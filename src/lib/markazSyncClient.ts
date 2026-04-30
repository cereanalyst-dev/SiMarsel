// ==============================================================
// Shared Markaz sync logic — dipakai oleh:
//   - MarkazApiCard (di tab Pengaturan Data) untuk konfigurasi platform
//   - TargetSection (di tab Strategi & Target) untuk inline fetch
//     langsung dari card platform
//
// Hook + helper di sini supaya gak duplikasi state/fetch logic
// antara dua komponen.
// ==============================================================

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { logger } from './logger';
import { format } from 'date-fns';

export interface MarkazSyncState {
  id: string;
  user_id: string;
  platform: string;
  enabled: boolean;
  last_run_at: string | null;
  last_synced_date: string | null;
  last_status: string | null;
  last_error: string | null;
  last_tx_inserted: number;
  last_dl_total: number;
  updated_at: string;
}

// Flat shape (semua field optional) — TypeScript narrowing dengan if (r.ok)
// kadang error pas type union dipakai dari hook. Flat lebih reliable.
export interface MarkazSyncResult {
  ok: boolean;
  successes?: number;
  errors?: number;
  totalPlatforms?: number;
  error?: string;
}

/**
 * Hook: fetch + auto-refresh daftar api_sync_state untuk user yg login.
 * Dipakai di MarkazApiCard (full management) + TargetSection (inline status).
 */
export function useMarkazSyncStates() {
  const [states, setStates] = useState<MarkazSyncState[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('api_sync_state')
      .select('*')
      .order('platform', { ascending: true });
    if (error) {
      logger.warn('Load api_sync_state:', error.message);
      setStates([]);
    } else {
      setStates((data ?? []) as MarkazSyncState[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { states, loading, refresh };
}

/**
 * Trigger fetch 1 platform dari Markaz API. Pakai endpoint
 * /api/markaz/sync-now dengan Bearer token user. Return result object
 * — caller decide UX (toast/notification).
 *
 * @param platform   nama platform (lowercase) — kalau undefined, fetch semua
 * @param syncDate   tanggal target dalam format YYYY-MM-DD
 */
export async function triggerMarkazSync(
  platform?: string,
  syncDate: string = format(new Date(), 'yyyy-MM-dd'),
): Promise<MarkazSyncResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase belum terkonfigurasi' };

  const { data: sessionRes } = await supabase.auth.getSession();
  const token = sessionRes?.session?.access_token;
  if (!token) return { ok: false, error: 'Sesi kamu tidak aktif — login dulu' };

  try {
    const res = await fetch('/api/markaz/sync-now', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: syncDate,
        ...(platform ? { platforms: [platform] } : {}),
      }),
    });

    if (res.status === 404) {
      return { ok: false, error: 'Endpoint belum tersedia (deploy dulu ke Vercel)' };
    }
    if (res.status === 504) {
      return { ok: false, error: 'Timeout (504) — Markaz API lambat, coba lagi' };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, error: `Respons invalid HTTP ${res.status}` };
    }
    if (!res.ok || !(body as { ok?: boolean }).ok) {
      const msg = (body as { error?: string }).error || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    const summary = body as {
      totalPlatforms: number;
      successes: number;
      errors: number;
    };
    return {
      ok: true,
      successes: summary.successes,
      errors: summary.errors,
      totalPlatforms: summary.totalPlatforms,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
