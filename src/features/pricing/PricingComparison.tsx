import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import type { Filters, Transaction } from '../../types';

interface Props {
  data: Transaction[];
  filters: Filters;
}

export const PricingComparison = ({ data, filters }: Props) => {
  const [mode, setMode] = useState<'yearly' | 'monthly'>('yearly');
  const [breakdownByApp, setBreakdownByApp] = useState(false);

  const rows = useMemo(() => {
    const filtered = data.filter((item) => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
      return matchApp && matchMethod;
    });

    type Sub = {
      year_month: string;
      year: number;
      app: string;
      revenue: number;
      transactions: number;
      buyers: Set<string>;
      aov: number;
      arppu: number;
    };
    const subs: Record<string, Sub> = {};
    filtered.forEach((item) => {
      const key = `${item.year_month}_${item.source_app}`;
      if (!subs[key]) {
        subs[key] = {
          year_month: item.year_month,
          year: item.year,
          app: item.source_app,
          revenue: 0,
          transactions: 0,
          buyers: new Set(),
          aov: 0,
          arppu: 0,
        };
      }
      subs[key].revenue += item.revenue;
      subs[key].transactions += 1;
      const id = item.email || item.phone || item.full_name || item.trx_id;
      if (id) subs[key].buyers.add(id);
    });
    Object.values(subs).forEach((s) => {
      s.aov = s.revenue / (s.transactions || 1);
      s.arppu = s.revenue / (s.buyers.size || 1);
    });

    type Group = {
      label: string | number;
      app: string;
      revenue: number;
      transactions: number;
      buyers: Set<string>;
      prices: number[];
    };
    const groups: Record<string, Group> = {};
    filtered.forEach((item) => {
      const timeKey = mode === 'yearly' ? item.year : item.year_month;
      const key = breakdownByApp ? `${timeKey}_${item.source_app}` : String(timeKey);
      if (!groups[key]) {
        groups[key] = {
          label: timeKey as string | number,
          app: item.source_app,
          revenue: 0,
          transactions: 0,
          buyers: new Set(),
          prices: [],
        };
      }
      groups[key].revenue += item.revenue;
      groups[key].transactions += 1;
      const id = item.email || item.phone || item.full_name || item.trx_id;
      if (id) groups[key].buyers.add(id);
      groups[key].prices.push(item.revenue);
    });

    return Object.values(groups)
      .map((g) => {
        const uniqueUsers = g.buyers.size;
        const aov = g.revenue / (g.transactions || 1);
        const arppu = uniqueUsers > 0 ? g.revenue / uniqueUsers : 0;

        const relevant = Object.values(subs).filter((s) => {
          const timeMatch = mode === 'yearly' ? s.year === g.label : s.year_month === g.label;
          const appMatch = !breakdownByApp || s.app === g.app;
          return timeMatch && appMatch;
        });
        const avgAov = relevant.length ? relevant.reduce((s, r) => s + r.aov, 0) / relevant.length : aov;
        const avgArppu = relevant.length
          ? relevant.reduce((s, r) => s + r.arppu, 0) / relevant.length
          : arppu;

        const sorted = [...g.prices].sort((a, b) => a - b);
        const minPrice = sorted[0] || 0;
        const maxPrice = sorted[sorted.length - 1] || 0;
        const avgPrice = g.revenue / (g.transactions || 1);
        const benchmarkPrice = sorted[Math.floor(sorted.length * 0.5)] || 0;
        const lowRec = sorted[Math.floor(sorted.length * 0.25)] || 0;
        const midRec = benchmarkPrice;
        const highRec = sorted[Math.floor(sorted.length * 0.75)] || 0;

        return {
          ...g,
          uniqueUsers,
          aov,
          arppu,
          avgAov,
          avgArppu,
          minPrice,
          maxPrice,
          avgPrice,
          benchmarkPrice,
          lowRec,
          midRec,
          highRec,
        };
      })
      .sort((a, b) => String(b.label).localeCompare(String(a.label)));
  }, [data, filters, mode, breakdownByApp]);

  return (
    <motion.div
      key="comparison"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Perbandingan Harga & Performa</h3>
          <p className="text-sm text-slate-400 font-medium mt-1.5">
            Analisis benchmark dan rekomendasi harga strategis lintas periode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setBreakdownByApp((v) => !v)}
            className={cn(
              'px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 border',
              breakdownByApp
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-slate-600',
            )}
          >
            {breakdownByApp ? 'Sembunyikan Aplikasi' : 'Lihat Per Aplikasi'}
          </button>
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
            {(['yearly', 'monthly'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300',
                  mode === m
                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100/50'
                    : 'text-slate-400 hover:text-slate-600',
                )}
              >
                {m === 'yearly' ? 'Tahunan' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
        <table className="w-full text-left min-w-[1300px]">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="pb-6 px-4">{mode === 'yearly' ? 'Tahun' : 'Bulan'}</th>
              {breakdownByApp && <th className="pb-6 px-4">Aplikasi</th>}
              <th className="pb-6">Total Revenue</th>
              <th className="pb-6">Paying Users</th>
              <th className="pb-6">Min Price</th>
              <th className="pb-6">Avg Price</th>
              <th className="pb-6">Max Price</th>
              <th className="pb-6">AOV</th>
              <th className="pb-6">ARPPU</th>
              <th className="pb-6">Avg AOV</th>
              <th className="pb-6">Avg ARPPU</th>
              <th className="pb-6">Benchmark Price</th>
              <th className="pb-6 text-emerald-600">Rec. Low</th>
              <th className="pb-6 text-indigo-600">Rec. Mid</th>
              <th className="pb-6 text-rose-600">Rec. High</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((item) => (
              <tr key={`${item.label}-${item.app}`} className="group hover:bg-slate-50/50 transition-all duration-200">
                <td className="py-6 px-4 font-black text-slate-900 text-sm">{item.label}</td>
                {breakdownByApp && <td className="py-6 px-4 text-slate-500 text-sm font-bold">{item.app}</td>}
                <td className="py-6 font-bold text-slate-700 text-sm">{formatCurrency(item.revenue)}</td>
                <td className="py-6 text-slate-500 text-sm font-medium">{formatNumber(item.uniqueUsers)}</td>
                <td className="py-6 text-emerald-600 font-bold text-sm">{formatCurrency(item.minPrice)}</td>
                <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.avgPrice)}</td>
                <td className="py-6 text-rose-600 font-bold text-sm">{formatCurrency(item.maxPrice)}</td>
                <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.aov)}</td>
                <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.arppu)}</td>
                <td className="py-6 text-slate-400 text-xs italic">{formatCurrency(item.avgAov)}</td>
                <td className="py-6 text-slate-400 text-xs italic">{formatCurrency(item.avgArppu)}</td>
                <td className="py-6 font-bold text-indigo-600 text-sm">{formatCurrency(item.benchmarkPrice)}</td>
                <td className="py-6 text-emerald-600 font-black text-sm">{formatCurrency(item.lowRec)}</td>
                <td className="py-6 text-indigo-600 font-black text-sm">{formatCurrency(item.midRec)}</td>
                <td className="py-6 text-rose-600 font-black text-sm">{formatCurrency(item.highRec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default PricingComparison;
