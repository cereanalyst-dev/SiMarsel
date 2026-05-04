import type {
  AppData,
  ContentScript,
  ContentStatus,
  ContentType,
  Downloader,
  KpiCard,
  KpiMetric,
  MonthlyPerformance,
  MonthlyStatusFilter,
  NewContentScript,
  NewKpiCard,
  NewKpiMetric,
  NewMonthlyPerformance,
  NewTask,
  Task,
  Transaction,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { logger } from './logger';
import {
  APPS_STORAGE_KEY,
  MAX_ROWS_PER_QUERY,
  SELECTED_APP_STORAGE_KEY,
} from '../config/app.config';
import { processDownloaders, processTransactions } from './dataProcessing';

// ---------- Apps (operational data) ----------

const defaultApps = (): AppData[] => [
  {
    id: '1',
    name: 'App Utama',
    targetConfig: {},
    dailyData: {},
    isTargetSet: {},
  },
];

// Heuristic migration: older versions stored targetConfig as a flat object
// (not keyed by month). Reset it to an empty map so the UI does not blow up.
const migrateApp = (app: unknown): AppData => {
  const a = app as AppData;
  const targetConfig =
    a.targetConfig && typeof a.targetConfig === 'object' && !Array.isArray(a.targetConfig)
      ? a.targetConfig
      : {};
  // If any key does not look like YYYY-MM, treat whole config as legacy shape.
  const keys = Object.keys(targetConfig);
  const looksLikeMonthMap = keys.every((k) => /^\d{4}-\d{2}$/.test(k));
  return {
    id: a.id || crypto.randomUUID(),
    name: a.name || 'App',
    targetConfig: looksLikeMonthMap ? targetConfig : {},
    dailyData: a.dailyData || {},
    isTargetSet:
      a.isTargetSet && typeof a.isTargetSet === 'object' && !Array.isArray(a.isTargetSet)
        ? (a.isTargetSet as Record<string, boolean>)
        : {},
  };
};

export const loadAppsFromLocal = (): AppData[] => {
  if (typeof window === 'undefined') return defaultApps();
  try {
    const raw = window.localStorage.getItem(APPS_STORAGE_KEY);
    if (!raw) return defaultApps();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultApps();
    return parsed.map(migrateApp);
  } catch (err) {
    logger.warn('Failed to load apps from localStorage:', err);
    return defaultApps();
  }
};

export const saveAppsToLocal = (apps: AppData[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
  } catch (err) {
    logger.warn('Failed to persist apps to localStorage:', err);
  }
};

export const loadSelectedAppIdFromLocal = (fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(SELECTED_APP_STORAGE_KEY);
    return raw || fallback;
  } catch {
    return fallback;
  }
};

export const saveSelectedAppIdToLocal = (id: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SELECTED_APP_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
};

// ---------- Supabase-backed apps ----------

interface AppsRow {
  user_id: string;
  apps: AppData[];
  updated_at?: string;
}

export const fetchAppsFromSupabase = async (userId: string): Promise<AppData[] | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('apps_snapshot')
    .select('apps')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.warn('Failed to fetch apps from Supabase:', error.message);
    return null;
  }
  if (!data) return null;
  const rows = (data as unknown as AppsRow).apps;
  if (!Array.isArray(rows)) return null;
  return rows.map(migrateApp);
};

export const saveAppsToSupabase = async (
  userId: string,
  apps: AppData[],
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('apps_snapshot')
    .upsert({ user_id: userId, apps }, { onConflict: 'user_id' });
  if (error) {
    logger.warn('Failed to save apps to Supabase:', error.message);
    return false;
  }
  return true;
};

// ---------- Transactions + downloaders ----------

export interface DataSet {
  transactions: Transaction[];
  downloaders: Downloader[];
}

// Supabase PostgREST default membatasi sekitar 1000 baris per request.
// Kita paginate manual pakai .range() supaya bisa ambil full dataset.
// PENTING: HARUS .order() pakai kolom unik — kalau tidak, urutan row antar
// request tidak deterministik, jadi range(0-999) & range(1000-1999) bisa
// overlap atau skip rows. Hasilnya state browser punya duplikat +
// distinct email turun padahal total rows match.
const PAGE_SIZE = 1000;

