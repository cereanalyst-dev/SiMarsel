import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import {
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import type { AvailableOptions, Transaction } from '../../types';

interface PriceSuggestionProps {
  data: Transaction[];
  availableOptions: AvailableOptions;
}

export const PriceSuggestion = ({ data, availableOptions }: PriceSuggestionProps) => {
  const [platform, setPlatform] = useState('');
  const [durationUnit, setDurationUnit] = useState<'hari' | 'bulan' | 'tahun'>('bulan');
  const [durationValue, setDurationValue] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const filteredHistory = useMemo(() => {
    let base = data;
    if (platform) base = base.filter(d => d.source_app.toUpperCase() === platform.toUpperCase());
    if (!showAllHistory && (durationValue || durationUnit)) {
      base = base.filter(d => {
        const name = (d.content_name || '').toLowerCase();
        // Kalau user isi angka → cocokkan "<angka> <unit>" (mis. "3 bulan")
        // Kalau angka kosong → cukup cocokkan unit-nya saja (mis. mengandung "bulan")
        const needle = durationValue
          ? `${durationValue} ${durationUnit}`.toLowerCase()
          : durationUnit.toLowerCase();
        return name.includes(needle);
      });
    }
    return base;
  }, [data, platform, durationValue, durationUnit, showAllHistory]);

  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    const prices = filteredHistory.map(d => d.revenue);
    const minPrice = prices.length > 0 ? prices.reduce((a, b) => Math.min(a, b), prices[0]) : 0;
    const maxPrice = prices.length > 0 ? prices.reduce((a, b) => Math.max(a, b), prices[0]) : 0;
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Find most bought price (Mode)
    const priceCounts = prices.reduce((acc: any, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    const mostBoughtPrice = Number(Object.keys(priceCounts).reduce((a, b) => priceCounts[a] > priceCounts[b] ? a : b));

    // Distribution at specific levels
    const lowCount = prices.filter(p => p <= minPrice * 1.1).length;
    const avgCount = prices.filter(p => p >= avgPrice * 0.9 && p <= avgPrice * 1.1).length;
    const highCount = prices.filter(p => p >= maxPrice * 0.9).length;

    return { minPrice, maxPrice, avgPrice, mostBoughtPrice, count: prices.length, lowCount, avgCount, highCount };
  }, [filteredHistory]);

  const recommendations = useMemo(() => {
    if (!stats) return null;
    
    // Logic: 
    // App Price (Value) = combination of average and most bought price
    let valuePrice = Math.round(((stats.avgPrice + stats.mostBoughtPrice) / 2) / 1000) * 1000;
    
    // Marketing Price (Campaign) = conversion-oriented derivative (between min and value)
    let campaignPrice = Math.round(((stats.minPrice + valuePrice) / 2.2) / 1000) * 1000;
    
    // Anchor Price (Coret) = derived from max price with psychological adjustment
    let anchorPrice = Math.round((stats.maxPrice * 1.15) / 1000) * 1000;

    // Avoid illogical gaps or conditions
    // 1. Marketing price shouldn't be too far from App price (max 40% gap)
    if (campaignPrice < valuePrice * 0.6) {
      campaignPrice = Math.round((valuePrice * 0.7) / 1000) * 1000;
    }

    // 2. Ensure order: Campaign < Value < Anchor
    if (campaignPrice >= valuePrice) campaignPrice = valuePrice - 5000;
    if (valuePrice >= anchorPrice) anchorPrice = valuePrice + 10000;

    return {
      anchor: anchorPrice,
      value: valuePrice,
      campaign: campaignPrice
    };
  }, [stats]);

  const buyerDistribution = useMemo(() => {
    if (!stats) return [];
    
    // Group into 5 price ranges for distribution
    const step = (stats.maxPrice - stats.minPrice) / 5;
    if (step === 0) return [{ range: formatCurrency(stats.minPrice), count: stats.count }];

    const ranges = Array.from({ length: 5 }, (_, i) => {
      const min = stats.minPrice + (i * step);
      const max = min + step;
      const count = filteredHistory.filter(d => d.revenue >= min && (i === 4 ? d.revenue <= max : d.revenue < max)).length;
      return { range: `${formatCurrency(min)} - ${formatCurrency(max)}`, count };
    });
    return ranges;
  }, [stats, filteredHistory]);

  const historyTableData = useMemo(() => {
    const grouped = filteredHistory.reduce((acc: any, curr) => {
      const key = curr.content_name;
      if (!acc[key]) acc[key] = { name: key, revenue: 0, transactions: 0, prices: [] };
      acc[key].revenue += curr.revenue;
      acc[key].transactions += 1;
      acc[key].prices.push(curr.revenue);
      return acc;
    }, {});

    return Object.values(grouped).map((p: any) => ({
      ...p,
      minPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.min(a, b), p.prices[0]) : 0,
      maxPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.max(a, b), p.prices[0]) : 0,
      avgPrice: p.revenue / p.transactions
    })).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredHistory]);

  return (
    <div className="space-y-10">
      {/* Editorial header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 -mt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Pricing Intelligence
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Optimasi Harga
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Rekomendasi 3-tier (Anchor, Value, Campaign) berbasis histori demand pembeli.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      >
        {/* Decorative */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-violet-100/50 to-transparent rounded-full blur-3xl" />

        <div className="relative flex items-start gap-4 mb-8">
          <div className="w-1 h-12 rounded-full bg-gradient-to-b from-violet-500 via-indigo-500 to-blue-500" />
          <div>
            <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.25em] mb-1">
              Pricing Engine
            </p>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Saran Harga Paket
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Rekomendasi berbasis histori &amp; distribusi demand pembeli
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Platform</label>
            <select 
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-700"
            >
              <option value="">Pilih Platform</option>
              {availableOptions.source_apps.map((app: string) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Masa Aktif / Durasi</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder="Angka"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="w-1/2 p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-700"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as 'hari' | 'bulan' | 'tahun')}
                className="w-1/2 p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-700 cursor-pointer"
              >
                <option value="hari">Hari</option>
                <option value="bulan">Bulanan</option>
                <option value="tahun">Tahunan</option>
              </select>
            </div>
            <p className="text-[10px] text-slate-400 font-medium ml-1">
              Dashboard akan mencari paket yang mengandung kata-kata tersebut di nama produknya.
            </p>
          </div>
        </div>

        {recommendations ? (
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ANCHOR */}
            <div className="group relative p-6 bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl transition-all">
              <div className="h-1 absolute inset-x-0 top-0 bg-gradient-to-r from-slate-400 to-slate-300" />
              <div className="flex items-start justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Anchor</span>
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Coret
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Harga Psikologis
              </p>
              <p className="text-2xl font-black text-slate-400 line-through tracking-tight">
                {formatCurrency(recommendations.anchor)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium leading-relaxed">
                Derived dari harga tertinggi historis + 15% psychological lift.
              </p>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Historical Demand
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-lg font-black text-slate-700">{stats?.highCount ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-400">pembeli di range high</p>
                </div>
              </div>
            </div>

            {/* VALUE (highlighted — primary recommendation) */}
            <div className="group relative p-6 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl overflow-hidden shadow-xl shadow-indigo-200/50 hover:shadow-2xl hover:shadow-indigo-300/50 transition-all">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -left-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Value</span>
                  </span>
                  <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest">
                    ⭐ Pilihan
                  </span>
                </div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">
                  Harga Aplikasi
                </p>
                <p className="text-3xl font-black text-white tracking-tight">
                  {formatCurrency(recommendations.value)}
                </p>
                <p className="text-[10px] text-white/70 mt-2 font-medium leading-relaxed">
                  Kombinasi rata-rata + harga modus (paling banyak dibeli).
                </p>
                <div className="mt-5 pt-4 border-t border-white/10">
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                    Historical Demand
                  </p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-lg font-black text-white">{stats?.avgCount ?? 0}</p>
                    <p className="text-[10px] font-bold text-white/60">pembeli di range avg</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CAMPAIGN */}
            <div className="group relative p-6 bg-white border border-emerald-200 rounded-3xl overflow-hidden hover:shadow-xl transition-all">
              <div className="h-1 absolute inset-x-0 top-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex items-start justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Campaign</span>
                </span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                  Promo
                </span>
              </div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">
                Harga Marketing
              </p>
              <p className="text-2xl font-black text-emerald-600 tracking-tight">
                {formatCurrency(recommendations.campaign)}
              </p>
              <p className="text-[10px] text-emerald-500/70 mt-2 font-medium leading-relaxed">
                Optimized untuk konversi — hemat ~30% dari Value.
              </p>
              <div className="mt-5 pt-4 border-t border-emerald-100">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                  Historical Demand
                </p>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-lg font-black text-emerald-700">{stats?.lowCount ?? 0}</p>
                  <p className="text-[10px] font-bold text-emerald-500/70">pembeli di range low</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative p-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <p className="text-sm font-bold text-slate-500">
              Pilih platform dulu untuk melihat saran harga berbasis demand.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Dashboard akan compute Anchor / Value / Campaign dari histori transaksi.
            </p>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">History Performa Paket</h3>
            </div>
            <button 
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="px-4 py-2 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              {showAllHistory ? 'Paket Mirip' : 'Semua Paket'}
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-2">Nama</th>
                  <th className="py-4 px-2">Revenue</th>
                  <th className="py-4 px-2">Trx</th>
                  <th className="py-4 px-2 text-emerald-600">Low Price</th>
                  <th className="py-4 px-2 text-emerald-600">Low Trx</th>
                  <th className="py-4 px-2 text-indigo-600">Avg Price</th>
                  <th className="py-4 px-2 text-indigo-600">Avg Trx</th>
                  <th className="py-4 px-2 text-rose-600">High Price</th>
                  <th className="py-4 px-2 text-rose-600">High Trx</th>
                </tr>
              </thead>
              <tbody>
                {historyTableData.map((item, idx) => {
                  const prices = item.prices;
                  const min = item.minPrice;
                  const max = item.maxPrice;
                  const avg = item.avgPrice;
                  
                  const lowDmd = prices.filter((p: number) => p <= min * 1.1).length;
                  const avgDmd = prices.filter((p: number) => p >= avg * 0.9 && p <= avg * 1.1).length;
                  const highDmd = prices.filter((p: number) => p >= max * 0.9).length;

                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all group">
                      <td className="py-4 px-2 text-[10px] font-bold text-slate-700">
                        <div className="max-w-[180px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600">{formatCurrency(item.revenue)}</td>
                      <td className="py-4 px-2 text-[10px] text-slate-500">{formatNumber(item.transactions)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-emerald-600 bg-emerald-50/30">{formatCurrency(item.minPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-emerald-600 bg-emerald-50/10">{formatNumber(lowDmd)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600 bg-indigo-50/30">{formatCurrency(item.avgPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600 bg-indigo-50/10">{formatNumber(avgDmd)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-rose-600 bg-rose-50/30">{formatCurrency(item.maxPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-rose-600 bg-rose-50/10">{formatNumber(highDmd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {buyerDistribution.length > 0 && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
            <h3 className="text-lg font-black text-slate-900 mb-6">Buyer Distribution</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buyerDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="range" hide />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val, 'Pembeli']}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {buyerDistribution.map((range, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-[100px]">{range.range}</span>
                  <span className="text-[10px] font-black text-indigo-600">{range.count} Users</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceSuggestion;
