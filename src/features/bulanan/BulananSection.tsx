import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import {
  BarChart3, Calendar, Loader2, Save, Trash2, Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/Toast';
import { logger } from '../../lib/logger';
import {
  deleteMonthlyPerformance, fetchMonthlyPerformance, upsertMonthlyPerformance,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  MonthlyPerformance, MonthlyStatusFilter, NewMonthlyPerformance,
} from '../../types';

// ============================================================
// Aggregate row hasil cleansing Excel
// ============================================================
interface AggRow {
  source_app: string;
  total_transaksi: number;
  total_berhasil: number;
  total_pending: number;
  total_expired: number;
  total_dibatalkan: number;
  conversion_rate: number;
  total_sales: number;
  harga_rata_rata: number;
}

const STATUS_OPTIONS: { value: MonthlyStatusFilter; label: string }[] = [
  { value: 'all',      label: 'Semua' },
  { value: 'berhasil', label: 'Berhasil' },
  { value: 'pending',  label: 'Pending' },
  { value: 'cancel',   label: 'Cancel' },
];

// Mapping kata di status_text Excel → enum
function classifyStatus(raw: unknown): 'berhasil' | 'pending' | 'expired' | 'dibatalkan' | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/(success|berhasil|paid|sukses|complete)/i.test(s)) return 'berhasil';
  if (/(pending|menunggu|wait)/i.test(s)) return 'pending';
  if (/(expired|kadaluarsa|expire)/i.test(s)) return 'expired';
  if (/(cancel|dibatalkan|canceled|gagal|failed)/i.test(s)) return 'dibatalkan';
  return null;
}

