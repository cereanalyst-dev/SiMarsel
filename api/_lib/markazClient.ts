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

async function markazGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const base = requireEnv('MARKAZ_API_BASE_URL').replace(/\/$/, '');
  const apiKey = requireEnv('MARKAZ_API_KEY');
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Markaz ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Date helper ----------

// WIB = UTC+7. Ambil tanggal "hari ini" menurut WIB sebagai "YYYY-MM-DD".
export function todayWIB(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

// ---------- Mapping ----------

function mapTransactionRow(t: MarkazTransaction, platform: string, userId: string) {
  const ts = (t.paid_date || t.date || '').replace('T', ' ').slice(0, 19) || null;
  const email = (t.customer_email || '').trim() || null;
  return {
    user_id: userId,
    trx_id: t.trx_id,
    source_app: platform,                // lowercase
    transaction_date: ts,
    payment_date: ts,
    methode_name: t.payment_method,
    revenue: Number(t.nominal) || 0,
    promo_code: null,
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

  // Sequential, bukan parallel, biar Markaz API gak kebanjiran request.
  const results: SyncPlatformResult[] = [];
  for (const p of platforms) {
    results.push(await syncPlatform({ admin, userId, platform: p, date }));
  }
  return results;
}
