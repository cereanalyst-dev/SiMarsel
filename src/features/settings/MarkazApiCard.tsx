import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, CheckCircle2, Clock, Plus, RefreshCw, Trash2, Wifi, XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';
import { getSupabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { format } from 'date-fns';

interface SyncState {
  id: string;
  user_id: string;
  platform: string;
  enabled: boolean;
  last_run_at: string | null;          // kapan fetch dijalankan (timestamp)
  last_synced_date: string | null;     // TANGGAL DATA yg di-fetch (date param ke API Markaz)
  last_status: string | null;
  last_error: string | null;
  last_tx_inserted: number;
  last_dl_total: number;
  updated_at: string;
}

// Hasil fetch satu kali ke /api/markaz/sync-now.
// Pakai shape flat (semua field optional) supaya TypeScript narrowing
// dengan if (r.ok) tidak bermasalah saat type union dipakai inline.
interface SyncResult {
  ok: boolean;
  successes?: number;
  errors?: number;
  totalPlatforms?: number;
  error?: string;
}

interface MarkazApiCardProps {
  detectedPlatforms?: string[];
  // Dipanggil setelah sync sukses, biar dashboard di parent re-fetch
  // data dari Supabase tanpa user perlu refresh manual.
  onSyncComplete?: () => void | Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  error: 'text-rose-600 bg-rose-50 border-rose-100',
};

export const MarkazApiCard = ({ detectedPlatforms = [], onSyncComplete }: MarkazApiCardProps) => {
  const supabase = getSupabase();
  const toast = useToast();
  const [rows, setRows] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPlatform, setAddingPlatform] = useState('');
  const [syncDate, setSyncDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('api_sync_state')
      .select('*')
      .order('platform', { ascending: true });
    if (error) {
      logger.error('Load api_sync_state:', error);
      toast.error('Gagal load config', error.message);
    } else {
      setRows((data ?? []) as SyncState[]);
    }
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Suggest platforms yang ada di DB tapi belum di-config
  const suggestedPlatforms = useMemo(() => {
    const existing = new Set(rows.map((r) => r.platform.toLowerCase()));
    return detectedPlatforms
      .map((p) => p.toLowerCase())
      .filter((p) => p && !existing.has(p));
  }, [rows, detectedPlatforms]);

  const addPlatform = async (rawName: string) => {
    const platform = rawName.trim().toLowerCase();
    if (!platform) return;
    if (!supabase) {
      toast.error('Supabase belum terkonfigurasi', 'Isi VITE_SUPABASE_URL / ANON_KEY.');
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      toast.error('Harus login dulu', 'Masuk dengan akun kamu untuk atur config.');
      return;
    }
    const { error } = await supabase
      .from('api_sync_state')
      .upsert(
        { user_id: uid, platform, enabled: true },
        { onConflict: 'user_id,platform' },
      );
    if (error) {
      toast.error('Gagal tambah platform', error.message);
      return;
    }
    toast.success('Platform ditambahkan', platform);
    setAddingPlatform('');
    void refresh();
  };

  const toggleEnabled = async (row: SyncState, next: boolean) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('api_sync_state')
      .update({ enabled: next })
      .eq('id', row.id);
    if (error) {
      toast.error('Gagal update', error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: next } : r)));
  };

  const removeRow = async (row: SyncState) => {
    if (!supabase) return;
    if (!window.confirm(`Hapus config untuk "${row.platform}"?`)) return;
    const { error } = await supabase
      .from('api_sync_state')
      .delete()
      .eq('id', row.id);
    if (error) {
      toast.error('Gagal hapus', error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  // Progress untuk "Fetch Semua" sequential
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    platform: string;
  } | null>(null);

  // Inti: 1 platform per HTTP call. Returns result object — caller decide
  // apa mau kasih toast atau gak (silent in batch mode).
  const fetchOnePlatform = async (platform?: string): Promise<SyncResult> => {
    if (!supabase) return { ok: false, error: 'Supabase belum terkonfigurasi' };
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;
    if (!token) return { ok: false, error: 'Sesi kamu tidak aktif' };

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
        return { ok: false, error: 'Endpoint belum tersedia (deploy dulu)' };
      }
      if (res.status === 504) {
        return { ok: false, error: 'Timeout (504) — Markaz API lambat' };
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
  };

  // Fetch satu platform spesifik (button kecil di row)
  const callSyncOne = async (platform: string) => {
    const r = await fetchOnePlatform(platform);
    if (r.ok) {
      const s = r.successes ?? 0;
      const e = r.errors ?? 0;
      toast.success('Sinkronisasi selesai', `${platform}: ${s} sukses • ${e} error`);
      void refresh();
      if (onSyncComplete && s > 0) void onSyncComplete();
    } else {
      toast.error(`Gagal fetch ${platform}`, r.error ?? 'Unknown error');
      void refresh();
    }
  };

  // Fetch SEMUA platform — sequential satu-satu biar gak kena 504.
  // Setiap platform = 1 HTTP call ke /api/markaz/sync-now (durasi ~5 detik
  // per call, well within Vercel timeout).
  const callSyncAll = async () => {
    const enabled = rows.filter((r) => r.enabled);
    if (enabled.length === 0) {
      toast.warning('Tidak ada platform aktif', 'Toggle ON dulu salah satu.');
      return;
    }

    let totalSuccess = 0;
    const errors: string[] = [];

    for (let i = 0; i < enabled.length; i += 1) {
      const row = enabled[i];
      setProgress({ current: i + 1, total: enabled.length, platform: row.platform });
      const r = await fetchOnePlatform(row.platform);
      if (r.ok) {
        totalSuccess += r.successes ?? 0;
        if ((r.errors ?? 0) > 0) errors.push(`${row.platform}: ${r.errors} error internal`);
      } else {
        errors.push(`${row.platform}: ${r.error ?? 'Unknown error'}`);
      }
      // Refresh setiap platform selesai biar UI update incrementally
      void refresh();
    }

    setProgress(null);

    if (errors.length > 0) {
      logger.error('Sync errors:', errors);
      toast.error(
        `${totalSuccess} sukses · ${errors.length} error`,
        errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} error lain — cek console)` : ''),
      );
    } else {
      toast.success(
        'Semua platform selesai',
        `${enabled.length} platform · ${totalSuccess} sukses tanpa error`,
      );
    }

    if (onSyncComplete && totalSuccess > 0) void onSyncComplete();
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-1 h-12 rounded-full bg-gradient-to-b from-cyan-500 via-indigo-500 to-violet-500" />
        <div className="flex-1">
          <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.25em] mb-1">
            Auto Sync
          </p>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Koneksi API Markaz
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-xl">
            Dashboard otomatis menarik data transaksi &amp; downloader dari{' '}
            <span className="font-black text-slate-700">markaz.cerehub.id</span> dua kali sehari
            (jam 12:00 &amp; 23:59 WIB). Kamu bisa trigger manual kapan saja.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100">
          <Wifi className="w-3 h-3 text-cyan-600" />
          <span className="text-[9px] font-black text-cyan-700 uppercase tracking-widest">
            Cron aktif di Vercel
          </span>
        </div>
      </div>

      {/* Controls: date + run all */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
            Tanggal yang di-sync
          </label>
          <input
            type="date"
            value={syncDate}
            onChange={(e) => setSyncDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="button"
          disabled={syncingAll || rows.filter((r) => r.enabled).length === 0}
          onClick={async () => {
            setSyncingAll(true);
            try {
              await callSyncAll();
            } finally {
              setSyncingAll(false);
            }
          }}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all',
            'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700',
            'disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed',
          )}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncingAll && 'animate-spin')} />
          {syncingAll ? 'Sync berjalan…' : 'Fetch Semua Platform'}
        </button>
      </div>

      {/* Progress bar untuk Fetch Semua sequential */}
      {progress && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
              Memproses {progress.current}/{progress.total} · {progress.platform}
            </p>
            <p className="text-[10px] font-black text-indigo-700 tabular-nums">
              {Math.round((progress.current / progress.total) * 100)}%
            </p>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Add platform */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-cyan-50/60 border border-indigo-100/60 mb-6">
        <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-3">
          Tambah Platform
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestedPlatforms.length === 0 ? (
            <span className="text-[10px] font-medium text-slate-400">
              Tidak ada platform baru yang terdeteksi di database.
            </span>
          ) : (
            suggestedPlatforms.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void addPlatform(p)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-indigo-200 text-[10px] font-black text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
              >
                <Plus className="w-3 h-3" />
                {p}
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={addingPlatform}
            onChange={(e) => setAddingPlatform(e.target.value)}
            placeholder="atau ketik manual: jadibumn, cerebrum, …"
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 placeholder:font-medium"
          />
          <button
            type="button"
            disabled={!addingPlatform.trim()}
            onClick={() => void addPlatform(addingPlatform)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
          >
            Tambah
          </button>
        </div>
      </div>

      {/* Platform list */}
      {loading ? (
        <div className="py-12 text-center text-[11px] font-bold text-slate-400">
          Memuat konfigurasi…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-xs font-bold text-slate-500">Belum ada platform terkonfigurasi.</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Tambah platform di atas untuk mulai auto-sync.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const statusKey = row.last_status ?? '';
            const statusBadge = STATUS_COLORS[statusKey] ?? 'text-slate-500 bg-slate-50 border-slate-100';
            const isSyncingThis = syncingId === row.id;
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all"
              >
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => void toggleEnabled(row, !row.enabled)}
                      aria-pressed={row.enabled}
                      aria-label={`Toggle ${row.platform}`}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                        row.enabled ? 'bg-emerald-500' : 'bg-slate-200',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                          row.enabled ? 'left-5' : 'left-0.5',
                        )}
                      />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {row.platform}
                        </h4>
                        {row.last_status === 'success' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {row.last_status === 'error' && (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-bold text-slate-400">
                        {/* Tanggal DATA terakhir yang di-fetch (parameter date ke Markaz) */}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span className="text-slate-300">Data terakhir:</span>
                          <span className="text-slate-700">
                            {row.last_synced_date
                              ? format(new Date(row.last_synced_date), 'dd MMM yyyy')
                              : 'Belum pernah'}
                          </span>
                        </span>
                        {/* Kapan fetch terakhir dijalankan */}
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1" title="Kapan fetch dijalankan">
                          <Clock className="w-3 h-3" />
                          {row.last_run_at
                            ? format(new Date(row.last_run_at), 'dd MMM, HH:mm')
                            : '–'}
                        </span>
                        {row.last_status && (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border',
                              statusBadge,
                            )}
                          >
                            {row.last_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSyncingThis}
                      onClick={async () => {
                        setSyncingId(row.id);
                        try {
                          await callSyncOne(row.platform);
                        } finally {
                          setSyncingId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 transition-all"
                    >
                      <RefreshCw className={cn('w-3 h-3', isSyncingThis && 'animate-spin')} />
                      Fetch
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRow(row)}
                      aria-label={`Hapus ${row.platform}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {row.last_error && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1">
                      Error terakhir
                    </p>
                    <p className="text-[11px] font-medium text-rose-600 break-words">
                      {row.last_error}
                    </p>
                  </div>
                )}

                {(row.last_tx_inserted > 0 || row.last_dl_total > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md uppercase tracking-widest">
                      {row.last_tx_inserted.toLocaleString('id-ID')} transaksi di-ingest
                    </span>
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md uppercase tracking-widest">
                      {row.last_dl_total.toLocaleString('id-ID')} downloader (snapshot)
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarkazApiCard;
