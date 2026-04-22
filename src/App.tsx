import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Session } from '@supabase/supabase-js';
import Sidebar from './layout/Sidebar';
import TopBar from './layout/TopBar';
import ErrorBoundary from './components/ErrorBoundary';
import LoginScreen from './components/LoginScreen';
import { getSupabase, isSupabaseConfigured } from './lib/supabase';
import {
  fetchAppsFromSupabase,
  fetchDataFromSupabase,
  loadAppsFromLocal,
  loadSelectedAppIdFromLocal,
  saveAppsToLocal,
  saveAppsToSupabase,
  saveSelectedAppIdToLocal,
  uploadDownloadersToSupabase,
  uploadTransactionsToSupabase,
} from './lib/dataAccess';
import { processDownloaders, processTransactions } from './lib/dataProcessing';
import { COLORS } from './lib/constants';
import { COMPANY_TAGLINE, DEFAULT_TAB } from './config/app.config';
import type {
  AppData, DashboardStats, Downloader, Filters, Transaction, TrendItem,
} from './types';
import { format, parseISO } from 'date-fns';

// Feature bundles are loaded lazily so the initial JS chunk stays small.
const Overview = lazy(() => import('./features/overview/Overview'));
const Packages = lazy(() => import('./features/packages/Packages'));
const TargetSection = lazy(() => import('./features/target/TargetSection'));
const PriceSuggestion = lazy(() => import('./features/pricing/PriceSuggestion'));
const PricingComparison = lazy(() => import('./features/pricing/PricingComparison'));
const PackageCalendar = lazy(() => import('./features/calendar/PackageCalendar'));
const SocialMediaAnalysis = lazy(() => import('./features/social/SocialMediaAnalysis'));
const SettingsSection = lazy(() => import('./features/settings/SettingsSection'));

const TabLoading = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"
    />
  </div>
);

