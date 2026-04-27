import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, DollarSign, Download, ShoppingBag, Target, TrendingUp, UserCheck, Users,
} from 'lucide-react';
import {
  Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { cn } from '../../lib/utils';
import { COLORS } from '../../lib/constants';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import FilterSection from '../../components/FilterSection';
import FlexibleChart from '../../components/FlexibleChart';
import DrillDownModal from '../../components/DrillDownModal';
import type {
  AvailableOptions, DashboardStats, Filters, TrendItem,
} from '../../types';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  availableOptions: AvailableOptions;
  stats: DashboardStats;
  trendData: TrendItem[];
  appColors: Record<string, string>;
  filteredData: { methode_name?: string; hour: number; revenue: number }[];
}

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'table';
type Metric = 'revenue' | 'transactions' | 'downloader' | 'conversion';
type Granularity = 'daily' | 'weekly' | 'monthly';

export const Overview = ({
  filters, setFilters, availableOptions, stats, trendData, appColors, filteredData,
}: Props) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [chartMetric, setChartMetric] = useState<Metric>('revenue');
  const [chartGranularity, setChartGranularity] = useState<Granularity>('daily');
  const [paymentChartMode, setPaymentChartMode] = useState<'revenue' | 'transactions'>('revenue');
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<any | null>(null);

  const methodPieData = useMemo(() => {
    const acc: Record<string, { name: string; value: number }> = {};
    filteredData.forEach((curr) => {
      const method = curr.methode_name || 'Unknown';
      if (!acc[method]) acc[method] = { name: method, value: 0 };
      acc[method].value += paymentChartMode === 'revenue' ? curr.revenue : 1;
    });
    return Object.values(acc).sort((a, b) => b.value - a.value);
  }, [filteredData, paymentChartMode]);

  const hourPieData = useMemo(() => {
    const acc: Record<string, { name: string; value: number }> = {};
    filteredData.forEach((curr) => {
      const h = curr.hour;
      let label = '';
      if (h >= 0 && h < 6) label = 'Dini Hari (00-06)';
      else if (h >= 6 && h < 12) label = 'Pagi (06-12)';
      else if (h >= 12 && h < 18) label = 'Siang/Sore (12-18)';
      else label = 'Malam (18-00)';
      if (!acc[label]) acc[label] = { name: label, value: 0 };
      acc[label].value += 1;
    });
    return Object.values(acc).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const toggleGranularity = chartGranularity;

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-10"
    >
      {/* ============ EDITORIAL HEADER ============ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Live Dashboard
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Ringkasan Performa
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Snapshot metrik utama — revenue, konversi, repeat order, dan volume
            transaksi lintas aplikasi.
          </p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
            Total Rows
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            {formatNumber(stats.totalTransactions)}
          </p>
        </div>
      </div>

      <FilterSection filters={filters} setFilters={setFilters} availableOptions={availableOptions} />

      {/* ============ HERO CARDS (3 big) ============ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HeroCard
          icon={DollarSign}
          gradient="from-indigo-600 via-indigo-500 to-purple-600"
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          sub={`${formatNumber(stats.totalTransactions)} transaksi`}
        />
        <HeroCard
          icon={ShoppingBag}
          gradient="from-emerald-500 via-emerald-400 to-teal-500"
          label="Total Transaksi"
          value={formatNumber(stats.totalTransactions)}
          sub="Jumlah baris transaksi"
        />
        <HeroCard
          icon={Download}
          gradient="from-blue-500 via-sky-500 to-cyan-500"
          label="Total Downloader"
          value={formatNumber(stats.totalRealDownloader)}
          sub="Akumulasi unduhan app"
        />
      </div>

      {/* ============ METRIC CARDS (4 compact, termasuk Konversi) ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          color="violet"
          label="Unique Buyers"
          value={formatNumber(stats.uniqueBuyers)}
          sub="Distinct email"
        />
        <MetricCard
          icon={TrendingUp}
          color="amber"
          label="AOV"
          value={formatCurrency(stats.aov)}
          sub="Revenue / Transaksi"
        />
        <MetricCard
          icon={UserCheck}
          color="rose"
          label="User Repeat Order"
          value={formatNumber(stats.totalRepeatOrderUsers)}
          sub="≥ 2 trx_id (by email)"
        />
        <ConversionCard
          value={stats.progressConversion}
          transactions={stats.totalTransactions}
          downloader={stats.totalRealDownloader}
        />
      </div>

      <div className="relative bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        {/* Decorative accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-indigo-100/50 to-transparent rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-gradient-to-br from-amber-100/40 to-transparent rounded-full blur-3xl" />

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-1 h-14 rounded-full bg-gradient-to-b from-indigo-500 via-amber-400 to-rose-500" />
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-1.5">
                Analytics
              </p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Analisa Tren &amp; Performa
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1 max-w-md">
                Visualisasi data multi-app dengan kontrol fleksibel — pilih metrik,
                tipe chart, dan granularity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <TabGroup<Metric>
              options={['revenue', 'transactions', 'downloader', 'conversion']}
              value={chartMetric}
              onChange={setChartMetric}
            />
            <TabGroup<ChartType>
              options={['bar', 'line', 'area', 'pie', 'table']}
              value={chartType}
              onChange={setChartType}
            />
            <TabGroup<Granularity>
              options={['daily', 'weekly', 'monthly']}
              value={toggleGranularity}
              onChange={setChartGranularity}
            />
          </div>
        </div>

        <div className="relative h-[500px] mb-8">
          {chartType === 'table' ? (
            <TrendTable
              data={trendData}
              metric={chartMetric}
              hiddenApps={hiddenApps}
              appColors={appColors}
            />
          ) : (
            <FlexibleChart
              data={trendData}
              type={chartType}
              metric={chartMetric}
              appColors={appColors}
              onDrillDown={setDrillDown}
              hiddenApps={hiddenApps}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 pt-8 border-t border-slate-50">
          {Object.entries(appColors).map(([app, color]) => (
            <button
              key={app}
              onClick={() => {
                const next = new Set(hiddenApps);
                if (next.has(app)) next.delete(app);
                else next.add(app);
                setHiddenApps(next);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border transition-all',
                hiddenApps.has(app)
                  ? 'bg-slate-50 border-slate-100 grayscale opacity-50'
                  : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm',
              )}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{app}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Metode Pembayaran</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Distribusi berdasarkan {paymentChartMode === 'revenue' ? 'pendapatan' : 'jumlah transaksi'}
              </p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['revenue', 'transactions'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentChartMode(m)}
                  className={cn(
                    'px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase',
                    paymentChartMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={methodPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {COLORS.map((color, idx) => (
                    <Cell key={`cell-${idx}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    paymentChartMode === 'revenue' ? formatCurrency(value) : formatNumber(value)
                  }
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Waktu Pembelian (Jam)</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Distribusi transaksi berdasarkan jam</p>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hourPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {COLORS.map((color, idx) => (
                    <Cell key={`cell-${idx}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${formatNumber(value)} Transaksi`} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <DrillDownModal
        isOpen={!!drillDown}
        onClose={() => setDrillDown(null)}
        data={drillDown}
        metric={chartMetric}
        appColors={appColors}
      />
    </motion.div>
  );
};

// ============ Hero Card — card besar dengan gradient ============
interface HeroCardProps {
  icon: any;
  gradient: string; // tailwind gradient class (dari-... via-... to-...)
  label: string;
  value: string;
  sub: string;
}

const HeroCard = ({ icon: Icon, gradient, label, value, sub }: HeroCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className={cn(
      'relative overflow-hidden rounded-[2rem] p-7 text-white shadow-xl shadow-slate-200',
      'bg-gradient-to-br',
      gradient,
    )}
  >
    {/* Decorative rings */}
    <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/10" />
    <div className="absolute -right-4 -bottom-16 w-40 h-40 rounded-full bg-white/5" />

    <div className="relative flex items-start justify-between mb-10">
      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
        <Icon className="w-7 h-7 text-white" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{label}</p>
    </div>
    <div className="relative">
      <h3 className="text-3xl font-black tracking-tight leading-none mb-2">{value}</h3>
      <p className="text-[11px] font-bold text-white/80">{sub}</p>
    </div>
  </motion.div>
);

// ============ Metric Card — card kompak ============
interface MetricCardProps {
  icon: any;
  color: 'indigo' | 'emerald' | 'violet' | 'amber' | 'blue' | 'rose' | 'cyan';
  label: string;
  value: string;
  sub: string;
}

const metricTone = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  accent: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'bg-emerald-500' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  accent: 'bg-violet-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   accent: 'bg-amber-500' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    accent: 'bg-blue-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    accent: 'bg-rose-500' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    accent: 'bg-cyan-500' },
};

