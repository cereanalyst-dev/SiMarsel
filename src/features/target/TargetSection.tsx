import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import {
  Activity, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  Loader2, MessageSquare, RefreshCw, Smartphone, Target, XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/Toast';
import {
  useMarkazSyncStates, triggerMarkazSync,
} from '../../lib/markazSyncClient';
import type { AppData, Downloader, Transaction } from '../../types';

import { classifyPromo, type PromoCategory } from '../../lib/promoRules';

// Helper: parse "1.000" / "1,000" / "1000" → 1000.
const parseFormattedNumber = (s: string): number => {
  const cleaned = s.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
};

interface TargetSectionProps {
  apps: AppData[];
  setApps: (a: AppData[]) => void;
  selectedAppId: string;
  setSelectedAppId: (id: string) => void;
  targetMonth: string;
  setTargetMonth: (m: string) => void;
  setActiveTab: (tab: string) => void;
  setCalendarFocusDate: (d: Date | null) => void;
  // Auto-sourced dari database — tidak perlu input manual
  transactions?: Transaction[];
  downloaders?: Downloader[];
  // Callback parent untuk re-fetch dashboard data setelah sync Markaz sukses
  onMarkazSyncComplete?: () => void | Promise<void>;
}

export const TargetSection = ({
  apps,
  setApps,
  selectedAppId,
  setSelectedAppId,
  targetMonth,
  setTargetMonth,
  setActiveTab,
  setCalendarFocusDate,
  transactions = [],
  downloaders = [],
  onMarkazSyncComplete,
}: TargetSectionProps) => {
  const toast = useToast();
  const [showAppSelection, setShowAppSelection] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('All');
  const selectedApp = apps.find(a => a.id === selectedAppId) || apps[0];

  // Markaz sync states — supaya bisa nampilin "Data terakhir" + tombol
  // sync inline di tiap card platform.
  const { states: markazStates, refresh: refreshMarkaz } = useMarkazSyncStates();
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

  // Map platform name (lowercase) → MarkazSyncState untuk lookup cepat
  const markazByPlatform = useMemo(() => {
    const map = new Map<string, typeof markazStates[number]>();
    markazStates.forEach((s) => map.set(s.platform.toLowerCase(), s));
    return map;
  }, [markazStates]);

  const handleSyncPlatform = async (platformName: string) => {
    const platform = platformName.trim().toLowerCase();
    setSyncingPlatform(platform);
    try {
      const res = await triggerMarkazSync(platform);
      if (res.ok) {
        toast.success(
          'Sync sukses',
          `${platform.toUpperCase()}: ${res.successes ?? 0} sukses · ${res.errors ?? 0} error`,
        );
        await refreshMarkaz();
        if (onMarkazSyncComplete) await onMarkazSyncComplete();
      } else {
        toast.error(`Gagal sync ${platform}`, res.error ?? 'Unknown error');
      }
    } finally {
      setSyncingPlatform(null);
    }
  };

  const filteredAppsForSummary = useMemo(() => {
    if (platformFilter === 'All') return apps;
    return apps.filter(app => app.name === platformFilter);
  }, [apps, platformFilter]);
  
  // Get unique months from data for selection
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const now = new Date();
    // Add next 12 months and past 12 months
    for (let i = -12; i <= 12; i++) {
      months.add(format(new Date(now.getFullYear(), now.getMonth() + i, 1), 'yyyy-MM'));
    }
    return Array.from(months).sort();
  }, []);

  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const filteredMonths = useMemo(() => {
    return availableMonths.filter(m => m.startsWith(selectedYear));
  }, [availableMonths, selectedYear]);

  const emptyTargetForm = {
    targetDownloader: 0,
    targetRepeatOrder: 0,
    targetSales: 0,
    targetConversion: 0,
    avgPrice: 0,
  };

  const [form, setForm] = useState(selectedApp.targetConfig?.[targetMonth] || emptyTargetForm);

  useEffect(() => {
    setForm(selectedApp.targetConfig?.[targetMonth] || emptyTargetForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId, targetMonth, selectedApp.targetConfig]);

  const daysInMonthCount = useMemo(() => {
    const [year, month] = targetMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [targetMonth]);

  const dates = useMemo(() => {
    const [year, month] = targetMonth.split('-').map(Number);
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      return format(new Date(year, month - 1, i + 1), 'yyyy-MM-dd');
    });
  }, [targetMonth, daysInMonthCount]);

  // ==============================================================
  // Auto-fill actuals dari database, keyed by APP_NAME_UPPER → DATE_KEY.
  //   • downloader = SUM(count) dari tabel downloaders
  //   • sales      = SUM(revenue) dari transactions
  //   • premium    = COUNT(DISTINCT trx_id) per (app, date)
  //
  // Dipakai oleh: operational sheet, summary, globalSummary, recap.
  // User tidak perlu isi Real manual — semua auto dari DB.
  // ==============================================================
  type ActualRow = {
    downloader: number;
    sales: number;
    trxIds: Set<string>;
    promo: Record<PromoCategory, number>;
  };
  const actualsByAppByDate = useMemo(() => {
    const outer = new Map<string, Map<string, ActualRow>>();
    const emptyPromo = (): Record<PromoCategory, number> => ({
      'Sales': 0, 'Marketing': 0, 'Aplikasi': 0, 'Live': 0,
      'Lainnya': 0, 'Artikel': 0, 'Tanpa Kode': 0,
    });
    const ensure = (appKey: string, dateKey: string): ActualRow => {
      let inner = outer.get(appKey);
      if (!inner) {
        inner = new Map();
        outer.set(appKey, inner);
      }
      let row = inner.get(dateKey);
      if (!row) {
        row = { downloader: 0, sales: 0, trxIds: new Set(), promo: emptyPromo() };
        inner.set(dateKey, row);
      }
      return row;
    };

    downloaders.forEach((d) => {
      const appKey = (d.source_app ?? '').trim().toUpperCase();
      if (!appKey) return;
      const raw = typeof d.date === 'string'
        ? d.date
        : d.parsed_date instanceof Date
          ? format(d.parsed_date, 'yyyy-MM-dd')
          : '';
      const dateKey = raw.slice(0, 10);
      if (!dateKey) return;
      ensure(appKey, dateKey).downloader += Number(d.count) || 0;
    });

    transactions.forEach((t) => {
      const appName = (t.source_app ?? '').trim();
      const appKey = appName.toUpperCase();
      if (!appKey) return;
      const dateKey = t.parsed_payment_date instanceof Date
        ? format(t.parsed_payment_date, 'yyyy-MM-dd')
        : typeof t.payment_date === 'string'
          ? String(t.payment_date).slice(0, 10)
          : '';
      if (!dateKey) return;
      const row = ensure(appKey, dateKey);
      row.sales += Number(t.revenue) || 0;
      const trxId = (t.trx_id ?? '').trim();
      if (trxId) row.trxIds.add(trxId);
      // Klasifikasi promo per transaksi → tally ke kategori-nya
      const category = classifyPromo(t.promo_code, appName);
      row.promo[category] += 1;
    });

    return outer;
  }, [transactions, downloaders]);

  // Helper untuk ambil actuals per app+date
  const emptyPromoCount = (): Record<PromoCategory, number> => ({
    'Sales': 0, 'Marketing': 0, 'Aplikasi': 0, 'Live': 0,
    'Lainnya': 0, 'Artikel': 0, 'Tanpa Kode': 0,
  });
  const getActual = (appName: string | undefined, dateKey: string) => {
    if (!appName) return { downloader: 0, sales: 0, premium: 0, promo: emptyPromoCount() };
    const row = actualsByAppByDate.get(appName.trim().toUpperCase())?.get(dateKey);
    if (!row) return { downloader: 0, sales: 0, premium: 0, promo: emptyPromoCount() };
    return {
      downloader: row.downloader,
      sales: row.sales,
      premium: row.trxIds.size,
      promo: row.promo,
    };
  };

  const handleGenerateSheet = () => {
    const dailyDownloader = Math.ceil(form.targetDownloader / daysInMonthCount);
    const dailySales = Math.ceil(form.targetSales / daysInMonthCount);
    const dailyRepeatOrder = Math.ceil(form.targetRepeatOrder / daysInMonthCount);

    const existingDaily = selectedApp.dailyData || {};
    const newDailyData: Record<string, any> = { ...existingDaily };
    dates.forEach(date => {
      const prev = existingDaily[date] || {};
      newDailyData[date] = {
        targetDownloader: dailyDownloader,
        targetSales: dailySales,
        targetRepeatOrder: dailyRepeatOrder,
        // preserve any already-entered actuals so regenerate won't wipe user work
        actualDownloader: prev.actualDownloader ?? null,
        actualSales: prev.actualSales ?? null,
        actualRepeatOrder: prev.actualRepeatOrder ?? null,
        estimasiHarga: form.avgPrice,
        channel: prev.channel || '',
        promo: prev.promo || '',
        strategy: prev.strategy || '',
        benefit: prev.benefit || '',
        event: prev.event || '',
        extra: prev.extra || '',
        bcan: prev.bcan || '',
        story: prev.story || '',
        chat: prev.chat || '',
        activity: prev.activity || '',
        socialContent: prev.socialContent || [],
      };
    });

    const newTargetConfig = { ...(selectedApp.targetConfig || {}) };
    newTargetConfig[targetMonth] = form;

    const newIsTargetSet = { ...(selectedApp.isTargetSet || {}) };
    newIsTargetSet[targetMonth] = true;

    setApps(apps.map(a => a.id === selectedAppId ? { 
      ...a, 
      targetConfig: newTargetConfig, 
      dailyData: newDailyData,
      isTargetSet: newIsTargetSet
    } : a));
  };

  const updateDailyValue = (date: string, field: string, value: any) => {
    const newDailyData = { ...selectedApp.dailyData };
    if (!newDailyData[date]) {
      newDailyData[date] = {};
    }
    newDailyData[date][field] = value;
    setApps(apps.map(a => a.id === selectedAppId ? { ...a, dailyData: newDailyData } : a));
  };

  const isTargetSetForMonth = selectedApp.isTargetSet?.[targetMonth];

  const summary = useMemo(() => {
    // Real — prioritas manual override (dailyData.actualX) > auto DB.
    // Konsisten dengan cell di operational sheet + globalSummary.
    let totalRealDownloader = 0;
    let totalRealSales = 0;
    let totalRealRepeatOrder = 0;
    dates.forEach((date) => {
      const dayData = selectedApp.dailyData?.[date] ?? {};
      const a = getActual(selectedApp.name, date);
      totalRealDownloader += dayData.actualDownloader != null
        ? Number(dayData.actualDownloader) : a.downloader;
      totalRealSales += dayData.actualSales != null
        ? Number(dayData.actualSales) : a.sales;
      totalRealRepeatOrder += dayData.actualRepeatOrder != null
        ? Number(dayData.actualRepeatOrder) : a.premium;
    });

    const targetConfig = selectedApp.targetConfig?.[targetMonth] || {
      targetDownloader: 0,
      targetSales: 0,
      targetRepeatOrder: 0,
      targetConversion: 0,
      avgPrice: 0
    };

    const progressDownloader = targetConfig.targetDownloader > 0
      ? (totalRealDownloader / targetConfig.targetDownloader) * 100
      : 0;
    const progressSales = targetConfig.targetSales > 0
      ? (totalRealSales / targetConfig.targetSales) * 100
      : 0;
    const progressConversion = totalRealDownloader > 0
      ? (totalRealRepeatOrder / totalRealDownloader) * 100
      : 0;

    // Selisih Sales = total real - total target (formula simpel).
    // - Negatif → Kekurangan (real < target)
    // - Positif → Kelebihan (real > target)
    const selisihSales = totalRealSales - (targetConfig.targetSales || 0);

    return {
      totalRealDownloader,
      totalRealSales,
      totalRealRepeatOrder,
      progressDownloader,
      progressSales,
      progressConversion,
      selisihSales,
      targetConfig,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, targetMonth, dates, actualsByAppByDate]);

  const globalSummary = useMemo(() => {
    let totalTargetDownloader = 0;
    let totalRealDownloader = 0;
    let totalTargetSales = 0;
    let totalRealSales = 0;
    let totalTargetRepeatOrder = 0;
    let totalRealRepeatOrder = 0;

    filteredAppsForSummary.forEach(app => {
      const targetConfig = app.targetConfig?.[targetMonth];
      if (targetConfig) {
        totalTargetDownloader += targetConfig.targetDownloader || 0;
        totalTargetSales += targetConfig.targetSales || 0;
        totalTargetRepeatOrder += targetConfig.targetRepeatOrder || 0;
      }

      // Real — prioritas manual override (dailyData.actualX), fallback ke DB
      dates.forEach((date) => {
        const dayData = app.dailyData?.[date] ?? {};
        const a = getActual(app.name, date);
        totalRealDownloader += dayData.actualDownloader != null
          ? Number(dayData.actualDownloader)
          : a.downloader;
        totalRealSales += dayData.actualSales != null
          ? Number(dayData.actualSales)
          : a.sales;
        totalRealRepeatOrder += dayData.actualRepeatOrder != null
          ? Number(dayData.actualRepeatOrder)
          : a.premium;
      });
    });

    // Selisih Sales = total real - total target (semua platform / app)
    // Negatif → Kekurangan, Positif → Kelebihan
    const totalSelisihSales = totalRealSales - totalTargetSales;

    return {
      totalTargetDownloader,
      totalRealDownloader,
      totalTargetSales,
      totalRealSales,
      totalTargetRepeatOrder,
      totalRealRepeatOrder,
      totalSelisihSales,
      downloaderProgress: totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0,
      salesProgress: totalTargetSales > 0 ? (totalRealSales / totalTargetSales) * 100 : 0,
      conversionProgress: totalRealDownloader > 0 ? (totalRealRepeatOrder / totalRealDownloader) * 100 : 0
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAppsForSummary, targetMonth, dates, actualsByAppByDate]);

  if (showAppSelection) {
    return (
      <div className="space-y-10">
        {/* Editorial header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                Operasional Harian
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Strategi &amp; Target
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
              Atur target bulanan per aplikasi, tracking aktual harian, dan monitor kekurangan/kelebihan
              sales secara real-time.
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Periode
            </p>
            <p className="text-xl font-black text-slate-900 tracking-tight mt-1">
              {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Global Summary Dashboard */}
        <div className="relative bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
          {/* Subtle decorative accent */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-indigo-100/50 to-transparent rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-start gap-4">
              <div className="w-1 h-12 rounded-full bg-gradient-to-b from-indigo-500 via-amber-400 to-rose-500" />
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-1">
                  Analytics
                </p>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Ringkasan Semua Platform
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Akumulasi performa dari seluruh aplikasi di bulan{' '}
                  {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}
                </p>
              </div>
            </div>

            {/* Global Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  aria-label="Filter platform"
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  <option value="All">Semua Platform</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.name}>{app.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Filter tahun"
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  {Array.from(new Set(availableMonths.map((m) => m.split('-')[0]))).sort().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3">
                <select 
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  {filteredMonths.map(m => (
                    <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Downloader</p>
              <h3 className="text-xl font-black text-indigo-600">{globalSummary.downloaderProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.downloaderProgress)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Sales</p>
              <h3 className="text-xl font-black text-emerald-600">{globalSummary.salesProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.salesProgress)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-violet-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progres Konversi</p>
              <h3 className="text-xl font-black text-violet-600">{globalSummary.conversionProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-violet-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.conversionProgress)}%` }} />
              </div>
            </div>
            {(() => {
              const s = globalSummary.totalSelisihSales;
              const isSurplus = s >= 0;
              return (
                <div
                  className={cn(
                    'p-5 rounded-3xl border shadow-sm transition-all',
                    isSurplus
                      ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50'
                      : 'bg-rose-50 border-rose-100 hover:bg-rose-100/50',
                  )}
                >
                  <p
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-widest mb-2',
                      isSurplus ? 'text-emerald-500' : 'text-rose-400',
                    )}
                  >
                    {isSurplus ? 'Kelebihan Sales' : 'Kekurangan Sales'}
                  </p>
                  <h3
                    className={cn(
                      'text-xl font-black',
                      isSurplus ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {isSurplus ? '+' : '-'}
                    {formatCurrency(Math.abs(s))}
                  </h3>
                  <p
                    className={cn(
                      'text-[8px] font-bold mt-1',
                      isSurplus ? 'text-emerald-500' : 'text-rose-400',
                    )}
                  >
                    {isSurplus ? 'Di atas target s/d hari ini' : 'Defisit s/d hari ini'}
                  </p>
                </div>
              );
            })()}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Downloader</p>
              <h3 className="text-xl font-black text-slate-900">{formatNumber(globalSummary.totalRealDownloader)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatNumber(globalSummary.totalTargetDownloader)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Sales</p>
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(globalSummary.totalRealSales)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatCurrency(globalSummary.totalTargetSales)}</p>
            </div>
          </div>

          {/* Target Recap Table */}
          <div className="mt-10 pt-10 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-50 rounded-xl">
                <Target className="w-4 h-4 text-violet-600" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Rekapitulasi Target All Platform</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="py-4 px-4">Platform</th>
                    <th className="py-4 px-4">Progress Downloader</th>
                    <th className="py-4 px-4">Progress Sales</th>
                    <th className="py-4 px-4">Progres Konversi</th>
                    <th className="py-4 px-4">Selisih Sales</th>
                    <th className="py-4 px-4">Total Real Downloader</th>
                    <th className="py-4 px-4">Total Real Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppsForSummary.map(app => {
                    const target = app.targetConfig?.[targetMonth];
                    let appRealDownloader = 0;
                    let appRealSales = 0;
                    let appRealRepeatOrder = 0;

                    // Real per app — prioritas manual override > DB
                    dates.forEach((date) => {
                      const dayData = app.dailyData?.[date] ?? {};
                      const a = getActual(app.name, date);
                      appRealDownloader += dayData.actualDownloader != null
                        ? Number(dayData.actualDownloader) : a.downloader;
                      appRealSales += dayData.actualSales != null
                        ? Number(dayData.actualSales) : a.sales;
                      appRealRepeatOrder += dayData.actualRepeatOrder != null
                        ? Number(dayData.actualRepeatOrder) : a.premium;
                    });

                    const progressDownloader = target?.targetDownloader > 0 ? (appRealDownloader / target.targetDownloader) * 100 : 0;
                    const progressSales = target?.targetSales > 0 ? (appRealSales / target.targetSales) * 100 : 0;
                    const progressConversion = appRealDownloader > 0 ? (appRealRepeatOrder / appRealDownloader) * 100 : 0;

                    // Selisih = real - target (sederhana)
                    const selisihSales = appRealSales - (target?.targetSales || 0);
                    const isSurplus = selisihSales >= 0;

                    return (
                      <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                        <td className="py-4 px-4 text-xs font-black text-slate-700">{app.name}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600">{progressDownloader.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, progressDownloader)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-600">{progressSales.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, progressSales)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-violet-600">{progressConversion.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, progressConversion)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className={cn('py-4 px-4 text-xs font-black', isSurplus ? 'text-emerald-600' : 'text-rose-600')}>
                          <span className="inline-flex items-center gap-1">
                            <span>{isSurplus ? '+' : '-'}</span>
                            {formatCurrency(Math.abs(selisihSales))}
                          </span>
                          <span className={cn('block text-[9px] font-bold uppercase tracking-widest mt-0.5', isSurplus ? 'text-emerald-400' : 'text-rose-400')}>
                            {isSurplus ? 'Kelebihan' : 'Kekurangan'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-500">{formatNumber(appRealDownloader)}</td>
                        <td className="py-4 px-4 text-xs font-black text-slate-900">{formatCurrency(appRealSales)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 mt-2">
          <div className="w-1 h-12 rounded-full bg-gradient-to-b from-emerald-500 via-amber-400 to-rose-500" />
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em] mb-1">
              Operasional
            </p>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Pilih Aplikasi
            </h2>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Daftar aplikasi auto-sync dari database. Klik kartu untuk mengatur target.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {apps.map((app, idx) => {
            const configuredMonths = Object.keys(app.targetConfig || {}).length;
            // Rotate accent color for visual variety
            const accents = [
              { gradient: 'from-indigo-500 to-violet-500', bg: 'bg-indigo-50', text: 'text-indigo-600' },
              { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
              { gradient: 'from-rose-500 to-pink-500', bg: 'bg-rose-50', text: 'text-rose-600' },
              { gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-600' },
              { gradient: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-50', text: 'text-cyan-600' },
            ];
            const accent = accents[idx % accents.length];

            return (
              <motion.div
                key={app.id}
                whileHover={{ y: -4 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white rounded-3xl border border-slate-100 overflow-hidden cursor-pointer hover:shadow-xl hover:border-slate-200 transition-all relative"
              >
                <div
                  onClick={() => {
                    setSelectedAppId(app.id);
                    setShowAppSelection(false);
                  }}
                  className="absolute inset-0 z-0"
                  role="button"
                  aria-label={`Pilih aplikasi ${app.name}`}
                />

                {/* Top accent bar */}
                <div className={cn('h-1 bg-gradient-to-r', accent.gradient)} />

                <div className="relative z-10 p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110', accent.bg)}>
                      <Smartphone className={cn('w-6 h-6', accent.text)} />
                    </div>
                    <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg', accent.bg, accent.text)}>
                      {configuredMonths > 0 ? `${configuredMonths} Bulan` : 'Kosong'}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 mb-1 px-1 truncate">
                    {app.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                    Klik untuk atur target
                  </p>

                  {/* Markaz inline sync — tampil status terakhir + tombol fetch */}
                  <MarkazInlineSync
                    appName={app.name}
                    syncState={markazByPlatform.get(app.name.trim().toLowerCase()) ?? null}
                    isSyncing={syncingPlatform === app.name.trim().toLowerCase()}
                    onSync={() => void handleSyncPlatform(app.name)}
                  />

                  <div
                    onClick={() => {
                      setSelectedAppId(app.id);
                      setShowAppSelection(false);
                    }}
                    className={cn('flex items-center justify-between pt-3 mt-3 border-t border-slate-100', accent.text)}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Atur Target</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* App & Month Selector */}
      <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAppSelection(true)}
            className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-900">{selectedApp.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengaturan Target</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent border-none text-xs font-black text-slate-600 outline-none px-4 py-1.5 cursor-pointer border-r border-slate-200"
          >
            {Array.from(new Set(availableMonths.map(m => m.split('-')[0]))).sort().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select 
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="bg-transparent border-none text-xs font-black text-slate-600 outline-none px-4 py-1.5 cursor-pointer"
          >
            {filteredMonths.map(m => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM')}</option>
            ))}
          </select>
        </div>
      </div>

      {!isTargetSetForMonth ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 max-w-4xl mx-auto"
        >
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Set Target - {selectedApp.name}</h3>
              <p className="text-sm text-slate-400 font-medium">Target untuk bulan {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Downloader</label>
              <input 
                type="number"
                value={form.targetDownloader || ''}
                onChange={(e) => setForm({...form, targetDownloader: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target User Premium</label>
              <input
                type="number"
                value={form.targetRepeatOrder || ''}
                onChange={(e) => setForm({...form, targetRepeatOrder: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Sales (Revenue)</label>
              <input 
                type="number"
                value={form.targetSales || ''}
                onChange={(e) => setForm({...form, targetSales: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Konversi (%)</label>
              <input 
                type="number"
                value={form.targetConversion || ''}
                onChange={(e) => setForm({...form, targetConversion: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Rata-rata Harga Paket</label>
              <input 
                type="number"
                value={form.avgPrice || ''}
                onChange={(e) => setForm({...form, avgPrice: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
          </div>

          <button 
            onClick={handleGenerateSheet}
            className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Generate Sheet Operasional
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Downloader</p>
              <h3 className="text-xl font-black text-indigo-600">{summary.progressDownloader.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, summary.progressDownloader)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Sales</p>
              <h3 className="text-xl font-black text-emerald-600">{summary.progressSales.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, summary.progressSales)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progres Konversi</p>
              <h3 className="text-xl font-black text-violet-600">{summary.progressConversion.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, summary.progressConversion)}%` }} />
              </div>
            </div>
            {(() => {
              const s = summary.selisihSales;
              const isSurplus = s >= 0;
              return (
                <div
                  className={cn(
                    'p-5 rounded-3xl border shadow-sm',
                    isSurplus ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100',
                  )}
                >
                  <p
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-widest mb-2',
                      isSurplus ? 'text-emerald-500' : 'text-rose-400',
                    )}
                  >
                    {isSurplus ? 'Kelebihan Sales' : 'Kekurangan Sales'}
                  </p>
                  <h3
                    className={cn(
                      'text-xl font-black',
                      isSurplus ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {isSurplus ? '+' : '-'}
                    {formatCurrency(Math.abs(s))}
                  </h3>
                  <p
                    className={cn(
                      'text-[8px] font-bold mt-1',
                      isSurplus ? 'text-emerald-500' : 'text-rose-400',
                    )}
                  >
                    {isSurplus ? 'Di atas target s/d hari ini' : 'Defisit s/d hari ini'}
                  </p>
                </div>
              );
            })()}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Downloader</p>
              <h3 className="text-xl font-black text-slate-900">{formatNumber(summary.totalRealDownloader)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatNumber(selectedApp.targetConfig[targetMonth]?.targetDownloader || 0)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Sales</p>
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(summary.totalRealSales)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatCurrency(selectedApp.targetConfig[targetMonth]?.targetSales || 0)}</p>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/30 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Operational Sheet - {selectedApp.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const newIsTargetSet = { ...(selectedApp.isTargetSet || {}) };
                    newIsTargetSet[targetMonth] = false;
                    setApps(apps.map(a => a.id === selectedAppId ? { ...a, isTargetSet: newIsTargetSet } : a));
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Edit Target
                </button>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[2900px] border-spacing-0">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50">
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-slate-200/20">Waktu</th>
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-indigo-100/20">Downloader</th>
                    <th colSpan={3} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-violet-100/20 text-xs font-black uppercase tracking-widest text-violet-700">User Premium</th>
                    <th colSpan={4} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-emerald-100/20">Sales & Revenue</th>
                    <th colSpan={7} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-amber-100/30 text-xs font-black uppercase tracking-widest text-amber-700">Sebaran Kode Promo</th>
                    <th colSpan={4} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-slate-100/50">Strategi</th>
                    <th colSpan={4} className="py-2 px-4 border-b border-slate-200 text-center bg-slate-200/50">Aktivitas</th>
                  </tr>
                  <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50/80">
                    <th className="py-4 px-4 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">Tanggal</th>
                    <th className="py-4 px-4 border-r border-slate-200">Hari</th>
                    <th className="py-4 px-4 border-r border-slate-200">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-indigo-50/30">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-indigo-50/30">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200">Conv (%)</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-emerald-50/30">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-emerald-50/30">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200">Status</th>
                    <th className="py-4 px-4 border-r border-slate-200">Keterangan</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Sales</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Marketing</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Aplikasi</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Live</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Lainnya</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Artikel</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-amber-50/30">Tanpa Kode</th>
                    <th className="py-4 px-4 border-r border-slate-200">User Premium</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">Event</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">BC</th>
                    <th className="py-4 px-4 border-r border-slate-200">Story</th>
                    <th className="py-4 px-4 border-r border-slate-200">Chat</th>
                    <th className="py-4 px-4 border-r border-slate-200">Lainnya</th>
                    <th className="py-4 px-4 border-slate-200 bg-indigo-50/50">Social Media</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, idx) => {
                    const dayData = selectedApp.dailyData[date] || {};
                    // Real value: prioritas manual override > auto dari DB.
                    // User bisa edit langsung di cell — tersimpan di
                    // dailyData[date].actualX (auto-sync ke Supabase).
                    const dbToday = getActual(selectedApp.name, date);
                    const actualDownloader =
                      dayData.actualDownloader != null
                        ? Number(dayData.actualDownloader)
                        : dbToday.downloader;
                    const actualRepeatOrder =
                      dayData.actualRepeatOrder != null
                        ? Number(dayData.actualRepeatOrder)
                        : dbToday.premium;
                    const actualSales =
                      dayData.actualSales != null
                        ? Number(dayData.actualSales)
                        : dbToday.sales;

                    const conv = actualDownloader > 0 ? (actualRepeatOrder / actualDownloader) * 100 : 0;

                    // Chained Dynamic Target Logic
                    const totalTargetSales = selectedApp.targetConfig[targetMonth]?.targetSales || 0;
                    const totalTargetDownloader = selectedApp.targetConfig[targetMonth]?.targetDownloader || 0;
                    const totalTargetRepeatOrder = selectedApp.targetConfig[targetMonth]?.targetRepeatOrder || 0;

                    const baseDailySales = totalTargetSales / dates.length;
                    const baseDailyDownloader = totalTargetDownloader / dates.length;
                    const baseDailyRepeatOrder = totalTargetRepeatOrder / dates.length;

                    // lastFilledIdx = tanggal terakhir yang ada data di DB
                    const lastFilledIdx = dates.reduce((acc, d, i) => {
                      const a = getActual(selectedApp.name, d);
                      return a.sales > 0 || a.downloader > 0 || a.premium > 0 ? i : acc;
                    }, -1);

                    let flexibleTargetSales = baseDailySales;
                    let flexibleTargetDownloader = baseDailyDownloader;
                    let flexibleTargetRepeatOrder = baseDailyRepeatOrder;

                    if (idx === lastFilledIdx + 1) {
                      const before = dates.slice(0, lastFilledIdx + 1).map((d) => getActual(selectedApp.name, d));
                      const totalActualSalesBefore = before.reduce((s, a) => s + a.sales, 0);
                      const totalActualDownloaderBefore = before.reduce((s, a) => s + a.downloader, 0);
                      const totalActualRepeatOrderBefore = before.reduce((s, a) => s + a.premium, 0);

                      const deficitSales = baseDailySales * (lastFilledIdx + 1) - totalActualSalesBefore;
                      const deficitDownloader = baseDailyDownloader * (lastFilledIdx + 1) - totalActualDownloaderBefore;
                      const deficitRepeatOrder = baseDailyRepeatOrder * (lastFilledIdx + 1) - totalActualRepeatOrderBefore;

                      flexibleTargetSales = Math.max(baseDailySales * 0.2, Math.min(baseDailySales * 2, baseDailySales + deficitSales));
                      flexibleTargetDownloader = Math.max(baseDailyDownloader * 0.2, Math.min(baseDailyDownloader * 2, baseDailyDownloader + deficitDownloader));
                      flexibleTargetRepeatOrder = Math.max(baseDailyRepeatOrder * 0.2, Math.min(baseDailyRepeatOrder * 2, baseDailyRepeatOrder + deficitRepeatOrder));
                    }

                    const displayTargetSales = dayData.manualTargetSales || flexibleTargetSales;
                    const displayTargetDownloader = dayData.manualTargetDownloader || flexibleTargetDownloader;
                    const displayTargetRepeatOrder = dayData.manualTargetRepeatOrder || flexibleTargetRepeatOrder;

                    const achievement = displayTargetSales > 0 ? (actualSales / displayTargetSales) * 100 : 0;
                    let statusColor = 'text-slate-400';
                    let statusText = 'Menunggu';
                    let statusBg = 'bg-slate-50';

                    if (actualSales > 0) {
                      if (achievement >= 100) {
                        statusColor = 'text-emerald-600';
                        statusText = 'Melebihi';
                        statusBg = 'bg-emerald-50';
                      } else if (achievement >= 90) {
                        statusColor = 'text-amber-600';
                        statusText = 'Mendekati';
                        statusBg = 'bg-amber-50';
                      } else {
                        statusColor = 'text-rose-600';
                        statusText = 'Kurang';
                        statusBg = 'bg-rose-50';
                      }
                    }

                    const salesDiff = actualSales - displayTargetSales;
                    const keteranganText = actualSales > 0
                      ? `${salesDiff >= 0 ? '+' : ''}${formatCurrency(salesDiff)}`
                      : '-';

                    return (
                      <tr key={date} className={cn(
                        "border-b border-slate-100 hover:bg-indigo-50/30 transition-all group",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      )}>
                        <td className="py-3 px-4 text-[11px] font-black text-slate-600 sticky left-0 bg-inherit group-hover:bg-indigo-50 z-10 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{format(new Date(date), 'dd MMM')}</span>
                            <button 
                              onClick={() => {
                                setCalendarFocusDate(new Date(date));
                                setActiveTab('calendar');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 bg-indigo-100 text-indigo-600 rounded-md transition-all hover:bg-indigo-200"
                              title="Lihat di Kalender"
                            >
                              <Calendar className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[11px] font-bold text-slate-400 border-r border-slate-100">
                          {format(new Date(date), 'EEE')}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(dayData.manualTargetDownloader || Math.round(displayTargetDownloader))}
                            onChange={(e) => updateDailyValue(date, 'manualTargetDownloader', parseFormattedNumber(e.target.value))}
                            aria-label={`Target downloader ${date}`}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors tabular-nums"
                          />
                        </td>
                        {/* Actual Downloader — editable, default dari DB */}
                        <td className="py-3 px-4 border-r border-slate-100" title="Default auto dari DB · klik untuk override manual">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={actualDownloader > 0 ? formatNumber(actualDownloader) : ''}
                            onChange={(e) => {
                              const val = parseFormattedNumber(e.target.value);
                              updateDailyValue(date, 'actualDownloader', val || null);
                            }}
                            placeholder="–"
                            aria-label={`Real downloader ${date}`}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 tabular-nums outline-none focus:bg-indigo-50/50 focus:ring-2 focus:ring-indigo-200 rounded transition-all placeholder:text-slate-300 placeholder:font-medium"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(dayData.manualTargetRepeatOrder || Math.round(displayTargetRepeatOrder))}
                            onChange={(e) => updateDailyValue(date, 'manualTargetRepeatOrder', parseFormattedNumber(e.target.value))}
                            aria-label={`Target user premium ${date}`}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors tabular-nums"
                          />
                        </td>
                        {/* Actual User Premium — editable, default dari DB */}
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20" title="Default auto dari DB · klik untuk override manual">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={actualRepeatOrder > 0 ? formatNumber(actualRepeatOrder) : ''}
                            onChange={(e) => {
                              const val = parseFormattedNumber(e.target.value);
                              updateDailyValue(date, 'actualRepeatOrder', val || null);
                            }}
                            placeholder="–"
                            aria-label={`Real user premium ${date}`}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 tabular-nums outline-none focus:bg-indigo-50/50 focus:ring-2 focus:ring-indigo-200 rounded transition-all placeholder:text-slate-300 placeholder:font-medium"
                          />
                        </td>
                        <td className={cn('py-3 px-4 text-[11px] font-black border-r border-slate-100', conv >= (selectedApp.targetConfig[targetMonth]?.targetConversion || 0) ? 'text-emerald-600' : 'text-rose-600')}>
                          {conv.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumber(dayData.manualTargetSales || Math.round(displayTargetSales))}
                            onChange={(e) => updateDailyValue(date, 'manualTargetSales', parseFormattedNumber(e.target.value))}
                            aria-label={`Target sales ${date}`}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-emerald-600 transition-colors tabular-nums"
                          />
                        </td>
                        {/* Actual Sales/Revenue — editable, default dari DB.
                            Display pakai formatCurrency, parsing pakai
                            parseFormattedNumber yg strip semua non-digit. */}
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20" title="Default auto dari DB · klik untuk override manual">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={actualSales > 0 ? formatCurrency(actualSales) : ''}
                            onChange={(e) => {
                              const val = parseFormattedNumber(e.target.value);
                              updateDailyValue(date, 'actualSales', val || null);
                            }}
                            placeholder="–"
                            aria-label={`Real sales ${date}`}
                            className="w-full bg-transparent text-[11px] font-black text-emerald-600 tabular-nums outline-none focus:bg-emerald-50/50 focus:ring-2 focus:ring-emerald-200 rounded transition-all placeholder:text-slate-300 placeholder:font-medium"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase text-center", statusBg, statusColor)}>
                            {statusText}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className={cn("text-[10px] font-bold text-center", salesDiff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {keteranganText}
                          </div>
                        </td>
                        {/* Sebaran Kode Promo — auto dari DB, klasifikasi via regex per platform */}
                        {(['Sales', 'Marketing', 'Aplikasi', 'Live', 'Lainnya', 'Artikel', 'Tanpa Kode'] as PromoCategory[]).map((cat) => {
                          const count = dbToday.promo[cat] || 0;
                          return (
                            <td key={cat} className="py-3 px-4 border-r border-slate-100 bg-amber-50/10 text-center">
                              <span className={cn(
                                "text-[10px] font-black tabular-nums",
                                count > 0 ? "text-amber-700" : "text-slate-300",
                              )}>
                                {count > 0 ? formatNumber(count) : '–'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.premium || ''} 
                            onChange={(e) => updateDailyValue(date, 'premium', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.benefit || ''} 
                            onChange={(e) => updateDailyValue(date, 'benefit', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.event || ''} 
                            onChange={(e) => updateDailyValue(date, 'event', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.benefit2 || ''} 
                            onChange={(e) => updateDailyValue(date, 'benefit2', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.bcan || ''} 
                            onChange={(e) => updateDailyValue(date, 'bcan', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.story || ''} 
                            onChange={(e) => updateDailyValue(date, 'story', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.chat || ''} 
                            onChange={(e) => updateDailyValue(date, 'chat', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.activity || ''} 
                            onChange={(e) => updateDailyValue(date, 'activity', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 bg-indigo-50/30">
                          <button
                            onClick={() => {
                              setCalendarFocusDate(new Date(date));
                              setActiveTab('social');
                            }}
                            title="Buka Analisa Sosial Media"
                            className="w-full py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Buka Sosmed
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
};

// ============================================================
// MarkazInlineSync — tombol sync + status badge per card platform.
// Tampil "Data terakhir: 29 Apr 2026" + tombol Fetch.
// Kalau platform belum ada di api_sync_state, tampil tombol "Aktifkan
// Sync" (= insert row di api_sync_state dengan enabled=true).
// ============================================================

import type { MarkazSyncState } from '../../lib/markazSyncClient';
import { getSupabase } from '../../lib/supabase';

function MarkazInlineSync({
  appName, syncState, isSyncing, onSync,
}: {
  appName: string;
  syncState: MarkazSyncState | null;
  isSyncing: boolean;
  onSync: () => void;
}) {
  // Stop propagation supaya klik tombol gak nge-trigger card click (yg
  // buka detail target page).
  const stopPropAndCall = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  // Kalau belum ada di api_sync_state, kasih tombol "Aktifkan Sync"
  if (!syncState) {
    return (
      <button
        type="button"
        onClick={stopPropAndCall(async () => {
          const supabase = getSupabase();
          if (!supabase) return;
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes?.user?.id;
          if (!uid) return;
          await supabase.from('api_sync_state').upsert(
            { user_id: uid, platform: appName.trim().toLowerCase(), enabled: true },
            { onConflict: 'user_id,platform' },
          );
          // Trigger sync langsung setelah aktifkan
          onSync();
        })}
        className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-cyan-50 border border-slate-100 hover:border-cyan-200 transition-all group/sync"
      >
        <span className="inline-flex items-center gap-2 text-[10px] font-black text-slate-500 group-hover/sync:text-cyan-700 uppercase tracking-widest">
          <RefreshCw className="w-3 h-3" />
          Aktifkan Sync Markaz
        </span>
        <span className="text-[9px] font-bold text-slate-400">→</span>
      </button>
    );
  }

  const lastDate = syncState.last_synced_date
    ? format(new Date(syncState.last_synced_date), 'dd MMM yyyy')
    : null;
  const isError = syncState.last_status === 'error';
  const isSuccess = syncState.last_status === 'success';

  return (
    <div className={cn(
      'rounded-xl border p-2.5 space-y-2 transition-all',
      isError ? 'bg-rose-50/50 border-rose-100'
        : isSuccess ? 'bg-emerald-50/40 border-emerald-100'
        : 'bg-slate-50 border-slate-100',
    )}>
      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
          {isError && <XCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />}
          {!isSuccess && !isError && <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />}
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
            {lastDate ? `Data: ${lastDate}` : 'Belum sync'}
          </span>
        </div>
        {syncState.enabled ? null : (
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100">
            Off
          </span>
        )}
      </div>

      {/* Sync button */}
      <button
        type="button"
        disabled={isSyncing}
        onClick={stopPropAndCall(onSync)}
        className={cn(
          'w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
          'bg-white text-slate-700 border border-slate-200 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200',
          'disabled:opacity-50 disabled:cursor-wait',
        )}
      >
        {isSyncing
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <RefreshCw className="w-3 h-3" />}
        {isSyncing ? 'Syncing…' : 'Fetch Markaz'}
      </button>

      {/* Error message kalau ada */}
      {isError && syncState.last_error && (
        <p className="text-[9px] font-medium text-rose-700 leading-snug line-clamp-2"
           title={syncState.last_error}>
          {syncState.last_error}
        </p>
      )}
    </div>
  );
}

export default TargetSection;