// Berapa request paralel sekaligus ke Supabase. Lebih besar = lebih cepat
// tapi mendekati rate limit. 8 = sweet spot (285 page = ~36 batch ~3-5 detik
// vs ~28 detik kalau sequential).
const FETCH_CONCURRENCY = 8;

export type FetchProgressCallback = (loaded: number, label: string) => void;

async function fetchAllPages<T>(
  supabase: ReturnType<typeof getSupabase>,
  tableName: 'transactions' | 'downloaders',
  label: string,
  onProgress?: FetchProgressCallback,
): Promise<T[]> {
  if (!supabase) return [];
  const rows: T[] = [];
  const startedAt = performance.now();

  // Order column harus deterministik + indexed:
  //   transactions: id (uuid PK)
  //   downloaders:  date + source_app (composite PK)
  const orderColumn = tableName === 'transactions' ? 'id' : 'date';

  let nextPage = 0;
  let done = false;

  while (!done) {
    // Build N request paralel sekaligus.
    const batch = Array.from({ length: FETCH_CONCURRENCY }, (_, i) => {
      const pageIdx = nextPage + i;
      const query = supabase
        .from(tableName)
        .select('*')
        .order(orderColumn, { ascending: true });

      if (tableName === 'downloaders') {
        query.order('source_app', { ascending: true });
      }

      const from = pageIdx * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      return query.range(from, to).then((res) => ({ pageIdx, res }));
    });

    const results = await Promise.all(batch);

    // Sort by page index supaya append ke rows[] tetap urut sesuai order.
    results.sort((a, b) => a.pageIdx - b.pageIdx);

    for (const { pageIdx, res } of results) {
      const { data, error } = res;
      if (error) {
        logger.error(
          `❌ Gagal fetch ${label} (page ${pageIdx}):`,
          error.message,
          error,
        );
        done = true;
        break;
      }
      if (!data) continue;
      rows.push(...(data as T[]));
      onProgress?.(rows.length, label);
      // Page < PAGE_SIZE = halaman terakhir.
      if (data.length < PAGE_SIZE) {
        done = true;
      }
    }

    nextPage += FETCH_CONCURRENCY;

    if (rows.length >= MAX_ROWS_PER_QUERY) {
      logger.warn(
        `⚠️ ${label} sudah mencapai batas MAX_ROWS_PER_QUERY (${MAX_ROWS_PER_QUERY}). Naikkan di config/app.config.ts kalau perlu.`,
      );
      break;
    }
  }

  const ms = Math.round(performance.now() - startedAt);
  logger.info(`✅ ${label}: ${rows.length} baris (${ms}ms, parallel x${FETCH_CONCURRENCY})`);
  return rows;
}

export const fetchDataFromSupabase = async (
  onProgress?: FetchProgressCallback,
): Promise<DataSet | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    logger.warn('Supabase client belum terkonfigurasi (VITE_SUPABASE_URL / ANON_KEY).');
    return null;
  }

  logger.info('Fetching data dari Supabase (paginated paralel)…');

  const [txRows, dlRows] = await Promise.all([
    fetchAllPages<unknown>(supabase, 'transactions', 'transactions', onProgress),
    fetchAllPages<unknown>(supabase, 'downloaders', 'downloaders', onProgress),
  ]);

  const rawTx = txRows ?? [];
  const rawDl = dlRows ?? [];

  // The DB stores normalized rows already, but we still need derived fields.
  const transactions = processTransactions(rawTx);

  // For downloader rows the DB shape is { date, source_app, count }.
  // processDownloaders expects the wide "tanggal / <app1> / <app2>" shape.
  // Build a synthetic map so we reuse the same derive logic.
  const dlByDate = new Map<string, Record<string, unknown>>();
  (rawDl as { date: string; source_app: string; count: number }[]).forEach((r) => {
    const key = r.date;
    const existing = dlByDate.get(key) || { Tanggal: r.date };
    existing[r.source_app] = r.count;
    dlByDate.set(key, existing);
  });
  const downloaders = processDownloaders(Array.from(dlByDate.values()));

  logger.info(
    `📊 Processed: ${transactions.length} transactions, ${downloaders.length} downloaders (long format)`,
  );

  return { transactions, downloaders };
};

// ---------- Quick overview stats (server-side aggregated) ----------
//
// View `overview_stats` mengembalikan single-row aggregate dari DB,
// jadi instant (~50ms) tidak peduli ada 285K rows. Dipakai untuk render
// headline cards di Overview tanpa harus tunggu raw data 285K rows
// di-download dulu.

