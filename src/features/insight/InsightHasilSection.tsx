import {
  useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent,
} from 'react';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, Download, Eye, Link as LinkIcon, MousePointerClick, Plus,
  Smartphone, Sparkles, Trash2, TrendingUp, Upload, Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/Toast';
import {
  bulkUploadInsightHasil, deleteInsightHasil,
  downloadInsightHasilTemplate, fetchInsightHasil, upsertInsightHasil,
} from '../../lib/insightHasilClient';
import type { AppData, InsightHasil, NewInsightHasil } from '../../types';

interface Props {
  userId: string | null;
  apps: AppData[];
}

const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X', 'YouTube', 'LinkedIn'];

const emptyInput = (): NewInsightHasil => ({
  app_name: '',
  platform: 'Instagram',
  date: format(new Date(), 'yyyy-MM-dd'),
  tayangan: 0,
  jangkauan: 0,
  interaksi_konten: 0,
  klik_tautan: 0,
  kunjungan: 0,
  pengikut: 0,
});

// 30 hari yang lalu sampai hari ini sebagai default range
const defaultFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return format(d, 'yyyy-MM-dd');
};

export const InsightHasilSection = ({ userId, apps }: Props) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<InsightHasil[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [appFilter, setAppFilter] = useState<string>('All');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>(defaultFrom());
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Modal form state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewInsightHasil>(emptyInput);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchInsightHasil(userId);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  // Set default app dari knownPlatforms
  useEffect(() => {
    if (!form.app_name && apps.length > 0) {
      setForm((prev) => ({ ...prev, app_name: apps[0].name }));
    }
  }, [apps, form.app_name]);

  const knownAppNames = useMemo(() => apps.map((a) => a.name), [apps]);

  // App + platform options derived dari data + apps user
  const appOptions = useMemo(() => {
    const set = new Set<string>(knownAppNames);
    rows.forEach((r) => set.add(r.app_name));
    return Array.from(set).sort();
  }, [knownAppNames, rows]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>(PLATFORM_OPTIONS);
    rows.forEach((r) => set.add(r.platform));
    return Array.from(set).sort();
  }, [rows]);

  // Filter rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (appFilter !== 'All' && r.app_name !== appFilter) return false;
      if (platformFilter !== 'All' && r.platform !== platformFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [rows, appFilter, platformFilter, dateFrom, dateTo]);

  // Totals
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.tayangan += r.tayangan;
        acc.jangkauan += r.jangkauan;
        acc.interaksi_konten += r.interaksi_konten;
        acc.klik_tautan += r.klik_tautan;
        acc.kunjungan += r.kunjungan;
        acc.pengikut += r.pengikut;
        return acc;
      },
      { tayangan: 0, jangkauan: 0, interaksi_konten: 0, klik_tautan: 0, kunjungan: 0, pengikut: 0 },
    );
  }, [filtered]);

  // Chart data: timeseries per tanggal (sum across filtered platforms/apps)
  const chartData = useMemo(() => {
    const byDate = new Map<string, {
      date: string;
      tayangan: number;
      jangkauan: number;
      interaksi_konten: number;
      kunjungan: number;
    }>();
    filtered.forEach((r) => {
      const ex = byDate.get(r.date) ?? {
        date: r.date,
        tayangan: 0,
        jangkauan: 0,
        interaksi_konten: 0,
        kunjungan: 0,
      };
      ex.tayangan += r.tayangan;
      ex.jangkauan += r.jangkauan;
      ex.interaksi_konten += r.interaksi_konten;
      ex.kunjungan += r.kunjungan;
      byDate.set(r.date, ex);
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // ============= Handlers =============
  const handleSubmit = async () => {
    if (!userId) return;
    if (!form.app_name || !form.platform || !form.date) {
      toast.error('Form belum lengkap', 'App, platform, dan tanggal wajib.');
      return;
    }
    setSubmitting(true);
    try {
      const saved = await upsertInsightHasil(userId, form);
      if (saved) {
        toast.success('Insight disimpan', `${saved.app_name} · ${saved.platform} · ${saved.date}`);
        await reload();
        setShowModal(false);
        setForm({ ...emptyInput(), app_name: form.app_name, platform: form.platform });
      } else {
        toast.error('Gagal simpan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rec: InsightHasil) => {
    if (!window.confirm(`Hapus insight ${rec.app_name} · ${rec.platform} · ${rec.date}?`)) return;
    const ok = await deleteInsightHasil(rec.id);
    if (ok) {
      toast.success('Dihapus');
      await reload();
    } else {
      toast.error('Gagal menghapus');
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setSubmitting(true);
    try {
      const res = await bulkUploadInsightHasil(userId, file);
      if (res.errors.length > 0) {
        toast.error(
          `Selesai dengan ${res.errors.length} catatan`,
          `${res.inserted} dimasukkan · ${res.skipped} dilewat. ${res.errors[0]}`,
        );
      } else {
        toast.success('Upload selesai', `${res.inserted} baris dimasukkan.`);
      }
      await reload();
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div
      key="insight-hasil"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 mb-3">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Insight Hasil</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Insight Hasil Konten
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Rekap harian per (app · platform sosmed). Input manual atau upload Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-end">
          <button
            type="button"
            onClick={() => downloadInsightHasilTemplate(knownAppNames)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 hover:border-emerald-400 hover:text-emerald-600 rounded-xl text-[11px] font-black text-slate-700 uppercase tracking-widest transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            type="button"
            disabled={!userId || submitting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 rounded-xl text-[11px] font-black text-emerald-700 uppercase tracking-widest transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={!userId}
            onClick={() => { setForm(emptyInput()); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl text-[11px] font-black text-white uppercase tracking-widest transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Insight
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              aria-label="Filter app"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="All">SEMUA APP</option>
              {appOptions.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            aria-label="Filter platform"
            className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
          >
            <option value="All">SEMUA PLATFORM</option>
            {platformOptions.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Tanggal dari"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sd</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Tanggal sampai"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none"
            />
          </div>
          <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest tabular-nums">
            {filtered.length} / {rows.length} baris
          </span>
        </div>
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <HeroCard icon={Eye} label="Tayangan" value={formatNumber(totals.tayangan)} gradient="from-violet-500 to-indigo-500" />
        <HeroCard icon={TrendingUp} label="Jangkauan" value={formatNumber(totals.jangkauan)} gradient="from-rose-500 to-pink-500" />
        <HeroCard icon={Sparkles} label="Interaksi Konten" value={formatNumber(totals.interaksi_konten)} gradient="from-emerald-500 to-teal-500" />
        <HeroCard icon={LinkIcon} label="Klik Tautan" value={formatNumber(totals.klik_tautan)} gradient="from-amber-500 to-orange-500" />
        <HeroCard icon={MousePointerClick} label="Kunjungan" value={formatNumber(totals.kunjungan)} gradient="from-cyan-500 to-sky-500" />
        <HeroCard icon={Users} label="Pengikut Baru" value={formatNumber(totals.pengikut)} gradient="from-fuchsia-500 to-purple-500" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
            <div>
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] mb-0.5">Timeseries</p>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                Trend Harian
              </h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickFormatter={(d) => format(parseISO(d), 'd MMM')}
              />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} />
              <Tooltip
                labelFormatter={(d) => format(parseISO(String(d)), 'dd MMM yyyy')}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }} />
              <Line type="monotone" dataKey="tayangan" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Tayangan" />
              <Line type="monotone" dataKey="jangkauan" stroke="#f43f5e" strokeWidth={2} dot={false} name="Jangkauan" />
              <Line type="monotone" dataKey="interaksi_konten" stroke="#10b981" strokeWidth={2} dot={false} name="Interaksi" />
              <Line type="monotone" dataKey="kunjungan" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Kunjungan" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
          <div>
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] mb-0.5">Detail</p>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Insight per Hari · App · Platform</h3>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/60 sticky top-0">
              <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-5">Tanggal</th>
                <th className="py-4 px-5">App</th>
                <th className="py-4 px-5">Platform</th>
                <th className="py-4 px-5 text-right">Tayangan</th>
                <th className="py-4 px-5 text-right">Jangkauan</th>
                <th className="py-4 px-5 text-right">Interaksi</th>
                <th className="py-4 px-5 text-right">Klik Tautan</th>
                <th className="py-4 px-5 text-right">Kunjungan</th>
                <th className="py-4 px-5 text-right">Pengikut</th>
                <th className="py-4 px-5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-xs font-bold text-slate-400">Memuat…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center text-xs font-bold text-slate-400">
                  Belum ada data. Klik "Tambah Insight" atau upload Excel.
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                  <td className="py-3.5 px-5 text-xs font-black text-slate-700 tabular-nums">
                    {format(parseISO(r.date), 'dd MMM yyyy')}
                  </td>
                  <td className="py-3.5 px-5 text-xs font-black text-slate-700 uppercase tracking-widest">{r.app_name}</td>
                  <td className="py-3.5 px-5">
                    <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-widest">{r.platform}</span>
                  </td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.tayangan)}</td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.jangkauan)}</td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.interaksi_konten)}</td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.klik_tautan)}</td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.kunjungan)}</td>
                  <td className="py-3.5 px-5 text-right text-xs font-black text-slate-900 tabular-nums">{formatNumber(r.pengikut)}</td>
                  <td className="py-3.5 px-5">
                    <button
                      type="button"
                      onClick={() => void handleDelete(r)}
                      aria-label="Hapus"
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {showModal && (
        <AddModal
          form={form}
          setForm={setForm}
          appNames={knownAppNames}
          submitting={submitting}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}
    </motion.div>
  );
};

