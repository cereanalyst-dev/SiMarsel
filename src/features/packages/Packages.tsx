import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import FilterSection from '../../components/FilterSection';
import type { AvailableOptions, Filters } from '../../types';

interface PackageRow {
  name: string;
  revenue: number;
  transactions: number;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  lowTrx: number;
  highTrx: number;
  avgTrx: number;
  durationLabel: string;
}

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  availableOptions: AvailableOptions;
  packagePerformance: PackageRow[];
}

const ITEMS_PER_PAGE = 10;

export const Packages = ({ filters, setFilters, availableOptions, packagePerformance }: Props) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(packagePerformance.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [packagePerformance]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return packagePerformance.slice(start, start + ITEMS_PER_PAGE);
  }, [packagePerformance, page]);

  return (
    <motion.div
      key="packages"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <FilterSection filters={filters} setFilters={setFilters} availableOptions={availableOptions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold mb-8 text-slate-900">Top Paket (Pendapatan)</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packagePerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(val) => `Rp${val >= 1000000 ? (val / 1000000).toFixed(0) + 'jt' : val}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                  formatter={(val: number) => [formatCurrency(val), 'Pendapatan']}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-lg font-bold mb-8 text-slate-900">Top Paket (Volume)</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packagePerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                  formatter={(val: number) => [formatNumber(val), 'Transaksi']}
                />
                <Bar dataKey="transactions" fill="#ec4899" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        <h3 className="text-xl font-black mb-10 text-slate-900 tracking-tight">Detail Performa Paket</h3>
        <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
          <table className="w-full text-left min-w-[1600px] border-separate border-spacing-0">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="pb-6 px-4 sticky left-0 bg-white z-10 border-b border-slate-100">Nama Paket</th>
                <th className="pb-6 px-4 border-b border-slate-100">Revenue</th>
                <th className="pb-6 px-4 border-b border-slate-100">Trx</th>
                <th className="pb-6 px-4 border-b border-slate-100">Low Price</th>
                <th className="pb-6 px-4 border-b border-slate-100">Low Trx</th>
                <th className="pb-6 px-4 border-b border-slate-100">Avg Price</th>
                <th className="pb-6 px-4 border-b border-slate-100">Avg Trx</th>
                <th className="pb-6 px-4 border-b border-slate-100">High Price</th>
                <th className="pb-6 px-4 border-b border-slate-100">High Trx</th>
                <th className="pb-6 px-4 border-b border-slate-100">Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map((pkg) => (
                <tr key={pkg.name} className="group hover:bg-slate-50/50 transition-all duration-200">
                  <td className="py-6 px-4 font-bold text-slate-700 text-sm sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="max-w-[250px] whitespace-normal break-words line-clamp-4 leading-tight" title={pkg.name}>
                      {pkg.name}
                    </div>
                  </td>
                  <td className="py-6 px-4 font-black text-slate-900 text-sm">{formatCurrency(pkg.revenue)}</td>
                  <td className="py-6 px-4 text-slate-500 text-sm font-bold">{formatNumber(pkg.transactions)}</td>
                  <td className="py-6 px-4 text-emerald-600 font-bold text-sm">{formatCurrency(pkg.minPrice)}</td>
                  <td className="py-6 px-4 text-emerald-500 text-xs font-bold">{formatNumber(pkg.lowTrx)}</td>
                  <td className="py-6 px-4 text-slate-500 text-sm font-medium">{formatCurrency(pkg.avgPrice)}</td>
                  <td className="py-6 px-4 text-slate-400 text-xs font-bold">{formatNumber(pkg.avgTrx)}</td>
                  <td className="py-6 px-4 text-rose-600 font-bold text-sm">{formatCurrency(pkg.maxPrice)}</td>
                  <td className="py-6 px-4 text-rose-500 text-xs font-bold">{formatNumber(pkg.highTrx)}</td>
                  <td className="py-6 px-4 text-slate-500 text-sm font-medium">{pkg.durationLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between mt-10 pt-6 border-t border-slate-100 gap-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(page * ITEMS_PER_PAGE, packagePerformance.length)} of {packagePerformance.length}{' '}
            packages
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = page;
                if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                if (pageNum <= 0 || pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'w-10 h-10 text-[11px] font-black rounded-xl transition-all',
                      page === pageNum
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Packages;
