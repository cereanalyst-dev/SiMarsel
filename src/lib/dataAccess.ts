import type {
  AppData,
  Downloader,
  Transaction,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
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
    console.warn('Failed to load apps from localStorage:', err);
    return defaultApps();
  }
};

export const saveAppsToLocal = (apps: AppData[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
  } catch (err) {
    console.warn('Failed to persist apps to localStorage:', err);
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
    console.warn('Failed to fetch apps from Supabase:', error.message);
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
    console.warn('Failed to save apps to Supabase:', error.message);
    return false;
  }
  return true;
};

// ---------- Transactions + downloaders ----------

export interface DataSet {
  transactions: Transaction[];
  downloaders: Downloader[];
}

export const fetchDataFromSupabase = async (): Promise<DataSet | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[SiMarsel] Supabase client belum terkonfigurasi (VITE_SUPABASE_URL / ANON_KEY).');
    return null;
  }

  console.log('[SiMarsel] Fetching data dari Supabase…');

  const [{ data: txRows, error: txErr }, { data: dlRows, error: dlErr }] = await Promise.all([
    supabase.from('transactions').select('*').limit(MAX_ROWS_PER_QUERY),
    supabase.from('downloaders').select('*').limit(MAX_ROWS_PER_QUERY),
  ]);

  if (txErr) {
    console.error('[SiMarsel] ❌ Gagal fetch transactions:', txErr.message, txErr);
  } else {
    console.log(`[SiMarsel] ✅ transactions: ${txRows?.length ?? 0} baris`);
  }
  if (dlErr) {
    console.error('[SiMarsel] ❌ Gagal fetch downloaders:', dlErr.message, dlErr);
  } else {
    console.log(`[SiMarsel] ✅ downloaders: ${dlRows?.length ?? 0} baris`);
  }

  const rawTx = (txRows as unknown[] | null) ?? [];
  const rawDl = (dlRows as unknown[] | null) ?? [];

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

  console.log(
    `[SiMarsel] 📊 Processed: ${transactions.length} transactions, ${downloaders.length} downloaders (long format)`,
  );

  return { transactions, downloaders };
};

export const uploadTransactionsToSupabase = async (
  userId: string,
  rows: Transaction[],
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[SiMarsel] Skip upload transactions — Supabase belum terkonfigurasi.');
    return false;
  }
  if (rows.length === 0) {
    console.warn('[SiMarsel] Skip upload transactions — tidak ada baris.');
    return false;
  }
  console.log(`[SiMarsel] ⬆️ Uploading ${rows.length} transactions ke Supabase…`);

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

  // Chunk to avoid payload limits.
  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('transactions')
      .upsert(chunk, { onConflict: 'trx_id' });
    if (error) {
      console.error(
        `[SiMarsel] ❌ Upload transactions gagal di chunk ${i / chunkSize + 1}:`,
        error.message,
        error,
      );
      return false;
    }
  }
  console.log(`[SiMarsel] ✅ Upload ${rows.length} transactions selesai.`);
  return true;
};

export const uploadDownloadersToSupabase = async (
  userId: string,
  rows: Downloader[],
): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[SiMarsel] Skip upload downloaders — Supabase belum terkonfigurasi.');
    return false;
  }
  if (rows.length === 0) {
    console.warn('[SiMarsel] Skip upload downloaders — tidak ada baris.');
    return false;
  }
  console.log(`[SiMarsel] ⬆️ Uploading ${rows.length} downloader rows ke Supabase…`);

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
      console.error(
        `[SiMarsel] ❌ Upload downloaders gagal di chunk ${i / chunkSize + 1}:`,
        error.message,
        error,
      );
      return false;
    }
  }
  console.log(`[SiMarsel] ✅ Upload ${rows.length} downloader rows selesai.`);
  return true;
};

export const clearAllTransactionsInSupabase = async (): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('transactions').delete().neq('trx_id', '');
  await supabase.from('downloaders').delete().neq('source_app', '');
};

export { isSupabaseConfigured };
