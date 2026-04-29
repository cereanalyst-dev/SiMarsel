import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Layers, Search, Smartphone, Tag, TrendingUp, Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import {
  buildPromoDisplayKey, classifyPromo, parsePromoCode,
  PROMO_CATEGORIES, PROMO_CATEGORY_TONE,
  type PromoCategory,
} from '../../lib/promoRules';
import type { Transaction } from '../../types';

interface Props {
  data: Transaction[];
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const PromoSection = ({ data }: Props) => {
  const [appFilter, setAppFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<PromoCategory | 'All'>('All');
  const [search, setSearch] = useState('');

  // Daftar app + year yang ada di data
  const allApps = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      const app = (t.source_app || '').trim().toLowerCase();
      if (app) set.add(app);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const allYears = useMemo(() => {
    const set = new Set<number>();
    data.forEach((t) => {
      if (typeof t.year === 'number' && !isNaN(t.year)) set.add(t.year);
    });
    return ['All', ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [data]);

  // Filter transaksi: app + year + month
  const filteredTx = useMemo(() => {
    return data.filter((t) => {
      const app = (t.source_app || '').trim().toLowerCase();
      if (appFilter !== 'All' && app !== appFilter) return false;
      if (yearFilter !== 'All' && String(t.year) !== yearFilter) return false;
      if (monthFilter !== 'All' && String(t.month) !== monthFilter) return false;
      return true;
    });
  }, [data, appFilter, yearFilter, monthFilter]);

  // ============================================================
  // Aggregate per kategori (Tabel 1: Kode Promo per Channel)
  // + Hitung total reseller (informational row)
  // ============================================================
  const byCategory = useMemo(() => {
    const totals: Record<PromoCategory, { count: number; revenue: number }> = {
      'Sales': { count: 0, revenue: 0 },
      'Marketing': { count: 0, revenue: 0 },
      'Aplikasi': { count: 0, revenue: 0 },
      'Live': { count: 0, revenue: 0 },
      'Artikel': { count: 0, revenue: 0 },
      'Lainnya': { count: 0, revenue: 0 },
      'Tanpa Kode': { count: 0, revenue: 0 },
    };
    let grandTotalCount = 0;
    let grandTotalRevenue = 0;

    // Reseller — total transaksi yang punya kode reseller (kode ke-2)
    let resCount = 0;
    let resRevenue = 0;

    filteredTx.forEach((t) => {
      const parsed = parsePromoCode(t.promo_code);
      const cat = classifyPromo(t.promo_code, t.source_app || '');
      const rev = Number(t.revenue) || 0;
      totals[cat].count += 1;
      totals[cat].revenue += rev;
      grandTotalCount += 1;
      grandTotalRevenue += rev;

      if (parsed.resellerCode) {
        resCount += 1;
        resRevenue += rev;
      }
    });

    const rows = PROMO_CATEGORIES.map((cat) => ({
      category: cat,
      count: totals[cat].count,
      revenue: totals[cat].revenue,
      pct: grandTotalRevenue > 0 ? (totals[cat].revenue / grandTotalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    return {
      rows,
      grandTotalCount,
      grandTotalRevenue,
      reseller: {
        count: resCount,
        revenue: resRevenue,
        pct: grandTotalRevenue > 0 ? (resRevenue / grandTotalRevenue) * 100 : 0,
      },
    };
  }, [filteredTx]);

  // ============================================================
  // Aggregate per kode unik (Tabel 2: Rekap Per Kode Promo)
  // ============================================================
  const byCode = useMemo(() => {
    const acc: Record<string, {
      key: string;
      category: PromoCategory;
      count: number;
      revenue: number;
    }> = {};

    filteredTx.forEach((t) => {
      const parsed = parsePromoCode(t.promo_code);
      const key = buildPromoDisplayKey(parsed);
      const cat = classifyPromo(t.promo_code, t.source_app || '');
      if (!acc[key]) acc[key] = { key, category: cat, count: 0, revenue: 0 };
      acc[key].count += 1;
      acc[key].revenue += Number(t.revenue) || 0;
    });

    let rows = Object.values(acc);
    if (categoryFilter !== 'All') {
      rows = rows.filter((r) => r.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Match terhadap normalized key (sudah uppercase + no spec chars)
      rows = rows.filter((r) => r.key.includes(q));
    }
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [filteredTx, categoryFilter, search]);

  // ============================================================
  // Detail search — saat user search, tampil breakdown per app
  // ============================================================
  const searchDetail = useMemo(() => {
    const q = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!q) return null;

    let totalCount = 0;
    let totalRev = 0;
    const byApp: Record<string, { count: number; revenue: number }> = {};

    filteredTx.forEach((t) => {
      const parsed = parsePromoCode(t.promo_code);
      const key = buildPromoDisplayKey(parsed).toUpperCase();
      if (!key.includes(q)) return;

      const app = (t.source_app || 'unknown').trim().toUpperCase() || 'UNKNOWN';
      const rev = Number(t.revenue) || 0;
      if (!byApp[app]) byApp[app] = { count: 0, revenue: 0 };
      byApp[app].count += 1;
      byApp[app].revenue += rev;
      totalCount += 1;
      totalRev += rev;
    });

    return {
      query: search.trim(),
      totalCount,
      totalRev,
      apps: Object.entries(byApp)
        .map(([app, v]) => ({ app, ...v }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }, [filteredTx, search]);

  return (
    <motion.div
      key="kode-promo"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Promo Analytics
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Performa Kode Promo
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Aggregasi kode promo per kategori + breakdown detail per kode unik.
            Kode auto di-normalize (huruf besar/kecil/spasi/dash dianggap sama).
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* App */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              aria-label="Filter platform"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              {allApps.map((a) => (
                <option key={a} value={a}>{a === 'All' ? 'SEMUA APP' : a.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Filter tahun"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              {allYears.map((y) => (
                <option key={y} value={y}>{y === 'All' ? 'SEMUA TAHUN' : y}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            aria-label="Filter bulan"
            className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
          >
            <option value="All">SEMUA BULAN</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroCard
          icon={Tag}
          label="Total Transaksi (Filter Aktif)"
          value={formatNumber(byCategory.grandTotalCount)}
          gradient="from-rose-500 to-pink-500"
        />
        <HeroCard
          icon={TrendingUp}
          label="Total Revenue"
          value={formatCurrency(byCategory.grandTotalRevenue)}
          gradient="from-emerald-500 to-teal-500"
        />
        <HeroCard
          icon={Users}
          label="Pakai Reseller"
          value={`${formatNumber(byCategory.reseller.count)}  ·  ${byCategory.reseller.pct.toFixed(1)}%`}
          gradient="from-violet-500 to-rose-500"
        />
      </div>

      {/* Table 1: Kode Promo Per Channel + row Reseller */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-rose-500 to-pink-500" />
          <div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-0.5">
              Tabel 1
            </p>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Kode Promo per Channel
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50/60">
              <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-6">Kode Promo (Kategori)</th>
                <th className="py-4 px-6 text-right">Jumlah Transaksi</th>
                <th className="py-4 px-6 text-right">Total Harga</th>
                <th className="py-4 px-6 text-right w-24">%</th>
                <th className="py-4 px-6 w-44">Distribusi</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.rows.map((row) => {
                const tone = PROMO_CATEGORY_TONE[row.category];
                return (
                  <tr key={row.category} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6">
                      <span className={cn(
                        'inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border',
                        tone.bg, tone.text, 'border-current/20',
                      )}>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right text-sm font-black text-slate-700 tabular-nums">
                      {formatNumber(row.count)}
                    </td>
                    <td className="py-4 px-6 text-right text-sm font-black text-slate-900 tabular-nums">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-4 px-6 text-right text-xs font-black text-indigo-600 tabular-nums">
                      {row.pct.toFixed(2)}%
                    </td>
                    <td className="py-4 px-6">
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-rose-500"
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Row tambahan: Kode Promo + Reseller (informational, gak masuk grand total
                  karena udah ke-count di kategori-nya masing-masing) */}
              <tr className="bg-violet-50/40 border-b-2 border-violet-200">
                <td className="py-4 px-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-100 text-violet-800 text-[10px] font-black uppercase tracking-widest border border-violet-200">
                    <Layers className="w-3 h-3" />
                    Kode Promo + Reseller
                  </span>
                </td>
                <td className="py-4 px-6 text-right text-sm font-black text-violet-900 tabular-nums">
                  {formatNumber(byCategory.reseller.count)}
                </td>
                <td className="py-4 px-6 text-right text-sm font-black text-violet-900 tabular-nums">
                  {formatCurrency(byCategory.reseller.revenue)}
                </td>
                <td className="py-4 px-6 text-right text-xs font-black text-violet-700 tabular-nums">
                  {byCategory.reseller.pct.toFixed(2)}%
                </td>
                <td className="py-4 px-6">
                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: `${Math.min(100, byCategory.reseller.pct)}%` }}
                    />
                  </div>
                </td>
              </tr>

              {/* Grand total row */}
              <tr className="bg-indigo-50/40 border-t-2 border-indigo-200">
                <td className="py-4 px-6 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  JUMLAH (tanpa double count Reseller)
                </td>
                <td className="py-4 px-6 text-right text-sm font-black text-indigo-900 tabular-nums">
                  {formatNumber(byCategory.grandTotalCount)}
                </td>
                <td className="py-4 px-6 text-right text-sm font-black text-indigo-900 tabular-nums">
                  {formatCurrency(byCategory.grandTotalRevenue)}
                </td>
                <td className="py-4 px-6 text-right text-xs font-black text-indigo-700 tabular-nums">
                  100.00%
                </td>
                <td className="py-4 px-6"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Search detail panel — tampil kalau user lagi search */}
      {searchDetail && (
        <SearchDetailCard detail={searchDetail} />
      )}

      {/* Table 2: Detail per kode unik */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-rose-500" />
            <div>
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] mb-0.5">
                Tabel 2
              </p>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Rekap Per Kode Promo
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Kode dengan reseller di-tag <span className="font-black text-violet-600">+RES</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PromoCategory | 'All')}
              aria-label="Filter kategori"
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="All">SEMUA KATEGORI</option>
              {PROMO_CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode..."
                className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 min-w-0"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear"
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-50/60 sticky top-0">
              <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-6 w-12">#</th>
                <th className="py-4 px-6">Kode Promo</th>
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6 text-right">Jumlah Transaksi</th>
                <th className="py-4 px-6 text-right">Total Harga</th>
              </tr>
            </thead>
            <tbody>
              {byCode.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs font-bold text-slate-400">
                    Tidak ada kode yg cocok dengan filter ini.
                  </td>
                </tr>
              ) : byCode.map((row, i) => {
                const tone = PROMO_CATEGORY_TONE[row.category];
                const hasReseller = row.key.endsWith('+RES');
                return (
                  <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                    <td className="py-3.5 px-6 text-xs font-black text-slate-400 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 font-mono">
                          {row.key.replace('+RES', '')}
                        </span>
                        {hasReseller && (
                          <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[8px] font-black uppercase tracking-widest">
                            +RES
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest',
                        tone.bg, tone.text,
                      )}>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right text-sm font-bold text-slate-700 tabular-nums">
                      {formatNumber(row.count)}
                    </td>
                    <td className="py-3.5 px-6 text-right text-sm font-black text-slate-900 tabular-nums">
                      {formatCurrency(row.revenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================
// Search detail card — breakdown per app saat search aktif
// ============================================================
interface SearchDetail {
  query: string;
  totalCount: number;
  totalRev: number;
  apps: { app: string; count: number; revenue: number }[];
}

function SearchDetailCard({ detail }: { detail: SearchDetail }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/60 rounded-3xl border border-indigo-200/60 shadow-sm overflow-hidden">
      <div className="px-7 py-5 border-b border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
          <div>
            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-0.5">
              Detail Pencarian
            </p>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Hasil cari: <span className="font-mono text-indigo-700">"{detail.query}"</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="p-7 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah Transaksi</p>
          <h4 className="text-2xl font-black text-indigo-600 tabular-nums">{formatNumber(detail.totalCount)}</h4>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
          <h4 className="text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(detail.totalRev)}</h4>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">App Pengguna</p>
          <h4 className="text-2xl font-black text-violet-600 tabular-nums">{detail.apps.length}</h4>
        </div>
      </div>

      {detail.apps.length > 0 && (
        <div className="px-7 pb-7">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            Rincian per App
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/60">
                <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-3 px-5">App</th>
                  <th className="py-3 px-5 text-right">Jumlah Transaksi</th>
                  <th className="py-3 px-5 text-right">Total Revenue</th>
                  <th className="py-3 px-5 text-right w-32">% dari Hasil</th>
                </tr>
              </thead>
              <tbody>
                {detail.apps.map((row) => {
                  const pct = detail.totalRev > 0 ? (row.revenue / detail.totalRev) * 100 : 0;
                  return (
                    <tr key={row.app} className="border-b border-slate-50 hover:bg-slate-50/40">
                      <td className="py-3 px-5 text-xs font-black text-slate-700">{row.app}</td>
                      <td className="py-3 px-5 text-right text-xs font-bold text-slate-700 tabular-nums">
                        {formatNumber(row.count)}
                      </td>
                      <td className="py-3 px-5 text-right text-xs font-black text-slate-900 tabular-nums">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-5 text-right text-xs font-black text-indigo-600 tabular-nums">
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const HeroCard = ({ icon: Icon, label, value, gradient }: {
  icon: typeof Tag;
  label: string;
  value: string;
  gradient: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -3 }}
    className={cn(
      'relative overflow-hidden p-5 rounded-2xl text-white shadow-lg',
      'bg-gradient-to-br',
      gradient,
    )}
  >
    <div className="pointer-events-none absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
    <div className="relative flex items-start justify-between mb-4">
      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[9px] font-black uppercase tracking-widest text-white/80 text-right">
        {label}
      </p>
    </div>
    <h3 className="text-2xl font-black tracking-tight">{value}</h3>
  </motion.div>
);

export default PromoSection;
