import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Activity, ChevronLeft, ChevronRight, Crown, Flame,
  MessageSquare, Package, ShoppingBag, Smartphone, TrendingUp, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { generateDailyInsight } from '../../lib/dailyInsight';
import type { AppData, AvailableOptions, Downloader, Transaction } from '../../types';

const compactRp = (v: number) => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
};

interface PackageCalendarProps {
  data: Transaction[];
  downloaderData: Downloader[];
  availableOptions: AvailableOptions;
  apps: AppData[];
  focusDate?: Date | null;
}

export const PackageCalendar = ({
  data, downloaderData, availableOptions, apps, focusDate,
}: PackageCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (focusDate) {
      setCurrentMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1));
      setSelectedDay(format(focusDate, 'yyyy-MM-dd'));
    }
  }, [focusDate]);

  const filteredData = useMemo(() => {
    if (!selectedApp) return data;
    return data.filter(d => d.source_app.toUpperCase() === selectedApp.toUpperCase());
  }, [data, selectedApp]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const activePackagesByDay = useMemo(() => {
    const map: Record<string, { packages: any[], appBreakdown: Record<string, { revenue: number, transactions: number }> }> = {};
    filteredData.forEach(item => {
      const dateStr = format(item.parsed_payment_date, 'yyyy-MM-dd');
      if (!map[dateStr]) map[dateStr] = { packages: [], appBreakdown: {} };
      
      const existingPkg = map[dateStr].packages.find(p => p.name === item.content_name);
      if (existingPkg) {
        existingPkg.revenue += item.revenue;
        existingPkg.transactions += 1;
        existingPkg.prices.push(item.revenue);
      } else {
        map[dateStr].packages.push({ 
          name: item.content_name, 
          revenue: item.revenue, 
          transactions: 1,
          prices: [item.revenue]
        });
      }

      const app = item.source_app || 'Unknown';
      if (!map[dateStr].appBreakdown[app]) {
        map[dateStr].appBreakdown[app] = { revenue: 0, transactions: 0 };
      }
      map[dateStr].appBreakdown[app].revenue += item.revenue;
      map[dateStr].appBreakdown[app].transactions += 1;
    });

    Object.keys(map).forEach(date => {
      map[date].packages = map[date].packages.map(p => ({
        ...p,
        minPrice: Math.min(...p.prices),
        maxPrice: Math.max(...p.prices),
        avgPrice: p.revenue / p.transactions
      }));
    });

    return map;
  }, [filteredData]);

  const selectedDayInsight = useMemo(() => {
    if (!selectedDay) return "";
    
    const dayRevenue = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
    const dayTransactions = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0;
    const dayDownloaders = downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).reduce((acc, curr) => acc + curr.count, 0);
    const dayStrategies = apps.map(app => ({
      appName: app.name,
      strategy: app.dailyData?.[selectedDay]
    })).filter(s => s.strategy);
    const daySocialContent = apps.flatMap(app => app.dailyData?.[selectedDay]?.socialContent || []);
    
    return generateDailyInsight(dayRevenue, dayTransactions, dayDownloaders, dayStrategies, daySocialContent);
  }, [selectedDay, activePackagesByDay, downloaderData, apps]);

  const selectedMonthPackages = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    const grouped: Record<string, any> = {};
    filteredData.forEach(item => {
      if (item.year_month === monthStr) {
        if (!grouped[item.content_name]) {
          grouped[item.content_name] = { 
            name: item.content_name, 
            revenue: 0, 
            transactions: 0,
            buyers: new Set(),
            prices: []
          };
        }
        grouped[item.content_name].revenue += item.revenue;
        grouped[item.content_name].transactions += 1;
        grouped[item.content_name].buyers.add(item.email || item.phone || item.full_name || item.trx_id);
        grouped[item.content_name].prices.push(item.revenue);
      }
    });
    return Object.values(grouped).map((p: any) => ({
      ...p,
      uniqueBuyers: p.buyers.size,
      minPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.min(a, b), p.prices[0]) : 0,
      maxPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.max(a, b), p.prices[0]) : 0,
      avgPrice: p.revenue / p.transactions
    })).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredData, currentMonth]);

  // Heatmap intensity + bulan-level KPI (supaya kalender ga flat)
  const { maxDayRevenue, monthTotals, topDay } = useMemo(() => {
    let max = 0;
    let totalRev = 0;
    let totalTx = 0;
    let topDate: string | null = null;
    let activeDays = 0;
    daysInMonth.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const pkgs = activePackagesByDay[key]?.packages ?? [];
      if (pkgs.length === 0) return;
      activeDays += 1;
      const rev = pkgs.reduce((s, p) => s + p.revenue, 0);
      const tx = pkgs.reduce((s, p) => s + p.transactions, 0);
      totalRev += rev;
      totalTx += tx;
      if (rev > max) {
        max = rev;
        topDate = key;
      }
    });
    return {
      maxDayRevenue: max,
      monthTotals: {
        revenue: totalRev,
        transactions: totalTx,
        activeDays,
        avgPerDay: activeDays > 0 ? totalRev / activeDays : 0,
      },
      topDay: topDate,
    };
  }, [daysInMonth, activePackagesByDay]);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  const goPrevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const goNextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-8">
      {/* Editorial header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 -mt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Kalender Aktivitas
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Kalender Marsel
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Visualisasi transaksi harian per paket — klik hari untuk lihat detail strategi &amp;
            konten sosial media.
          </p>
        </div>
      </div>

      <div className="relative bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        {/* Decorative */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-amber-100/60 to-transparent rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-60 h-60 bg-gradient-to-br from-indigo-100/40 to-transparent rounded-full blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-1 h-12 rounded-full bg-gradient-to-b from-amber-500 via-rose-400 to-indigo-500" />
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.25em] mb-1">
                {format(currentMonth, 'MMMM yyyy')}
              </p>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Transaksi Bulan Ini
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Klik tanggal dengan indikator untuk buka detail harian
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* App Filter */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <Smartphone className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-2 py-1.5 cursor-pointer"
              >
                <option value="">Semua App</option>
                {availableOptions.source_apps.map((app: string) => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
            </div>

            {/* Year & Month Selectors dengan prev/next */}
            <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Bulan sebelumnya"
                className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => setCurrentMonth(new Date(Number(e.target.value), currentMonth.getMonth(), 1))}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-3 py-1.5 cursor-pointer border-r border-slate-200"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={currentMonth.getMonth()}
                onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), Number(e.target.value), 1))}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-3 py-1.5 cursor-pointer"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Bulan berikutnya"
                className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI strip bulanan — revenue, transaksi, top day, rata2 per hari aktif */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 rounded-2xl text-white shadow-lg shadow-indigo-200/40">
            <div className="pointer-events-none absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1.5">Revenue Bulan Ini</p>
            <h3 className="text-xl font-black tracking-tight">{formatCurrency(monthTotals.revenue)}</h3>
            <p className="text-[9px] font-bold text-indigo-200 mt-1">{monthTotals.activeDays} hari aktif</p>
          </div>
          <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 bg-emerald-100/60 rounded-full blur-xl" />
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1 bg-emerald-50 rounded-md">
                <ShoppingBag className="w-3 h-3 text-emerald-600" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Transaksi</p>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{formatNumber(monthTotals.transactions)}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1">
              Avg {compactRp(monthTotals.activeDays > 0 ? monthTotals.transactions / monthTotals.activeDays : 0)}/hari
            </p>
          </div>
          <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 bg-amber-100/60 rounded-full blur-xl" />
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1 bg-amber-50 rounded-md">
                <Crown className="w-3 h-3 text-amber-600" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Hari Paling Ramai</p>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {topDay ? format(new Date(topDay), 'dd MMM') : '—'}
            </h3>
            <p className="text-[9px] font-bold text-amber-600 mt-1">{topDay ? formatCurrency(maxDayRevenue) : 'Belum ada data'}</p>
          </div>
          <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 bg-violet-100/60 rounded-full blur-xl" />
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1 bg-violet-50 rounded-md">
                <Flame className="w-3 h-3 text-violet-600" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rata-rata / Hari Aktif</p>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(monthTotals.avgPerDay)}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1">{monthTotals.activeDays > 0 ? 'Basis hari jualan' : 'Basis hari jualan'}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-3 mb-4">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
            <div key={day} className="text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
          {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const packages = activePackagesByDay[dateStr]?.packages || [];
            const hasActivity = packages.length > 0;
            const isSelected = selectedDay === dateStr;
            const isToday = dateStr === todayKey;
            const isTop = dateStr === topDay;
            const dow = day.getDay();
            const isWeekend = dow === 0 || dow === 6;

            // Heatmap tier — 0..4, dihitung dari revenue hari ini terhadap max bulan
            const dayRevenue = packages.reduce((s, p) => s + p.revenue, 0);
            const ratio = maxDayRevenue > 0 ? dayRevenue / maxDayRevenue : 0;
            const tier = !hasActivity ? 0 : ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;

            const heatmap = [
              // 0 — no activity
              isWeekend
                ? 'bg-slate-50/60 border-slate-100'
                : 'bg-white border-slate-100',
              // 1
              'bg-indigo-50 border-indigo-100 hover:bg-indigo-100',
              // 2
              'bg-indigo-100 border-indigo-200 hover:bg-indigo-200',
              // 3
              'bg-indigo-300/80 border-indigo-300 hover:bg-indigo-300',
              // 4 — hottest
              'bg-gradient-to-br from-indigo-500 to-violet-600 border-indigo-500 hover:from-indigo-600 hover:to-violet-700 text-white shadow-md shadow-indigo-200/50',
            ][tier];

            const dateColor =
              tier === 0 ? (isWeekend ? 'text-rose-300' : 'text-slate-300')
                : tier >= 4 ? 'text-white'
                  : tier >= 3 ? 'text-indigo-900'
                    : 'text-indigo-700';

            const amountColor =
              tier >= 4 ? 'text-white/90' : tier >= 3 ? 'text-indigo-900' : 'text-indigo-600';

            return (
              <div
                key={dateStr}
                onClick={() => hasActivity && setSelectedDay(isSelected ? null : dateStr)}
                className={cn(
                  'aspect-square rounded-2xl border p-2 flex flex-col items-center justify-between transition-all relative group',
                  heatmap,
                  hasActivity && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
                  isSelected && 'ring-2 ring-indigo-500 ring-offset-2 scale-[1.04] z-10',
                  isToday && !isSelected && 'ring-2 ring-amber-400 ring-offset-1',
                )}
              >
                {/* Top row: date + optional crown */}
                <div className="w-full flex items-start justify-between">
                  <span className={cn('text-xs md:text-sm font-black leading-none', dateColor)}>
                    {format(day, 'd')}
                  </span>
                  {isTop && hasActivity && (
                    <Crown className={cn('w-3 h-3', tier >= 4 ? 'text-amber-300' : 'text-amber-500')} />
                  )}
                </div>

                {/* Revenue amount (compact) */}
                {hasActivity && (
                  <div className="w-full text-center">
                    <p className={cn('text-[9px] md:text-[10px] font-black tracking-tight leading-none', amountColor)}>
                      {compactRp(dayRevenue)}
                    </p>
                    <p className={cn(
                      'text-[7px] md:text-[8px] font-bold uppercase tracking-widest mt-0.5 leading-none',
                      tier >= 4 ? 'text-indigo-100' : 'text-slate-400',
                    )}>
                      {packages.length} pkt
                    </p>
                  </div>
                )}

                {/* Today badge */}
                {isToday && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow">
                    Ini
                  </span>
                )}

                {/* Tooltip */}
                {hasActivity && !isSelected && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        {format(day, 'dd MMM')}
                      </p>
                      <p className="text-[9px] font-black text-indigo-400">{formatCurrency(dayRevenue)}</p>
                    </div>
                    <div className="space-y-1.5">
                      {packages.slice(0, 3).map((p, i) => (
                        <div key={i} className="flex justify-between items-center gap-2">
                          <span className="text-[9px] font-bold truncate">{p.name}</span>
                          <span className="text-[9px] font-black text-indigo-400">{p.transactions}x</span>
                        </div>
                      ))}
                      {packages.length > 3 && <p className="text-[8px] text-slate-400 italic">+{packages.length - 3} paket lainnya</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend heatmap */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Intensitas</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-md bg-white border border-slate-100" title="Tanpa transaksi" />
              <span className="w-3 h-3 rounded-md bg-indigo-50 border border-indigo-100" />
              <span className="w-3 h-3 rounded-md bg-indigo-100 border border-indigo-200" />
              <span className="w-3 h-3 rounded-md bg-indigo-300/80 border border-indigo-300" />
              <span className="w-3 h-3 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 border border-indigo-500" title="Paling ramai" />
            </div>
            <span className="text-[9px] font-bold text-slate-400">Sedikit → Banyak</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md ring-2 ring-amber-400" />
              Hari ini
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-500" />
              Top day
            </span>
          </div>
        </div>

        {/* Daily Detail View */}
        <AnimatePresence mode="wait">
          {selectedDay && activePackagesByDay[selectedDay] && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 pt-8 border-t border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Detail Transaksi - {format(new Date(selectedDay), 'dd MMMM yyyy')}
                </h4>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="text-[10px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors"
                >
                  Tutup
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Revenue</p>
                  <h3 className="text-xl font-black text-indigo-600">
                    {formatCurrency(activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(activePackagesByDay[selectedDay]?.appBreakdown || {}).map(([app, vals]: [string, any]) => (
                      <span key={app} className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {app}: {formatCurrency(vals.revenue)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Transaksi</p>
                  <h3 className="text-xl font-black text-emerald-600">
                    {formatNumber(activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(activePackagesByDay[selectedDay]?.appBreakdown || {}).map(([app, vals]: [string, any]) => (
                      <span key={app} className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {app}: {formatNumber(vals.transactions)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Downloader</p>
                  <h3 className="text-xl font-black text-violet-600">
                    {formatNumber(downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).reduce((acc, curr) => acc + curr.count, 0))}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).map((d, i) => (
                      <span key={i} className="text-[8px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                        {d.source_app}: {d.count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">AOV Harian</p>
                  <h3 className="text-xl font-black text-amber-600">
                    {(() => {
                      const rev = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
                      const trx = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0;
                      return trx ? formatCurrency(rev / trx) : 'Rp0';
                    })()}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 border border-slate-100 rounded-2xl">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 border-b border-slate-50 sticky top-0 bg-white z-20 flex items-center gap-2">
                    <ShoppingBag className="w-3 h-3 text-emerald-600" />
                    Detail Transaksi
                  </h5>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-10 bg-white z-10">
                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-4 px-4 bg-white">Nama Paket</th>
                        <th className="py-4 px-4 bg-white">Revenue</th>
                        <th className="py-4 px-4 bg-white">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...activePackagesByDay[selectedDay].packages].sort((a, b) => b.revenue - a.revenue).map((pkg, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                          <td className="py-4 px-4 align-top">
                            <div className="text-xs font-black text-slate-700 max-w-[250px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={pkg.name}>
                              {pkg.name}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs font-black text-indigo-600 align-top">{formatCurrency(pkg.revenue)}</td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-500 align-top">{formatNumber(pkg.transactions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    Strategi & Aktivitas Operasional
                  </h5>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {apps.filter(app => !selectedApp || app.name.toUpperCase() === selectedApp.toUpperCase()).map(app => {
                      const dayData = app.dailyData?.[selectedDay];
                      if (!dayData) return null;
                      
                      const hasStrategy = dayData.strategy || dayData.benefit || dayData.event || dayData.activity || dayData.bcan || dayData.story || dayData.chat;
                      if (!hasStrategy) return null;

                      return (
                        <div key={app.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <p className="text-[9px] font-black text-indigo-600 uppercase mb-2">{app.name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {dayData.strategy && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">User Premium</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.strategy}</p>
                              </div>
                            )}
                            {dayData.benefit && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Benefit</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.benefit}</p>
                              </div>
                            )}
                            {dayData.event && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Event</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.event}</p>
                              </div>
                            )}
                            {dayData.activity && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Aktivitas</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.activity}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Social Media & Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-indigo-600" />
                    Konten Sosial Media
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {apps.flatMap(app => app.dailyData?.[selectedDay as string]?.socialContent || []).map((content, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between mb-2">
                          <span className="text-[8px] font-black text-indigo-600 uppercase">{content.platform}</span>
                          <span className="text-[8px] font-bold text-slate-400">{content.postingTime} WIB</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 mb-2">{content.title || 'Tanpa Judul'}</p>
                        <p className="text-[10px] text-slate-500 mb-3 line-clamp-2">{content.caption}</p>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Reach</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.reach)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Eng</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.engagement)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Views</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.views)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">Type: {content.contentType}</span>
                          {content.cta && <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">CTA: {content.cta}</span>}
                          <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">Obj: {content.objective}</span>
                        </div>
                      </div>
                    ))}
                    {apps.every(app => !app.dailyData?.[selectedDay as string]?.socialContent?.length) && (
                      <div className="col-span-full py-8 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Belum ada data konten</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-2xl text-white">
                  <h5 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-white" />
                    Auto-Generated Insights
                  </h5>
                  <p className="text-[11px] leading-relaxed opacity-90 italic">
                    {selectedDayInsight}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[8px] font-bold text-indigo-200 uppercase tracking-widest">Sebab-Akibat Analysis</p>
                    <p className="text-[10px] mt-1 text-white/80">Analisa ini dibuat secara otomatis berdasarkan korelasi data konten, strategi operasional, dan performa sales harian.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedDay && (
          <div className="pt-8 border-t border-slate-100">
          <h4 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Detail Performa Paket - {format(currentMonth, 'MMMM yyyy')}
          </h4>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-4">Nama Paket</th>
                  <th className="py-4 px-4">Revenue</th>
                  <th className="py-4 px-4">Transactions</th>
                  <th className="py-4 px-4 text-emerald-600">Low Price</th>
                  <th className="py-4 px-4 text-indigo-600">Avg Price</th>
                  <th className="py-4 px-4 text-rose-600">High Price</th>
                </tr>
              </thead>
              <tbody>
                {selectedMonthPackages.map((pkg: any, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                    <td className="py-4 px-4 align-top">
                      <div className="text-xs font-black text-slate-700 max-w-[250px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={pkg.name}>
                        {pkg.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-black text-indigo-600 align-top">{formatCurrency(pkg.revenue)}</td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-500 align-top">{formatNumber(pkg.transactions)}</td>
                    <td className="py-4 px-4 text-xs font-black text-emerald-600 bg-emerald-50/30 align-top">{formatCurrency(pkg.minPrice)}</td>
                    <td className="py-4 px-4 text-xs font-black text-indigo-600 bg-indigo-50/30 align-top">{formatCurrency(pkg.avgPrice)}</td>
                    <td className="py-4 px-4 text-xs font-black text-rose-600 bg-rose-50/30 align-top">{formatCurrency(pkg.maxPrice)}</td>
                  </tr>
                ))}
                {selectedMonthPackages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <p className="text-sm font-bold text-slate-400">Tidak ada data transaksi di periode ini.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

export default PackageCalendar;