export const BulananSection = () => {
  const toast = useToast();
  const supabase = getSupabase();

  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [statusFilter, setStatusFilter] = useState<MonthlyStatusFilter>('all');

  const [aggregateRows, setAggregateRows] = useState<AggRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Existing snapshots dari DB
  const [savedRows, setSavedRows] = useState<MonthlyPerformance[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const refresh = useCallback(async () => {
    setLoadingSaved(true);
    const data = await fetchMonthlyPerformance({ yearMonth, statusFilter });
    setSavedRows(data);
    setLoadingSaved(false);
  }, [yearMonth, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ============================================================
  // Excel upload + cleansing + aggregate
  // ============================================================
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Ambil sheet pertama (atau yang nama-nya match TRANSAKSI/TRX/PAID)
      const targetSheet = wb.SheetNames.find(
        (n) => /(TRANSAKSI|TRX|PAID)/i.test(n),
      ) ?? wb.SheetNames[0];
      const sheet = wb.Sheets[targetSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length === 0) {
        toast.error('Excel kosong', 'Tidak ada baris yang bisa diproses.');
        setUploading(false);
        e.target.value = '';
        return;
      }

      // === CLEANSING: dedupe by trx_id ===
      const seenTrxIds = new Set<string>();
      const cleansedRows: typeof rows = [];
      let duplicateCount = 0;

      rows.forEach((row) => {
        const trxId = String(
          row.trx_id ?? row.trxId ?? row.transaction_id ?? row.id ?? '',
        ).trim();
        // Kalau gak ada trx_id, pakai composite key alternatif
        const dedupeKey = trxId || JSON.stringify({
          email: row.customer_email ?? row.email,
          tgl: row.date ?? row.tanggal,
          nominal: row.nominal ?? row.revenue,
        });
        if (seenTrxIds.has(dedupeKey)) {
          duplicateCount += 1;
          return;
        }
        seenTrxIds.add(dedupeKey);
        cleansedRows.push(row);
      });

      // === AGGREGATE per source_app ===
      // Apply status filter di sini juga
      const acc: Record<string, AggRow> = {};

      cleansedRows.forEach((row) => {
        const app = String(
          row.source_app ?? row.platform ?? row.aplikasi ?? '',
        ).trim().toLowerCase();
        if (!app) return;

        const status = classifyStatus(
          row.status_message ?? row.status ?? row.payment_status,
        );

        // Filter by status_filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'berhasil' && status !== 'berhasil') return;
          if (statusFilter === 'pending' && status !== 'pending') return;
          if (statusFilter === 'cancel' && status !== 'dibatalkan') return;
        }

        if (!acc[app]) {
          acc[app] = {
            source_app: app,
            total_transaksi: 0,
            total_berhasil: 0,
            total_pending: 0,
            total_expired: 0,
            total_dibatalkan: 0,
            conversion_rate: 0,
            total_sales: 0,
            harga_rata_rata: 0,
          };
        }
        const r = acc[app];
        r.total_transaksi += 1;
        if (status === 'berhasil')   r.total_berhasil += 1;
        if (status === 'pending')    r.total_pending += 1;
        if (status === 'expired')    r.total_expired += 1;
        if (status === 'dibatalkan') r.total_dibatalkan += 1;

        const nominal = Number(row.nominal ?? row.revenue ?? row.total ?? 0) || 0;
        // Total sales: cuma hitung kalau berhasil (yang dianggap revenue real)
        if (status === 'berhasil') r.total_sales += nominal;
      });

      // Compute conversion + avg price per app
      const list = Object.values(acc).map((r) => ({
        ...r,
        conversion_rate: r.total_transaksi > 0
          ? (r.total_berhasil / r.total_transaksi) * 100
          : 0,
        harga_rata_rata: r.total_berhasil > 0
          ? r.total_sales / r.total_berhasil
          : 0,
      })).sort((a, b) => b.total_sales - a.total_sales);

      setAggregateRows(list);
      toast.success(
        'Cleansing selesai',
        `${cleansedRows.length} unik · ${duplicateCount} duplikat di-skip · ${list.length} app`,
      );
    } catch (err) {
      logger.error('Upload bulanan gagal:', err);
      toast.error('Gagal proses file', err instanceof Error ? err.message : 'Cek format Excel.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ============================================================
  // Save snapshot ke DB
  // ============================================================
  const handleSave = async () => {
    if (aggregateRows.length === 0) {
      toast.warning('Belum ada hasil', 'Upload Excel dulu.');
      return;
    }
    if (!supabase) {
      toast.error('Supabase belum siap', 'Login dulu.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        toast.error('Harus login', 'Sesi expired.');
        return;
      }

      const payload: NewMonthlyPerformance[] = aggregateRows.map((r) => ({
        user_id: userId,
        year_month: yearMonth,
        source_app: r.source_app,
        status_filter: statusFilter,
        total_transaksi: r.total_transaksi,
        total_berhasil: r.total_berhasil,
        total_pending: r.total_pending,
        total_expired: r.total_expired,
        total_dibatalkan: r.total_dibatalkan,
        conversion_rate: Number(r.conversion_rate.toFixed(2)),
        total_sales: r.total_sales,
        harga_rata_rata: Number(r.harga_rata_rata.toFixed(2)),
      }));

      const result = await upsertMonthlyPerformance(payload);
      if (result.inserted > 0) {
        toast.success(
          'Snapshot tersimpan',
          `${result.inserted} app untuk ${yearMonth} (filter: ${statusFilter})`,
        );
        setAggregateRows([]); // clear preview
        void refresh();
      } else {
        toast.error('Save gagal', 'Coba lagi atau cek console.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MonthlyPerformance) => {
    if (!window.confirm(`Hapus snapshot ${row.source_app} untuk ${row.year_month}?`)) return;
    const ok = await deleteMonthlyPerformance(row.id);
    if (ok) {
      toast.success('Snapshot dihapus');
      void refresh();
    } else {
      toast.error('Gagal hapus');
    }
  };

  const previewRows = aggregateRows.length > 0 ? aggregateRows : null;
  const totalAcrossApps = useMemo(() => {
    if (!previewRows) return null;
    const t = {
      transaksi: 0, berhasil: 0, pending: 0, expired: 0, dibatalkan: 0, sales: 0,
    };
    previewRows.forEach((r) => {
      t.transaksi  += r.total_transaksi;
      t.berhasil   += r.total_berhasil;
      t.pending    += r.total_pending;
      t.expired    += r.total_expired;
      t.dibatalkan += r.total_dibatalkan;
      t.sales      += r.total_sales;
    });
    return t;
  }, [previewRows]);

  return (
    <motion.div
      key="bulanan"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Monthly Snapshot
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Performa Bulanan
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Upload Excel transaksi → otomatis cleanse duplikat + aggregate per
            app. Hanya hasil rekap yang tersimpan (raw transactions tidak disimpan).
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Year-month */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Bulan
            </label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {/* Status filter dropdown */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Status Transaksi
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MonthlyStatusFilter)}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Upload button */}
          <label className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest cursor-pointer transition-all',
            'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100',
            uploading && 'opacity-70 cursor-wait',
          )}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Memproses…' : 'Upload Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {/* Save button (kalau ada preview) */}
          {previewRows && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all',
                'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100',
                saving && 'opacity-70 cursor-wait',
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Menyimpan…' : 'Simpan Snapshot'}
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-3 max-w-xl">
          Cleansing: dedupe baris dengan <code className="bg-slate-100 px-1 rounded">trx_id</code> sama
          (atau composite email+tanggal+nominal kalau trx_id kosong). Filter <strong>Berhasil</strong>
          cuma hitung row dengan status_message = "Success".
        </p>
      </div>

      {/* Preview hasil cleansing (sebelum di-save) */}
      {previewRows && totalAcrossApps && (
        <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm overflow-hidden">
          <div className="px-7 py-5 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">
                  Preview · Belum Disimpan
                </p>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Hasil Cleansing &amp; Aggregate · {yearMonth}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAggregateRows([])}
              className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
            >
              Buang Preview
            </button>
          </div>

          <PerformanceTable rows={previewRows} totals={totalAcrossApps} />
        </div>
      )}

      {/* Saved snapshots dari DB */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                Tersimpan
              </p>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Snapshot · {yearMonth} · Filter: {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}
              </h3>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <Calendar className="w-3 h-3" />
            {savedRows.length} app
          </span>
        </div>

        {loadingSaved ? (
          <div className="py-12 text-center text-[11px] font-bold text-slate-400">Memuat…</div>
        ) : savedRows.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-amber-400" />
            </div>
            <h4 className="text-sm font-black text-slate-700 mb-1">Belum ada snapshot</h4>
            <p className="text-xs text-slate-400 font-medium">
              Upload Excel untuk bulan {yearMonth} (filter: {statusFilter}).
            </p>
          </div>
        ) : (
          <SavedTable rows={savedRows} onDelete={handleDelete} />
        )}
      </div>
    </motion.div>
  );
};

// ============================================================
// Performance Table — preview hasil cleansing
// ============================================================
function PerformanceTable({ rows, totals }: {
  rows: AggRow[];
  totals: { transaksi: number; berhasil: number; pending: number; expired: number; dibatalkan: number; sales: number };
}) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead className="bg-amber-100/40">
          <tr className="text-[9px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-100">
            <th className="py-4 px-5">Aplikasi</th>
            <th className="py-4 px-5 text-right">Total Transaksi</th>
            <th className="py-4 px-5 text-right">Berhasil</th>
            <th className="py-4 px-5 text-right">Pending</th>
            <th className="py-4 px-5 text-right">Expired</th>
            <th className="py-4 px-5 text-right">Dibatalkan</th>
            <th className="py-4 px-5 text-right">Conversion Rate</th>
            <th className="py-4 px-5 text-right">Total Sales</th>
            <th className="py-4 px-5 text-right">Harga Rata-rata</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = r.conversion_rate;
            const convClass = conv >= 70 ? 'text-emerald-600'
              : conv >= 50 ? 'text-amber-600'
              : 'text-rose-600';
            return (
              <tr key={r.source_app} className="border-b border-slate-50 hover:bg-amber-50/30 transition-colors">
                <td className="py-3.5 px-5 text-sm font-black text-slate-800 uppercase">{r.source_app}</td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-slate-700 tabular-nums">{formatNumber(r.total_transaksi)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-emerald-600 tabular-nums">{formatNumber(r.total_berhasil)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-amber-600 tabular-nums">{formatNumber(r.total_pending)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-slate-500 tabular-nums">{formatNumber(r.total_expired)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-rose-600 tabular-nums">{formatNumber(r.total_dibatalkan)}</td>
                <td className={cn('py-3.5 px-5 text-right text-sm font-black tabular-nums', convClass)}>
                  {conv.toFixed(0)}%
                </td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-slate-900 tabular-nums">{formatCurrency(r.total_sales)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-slate-600 tabular-nums">{formatCurrency(r.harga_rata_rata)}</td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-amber-100/60 border-t-2 border-amber-300">
            <td className="py-3.5 px-5 text-[10px] font-black text-amber-900 uppercase tracking-widest">TOTAL</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatNumber(totals.transaksi)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatNumber(totals.berhasil)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatNumber(totals.pending)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatNumber(totals.expired)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatNumber(totals.dibatalkan)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">
              {totals.transaksi > 0 ? `${((totals.berhasil / totals.transaksi) * 100).toFixed(0)}%` : '–'}
            </td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">{formatCurrency(totals.sales)}</td>
            <td className="py-3.5 px-5 text-right text-sm font-black text-amber-900 tabular-nums">
              {totals.berhasil > 0 ? formatCurrency(totals.sales / totals.berhasil) : '–'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SavedTable({ rows, onDelete }: {
  rows: MonthlyPerformance[];
  onDelete: (r: MonthlyPerformance) => void | Promise<void>;
}) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1100px]">
        <thead className="bg-slate-50/60">
          <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
            <th className="py-4 px-5">Aplikasi</th>
            <th className="py-4 px-5 text-right">Total Transaksi</th>
            <th className="py-4 px-5 text-right">Berhasil</th>
            <th className="py-4 px-5 text-right">Pending</th>
            <th className="py-4 px-5 text-right">Expired</th>
            <th className="py-4 px-5 text-right">Dibatalkan</th>
            <th className="py-4 px-5 text-right">Conversion</th>
            <th className="py-4 px-5 text-right">Total Sales</th>
            <th className="py-4 px-5 text-right">Harga Rata-rata</th>
            <th className="py-4 px-5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const conv = Number(r.conversion_rate);
            const convClass = conv >= 70 ? 'text-emerald-600' : conv >= 50 ? 'text-amber-600' : 'text-rose-600';
            return (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors group">
                <td className="py-3.5 px-5 text-sm font-black text-slate-800 uppercase">{r.source_app}</td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-slate-700 tabular-nums">{formatNumber(r.total_transaksi)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-emerald-600 tabular-nums">{formatNumber(r.total_berhasil)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-amber-600 tabular-nums">{formatNumber(r.total_pending)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-slate-500 tabular-nums">{formatNumber(r.total_expired)}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-rose-600 tabular-nums">{formatNumber(r.total_dibatalkan)}</td>
                <td className={cn('py-3.5 px-5 text-right text-sm font-black tabular-nums', convClass)}>
                  {conv.toFixed(0)}%
                </td>
                <td className="py-3.5 px-5 text-right text-sm font-black text-slate-900 tabular-nums">{formatCurrency(Number(r.total_sales))}</td>
                <td className="py-3.5 px-5 text-right text-sm font-bold text-slate-600 tabular-nums">{formatCurrency(Number(r.harga_rata_rata))}</td>
                <td className="py-3.5 px-5 text-right">
                  <button
                    type="button"
                    onClick={() => void onDelete(r)}
                    aria-label="Hapus snapshot"
                    className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default BulananSection;
