import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import {
  Activity, Calendar, ChevronDown, ChevronRight, LayoutDashboard,
  MessageSquare, Plus, RefreshCw, Smartphone, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import type { AppData } from '../../types';
import SocialMediaModal from './SocialMediaModal';

interface TargetSectionProps {
  apps: AppData[];
  setApps: (a: AppData[]) => void;
  selectedAppId: string;
  setSelectedAppId: (id: string) => void;
  targetMonth: string;
  setTargetMonth: (m: string) => void;
  setActiveTab: (tab: string) => void;
  setCalendarFocusDate: (d: Date | null) => void;
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
}: TargetSectionProps) => {
  const [showAppSelection, setShowAppSelection] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('All');
  const [socialModalDate, setSocialModalDate] = useState<string | null>(null);
  const selectedApp = apps.find(a => a.id === selectedAppId) || apps[0];

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
    const dailyValues = dates.map(date => selectedApp.dailyData?.[date] || {});
    const totalRealDownloader = dailyValues.reduce((sum, d) => sum + (Number(d.actualDownloader) || 0), 0);
    const totalRealSales = dailyValues.reduce((sum, d) => sum + (Number(d.actualSales) || 0), 0);
    const totalRealRepeatOrder = dailyValues.reduce((sum, d) => sum + (Number(d.actualRepeatOrder) || 0), 0);

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

    // Calculate Hutang Sales (Debt)
    const lastFilledIdx = dates.reduce((acc, d, i) => {
      const data = selectedApp.dailyData?.[d];
      const hasData = data && (
        (data.actualSales !== undefined && data.actualSales !== null && data.actualSales !== 0) ||
        (data.actualDownloader !== undefined && data.actualDownloader !== null && data.actualDownloader !== 0) ||
        (data.actualRepeatOrder !== undefined && data.actualRepeatOrder !== null && data.actualRepeatOrder !== 0)
      );
      return hasData ? i : acc;
    }, -1);

    const baseDailySales = targetConfig.targetSales / Math.max(1, dates.length);
    const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
    const hutangSales = Math.max(0, expectedSalesSoFar - totalRealSales);

    return {
      totalRealDownloader,
      totalRealSales,
      totalRealRepeatOrder,
      progressDownloader,
      progressSales,
      progressConversion,
      hutangSales,
      targetConfig
    };
  }, [selectedApp, targetMonth, dates]);

  const addApp = () => {
    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 11);
    setApps([...apps, {
      id: newId,
      name: `App ${apps.length + 1}`,
      targetConfig: {},
      dailyData: {},
      isTargetSet: {}
    }]);
    setSelectedAppId(newId);
  };

  const globalSummary = useMemo(() => {
    let totalTargetDownloader = 0;
    let totalRealDownloader = 0;
    let totalTargetSales = 0;
    let totalRealSales = 0;
    let totalTargetRepeatOrder = 0;
    let totalRealRepeatOrder = 0;
    let totalHutangSales = 0;

    filteredAppsForSummary.forEach(app => {
      const targetConfig = app.targetConfig?.[targetMonth];
      if (targetConfig) {
        totalTargetDownloader += targetConfig.targetDownloader || 0;
        totalTargetSales += targetConfig.targetSales || 0;
        totalTargetRepeatOrder += targetConfig.targetRepeatOrder || 0;
      }

      const dailyData = app.dailyData || {};
      let appRealDownloader = 0;
      let appRealSales = 0;
      let appRealRepeatOrder = 0;
      let lastFilledIdx = -1;

      dates.forEach((date, idx) => {
        const d = dailyData[date];
        if (d) {
          const rd = Number(d.actualDownloader) || 0;
          const rs = Number(d.actualSales) || 0;
          const rr = Number(d.actualRepeatOrder) || 0;
          appRealDownloader += rd;
          appRealSales += rs;
          appRealRepeatOrder += rr;

          if (rd > 0 || rs > 0 || rr > 0) {
            lastFilledIdx = idx;
          }
        }
      });

      totalRealDownloader += appRealDownloader;
      totalRealSales += appRealSales;
      totalRealRepeatOrder += appRealRepeatOrder;

      if (targetConfig && targetConfig.targetSales > 0) {
        const baseDailySales = targetConfig.targetSales / Math.max(1, dates.length);
        const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
        totalHutangSales += Math.max(0, expectedSalesSoFar - appRealSales);
      }
    });

    return {
      totalTargetDownloader,
      totalRealDownloader,
      totalTargetSales,
      totalRealSales,
      totalTargetRepeatOrder,
      totalRealRepeatOrder,
      totalHutangSales,
      downloaderProgress: totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0,
      salesProgress: totalTargetSales > 0 ? (totalRealSales / totalTargetSales) * 100 : 0,
      conversionProgress: totalRealDownloader > 0 ? (totalRealRepeatOrder / totalRealDownloader) * 100 : 0
    };
  }, [filteredAppsForSummary, targetMonth, dates]);

  if (showAppSelection) {
    return (
      <div className="space-y-10">
        {/* Global Summary Dashboard */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <LayoutDashboard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Ringkasan Semua Platform</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Akumulasi performa dari seluruh aplikasi di bulan {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
              </div>
            </div>

            {/* Global Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  <option value="All">Semua Platform</option>
                  {apps.map(app => <option key={app.id} value={app.name}>{app.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  {Array.from(new Set(availableMonths.map(m => m.split('-')[0]))).sort().map(y => (
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
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm hover:bg-rose-100/50 transition-all">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-2">Hutang Sales</p>
              <h3 className="text-xl font-black text-rose-600">{formatCurrency(globalSummary.totalHutangSales)}</h3>
              <p className="text-[8px] text-rose-400 font-bold mt-1">Defisit s/d hari ini</p>
            </div>
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
                    <th className="py-4 px-4">Hutang Sales</th>
                    <th className="py-4 px-4">Total Real Downloader</th>
                    <th className="py-4 px-4">Total Real Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppsForSummary.map(app => {
                    const target = app.targetConfig?.[targetMonth];
                    const dailyData = app.dailyData || {};
                    let appRealDownloader = 0;
                    let appRealSales = 0;
                    let appRealRepeatOrder = 0;
                    let lastFilledIdx = -1;

                    dates.forEach((date, idx) => {
                      const d = dailyData[date];
                      if (d) {
                        const rd = Number(d.actualDownloader) || 0;
                        const rs = Number(d.actualSales) || 0;
                        const rr = Number(d.actualRepeatOrder) || 0;
                        appRealDownloader += rd;
                        appRealSales += rs;
                        appRealRepeatOrder += rr;
                        if (rd > 0 || rs > 0 || rr > 0) lastFilledIdx = idx;
                      }
                    });

                    const progressDownloader = target?.targetDownloader > 0 ? (appRealDownloader / target.targetDownloader) * 100 : 0;
                    const progressSales = target?.targetSales > 0 ? (appRealSales / target.targetSales) * 100 : 0;
                    const progressConversion = appRealDownloader > 0 ? (appRealRepeatOrder / appRealDownloader) * 100 : 0;

                    let hutangSales = 0;
                    if (target?.targetSales > 0) {
                      const baseDailySales = target.targetSales / Math.max(1, dates.length);
                      const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
                      hutangSales = Math.max(0, expectedSalesSoFar - appRealSales);
                    }

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
                        <td className="py-4 px-4 text-xs font-bold text-rose-600">{formatCurrency(hutangSales)}</td>
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

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pilih Aplikasi</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">Pilih aplikasi untuk mengatur target operasional</p>
          </div>
          <button 
            onClick={addApp}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Aplikasi
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map(app => (
            <motion.div
              key={app.id}
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 cursor-pointer group hover:border-indigo-200 transition-all relative"
            >
              <div 
                onClick={() => {
                  setSelectedAppId(app.id);
                  setShowAppSelection(false);
                }}
                className="absolute inset-0 z-0"
              />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-7 h-7 text-indigo-600" />
                </div>
                <input
                  type="text"
                  value={app.name}
                  onChange={(e) => {
                    setApps(apps.map(a => a.id === app.id ? { ...a, name: e.target.value } : a));
                  }}
                  className="text-lg font-black text-slate-900 mb-2 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded px-1 w-full"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {Object.keys(app.targetConfig || {}).length} Target Terpasang
                </p>
                <div 
                  onClick={() => {
                    setSelectedAppId(app.id);
                    setShowAppSelection(false);
                  }}
                  className="mt-6 flex items-center justify-between text-indigo-600"
                >
                  <span className="text-xs font-black uppercase tracking-widest">Atur Target</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
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
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-2">Hutang Sales</p>
              <h3 className="text-xl font-black text-rose-600">{formatCurrency(summary.hutangSales)}</h3>
              <p className="text-[8px] text-rose-400 font-bold mt-1">Defisit s/d hari ini</p>
            </div>
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
              <table className="w-full text-left border-collapse min-w-[2200px] border-spacing-0">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50">
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-slate-200/20">Waktu</th>
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-indigo-100/20">Downloader</th>
                    <th colSpan={3} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-violet-100/20 text-xs font-black uppercase tracking-widest text-violet-700">User Premium</th>
                    <th colSpan={4} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-emerald-100/20">Sales & Revenue</th>
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
                    const conv = dayData.actualDownloader > 0 ? (dayData.actualRepeatOrder / dayData.actualDownloader) * 100 : 0;
                    
                    // Chained Dynamic Target Logic
                    const totalTargetSales = selectedApp.targetConfig[targetMonth]?.targetSales || 0;
                    const totalTargetDownloader = selectedApp.targetConfig[targetMonth]?.targetDownloader || 0;
                    const totalTargetRepeatOrder = selectedApp.targetConfig[targetMonth]?.targetRepeatOrder || 0;
                    
                    const baseDailySales = totalTargetSales / dates.length;
                    const baseDailyDownloader = totalTargetDownloader / dates.length;
                    const baseDailyRepeatOrder = totalTargetRepeatOrder / dates.length;

                    // Find the last day that has real data (not null/undefined)
                    const lastFilledIdx = dates.reduce((acc, d, i) => {
                      const data = selectedApp.dailyData[d];
                      const hasData = data && (
                        (data.actualSales !== undefined && data.actualSales !== null) ||
                        (data.actualDownloader !== undefined && data.actualDownloader !== null) ||
                        (data.actualRepeatOrder !== undefined && data.actualRepeatOrder !== null)
                      );
                      return hasData ? i : acc;
                    }, -1);

                    let flexibleTargetSales = baseDailySales;
                    let flexibleTargetDownloader = baseDailyDownloader;
                    let flexibleTargetRepeatOrder = baseDailyRepeatOrder;

                    // If this is the day immediately after the last filled day, apply the accumulated deficit
                    if (idx === lastFilledIdx + 1) {
                      const actualsBefore = dates.slice(0, lastFilledIdx + 1).map(d => selectedApp.dailyData[d] || {});
                      const totalActualSalesBefore = actualsBefore.reduce((sum, d) => sum + (d.actualSales || 0), 0);
                      const totalActualDownloaderBefore = actualsBefore.reduce((sum, d) => sum + (d.actualDownloader || 0), 0);
                      const totalActualRepeatOrderBefore = actualsBefore.reduce((sum, d) => sum + (d.actualRepeatOrder || 0), 0);
                      
                      const expectedSalesBefore = baseDailySales * (lastFilledIdx + 1);
                      const expectedDownloaderBefore = baseDailyDownloader * (lastFilledIdx + 1);
                      const expectedRepeatOrderBefore = baseDailyRepeatOrder * (lastFilledIdx + 1);

                      const deficitSales = expectedSalesBefore - totalActualSalesBefore;
                      const deficitDownloader = expectedDownloaderBefore - totalActualDownloaderBefore;
                      const deficitRepeatOrder = expectedRepeatOrderBefore - totalActualRepeatOrderBefore;

                      // Apply reasonable limits (max 2x base target, min 0.2x base target)
                      flexibleTargetSales = Math.max(baseDailySales * 0.2, Math.min(baseDailySales * 2, baseDailySales + deficitSales));
                      flexibleTargetDownloader = Math.max(baseDailyDownloader * 0.2, Math.min(baseDailyDownloader * 2, baseDailyDownloader + deficitDownloader));
                      flexibleTargetRepeatOrder = Math.max(baseDailyRepeatOrder * 0.2, Math.min(baseDailyRepeatOrder * 2, baseDailyRepeatOrder + deficitRepeatOrder));
                    }

                    // Use manual override if exists
                    const displayTargetSales = dayData.manualTargetSales || flexibleTargetSales;
                    const displayTargetDownloader = dayData.manualTargetDownloader || flexibleTargetDownloader;
                    const displayTargetRepeatOrder = dayData.manualTargetRepeatOrder || flexibleTargetRepeatOrder;

                    const achievement = displayTargetSales > 0 ? (dayData.actualSales / displayTargetSales) * 100 : 0;
                    let statusColor = "text-slate-400";
                    let statusText = "Menunggu";
                    let statusBg = "bg-slate-50";

                    if (dayData.actualSales > 0) {
                      if (achievement >= 100) {
                        statusColor = "text-emerald-600";
                        statusText = "Melebihi";
                        statusBg = "bg-emerald-50";
                      } else if (achievement >= 90) {
                        statusColor = "text-amber-600";
                        statusText = "Mendekati";
                        statusBg = "bg-amber-50";
                      } else {
                        statusColor = "text-rose-600";
                        statusText = "Kurang";
                        statusBg = "bg-rose-50";
                      }
                    }

                    const salesDiff = (dayData.actualSales || 0) - displayTargetSales;
                    const keteranganText = dayData.actualSales > 0 
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
                            type="number" 
                            value={dayData.manualTargetDownloader || Math.round(displayTargetDownloader)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetDownloader', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="number" 
                            value={dayData.actualDownloader === null || dayData.actualDownloader === undefined ? '' : dayData.actualDownloader} 
                            onChange={(e) => updateDailyValue(date, 'actualDownloader', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input 
                            type="number" 
                            value={dayData.manualTargetRepeatOrder || Math.round(displayTargetRepeatOrder)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetRepeatOrder', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input 
                            type="number" 
                            value={dayData.actualRepeatOrder === null || dayData.actualRepeatOrder === undefined ? '' : dayData.actualRepeatOrder} 
                            onChange={(e) => updateDailyValue(date, 'actualRepeatOrder', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 outline-none"
                          />
                        </td>
                        <td className={cn("py-3 px-4 text-[11px] font-black border-r border-slate-100", conv >= (selectedApp.targetConfig[targetMonth]?.targetConversion || 0) ? "text-emerald-600" : "text-rose-600")}>
                          {conv.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20">
                          <input 
                            type="number" 
                            value={dayData.manualTargetSales || Math.round(displayTargetSales)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetSales', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-emerald-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20">
                          <input 
                            type="number" 
                            value={dayData.actualSales === null || dayData.actualSales === undefined ? '' : dayData.actualSales} 
                            onChange={(e) => updateDailyValue(date, 'actualSales', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-emerald-600 outline-none"
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
                            onClick={() => setSocialModalDate(date)}
                            className={cn(
                              "w-full py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                              dayData.socialContent?.length > 0 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50"
                            )}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {dayData.socialContent?.length > 0 ? `${dayData.socialContent.length} Konten` : 'Input'}
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

      {socialModalDate && (
        <SocialMediaModal 
          isOpen={!!socialModalDate}
          onClose={() => setSocialModalDate(null)}
          date={socialModalDate}
          content={selectedApp.dailyData[socialModalDate]?.socialContent || []}
          onSave={(newContent) => updateDailyValue(socialModalDate, 'socialContent', newContent)}
        />
      )}
    </div>
  );
};

export default TargetSection;