// ============================================================
// Hero card kecil
// ============================================================
const HeroCard = ({ icon: Icon, label, value, gradient }: {
  icon: typeof Eye;
  label: string;
  value: string;
  gradient: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    className={cn(
      'relative overflow-hidden p-4 rounded-2xl text-white shadow-lg bg-gradient-to-br',
      gradient,
    )}
  >
    <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
    <div className="relative flex items-start justify-between mb-3">
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className="text-[8px] font-black uppercase tracking-widest text-white/80 mb-1">{label}</p>
    <h3 className="text-xl font-black tracking-tight tabular-nums">{value}</h3>
  </motion.div>
);

// ============================================================
// Add/Edit modal
// ============================================================
interface AddModalProps {
  form: NewInsightHasil;
  setForm: (f: NewInsightHasil) => void;
  appNames: string[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

const AddModal = ({ form, setForm, appNames, submitting, onClose, onSubmit }: AddModalProps) => {
  const update = <K extends keyof NewInsightHasil>(field: K, value: NewInsightHasil[K]) => {
    setForm({ ...form, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-7 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] mb-0.5">Insight Hasil</p>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tambah / Update Insight</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Kombinasi (App + Platform + Tanggal) yang sudah ada akan di-overwrite.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-7 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Aplikasi">
              <input
                list="insight-app-list"
                value={form.app_name}
                onChange={(e) => update('app_name', e.target.value)}
                placeholder="JADIBUMN"
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              />
              <datalist id="insight-app-list">
                {appNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </Field>
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={(e) => update('platform', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Tanggal">
              <input
                type="date"
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              />
            </Field>
          </div>

          <div className="pt-2">
            <p className="text-[10px] font-black text-violet-500 uppercase tracking-[0.2em] border-b border-violet-100 pb-1.5 mb-4">
              Metrik
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Tayangan">
                <NumberInput value={form.tayangan} onChange={(v) => update('tayangan', v)} />
              </Field>
              <Field label="Jangkauan">
                <NumberInput value={form.jangkauan} onChange={(v) => update('jangkauan', v)} />
              </Field>
              <Field label="Interaksi Konten">
                <NumberInput value={form.interaksi_konten} onChange={(v) => update('interaksi_konten', v)} />
              </Field>
              <Field label="Klik Tautan">
                <NumberInput value={form.klik_tautan} onChange={(v) => update('klik_tautan', v)} />
              </Field>
              <Field label="Kunjungan">
                <NumberInput value={form.kunjungan} onChange={(v) => update('kunjungan', v)} />
              </Field>
              <Field label="Pengikut Baru">
                <NumberInput value={form.pengikut} onChange={(v) => update('pengikut', v)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onSubmit()}
            className="px-7 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-violet-100 transition-colors"
          >
            Simpan
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
      {label}
    </label>
    {children}
  </div>
);

const NumberInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <input
    type="number"
    min={0}
    value={value}
    onChange={(e) => onChange(Number(e.target.value) || 0)}
    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none tabular-nums"
  />
);

export default InsightHasilSection;
