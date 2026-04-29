import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Tag, Users, TrendingUp, Smartphone, Search } from 'lucide-react';
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

export const PromoSection = ({ data }: Props) => {
  const [appFilter, setAppFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<PromoCategory | 'All'>('All');
  const [search, setSearch] = useState('');

  // Extract daftar app yg ada di data
  const allApps = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      const app = (t.source_app || '').trim().toLowerCase();
      if (app) set.add(app);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  // Filter transaksi by app
  const filteredTx = useMemo(() => {
    if (appFilter === 'All') return data;
    return data.filter((t) => (t.source_app || '').trim().toLowerCase() === appFilter);
  }, [data, appFilter]);

  // Aggregate per kategori (untuk tabel atas: KODE PROMO PER CHANNEL)
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

    filteredTx.forEach((t) => {
      const cat = classifyPromo(t.promo_code, t.source_app || '');
      const rev = Number(t.revenue) || 0;
      totals[cat].count += 1;
      totals[cat].revenue += rev;
      grandTotalCount += 1;
      grandTotalRevenue += rev;
    });

    const rows = PROMO_CATEGORIES.map((cat) => ({
      category: cat,
      count: totals[cat].count,
      revenue: totals[cat].revenue,
      pct: grandTotalRevenue > 0 ? (totals[cat].revenue / grandTotalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    return { rows, grandTotalCount, grandTotalRevenue };
  }, [filteredTx]);

  // Aggregate per kode unik (detail breakdown)
  // Group by (mainCode, hasReseller) → buildDisplayKey
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
      if (!acc[key]) {
        acc[key] = { key, category: cat, count: 0, revenue: 0 };
      }
      acc[key].count += 1;
      acc[key].revenue += Number(t.revenue) || 0;
    });

    let rows = Object.values(acc);
    if (categoryFilter !== 'All') {
      rows = rows.filter((r) => r.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.key.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => b.revenue - a.revenue);
  }, [filteredTx, categoryFilter, search]);

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
            Aggregasi kode promo per kategori (Sales/Marketing/Aplikasi/Live/Artikel/Lainnya)
            dan breakdown detail per kode unik.
          </p>
        </div>

        {/* App filter */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <Smartphone className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            aria-label="Filter app"
            className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest pr-3 py-1"
          >
            {allApps.map((a) => (
              <option key={a} value={a}>{a === 'All' ? 'SEMUA APP' : a.toUpperCase()}</option>
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
          label="Kategori Aktif"
          value={String(byCategory.rows.filter((r) => r.count > 0).length) + ' / 7'}
          gradient="from-indigo-500 to-violet-500"
        />
      </div>

      {/* Table 1: Kode Promo Per Channel (kategori) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
              {/* Grand total row */}
              <tr className="bg-indigo-50/40 border-t-2 border-indigo-200">
                <td className="py-4 px-6 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  JUMLAH
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
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PromoCategory | 'All')}
              aria-label="Filter kategori"
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="All">SEMUA KATEGORI</option>
              {PROMO_CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode..."
                className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 min-w-0"
              />
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