export interface QuickOverviewStats {
  totalRevenue: number;
  totalTransactions: number;
  aov: number;
  uniqueBuyers: number;
  totalRepeatOrderUsers: number;
  totalRealDownloader: number;
  konversiPct: number;
}

export const fetchOverviewStats = async (): Promise<QuickOverviewStats | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const startedAt = performance.now();
  const { data, error } = await supabase
    .from('overview_stats')
    .select('*')
    .maybeSingle();

  if (error) {
    logger.warn('overview_stats fetch failed:', error.message);
    return null;
  }
  if (!data) return null;

  const ms = Math.round(performance.now() - startedAt);
  logger.info(`⚡ overview_stats: ${ms}ms (server-side aggregated)`);

  const r = data as Record<string, number | null>;
  return {
    totalRevenue: Number(r.total_revenue) || 0,
    totalTransactions: Number(r.total_transaksi) || 0,
    aov: Number(r.aov) || 0,
    uniqueBuyers: Number(r.unique_buyers) || 0,
    totalRepeatOrderUsers: Number(r.user_repeat_order) || 0,
    totalRealDownloader: Number(r.total_downloader) || 0,
    konversiPct: Number(r.konversi_pct) || 0,
  };
};

export interface UploadProgress {
  stage: 'deleting' | 'uploading' | 'done';
  current: number;
  total: number;
  label: string;
}

export type UploadProgressCallback = (p: UploadProgress) => void;

export const uploadTransactionsToSupabase = async (
  userId: string,
  rows: Transaction[],
  replaceMode: boolean = false,
  onProgress?: UploadProgressCallback,
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    logger.warn('Skip upload transactions — Supabase belum terkonfigurasi.');
    return false;
  }
  if (rows.length === 0) {
    logger.warn('Skip upload transactions — tidak ada baris.');
    return false;
  }

  if (replaceMode) {
    logger.info('🗑️ Ganti Data Total → delete transactions lama dulu…');
    onProgress?.({ stage: 'deleting', current: 0, total: rows.length, label: 'Menghapus data lama…' });
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .not('id', 'is', null);
    if (delErr) {
      logger.error('❌ Gagal delete transactions lama:', delErr.message, delErr);
      return false;
    }
  }

  logger.info(`⬆️ Uploading ${rows.length} transactions ke Supabase…`);
  onProgress?.({ stage: 'uploading', current: 0, total: rows.length, label: 'Mengunggah transactions…' });

  // Strip derived fields before sending. transaction_date & payment_date
  // sudah di-format "YYYY-MM-DD HH:mm:ss" (lokal) oleh processTransactions,
  // jadi langsung dikirim apa adanya ke kolom timestamp (without time zone).
  const payload = rows.map((r) => ({
    trx_id: r.trx_id,
    source_app: r.source_app,
    methode_name: r.methode_name,
    revenue: r.revenue,
    promo_code: r.promo_code,
    content_name: r.content_name,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    payment_status: r.payment_status,
    transaction_date: r.transaction_date,
    payment_date: r.payment_date,
    user_id: userId,
  }));

  // Chunk besar = lebih cepat. Supabase bisa handle ~1000 rows per request.
  //
  // Strategi dedup:
  //   • replaceMode=true ("Ganti Data Total")  → kita sudah DELETE semua di
  //     atas, jadi sekarang tinggal INSERT biasa.
  //   • replaceMode=false ("Tambah Data")      → UPSERT dengan
  //     onConflict=(trx_id, content_name) + ignoreDuplicates=true. Artinya:
  //       - Baris dengan pasangan (trx_id, content_name) yang belum ada → masuk.
  //       - Baris yang pasangannya sudah ada → DI-SKIP (tidak jadi duplikat).
  //     Butuh unique constraint di kolom (trx_id, content_name) — ada di schema.sql.
  const chunkSize = 1000;
  const totalChunks = Math.ceil(payload.length / chunkSize);
  const startedAt = performance.now();

  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunkIndex = Math.floor(i / chunkSize) + 1;
    const chunk = payload.slice(i, i + chunkSize);

    const query = replaceMode
      ? supabase.from('transactions').insert(chunk)
      : supabase.from('transactions').upsert(chunk, {
          onConflict: 'trx_id,content_name',
          ignoreDuplicates: true,
        });

    const { error } = await query;
    if (error) {
      logger.error(
        `❌ Upload transactions gagal di chunk ${chunkIndex}/${totalChunks}:`,
        error.message,
        error,
      );
      return false;
    }
    const current = Math.min(i + chunkSize, payload.length);
    onProgress?.({
      stage: 'uploading',
      current,
      total: rows.length,
      label: `Mengunggah chunk ${chunkIndex}/${totalChunks}`,
    });
    if (chunkIndex % 10 === 0 || chunkIndex === totalChunks) {
      logger.info(`⏳ transactions chunk ${chunkIndex}/${totalChunks} done (${current}/${payload.length})`);
    }
  }
  const ms = Math.round(performance.now() - startedAt);
  const modeLabel = replaceMode ? 'INSERT' : 'UPSERT (skip duplicates)';
  logger.info(
    `✅ Upload ${rows.length} transactions selesai (${ms}ms, mode: ${modeLabel}).`,
  );
  onProgress?.({ stage: 'done', current: rows.length, total: rows.length, label: 'Selesai' });
  return true;
};