const MetricCard = ({ icon: Icon, color, label, value, sub }: MetricCardProps) => {
  const tone = metricTone[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all relative overflow-hidden group"
    >
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', tone.accent, 'opacity-80')} />

      <div className="flex items-center gap-3 mb-3">
        <div className={cn('p-2 rounded-xl transition-transform group-hover:scale-110', tone.bg, tone.text)}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
      <p className="text-[10px] text-slate-400 font-medium mt-1">{sub}</p>
    </motion.div>
  );
};

// ============ Conversion Card — dengan progress bar ============
interface ConversionCardProps {
  value: number; // persentase (0-100)
  transactions: number;
  downloader: number;
}

const ConversionCard = ({ value, transactions, downloader }: ConversionCardProps) => {
  const clamped = Math.max(0, Math.min(100, value));
  const isHealthy = value >= 20;
  const isLow = value < 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all relative overflow-hidden group"
    >
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          isLow ? 'bg-rose-500' : isHealthy ? 'bg-emerald-500' : 'bg-cyan-500',
        )}
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 transition-transform group-hover:scale-110">
            <Target className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konversi</p>
        </div>
        <span
          className={cn(
            'text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest',
            isLow
              ? 'bg-rose-50 text-rose-600'
              : isHealthy
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600',
          )}
        >
          {isLow ? 'Low' : isHealthy ? 'Good' : 'Fair'}
        </span>
      </div>

      <h3 className="text-2xl font-black text-slate-900 tracking-tight">
        {clamped.toFixed(2)}
        <span className="text-lg text-slate-400 font-bold">%</span>
      </h3>

      <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            isLow ? 'bg-rose-500' : isHealthy ? 'bg-emerald-500' : 'bg-cyan-500',
          )}
        />
      </div>

      <p className="text-[10px] text-slate-400 font-medium mt-2">
        {formatNumber(transactions)} trx / {formatNumber(downloader)} downloader
      </p>
    </motion.div>
  );
};

