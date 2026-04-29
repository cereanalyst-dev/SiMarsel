// Client untuk Markaz API (https://markaz.cerehub.id/api).
// Dipakai oleh endpoint cron + endpoint manual "Fetch Sekarang".

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- Response types ----------

interface MarkazTransaction {
  id: number;
  trx_id: string;
  date: string;            // "YYYY-MM-DD HH:mm:ss"
  paid_date: string | null;
  payment_method: string | null;
  nominal: number;
  product: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: number;
  status_message: string;  // filter: hanya "Success" yang di-ingest
  // Field promo — Markaz mungkin pakai salah satu nama berikut.
  // Kalau response API beneran punya, kita map ke kolom promo_code di DB.
  promo_code?: string | null;
  voucher_code?: string | null;
  coupon_code?: string | null;
  discount_code?: string | null;
  promo?: string | null;
  voucher?: string | null;
}

interface TransactionResponse {
  status: boolean;
  message: string;
  data: MarkazTransaction[];
}

interface UserDailyResponse {
  status: boolean;
  message: string;
  data: { total: number };
}

// ---------- Low-level fetch ----------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Timeout per request ke Markaz biar function gak nunggu kelamaan kalau
// API lemot. 8 detik = balance antara reliability + kasih kesempatan
// API yg lambat untuk respond.
const MARKAZ_FETCH_TIMEOUT_MS = 8000;

