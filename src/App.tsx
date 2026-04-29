import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from './lib/logger';
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
  fetchOverviewStats,
  loadAppsFromLocal,
  loadSelectedAppIdFromLocal,
  saveAppsToLocal,
  saveAppsToSupabase,
  saveSelectedAppIdToLocal,
  uploadDownloadersToSupabase,
  uploadTransactionsToSupabase,
  type QuickOverviewStats,
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
const ContentSection = lazy(() => import('./features/konten/ContentSection'));
const PromoSection = lazy(() => import('./features/promo/PromoSection'));
const BulananSection = lazy(() => import('./features/bulanan/BulananSection'));
const SettingsSection = lazy(() => import('./features/settings/SettingsSection'));

// Preload semua chunk tab setelah initial render selesai. Tujuannya:
// pas user klik tab manapun, JS-nya sudah ada di memory (gak perlu nunggu
// network round-trip + parse). Trade-off: total bytes downloaded sama,
// tapi UX terasa instan setelah ~2 detik pertama.
const preloadAllTabs = () => {
  void import('./features/overview/Overview');
  void import('./features/packages/Packages');
  void import('./features/target/TargetSection');
  void import('./features/pricing/PriceSuggestion');
  void import('./features/pricing/PricingComparison');
  void import('./features/calendar/PackageCalendar');
  void import('./features/social/SocialMediaAnalysis');
  void import('./features/konten/ContentSection');
  void import('./features/promo/PromoSection');
  void import('./features/bulanan/BulananSection');
  void import('./features/settings/SettingsSection');
};

const TabLoading = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"
    />
  </div>
);