export default function App() {
  const supabase = getSupabase();
  const supabaseReady = isSupabaseConfigured();

  // ---------- Auth ----------
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabaseReady);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;

  // ---------- Data ----------
  const [data, setData] = useState<Transaction[]>([]);
  const [downloaderData, setDownloaderData] = useState<Downloader[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDataUpdate = useCallback(
    async (rawTransactions: unknown[], rawDownloaders: unknown[], append: boolean) => {
      const processedTx = processTransactions(rawTransactions);
      const processedDl = processDownloaders(rawDownloaders);

      setData((prev) => (append ? [...prev, ...processedTx] : processedTx));
      setDownloaderData((prev) => (append ? [...prev, ...processedDl] : processedDl));

      if (userId) {
        await uploadTransactionsToSupabase(userId, processedTx);
        await uploadDownloadersToSupabase(userId, processedDl);
      }
    },
    [userId],
  );

  // Initial data load: try Supabase once user is authenticated.
  useEffect(() => {
    if (supabaseReady && !userId && !guestMode) {
      setLoadingData(false);
      return;
    }
    let active = true;
    const run = async () => {
      setLoadingData(true);
      setError(null);
      try {
        if (userId) {
          const res = await fetchDataFromSupabase();
          if (active && res) {
            setData(res.transactions);
            setDownloaderData(res.downloaders);
            if (res.transactions.length === 0) {
              setError('Belum ada data transaksi. Unggah file Excel di Settings.');
            }
          }
        } else {
          // Guest / local-only mode: nothing to preload.
          setError('Mode lokal. Unggah file Excel di Settings untuk mulai.');
        }
      } catch (err) {
        console.warn('Initial data load failed:', err);
        setError('Gagal memuat data. Coba unggah ulang di Settings.');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [supabaseReady, userId, guestMode]);

  // ---------- UI state ----------
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [filters, setFilters] = useState<Filters>({
    source_app: 'All',
    year: 'All',
    month: 'All',
    methode_name: 'All',
  });
  const [apps, setApps] = useState<AppData[]>(() => loadAppsFromLocal());
  const [selectedAppId, setSelectedAppId] = useState<string>(() =>
    loadSelectedAppIdFromLocal(loadAppsFromLocal()[0]?.id ?? '1'),
  );
  const [targetMonth, setTargetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null);

  // Ensure selectedAppId always points to a valid app.
  useEffect(() => {
    if (apps.length === 0) return;
    if (!apps.some((a) => a.id === selectedAppId)) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps, selectedAppId]);

  // Pull apps snapshot from Supabase when user signs in.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchAppsFromSupabase(userId).then((remote) => {
      if (!active || !remote || remote.length === 0) return;
      setApps(remote);
      saveAppsToLocal(remote);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // Persist apps: always localStorage, plus Supabase if signed in.
  useEffect(() => {
    saveAppsToLocal(apps);
    if (userId) {
      const handle = setTimeout(() => {
        void saveAppsToSupabase(userId, apps);
      }, 800); // debounce cloud writes
      return () => clearTimeout(handle);
    }
  }, [apps, userId]);

  useEffect(() => {
    saveSelectedAppIdToLocal(selectedAppId);
  }, [selectedAppId]);

  // ---------- Derived data ----------
  const filteredData = useMemo(
    () =>
      data.filter((item) => {
        const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
        const matchYear = filters.year === 'All' || item.year === Number(filters.year);
        const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
        const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
        return matchApp && matchYear && matchMonth && matchMethod;
      }),
    [data, filters],
  );

  const filteredDownloaderData = useMemo(
    () =>
      downloaderData.filter((item) => {
        const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
        const matchYear = filters.year === 'All' || item.year === Number(filters.year);
        const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
        return matchApp && matchYear && matchMonth;
      }),
    [downloaderData, filters],
  );

  const availableOptions = useMemo(() => {
    const allApps = [
      ...data.map((d) => d.source_app),
      ...downloaderData.map((d) => d.source_app),
    ];
    const allYears = [
      ...data.map((d) => d.year),
      ...downloaderData.map((d) => d.year),
    ];
    return {
      source_apps: Array.from(new Set(allApps.filter(Boolean))).sort(),
      years: Array.from(new Set(allYears.filter((y) => y != null))).sort((a, b) => b - a),
      methods: Array.from(new Set(data.map((d) => d.methode_name).filter(Boolean))).sort(),
    };
  }, [data, downloaderData]);

  const appColors = useMemo(() => {
    const colors: Record<string, string> = {};
    availableOptions.source_apps.forEach((app, index) => {
      colors[app] = COLORS[index % COLORS.length];
    });
    return colors;
  }, [availableOptions.source_apps]);

  const stats: DashboardStats = useMemo(() => {
    const isMonthFiltered = filters.month !== 'All';
    const isYearFiltered = filters.year !== 'All';
    const monthKey = isYearFiltered && isMonthFiltered
      ? `${filters.year}-${String(filters.month).padStart(2, '0')}`
      : null;

    const totalRealSales = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = filteredData.length;
    const uniqueBuyers = new Set(
      filteredData
        .map((item) => item.email || item.phone || item.full_name || item.trx_id)
        .filter(Boolean),
    ).size;
    const totalRealDownloader = filteredDownloaderData.reduce((sum, d) => sum + d.count, 0);

    const emailCountsInAllData = data.reduce<Record<string, number>>((acc, curr) => {
      if (curr.email) acc[curr.email] = (acc[curr.email] || 0) + 1;
      return acc;
    }, {});
    const repeatOrderUsers = new Set(
      filteredData
        .filter((item) => item.email && emailCountsInAllData[item.email] >= 2)
        .map((item) => item.email),
    ).size;

    const relevantApps = filters.source_app === 'All'
      ? apps
      : apps.filter((a) => a.name.toUpperCase() === filters.source_app.toUpperCase());

    let totalTargetRevenue = 0;
    let totalTargetDownloader = 0;
    let totalTargetRepeatOrder = 0;
    let totalHutangSales = 0;

    relevantApps.forEach((app) => {
      if (monthKey) {
        const target = app.targetConfig?.[monthKey];
        if (target) {
          totalTargetRevenue += target.targetSales || 0;
          totalTargetDownloader += target.targetDownloader || 0;
          totalTargetRepeatOrder += target.targetRepeatOrder || 0;
        }

        const dailyData = app.dailyData || {};
        const monthDates = Object.keys(dailyData).filter((d) => d.startsWith(monthKey)).sort();
        let appRealSales = 0;
        monthDates.forEach((d) => {
          appRealSales += Number(dailyData[d]?.actualSales) || 0;
        });

        if (target) {
          const lastFilledIdx = monthDates.reduce((acc, d, i) => {
            const row = dailyData[d];
            const hasData =
              row && (
                (row.actualSales != null && row.actualSales !== 0) ||
                (row.actualDownloader != null && row.actualDownloader !== 0) ||
                (row.actualRepeatOrder != null && row.actualRepeatOrder !== 0)
              );
            return hasData ? i : acc;
          }, -1);
          const [ymY, ymM] = monthKey.split('-').map(Number);
          const daysInMonth = new Date(ymY, ymM, 0).getDate();
          const baseDailySales = (target.targetSales || 0) / Math.max(1, daysInMonth);
          const expectedSoFar = baseDailySales * (lastFilledIdx + 1);
          totalHutangSales += Math.max(0, expectedSoFar - appRealSales);
        }
      } else {
        Object.keys(app.targetConfig || {}).forEach((m) => {
          if (!isYearFiltered || m.startsWith(filters.year)) {
            const t = app.targetConfig[m];
            totalTargetRevenue += t.targetSales || 0;
            totalTargetDownloader += t.targetDownloader || 0;
            totalTargetRepeatOrder += t.targetRepeatOrder || 0;
          }
        });
      }
    });

    return {
      totalRevenue: totalRealSales,
      totalTransactions,
      aov: totalTransactions > 0 ? totalRealSales / totalTransactions : 0,
      uniqueBuyers,
      totalPackagesSold: totalTransactions,
      totalTargetRevenue,
      totalTargetDownloader,
      totalTargetRepeatOrder,
      progressDownloader:
        totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0,
      progressSales:
        totalTargetRevenue > 0 ? (totalRealSales / totalTargetRevenue) * 100 : 0,
      progressConversion:
        totalRealDownloader > 0 ? (repeatOrderUsers / totalRealDownloader) * 100 : 0,
      hutangSales: totalHutangSales,
      totalRealDownloader,
      totalRealSales,
      totalRepeatOrderUsers: repeatOrderUsers,
    };
  }, [filteredData, filteredDownloaderData, apps, filters, data]);

  const trendData: TrendItem[] = useMemo(() => {
    const grouped: Record<string, TrendItem> = {};
    // Granularity handled inside Overview; here we aggregate daily as default.
    const getKey = (d: Date) => format(d, 'yyyy-MM-dd');
    const getName = (key: string) => {
      try {
        return format(parseISO(key), 'dd MMM');
      } catch {
        return key;
      }
    };

    filteredData.forEach((item) => {
      const key = getKey(item.parsed_payment_date);
      if (!grouped[key]) {
        grouped[key] = {
          name: getName(key),
          revenue: 0,
          transactions: 0,
          downloader: 0,
          conversion: 0,
          rawDate: item.parsed_payment_date,
          appBreakdown: {},
        };
      }
      const app = item.source_app;
      grouped[key].appBreakdown![app] ??= { revenue: 0, transactions: 0, downloader: 0 };
      grouped[key].revenue += item.revenue;
      grouped[key].transactions += 1;
      grouped[key].appBreakdown![app].revenue += item.revenue;
      grouped[key].appBreakdown![app].transactions += 1;
    });

    filteredDownloaderData.forEach((item) => {
      const key = getKey(item.parsed_date);
      if (!grouped[key]) {
        grouped[key] = {
          name: getName(key),
          revenue: 0,
          transactions: 0,
          downloader: 0,
          conversion: 0,
          rawDate: item.parsed_date,
          appBreakdown: {},
        };
      }
      const app = item.source_app;
      grouped[key].appBreakdown![app] ??= { revenue: 0, transactions: 0, downloader: 0 };
      grouped[key].downloader += item.count;
      grouped[key].appBreakdown![app].downloader += item.count;
    });

    return Object.values(grouped)
      .map((item) => {
        const conversion = item.downloader > 0 ? (item.transactions / item.downloader) * 100 : 0;
        const breakdownProps: Record<string, number> = {};
        Object.entries(item.appBreakdown || {}).forEach(([app, vals]) => {
          breakdownProps[`revenue_${app}`] = vals.revenue;
          breakdownProps[`transactions_${app}`] = vals.transactions;
          breakdownProps[`downloader_${app}`] = vals.downloader;
          breakdownProps[`conversion_${app}`] =
            vals.downloader > 0 ? (vals.transactions / vals.downloader) * 100 : 0;
        });
        return { ...item, conversion, ...breakdownProps } as TrendItem;
      })
      .sort((a, b) => (a.rawDate?.getTime() ?? 0) - (b.rawDate?.getTime() ?? 0));
  }, [filteredData, filteredDownloaderData]);

  const packagePerformanceData = useMemo(() => {
    type Row = {
      name: string;
      revenue: number;
      transactions: number;
      buyers: Set<string>;
      prices: number[];
      minDate: Date;
      maxDate: Date;
    };
    const grouped: Record<string, Row> = {};
    filteredData.forEach((item) => {
      const key = item.content_name;
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          revenue: 0,
          transactions: 0,
          buyers: new Set(),
          prices: [],
          minDate: item.parsed_payment_date,
          maxDate: item.parsed_payment_date,
        };
      }
      grouped[key].revenue += item.revenue;
      grouped[key].transactions += 1;
      const id = item.email || item.phone || item.full_name || item.trx_id;
      if (id) grouped[key].buyers.add(id);
      grouped[key].prices.push(item.revenue);
      if (item.parsed_payment_date < grouped[key].minDate) grouped[key].minDate = item.parsed_payment_date;
      if (item.parsed_payment_date > grouped[key].maxDate) grouped[key].maxDate = item.parsed_payment_date;
    });

    return Object.values(grouped)
      .map((item) => {
        const uniqueUsers = item.buyers.size;
        const aov = item.transactions > 0 ? item.revenue / item.transactions : 0;
        const arppu = uniqueUsers > 0 ? item.revenue / uniqueUsers : 0;
        const minPrice = item.prices.length ? Math.min(...item.prices) : 0;
        const maxPrice = item.prices.length ? Math.max(...item.prices) : 0;
        const avgPrice = item.prices.length
          ? item.prices.reduce((a, b) => a + b, 0) / item.prices.length
          : 0;
        const lowTrx = item.prices.filter((p) => p === minPrice).length;
        const highTrx = item.prices.filter((p) => p === maxPrice).length;
        const durationDays = Math.max(
          1,
          Math.ceil((item.maxDate.getTime() - item.minDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const durationLabel =
          durationDays >= 365
            ? `${(durationDays / 365).toFixed(1)} Tahun`
            : durationDays >= 30
              ? `${(durationDays / 30).toFixed(1)} Bulan`
              : `${durationDays} Hari`;
        return {
          ...item,
          uniqueUsers,
          aov,
          arppu,
          minPrice,
          maxPrice,
          avgPrice,
          lowTrx,
          highTrx,
          avgTrx: item.transactions,
          startDate: format(item.minDate, 'dd MMM yyyy'),
          endDate: format(item.maxDate, 'dd MMM yyyy'),
          durationDays,
          durationLabel,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredData]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setGuestMode(false);
  }, [supabase]);

  // ---------- Render ----------
  if (!authChecked) return <TabLoading />;

  if (supabaseReady && !session && !guestMode) {
    return (
      <ErrorBoundary>
        <LoginScreen onGuestContinue={() => setGuestMode(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userEmail={userEmail}
          onSignOut={session ? signOut : undefined}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <main className="p-8 max-w-[1600px] mx-auto w-full">
            {error && data.length === 0 && (
              <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] font-bold text-amber-700">
                {error}
              </div>
            )}
            {loadingData ? (
              <TabLoading />
            ) : (
              <Suspense fallback={<TabLoading />}>
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <Overview
                      key="overview"
                      filters={filters}
                      setFilters={setFilters}
                      availableOptions={availableOptions}
                      stats={stats}
                      trendData={trendData}
                      appColors={appColors}
                      filteredData={filteredData}
                    />
                  )}
                  {activeTab === 'optimasi' && (
                    <motion.div
                      key="optimasi"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-10"
                    >
                      <PriceSuggestion data={data} availableOptions={availableOptions} />
                      <PricingComparison data={data} filters={filters} />
                    </motion.div>
                  )}
                  {activeTab === 'target' && (
                    <motion.div
                      key="target"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <TargetSection
                        apps={apps}
                        setApps={setApps}
                        selectedAppId={selectedAppId}
                        setSelectedAppId={setSelectedAppId}
                        targetMonth={targetMonth}
                        setTargetMonth={setTargetMonth}
                        setActiveTab={setActiveTab}
                        setCalendarFocusDate={setCalendarFocusDate}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'calendar' && (
                    <motion.div
                      key="calendar"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <PackageCalendar
                        data={data}
                        downloaderData={downloaderData}
                        availableOptions={availableOptions}
                        apps={apps}
                        focusDate={calendarFocusDate}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'social' && (
                    <motion.div
                      key="social"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <SocialMediaAnalysis
                        apps={apps}
                        setActiveTab={setActiveTab}
                        setCalendarFocusDate={setCalendarFocusDate}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'packages' && (
                    <Packages
                      key="packages"
                      filters={filters}
                      setFilters={setFilters}
                      availableOptions={availableOptions}
                      packagePerformance={packagePerformanceData}
                    />
                  )}
                  {activeTab === 'settings' && (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <SettingsSection onDataUpdate={handleDataUpdate} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Suspense>
            )}
          </main>

          <footer className="max-w-[1600px] mx-auto p-12 text-center border-t border-slate-100 mt-12">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
              {COMPANY_TAGLINE}
            </p>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}