export const uploadDownloadersToSupabase = async (
  userId: string,
  rows: Downloader[],
  replaceMode: boolean = false,
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    logger.warn('Skip upload downloaders — Supabase belum terkonfigurasi.');
    return false;
  }
  if (rows.length === 0) {
    logger.warn('Skip upload downloaders — tidak ada baris.');
    return false;
  }

  if (replaceMode) {
    logger.info('🗑️ Ganti Data Total → delete downloaders lama dulu…');
    const { error: delErr } = await supabase
      .from('downloaders')
      .delete()
      .not('source_app', 'is', null);
    if (delErr) {
      logger.error('❌ Gagal delete downloaders lama:', delErr.message, delErr);
      return false;
    }
  }

  logger.info(`⬆️ Uploading ${rows.length} downloader rows ke Supabase…`);

  // Pakai komponen lokal supaya date di DB = date di Excel (tidak geser via UTC).
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const payload = rows.map((r) => ({
    date: toLocalDate(r.parsed_date),
    source_app: r.source_app,
    count: r.count,
    user_id: userId,
  }));

  const chunkSize = 1000;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('downloaders')
      .upsert(chunk, { onConflict: 'date,source_app' });
    if (error) {
      logger.error(
        `❌ Upload downloaders gagal di chunk ${i / chunkSize + 1}:`,
        error.message,
        error,
      );
      return false;
    }
  }
  logger.info(`✅ Upload ${rows.length} downloader rows selesai.`);
  return true;
};

export const clearAllTransactionsInSupabase = async (): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('transactions').delete().not('id', 'is', null);
  await supabase.from('downloaders').delete().not('source_app', 'is', null);
};

// ============================================================
// Content Scripts (Manajemen Konten)
// ============================================================

export interface ContentListFilter {
  platform?: string;
  type?: ContentType;
  status?: ContentStatus;
}

export const fetchContentScripts = async (
  filter: ContentListFilter = {},
): Promise<ContentScript[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('content_scripts')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filter.platform) query = query.eq('platform', filter.platform);
  if (filter.type) query = query.eq('type', filter.type);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) {
    logger.error('Fetch content_scripts gagal:', error.message);
    return [];
  }
  return (data ?? []) as ContentScript[];
};

export const createContentScript = async (
  payload: NewContentScript,
): Promise<ContentScript | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('content_scripts')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logger.error('Create content_script gagal:', error.message);
    return null;
  }
  return data as ContentScript;
};

export const updateContentScript = async (
  id: string,
  patch: Partial<NewContentScript>,
): Promise<ContentScript | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('content_scripts')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error('Update content_script gagal:', error.message);
    return null;
  }
  return data as ContentScript;
};

export const deleteContentScript = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('content_scripts')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Delete content_script gagal:', error.message);
    return false;
  }
  return true;
};

// Bulk insert untuk import dari Excel.
export const bulkInsertContentScripts = async (
  rows: NewContentScript[],
): Promise<{ inserted: number; failed: number }> => {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return { inserted: 0, failed: 0 };

  // Chunk biar gak kebanyakan dalam 1 request.
  const chunkSize = 200;
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('content_scripts').insert(chunk);
    if (error) {
      logger.error(`Bulk insert content_scripts chunk ${i / chunkSize + 1} gagal:`, error.message);
      failed += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, failed };
};

