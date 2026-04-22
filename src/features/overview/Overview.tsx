import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, DollarSign, Download, ShoppingBag, TrendingUp, UserCheck, Users,
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

type ChartType = 'bar' | 'line' | 'area' | 'pie';
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
      <FilterSection filters={filters} setFilters={setFilters} availableOptions={availableOptions} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard icon={DollarSign} color="indigo" title="Total Revenue" value={formatCurrency(stats.totalRevenue)} subtitle="Sum revenue semua baris" />
        <SummaryCard icon={ShoppingBag} color="emerald" title="Total Transaksi" value={formatNumber(stats.totalTransactions)} subtitle={`${formatNumber(stats.totalUniqueOrders)} order unik`} />
        <SummaryCard icon={Users} color="violet" title="Unique Buyers" value={formatNumber(stats.uniqueBuyers)} subtitle="Distinct email (non-kosong)" />
        <SummaryCard icon={TrendingUp} color="amber" title="AOV" value={formatCurrency(stats.aov)} subtitle="Revenue / Order unik" />
        <SummaryCard icon={Download} color="blue" title="Downloader" value={formatNumber(stats.totalRealDownloader)} subtitle="Sum count unduhan" />
        <SummaryCard icon={UserCheck} color="rose" title="User Repeat Order" value={formatNumber(stats.totalRepeatOrderUsers)} subtitle="≥ 2 order unik (global, by email)" />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Analisa Tren & Performa</h3>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Visualisasi data multi-app dengan kontrol fleksibel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <TabGroup<Metric>
              options={['revenue', 'transactions', 'downloader', 'conversion']}
              value={chartMetric}
              onChange={setChartMetric}
            />
            <TabGroup<ChartType>
              options={['bar', 'line', 'area', 'pie']}
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

        <div className="h-[500px] mb-8">
          <FlexibleChart
            data={trendData}
            type={chartType}
            metric={chartMetric}
            appColors={appColors}
            onDrillDown={setDrillDown}
            hiddenApps={hiddenApps}
          />
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

interface SummaryCardProps {
  icon: any;
  color: 'indigo' | 'emerald' | 'violet' | 'amber' | 'blue' | 'rose';
  title: string;
  value: string;
  subtitle: string;
}
const colorMap = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  rose: 'bg-rose-50 text-rose-600',
};
const SummaryCard = ({ icon: Icon, color, title, value, subtitle }: SummaryCardProps) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-3">
      <div className={cn('p-2 rounded-xl', colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
    </div>
    <h3 className="text-xl font-black text-slate-900">{value}</h3>
    <p className="text-[9px] text-slate-400 font-medium mt-1">{subtitle}</p>
  </div>
);

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