async function markazGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const base = requireEnv('MARKAZ_API_BASE_URL').replace(/\/$/, '');
  const apiKey = requireEnv('MARKAZ_API_KEY');
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MARKAZ_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Markaz ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return await (res.json() as Promise<T>);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Markaz ${path} → timeout setelah ${MARKAZ_FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Date helper ----------

// WIB = UTC+7. Default ambil tanggal "hari ini" menurut WIB sebagai
// "YYYY-MM-DD". Optional daysAgo: 1 = kemarin, 2 = lusa, dst.
// Berguna untuk cron yang fire jam 00:00 WIB tapi mau fetch data hari
// sebelumnya (yang sudah lengkap, gak ada lagi transaksi yg masuk).
export function todayWIB(now: Date = new Date(), daysAgo: number = 0): string {
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000 - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

// ---------- Mapping ----------

function mapTransactionRow(t: MarkazTransaction, platform: string, userId: string) {
  const ts = (t.paid_date || t.date || '').replace('T', ' ').slice(0, 19) || null;
  const email = (t.customer_email || '').trim() || null;
  // Coba beberapa nama field — Markaz mungkin pakai salah satu di antaranya.
  // Kalau semua null/undefined, simpan null (akan jadi 'Tanpa Kode' di UI).
  const promoCode =
    t.promo_code ?? t.voucher_code ?? t.coupon_code ??
    t.discount_code ?? t.promo ?? t.voucher ?? null;
  return {
    user_id: userId,
    trx_id: t.trx_id,
    source_app: platform,                // lowercase
    transaction_date: ts,
    payment_date: ts,
    methode_name: t.payment_method,
    revenue: Number(t.nominal) || 0,
    promo_code: promoCode,
    content_name: t.product,
    full_name: t.customer_name,
    email,
    phone: t.customer_phone,
    payment_status: 'paid',
  };
}

// ---------- Main: fetch + upsert untuk 1 platform ----------

export interface SyncPlatformResult {
  platform: string;
  txFetched: number;
  txSuccessful: number;
  txInsertedEst: number;   // estimasi karena ignoreDuplicates tidak return count akurat
  dlTotal: number;
  error: string | null;
}

export async function syncPlatform(opts: {
  admin: SupabaseClient;
  userId: string;
  platform: string;
  date: string;
}): Promise<SyncPlatformResult> {
  const { admin, userId, platform, date } = opts;
  const out: SyncPlatformResult = {
    platform,
    txFetched: 0,
    txSuccessful: 0,
    txInsertedEst: 0,
    dlTotal: 0,
    error: null,
  };

  try {
    // ---------- 1) Transactions ----------
    const txRes = await markazGet<TransactionResponse>('/api/transaction', { date, platform });
    if (!txRes.status) throw new Error(`API /api/transaction status=false: ${txRes.message}`);
    const allTx = Array.isArray(txRes.data) ? txRes.data : [];
    out.txFetched = allTx.length;

    // Filter: hanya status_message === "Success"
    const successful = allTx.filter((t) => t.status_message === 'Success');
    out.txSuccessful = successful.length;

    if (successful.length > 0) {
      const rows = successful.map((t) => mapTransactionRow(t, platform, userId));
      // Dedupe berdasarkan UNIQUE(trx_id, content_name): kalau sudah ada → skip.
      const { error: txErr } = await admin
        .from('transactions')
        .upsert(rows, { onConflict: 'trx_id,content_name', ignoreDuplicates: true });
      if (txErr) throw new Error(`Upsert transactions: ${txErr.message}`);
      out.txInsertedEst = rows.length;
    }

    // ---------- 2) Downloaders (user-daily) ----------
    const dlRes = await markazGet<UserDailyResponse>('/api/user-daily', { date, platform });
    if (dlRes.status && dlRes.data && typeof dlRes.data.total === 'number') {
      out.dlTotal = dlRes.data.total;
      // Upsert: (date, source_app) sebagai PK → UPDATE count ke snapshot terbaru.
      const { error: dlErr } = await admin
        .from('downloaders')
        .upsert(
          [{
            date,
            source_app: platform,
            count: dlRes.data.total,
            user_id: userId,
          }],
          { onConflict: 'date,source_app' },
        );
      if (dlErr) throw new Error(`Upsert downloaders: ${dlErr.message}`);
    }

    // ---------- 3) Update api_sync_state ----------
    await admin
      .from('api_sync_state')
      .update({
        last_run_at: new Date().toISOString(),
        last_synced_date: date,            // tanggal DATA yang di-fetch (bukan kapan cron jalan)
        last_status: 'success',
        last_error: null,
        last_tx_inserted: out.txInsertedEst,
        last_dl_total: out.dlTotal,
      })
      .eq('user_id', userId)
      .eq('platform', platform);
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    // Best-effort update state (jangan throw lagi kalau gagal)
    try {
      await admin
        .from('api_sync_state')
        .update({
          last_run_at: new Date().toISOString(),
          last_synced_date: date,
          last_status: 'error',
          last_error: out.error,
        })
        .eq('user_id', userId)
        .eq('platform', platform);
    } catch {
      /* ignore secondary error */
    }
  }

  return out;
}

// ---------- Batch: sync semua platform yang enabled untuk 1 user ----------

export async function syncAllEnabled(opts: {
  admin: SupabaseClient;
  userId: string;
  date: string;
  platformsOverride?: string[];
}): Promise<SyncPlatformResult[]> {
  const { admin, userId, date, platformsOverride } = opts;

  let platforms: string[] = [];
  if (platformsOverride && platformsOverride.length > 0) {
    platforms = platformsOverride;
  } else {
    const { data, error } = await admin
      .from('api_sync_state')
      .select('platform')
      .eq('user_id', userId)
      .eq('enabled', true);
    if (error) throw new Error(`Load api_sync_state: ${error.message}`);
    platforms = (data ?? []).map((r) => r.platform);
  }

  if (platforms.length === 0) return [];

  // Parallel dengan concurrency limit. Sebelumnya sequential — 7 platform
  // × 4-5 detik = 28-35 detik, lewat batas Edge Hobby (25-30s) → 504.
  // Sekarang process 4 platform sekaligus → ±2 batch × 5 detik = ±10 detik.
  // Concurrency 4 = balance antara cepat tapi gak banjirin Markaz API.
  const CONCURRENCY = 4;
  const results: SyncPlatformResult[] = [];

  for (let i = 0; i < platforms.length; i += CONCURRENCY) {
    const batch = platforms.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((p) => syncPlatform({ admin, userId, platform: p, date })),
    );
    results.push(...batchResults);
  }

  return results;
}