// Skeleton untuk tab yang butuh raw data tapi raw data masih download.
// Memberi user feedback bahwa tab BELUM kosong/error, cuma menunggu data.
const RawDataSkeleton = ({ label }: { label: string }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"
      />
      <div>
        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">
          Memuat {label}
        </p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Tunggu beberapa detik — data sedang di-download dari database…
        </p>
      </div>
    </div>
    {/* Skeleton bars */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 animate-pulse"
        />
      ))}
    </div>
    <div className="h-72 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-50 animate-pulse" />
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
      logger.info(
        'Auth restored:',
        data.session?.user?.email ?? '(no session)',
      );
      setSession(data.session ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      logger.info('Auth event:', event, '→', newSession?.user?.email ?? '(no user)');
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
  // Strategi loading 2-stage:
  //   1. quickStats — server-aggregated dari view `overview_stats` (~50ms).
  //      Dipakai render headline Overview INSTAN sebelum raw data ke-load.
  //   2. data + downloaderData — raw rows (paginated paralel ~3-5 detik).
  //      Dipakai untuk filter, chart per-day, dan tab lain.
  // UI bisa render Overview pakai quickStats sambil tunggu raw load di
  // background. Tab lain (Target/Kalender/Paket) tampil skeleton sampai
  // raw ready.
  const [quickStats, setQuickStats] = useState<QuickOverviewStats | null>(null);
  const [data, setData] = useState<Transaction[]>([]);
  const [downloaderData, setDownloaderData] = useState<Downloader[]>([]);
  const [loadingHeadline, setLoadingHeadline] = useState(true);
  const [loadingRawData, setLoadingRawData] = useState(true);
  const [fetchProgress, setFetchProgress] = useState<{ tx: number; dl: number }>({ tx: 0, dl: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleDataUpdate = useCallback(
    async (
      rawTransactions: unknown[],
      rawDownloaders: unknown[],
      append: boolean,
      onProgress?: (p: { current: number; total: number; label: string }) => void,
    ) => {
      const processedTx = processTransactions(rawTransactions);
      const processedDl = processDownloaders(rawDownloaders);

      // Mode GUEST / tidak login — tidak ada Supabase, data cuma ada di
      // memory. Set state lokal biar dashboard tetap bisa dipakai.
      if (!userId) {
        setData((prev) => (append ? [...prev, ...processedTx] : processedTx));
        setDownloaderData((prev) => (append ? [...prev, ...processedDl] : processedDl));
        return;
      }

      // Logged in — SEMUA data di dashboard harus berasal dari Supabase.
      // Flow: upload ke Supabase → fetch ulang → render.
      setLoadingRawData(true);
      setError(null);
      try {
        const replaceMode = !append;
        const txOk = await uploadTransactionsToSupabase(userId, processedTx, replaceMode, onProgress);
        const dlOk = await uploadDownloadersToSupabase(userId, processedDl, replaceMode);

        if (!txOk || !dlOk) {
          throw new Error(
            'Sebagian upload ke Supabase gagal. Cek DevTools Console untuk detail error.',
          );
        }

        logger.info('♻️ Upload sukses, fetching ulang dari Supabase…');
        const res = await fetchDataFromSupabase();
        if (res) {
          setData(res.transactions);
          setDownloaderData(res.downloaders);
        }
      } catch (err) {
        logger.error('Upload/refetch gagal:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Upload gagal. Data belum tersimpan ke database.',
        );
        // Sengaja TIDAK setData dengan processed lokal — kita hanya tampilkan
        // data yang sudah berhasil masuk DB. Dashboard tetap pakai state
        // sebelumnya (data DB lama).
      } finally {
        setLoadingRawData(false);
      }
    },
    [userId],
  );

  // Initial data load — 2 stages:
  //   Stage 1 (~50ms): fetch quickStats dari view, set loadingHeadline=false
  //                    → Overview langsung render dengan headline cards.
  //   Stage 2 (~3-5s): fetch raw transactions+downloaders di background,
  //                    set loadingRawData=false → tab lain bisa dipakai.
  useEffect(() => {
    if (supabaseReady && !userId && !guestMode) {
      setLoadingHeadline(false);
      setLoadingRawData(false);
      return;
    }
    let active = true;

    const run = async () => {
      setLoadingHeadline(true);
      setLoadingRawData(true);
      setError(null);

      if (!userId) {
        setError('Mode lokal. Unggah file Excel di Settings untuk mulai.');
        setLoadingHeadline(false);
        setLoadingRawData(false);
        return;
      }

      // Stage 1: quick stats (instant)
      try {
        logger.info('Load quick stats for user:', userId);
        const quick = await fetchOverviewStats();
        if (!active) return;
        if (quick) setQuickStats(quick);
      } catch (err) {
        logger.warn('Quick stats fetch failed (lanjut ke raw):', err);
      } finally {
        if (active) setLoadingHeadline(false);
      }

      // Stage 2: raw data (background, takes 3-5s)
      try {
        const res = await fetchDataFromSupabase((loaded, label) => {
          if (!active) return;
          setFetchProgress((prev) => ({
            ...prev,
            [label === 'transactions' ? 'tx' : 'dl']: loaded,
          }));
        });
        if (!active) return;
        if (res) {
          setData(res.transactions);
          setDownloaderData(res.downloaders);
          if (res.transactions.length === 0 && res.downloaders.length === 0 && !quickStats) {
            setError('Belum ada data di Supabase. Unggah file Excel di Settings.');
          }
        } else {
          setError(
            'Supabase tidak bisa diakses. Cek .env.local (VITE_SUPABASE_URL / ANON_KEY).',
          );
        }
      } catch (err) {
        logger.error('Raw data load failed:', err);
        setError('Gagal memuat data. Buka DevTools Console untuk detail errornya.');
      } finally {
        if (active) setLoadingRawData(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseReady, userId, guestMode]);

  // ---------- UI state ----------
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Auto-sync app cards dari source_app yang ada di DB (transactions + downloaders).
  // Daftar platform di Strategi & Target jadi auto-derived — user cuma perlu
  // set targetnya. App lama dengan target/dailyData dipreserve.
  // App placeholder default (mis. "App Utama" yang belum diisi) dibuang
  // begitu DB punya data nyata.
  useEffect(() => {
    const platforms = new Set<string>();
    data.forEach((t) => {
      const p = (t.source_app ?? '').trim();
      if (p) platforms.add(p.toUpperCase());
    });
    downloaderData.forEach((d) => {
      const p = (d.source_app ?? '').trim();
      if (p) platforms.add(p.toUpperCase());
    });
    if (platforms.size === 0) return;

    setApps((prev) => {
      const kept = prev.filter((a) => {
        const inDb = platforms.has(a.name.trim().toUpperCase());
        const hasTarget = Object.keys(a.targetConfig ?? {}).length > 0;
        const hasDaily = Object.keys(a.dailyData ?? {}).length > 0;
        return inDb || hasTarget || hasDaily;
      });
      const existing = new Set(kept.map((a) => a.name.trim().toUpperCase()));
      const missing = Array.from(platforms).filter((p) => !existing.has(p));
      if (missing.length === 0 && kept.length === prev.length) return prev;
      const additions: AppData[] = missing.map((name) => ({
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 11),
        name,
        targetConfig: {},
        dailyData: {},
        isTargetSet: {},
      }));
      return [...kept, ...additions];
    });
  }, [data, downloaderData]);

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

  // Helper buat re-fetch data dari Supabase. Dipakai setelah upload Excel
  // SELESAI atau setelah sync Markaz API selesai — supaya state browser
  // langsung dapet data terbaru tanpa perlu refresh manual.
  const refetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [quick, raw] = await Promise.all([
        fetchOverviewStats(),
        fetchDataFromSupabase((loaded, label) => {
          setFetchProgress((prev) => ({
            ...prev,
            [label === 'transactions' ? 'tx' : 'dl']: loaded,
          }));
        }),
      ]);
      if (quick) setQuickStats(quick);
      if (raw) {
        setData(raw.transactions);
        setDownloaderData(raw.downloaders);
      }
    } catch (err) {
      logger.error('Refetch data gagal:', err);
    }
  }, [userId]);
  // Preload semua chunk tab di background setelah ~1.5s.
  // requestIdleCallback (kalau browser support) lebih aman karena cuma
  // jalan saat browser idle. Fallback ke setTimeout untuk Safari.
  useEffect(() => {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      const handle = ric(preloadAllTabs, { timeout: 3000 });
      return () => {
        const cancel = (window as unknown as {
          cancelIdleCallback?: (h: number) => void;
        }).cancelIdleCallback;
        if (cancel) cancel(handle);
      };
    }
    const t = window.setTimeout(preloadAllTabs, 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Data disimpan apa adanya di Supabase, tapi di dashboard kita samakan
  // (uppercase) supaya aggregasi lintas tabel tidak terpisah.
  const normApp = useCallback((s: string | null | undefined) => (s || '').toUpperCase(), []);

  // ---------- Derived data ----------
  const filteredData = useMemo(
    () =>
      data.filter((item) => {
        const matchApp =
          filters.source_app === 'All' || normApp(item.source_app) === normApp(filters.source_app);
        const matchYear = filters.year === 'All' || item.year === Number(filters.year);
        const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
        const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
        return matchApp && matchYear && matchMonth && matchMethod;
      }),
    [data, filters, normApp],
  );

  const filteredDownloaderData = useMemo(
    () =>
      downloaderData.filter((item) => {
        const matchApp =
          filters.source_app === 'All' || normApp(item.source_app) === normApp(filters.source_app);
        const matchYear = filters.year === 'All' || item.year === Number(filters.year);
        const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
        return matchApp && matchYear && matchMonth;
      }),
    [downloaderData, filters, normApp],
  );

  const availableOptions = useMemo(() => {
    // Normalisasi ke uppercase supaya "jadibumn" & "JADIBUMN" tidak jadi 2 option.
    const allApps = [
      ...data.map((d) => normApp(d.source_app)),
      ...downloaderData.map((d) => normApp(d.source_app)),
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
  }, [data, downloaderData, normApp]);

  const appColors = useMemo(() => {
    const colors: Record<string, string> = {};
    availableOptions.source_apps.forEach((app, index) => {
      colors[app] = COLORS[index % COLORS.length];
    });
    return colors;
  }, [availableOptions.source_apps]);

  const stats: DashboardStats = useMemo(() => {
    // Fast path — raw data belum ke-load tapi quickStats dari view udah
    // ada dan tidak ada filter aktif. Render headline langsung dari
    // server-aggregated stats biar Overview tampil instan.
    const noFilter =
      filters.source_app === 'All' &&
      filters.year === 'All' &&
      filters.month === 'All' &&
      filters.methode_name === 'All';
    if (data.length === 0 && quickStats && noFilter) {
      return {
        totalRevenue: quickStats.totalRevenue,
        totalTransactions: quickStats.totalTransactions,
        aov: quickStats.aov,
        uniqueBuyers: quickStats.uniqueBuyers,
        totalPackagesSold: quickStats.totalTransactions,
        totalTargetRevenue: 0,
        totalTargetDownloader: 0,
        totalTargetRepeatOrder: 0,
        progressDownloader: 0,
        progressSales: 0,
        progressConversion: quickStats.konversiPct,
        selisihSales: 0,
        totalRealDownloader: quickStats.totalRealDownloader,
        totalRealSales: quickStats.totalRevenue,
        totalRepeatOrderUsers: quickStats.totalRepeatOrderUsers,
      };
    }

    const isMonthFiltered = filters.month !== 'All';
    const isYearFiltered = filters.year !== 'All';
    const monthKey = isYearFiltered && isMonthFiltered
      ? `${filters.year}-${String(filters.month).padStart(2, '0')}`
      : null;

    const totalRealSales = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = filteredData.length;

    // Unique Buyer & User Repeat Order dihitung dengan EMAIL saja
    // (konsisten dengan query SQL di Supabase).
    // Case-sensitive (sama dengan SELECT DISTINCT email). Hanya .trim()
    // untuk membersihkan whitespace artefak dari Excel.
    const emailOf = (r: { email?: string | null }): string =>
      (r.email ?? '').trim();

    const uniqueBuyers = new Set(
      filteredData.map((item) => emailOf(item)).filter((e) => e !== ''),
    ).size;

    // ==============================================================
    // User Repeat Order — logic yang sama dengan SQL user:
    //
    //   SELECT count(*) FROM (
    //     SELECT email FROM transactions
    //     WHERE email IS NOT NULL AND email <> ''
    //       AND trx_id <> ''
    //     GROUP BY email
    //     HAVING count(DISTINCT trx_id) >= 2
    //   ) y;
    //
    // BEDA: kita pakai filteredData (bukan seluruh data) supaya angka
    // ikut berubah saat user filter bulan/app. Artinya scope SQL-nya
    // setara dengan menambah WHERE <filter> di query.
    //
    // Contoh: filter = Januari 2024
    //   → Hitung email yang punya ≥ 2 trx_id BERBEDA di Januari 2024.
    //   → User yang cuma beli 1x di Januari 2024 tidak dihitung repeat
    //     walaupun totalnya dia punya 5 transaksi sepanjang waktu.
    // ==============================================================
    const ordersPerEmail = filteredData.reduce<Record<string, Set<string>>>((acc, curr) => {
      const e = emailOf(curr);
      const trxId = (curr.trx_id ?? '').trim();
      if (!e || !trxId) return acc;
      if (!acc[e]) acc[e] = new Set<string>();
      acc[e].add(trxId);
      return acc;
    }, {});

    const repeatOrderUsers = Object.values(ordersPerEmail).filter(
      (orderSet) => orderSet.size >= 2,
    ).length;

    const totalRealDownloader = filteredDownloaderData.reduce((sum, d) => sum + d.count, 0);

    const relevantApps = filters.source_app === 'All'
      ? apps
      : apps.filter((a) => a.name.toUpperCase() === filters.source_app.toUpperCase());

    let totalTargetRevenue = 0;
    let totalTargetDownloader = 0;
    let totalTargetRepeatOrder = 0;
    // selisihSales = totalRealSales - totalTargetRevenue (formula sederhana)
    //   negatif → Kekurangan (real < target)
    //   positif → Kelebihan (real > target)
    let totalSelisihSales = 0;

    relevantApps.forEach((app) => {
      if (monthKey) {
        const target = app.targetConfig?.[monthKey];
        if (target) {
          totalTargetRevenue += target.targetSales || 0;
          totalTargetDownloader += target.targetDownloader || 0;
          totalTargetRepeatOrder += target.targetRepeatOrder || 0;
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

    // Selisih = total real sales - total target revenue (sederhana)
    // negatif = Kekurangan, positif = Kelebihan
    totalSelisihSales = totalRealSales - totalTargetRevenue;

    const result = {
      totalRevenue: totalRealSales,
      totalTransactions,
      // AOV per definisi user: revenue / jumlah transaksi (baris), BUKAN per
      // distinct trx_id. Artinya kalau 1 order ada 3 line item, dianggap 3
      // "transaksi".
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
      // Conversion per definisi user: transaksi / downloader × 100.
      // Downloader = sum count di filteredDownloaderData.
      progressConversion:
        totalRealDownloader > 0 ? (totalTransactions / totalRealDownloader) * 100 : 0,
      selisihSales: totalSelisihSales,
      totalRealDownloader,
      totalRealSales,
      totalRepeatOrderUsers: repeatOrderUsers,
    };

    // Debug log — bisa langsung di-copy ke clipboard lalu bandingkan dengan SQL
    logger.info('📊 Stats snapshot', {
      filter: {
        source_app: filters.source_app,
        year: filters.year,
        month: filters.month,
        methode_name: filters.methode_name,
      },
      total_data_rows: data.length,
      filtered_rows: filteredData.length,
      total_revenue: totalRealSales,
      total_transaksi_rows: totalTransactions,
      unique_email: uniqueBuyers,
      repeat_order_email: repeatOrderUsers,
      aov_per_row: totalTransactions > 0 ? Math.round(totalRealSales / totalTransactions) : 0,
      conversion_pct:
        totalRealDownloader > 0
          ? Math.round((totalTransactions / totalRealDownloader) * 10000) / 100
          : 0,
      downloader_sum: totalRealDownloader,
    });

    return result;
  }, [filteredData, filteredDownloaderData, apps, filters, data.length, quickStats]);

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
      const app = normApp(item.source_app);
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
      const app = normApp(item.source_app);
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
  }, [filteredData, filteredDownloaderData, normApp]);

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
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            activeTab={activeTab}
            rowsLoaded={data.length}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          <main className="p-8 max-w-[1600px] mx-auto w-full">
            {error && data.length === 0 && !quickStats && (
              <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] font-bold text-amber-700">
                {error}
              </div>
            )}

            {/* Banner halus saat raw data masih download di background.
                Headline udah keliatan dari quickStats, jadi user gak perlu
                tunggu raw selesai untuk lihat angka utama. */}
            {loadingRawData && quickStats && (
              <div className="mb-6 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full"
                />
                <p className="text-[11px] font-bold text-indigo-700">
                  Memuat detail data di latar belakang…
                  {fetchProgress.tx > 0 && (
                    <span className="ml-2 text-indigo-500 font-medium">
                      {fetchProgress.tx.toLocaleString('id-ID')} transaksi · {fetchProgress.dl.toLocaleString('id-ID')} downloader
                    </span>
                  )}
                </p>
              </div>
            )}

            {loadingHeadline ? (
              <TabLoading />
            ) : (
              <Suspense fallback={<TabLoading />}>
                {/* mode="wait" memastikan konten lama exit dulu sebelum konten
                    baru masuk — supaya gak ada overlap antar tab. Duration
                    pendek (150ms) bikin tetap terasa snappy. */}
                <AnimatePresence mode="wait" initial={false}>
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
                    loadingRawData ? (
                      <RawDataSkeleton key="optimasi" label="Optimasi Harga" />
                    ) : (
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
                    )
                  )}
                  {activeTab === 'target' && (
                    loadingRawData ? (
                      <RawDataSkeleton key="target" label="Strategi & Target" />
                    ) : (
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
                          transactions={data}
                          downloaders={downloaderData}
                        />
                      </motion.div>
                    )
                  )}
                  {activeTab === 'calendar' && (
                    loadingRawData ? (
                      <RawDataSkeleton key="calendar" label="Kalender Marsel" />
                    ) : (
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
                    )
                  )}
                  {activeTab === 'social' && (
                    <motion.div
                      key="social"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SocialMediaAnalysis
                        apps={apps}
                        setApps={setApps}
                        setActiveTab={setActiveTab}
                        setCalendarFocusDate={setCalendarFocusDate}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'konten' && (
                    <motion.div
                      key="konten"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ContentSection detectedPlatforms={availableOptions.source_apps} />
                    </motion.div>
                  )}
                  {activeTab === 'packages' && (
                    loadingRawData ? (
                      <RawDataSkeleton key="packages" label="Detail Paket" />
                    ) : (
                      <Packages
                        key="packages"
                        filters={filters}
                        setFilters={setFilters}
                        availableOptions={availableOptions}
                        packagePerformance={packagePerformanceData}
                      />
                    )
                  )}
                  {activeTab === 'kode-promo' && (
                    loadingRawData ? (
                      <RawDataSkeleton key="kode-promo" label="Performa Kode Promo" />
                    ) : (
                      <PromoSection key="kode-promo" data={data} />
                    )
                  )}
                  {activeTab === 'bulanan' && (
                    <BulananSection key="bulanan" />
                  )}
                  {activeTab === 'settings' && (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SettingsSection
                        onDataUpdate={handleDataUpdate}
                        detectedPlatforms={availableOptions.source_apps}
                        onMarkazSyncComplete={refetchData}
                      />
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