// ============ Trend Table — opsi alternatif chart, render data sebagai tabel ============
// Cuma tampilin tanggal + nilai metric. Apps yang di-hide di legend juga dihormati.
const METRIC_LABEL: Record<Metric, string> = {
  revenue: 'Revenue',
  transactions: 'Transaksi',
  downloader: 'Downloader',
  conversion: 'Konversi (%)',
};

function TrendTable({
  data, metric, hiddenApps, appColors,
}: {
  data: TrendItem[];
  metric: Metric;
  hiddenApps: Set<string>;
  appColors: Record<string, string>;
}) {
  const visibleApps = Object.keys(appColors).filter((a) => !hiddenApps.has(a));

  // Untuk konversi total: butuh total transaksi & downloader supaya bisa hitung %
  const valueFor = (item: TrendItem, app: string | null) => {
    if (app) {
      const breakdown = item.appBreakdown?.[app];
      if (!breakdown) return 0;
      if (metric === 'revenue') return breakdown.revenue;
      if (metric === 'transactions') return breakdown.transactions;
      if (metric === 'downloader') return breakdown.downloader;
      if (metric === 'conversion') {
        return breakdown.downloader > 0
          ? (breakdown.transactions / breakdown.downloader) * 100
          : 0;
      }
    }
    if (metric === 'revenue') return item.revenue;
    if (metric === 'transactions') return item.transactions;
    if (metric === 'downloader') return item.downloader;
    if (metric === 'conversion') return item.conversion;
    return 0;
  };

  const fmt = (val: number) => {
    if (metric === 'revenue') return formatCurrency(val);
    if (metric === 'conversion') return `${val.toFixed(2)}%`;
    return formatNumber(val);
  };

  // Hitung total kolom kanan (kalau visible apps > 0, baru tampilkan total)
  const total = data.reduce((acc, item) => {
    visibleApps.forEach((app) => {
      acc += valueFor(item, app);
    });
    return acc;
  }, 0);

  return (
    <div className="h-full overflow-auto custom-scrollbar rounded-2xl border border-slate-100">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <th className="py-3 px-4 bg-white">Tanggal</th>
            {visibleApps.length > 0 ? (
              visibleApps.map((app) => (
                <th key={app} className="py-3 px-4 bg-white text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: appColors[app] }}
                    />
                    {app}
                  </span>
                </th>
              ))
            ) : (
              <th className="py-3 px-4 bg-white text-right">{METRIC_LABEL[metric]}</th>
            )}
            {visibleApps.length > 1 && (
              <th className="py-3 px-4 bg-slate-50/50 text-right text-indigo-600">Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => {
            const rowTotal = visibleApps.reduce((s, app) => s + valueFor(item, app), 0);
            return (
              <tr
                key={i}
                className={cn(
                  'border-b border-slate-50 hover:bg-slate-50/50 transition-colors',
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20',
                )}
              >
                <td className="py-3 px-4 text-xs font-black text-slate-700">{item.name}</td>
                {visibleApps.length > 0 ? (
                  visibleApps.map((app) => {
                    const val = valueFor(item, app);
                    return (
                      <td key={app} className="py-3 px-4 text-xs font-bold text-slate-600 text-right tabular-nums">
                        {val > 0 || metric === 'conversion' ? fmt(val) : <span className="text-slate-300">–</span>}
                      </td>
                    );
                  })
                ) : (
                  <td className="py-3 px-4 text-xs font-black text-indigo-600 text-right tabular-nums">
                    {fmt(valueFor(item, null))}
                  </td>
                )}
                {visibleApps.length > 1 && (
                  <td className="py-3 px-4 text-xs font-black text-indigo-600 text-right tabular-nums bg-slate-50/30">
                    {fmt(rowTotal)}
                  </td>
                )}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={Math.max(2, visibleApps.length + 2)} className="py-12 text-center text-xs font-bold text-slate-400">
                Tidak ada data untuk filter ini.
              </td>
            </tr>
          )}
        </tbody>
        {data.length > 0 && metric !== 'conversion' && visibleApps.length > 1 && (
          <tfoot className="sticky bottom-0">
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td className="py-3 px-4 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                Total ({METRIC_LABEL[metric]})
              </td>
              {visibleApps.map((app) => {
                const sum = data.reduce((s, item) => s + valueFor(item, app), 0);
                return (
                  <td key={app} className="py-3 px-4 text-xs font-black text-indigo-700 text-right tabular-nums">
                    {fmt(sum)}
                  </td>
                );
              })}
              <td className="py-3 px-4 text-xs font-black text-indigo-700 text-right tabular-nums bg-indigo-100/50">
                {fmt(total)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function TabGroup<T extends string>({
  options, value, onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            'px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest',
            value === o ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default Overview;