// ============================================================
// Monthly Performance (snapshot rekap bulanan per app)
// ============================================================

export interface MonthlyPerfFilter {
  yearMonth?: string;
  statusFilter?: MonthlyStatusFilter;
}

export const fetchMonthlyPerformance = async (
  filter: MonthlyPerfFilter = {},
): Promise<MonthlyPerformance[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from('monthly_performance')
    .select('*')
    .order('year_month', { ascending: false })
    .order('source_app', { ascending: true });
  if (filter.yearMonth) query = query.eq('year_month', filter.yearMonth);
  if (filter.statusFilter) query = query.eq('status_filter', filter.statusFilter);
  const { data, error } = await query;
  if (error) {
    logger.error('Fetch monthly_performance gagal:', error.message);
    return [];
  }
  return (data ?? []) as MonthlyPerformance[];
};

// Upsert batch — pakai unique(user_id, year_month, source_app, status_filter).
// Re-upload di bulan yg sama akan UPDATE row existing, bukan duplikasi.
export const upsertMonthlyPerformance = async (
  rows: NewMonthlyPerformance[],
): Promise<{ inserted: number; failed: number }> => {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return { inserted: 0, failed: 0 };
  const { error } = await supabase
    .from('monthly_performance')
    .upsert(rows, { onConflict: 'user_id,year_month,source_app,status_filter' });
  if (error) {
    logger.error('Upsert monthly_performance gagal:', error.message);
    return { inserted: 0, failed: rows.length };
  }
  return { inserted: rows.length, failed: 0 };
};

export const deleteMonthlyPerformance = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('monthly_performance')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Delete monthly_performance gagal:', error.message);
    return false;
  }
  return true;
};

// ============================================================
// Tasks (Kanban tasklist)
// ============================================================

export const fetchTasks = async (): Promise<Task[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Fetch tasks gagal:', error.message);
    return [];
  }
  return (data ?? []) as Task[];
};

export const createTask = async (payload: NewTask): Promise<Task | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logger.error('Create task gagal:', error.message);
    return null;
  }
  return data as Task;
};

export const updateTask = async (
  id: string,
  patch: Partial<NewTask>,
): Promise<Task | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error('Update task gagal:', error.message);
    return null;
  }
  return data as Task;
};

export const deleteTask = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) {
    logger.error('Delete task gagal:', error.message);
    return false;
  }
  return true;
};

// ============================================================
// KPI cards + metrics
// ============================================================

export const fetchKpiCards = async (): Promise<KpiCard[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kpi_cards')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Fetch KPI cards gagal:', error.message);
    return [];
  }
  return (data ?? []) as KpiCard[];
};

export const createKpiCard = async (payload: NewKpiCard): Promise<KpiCard | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('kpi_cards')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logger.error('Create KPI card gagal:', error.message);
    return null;
  }
  return data as KpiCard;
};

export const updateKpiCard = async (
  id: string,
  patch: Partial<NewKpiCard>,
): Promise<KpiCard | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('kpi_cards')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error('Update KPI card gagal:', error.message);
    return null;
  }
  return data as KpiCard;
};

export const deleteKpiCard = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('kpi_cards').delete().eq('id', id);
  if (error) {
    logger.error('Delete KPI card gagal:', error.message);
    return false;
  }
  return true;
};

export const fetchKpiMetrics = async (cardId: string): Promise<KpiMetric[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kpi_metrics')
    .select('*')
    .eq('card_id', cardId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('Fetch KPI metrics gagal:', error.message);
    return [];
  }
  return (data ?? []) as KpiMetric[];
};

export const createKpiMetric = async (payload: NewKpiMetric): Promise<KpiMetric | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('kpi_metrics')
    .insert(payload)
    .select()
    .single();
  if (error) {
    logger.error('Create KPI metric gagal:', error.message);
    return null;
  }
  return data as KpiMetric;
};

export const updateKpiMetric = async (
  id: string,
  patch: Partial<NewKpiMetric>,
): Promise<KpiMetric | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('kpi_metrics')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error('Update KPI metric gagal:', error.message);
    return null;
  }
  return data as KpiMetric;
};

export const deleteKpiMetric = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('kpi_metrics').delete().eq('id', id);
  if (error) {
    logger.error('Delete KPI metric gagal:', error.message);
    return false;
  }
  return true;
};

export { isSupabaseConfigured };
