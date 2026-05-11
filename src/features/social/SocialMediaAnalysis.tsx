import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { format, parse, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, Download, Eye, FileSpreadsheet, Heart, Layers,
  LineChart as LineChartIcon, MessageCircle, Plus, Search, Share2, Smartphone,
  TrendingUp, Trash2, Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../lib/formatters';
import { excelDateToJSDate } from '../../lib/excelDate';
import { useToast } from '../../components/Toast';
import { fetchContentScripts } from '../../lib/dataAccess';
import type {
  AppData, CarouselContent, ContentScript, SinglePostContent,
  SocialMediaContent, VideoContent,
} from '../../types';

interface Props {
  apps: AppData[];
  setApps: (a: AppData[]) => void;
  setActiveTab: (tab: string) => void;
  setCalendarFocusDate: (date: Date) => void;
}

const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X', 'YouTube', 'LinkedIn'];
const JENIS_KONTEN_OPTIONS = ['Reel', 'Feed', 'Story', 'Carousel', 'Video', 'Shorts', 'Live', 'Single Post'];

const emptyContent = (): SocialMediaContent => ({
  platform: 'Instagram',
  jenisKonten: 'Reel',
  caption: '',
  tanggalUpload: format(new Date(), 'yyyy-MM-dd'),
  tayangan: 0,
  jangkauan: 0,
  pemirsa: 0,
  jumlahBersihInteraksi: 0,
  sukaTanggapan: 0,
  komen: 0,
  share: 0,
  save: 0,
  klikTautan: 0,
  balasan: 0,
  mengikuti: 0,
  waktuTonton: 0,
  rataRataWaktuTonton: 0,
});

export const SocialMediaAnalysis = ({
  apps,
  setApps,
  setActiveTab,
  setCalendarFocusDate,
}: Props) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [jenisFilter, setJenisFilter] = useState('All');
  const [appFilter, setAppFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return format(d, 'yyyy-MM-dd');
  });
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  // Semua metrik yang bisa dipilih untuk chart (mengikuti kolom tabel + ER%)
  type ChartMetric =
    | 'tayangan' | 'jangkauan' | 'pemirsa'
    | 'jumlahBersihInteraksi' | 'sukaTanggapan' | 'komen'
    | 'share' | 'save' | 'klikTautan' | 'mengikuti' | 'er';
  const [chartMetric, setChartMetric] = useState<ChartMetric>('tayangan');
  const [chartPlatform, setChartPlatform] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // Konten dari Skrip Konten yang sudah status='published'.
  const [publishedKonten, setPublishedKonten] = useState<ContentScript[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await fetchContentScripts({ status: 'published' });
      if (active) setPublishedKonten(rows);
    };
    void load();
    return () => { active = false; };
  }, []);

  // ContentScript published → shape mirip SocialMediaContent.
  // Metrik-nya 0 karena Skrip Konten cuma punya metadata, belum ada metrik aktual.
  const kontenAsSocialContent = useMemo(() => {
    return publishedKonten.map((s) => {
      const dateStr = s.scheduled_date ?? format(new Date(s.updated_at), 'yyyy-MM-dd');
      const c = s.content as VideoContent & CarouselContent & SinglePostContent;
      const typeLabel =
        s.type === 'video' ? 'Video' :
        s.type === 'carousel' ? 'Carousel' : 'Single Post';
      const caption =
        (c?.caption_instagram as string | undefined) ||
        (c?.caption_tiktok as string | undefined) ||
        (c?.caption as string | undefined) ||
        s.title || '';

      return {
        platform: s.platform.toUpperCase(),
        jenisKonten: typeLabel,
        caption,
        tanggalUpload: dateStr,
        tayangan: 0,
        jangkauan: 0,
        pemirsa: 0,
        jumlahBersihInteraksi: 0,
        sukaTanggapan: 0,
        komen: 0,
        share: 0,
        save: 0,
        klikTautan: 0,
        balasan: 0,
        mengikuti: 0,
        waktuTonton: 0,
        rataRataWaktuTonton: 0,
        date: dateStr,
        appId: `konten:${s.id}`,
        appName: s.platform.toUpperCase(),
        contentIndex: 0,
        _fromKonten: true as const,
        _scriptId: s.id,
      };
    });
  }, [publishedKonten]);

  const allContent = useMemo(() => {
    const fromLegacy = apps.flatMap((app) =>
      Object.entries(app.dailyData || {}).flatMap(([date, dayData]) =>
        (dayData.socialContent || []).map((content, idx) => ({
          ...content,
          // tanggalUpload override: kalau ada di content pakai itu, fallback ke key date.
          tanggalUpload: content.tanggalUpload || date,
          date,
          appId: app.id,
          appName: app.name,
          contentIndex: idx,
          _fromKonten: false as const,
        })),
      ),
    );
    return [...kontenAsSocialContent, ...fromLegacy]
      .sort((a, b) => b.tanggalUpload.localeCompare(a.tanggalUpload));
  }, [apps, kontenAsSocialContent]);

  const handleDateClick = (dateStr: string) => {
    if (!dateStr) return;
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    setCalendarFocusDate(date);
    setActiveTab('calendar');
  };

  const filteredContent = useMemo(() => {
    const needle = searchTerm.toLowerCase();
    return allContent.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        (item.caption || '').toLowerCase().includes(needle) ||
        (item.platform || '').toLowerCase().includes(needle) ||
        (item.jenisKonten || '').toLowerCase().includes(needle);
      const matchesPlatform = platformFilter === 'All' || item.platform === platformFilter;
      const matchesJenis = jenisFilter === 'All' || item.jenisKonten === jenisFilter;
      const matchesApp = appFilter === 'All' || item.appName === appFilter;
      const dateStr = item.tanggalUpload || item.date;
      const matchesDate = (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
      return matchesSearch && matchesPlatform && matchesJenis && matchesApp && matchesDate;
    });
  }, [allContent, searchTerm, platformFilter, jenisFilter, appFilter, dateFrom, dateTo]);

  // Aggregate totals untuk hero cards
  const totals = useMemo(() => {
    const acc = {
      posts: 0, tayangan: 0, jangkauan: 0, pemirsa: 0,
      jumlahBersihInteraksi: 0, sukaTanggapan: 0, komen: 0, share: 0,
      save: 0, klikTautan: 0, mengikuti: 0,
    };
    filteredContent.forEach((it) => {
      acc.posts += 1;
      acc.tayangan += it.tayangan;
      acc.jangkauan += it.jangkauan;
      acc.pemirsa += it.pemirsa;
      acc.jumlahBersihInteraksi += it.jumlahBersihInteraksi;
      acc.sukaTanggapan += it.sukaTanggapan;
      acc.komen += it.komen;
      acc.share += it.share;
      acc.save += it.save;
      acc.klikTautan += it.klikTautan;
      acc.mengikuti += it.mengikuti;
    });
    return acc;
  }, [filteredContent]);

  // Chart data: agregat selectedMetric per tanggal.
  // ER% dihitung dari sum(interaksi) / sum(jangkauan) × 100 per hari.
  const chartData = useMemo(() => {
    const source = chartPlatform === 'All'
      ? filteredContent
      : filteredContent.filter((it) => it.platform === chartPlatform);
    const byDate = new Map<string, {
      date: string;
      tayangan: number; jangkauan: number; pemirsa: number;
      jumlahBersihInteraksi: number; sukaTanggapan: number; komen: number;
      share: number; save: number; klikTautan: number; mengikuti: number;
    }>();
    source.forEach((it) => {
      const d = (it.tanggalUpload || it.date).slice(0, 10);
      if (!d) return;
      const row = byDate.get(d) ?? {
        date: d, tayangan: 0, jangkauan: 0, pemirsa: 0,
        jumlahBersihInteraksi: 0, sukaTanggapan: 0, komen: 0,
        share: 0, save: 0, klikTautan: 0, mengikuti: 0,
      };
      row.tayangan += it.tayangan;
      row.jangkauan += it.jangkauan;
      row.pemirsa += it.pemirsa;
      row.jumlahBersihInteraksi += it.jumlahBersihInteraksi;
      row.sukaTanggapan += it.sukaTanggapan;
      row.komen += it.komen;
      row.share += it.share;
      row.save += it.save;
      row.klikTautan += it.klikTautan;
      row.mengikuti += it.mengikuti;
      byDate.set(d, row);
    });
    return Array.from(byDate.values())
      .map((r) => ({
        ...r,
        er: r.jangkauan > 0 ? (r.jumlahBersihInteraksi / r.jangkauan) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredContent, chartPlatform]);

  const appOptions = useMemo(() => {
    const set = new Set<string>(apps.map((a) => a.name));
    allContent.forEach((c) => set.add(c.appName));
    return ['All', ...Array.from(set).sort()];
  }, [apps, allContent]);

  const jenisOptions = useMemo(() => {
    const set = new Set<string>(JENIS_KONTEN_OPTIONS);
    allContent.forEach((c) => set.add(c.jenisKonten));
    return ['All', ...Array.from(set).sort()];
  }, [allContent]);

  const METRIC_LABELS: Record<ChartMetric, { label: string; color: string; format: 'number' | 'percent' }> = {
    tayangan:              { label: 'Tayangan',         color: '#8b5cf6', format: 'number' },
    jangkauan:             { label: 'Jangkauan',        color: '#f43f5e', format: 'number' },
    pemirsa:               { label: 'Pemirsa',          color: '#0ea5e9', format: 'number' },
    jumlahBersihInteraksi: { label: 'Interaksi',        color: '#10b981', format: 'number' },
    sukaTanggapan:         { label: 'Suka',             color: '#f59e0b', format: 'number' },
    komen:                 { label: 'Komen',            color: '#ec4899', format: 'number' },
    share:                 { label: 'Share',            color: '#06b6d4', format: 'number' },
    save:                  { label: 'Save',             color: '#a855f7', format: 'number' },
    klikTautan:            { label: 'Klik',             color: '#eab308', format: 'number' },
    mengikuti:             { label: 'Mengikuti',        color: '#14b8a6', format: 'number' },
    er:                    { label: 'ER%',              color: '#22c55e', format: 'percent' },
  };

  // Daftar platform unik untuk filter chart (drop "All" placeholder + dedupe)
  const platformsForChart = useMemo(() => {
    const set = new Set<string>();
    allContent.forEach((c) => { if (c.platform) set.add(c.platform); });
    return ['All', ...Array.from(set).sort()];
  }, [allContent]);

  const platforms = useMemo(
    () => ['All', ...Array.from(new Set(allContent.map((i) => i.platform).filter(Boolean)))],
    [allContent],
  );

  const handleDelete = (appId: string, date: string, contentIndex: number) => {
    if (!window.confirm('Yakin ingin hapus konten ini?')) return;
    setApps(
      apps.map((app) => {
        if (app.id !== appId) return app;
        const dayData = app.dailyData?.[date];
        if (!dayData?.socialContent) return app;
        const updated = dayData.socialContent.filter((_, i) => i !== contentIndex);
        return {
          ...app,
          dailyData: {
            ...app.dailyData,
            [date]: { ...dayData, socialContent: updated },
          },
        };
      }),
    );
  };

  // ===================== EXCEL TEMPLATE / IMPORT =====================
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const exampleAppName = apps[0]?.name ?? 'JADIBUMN';
    const today = format(new Date(), 'yyyy-MM-dd');
    const appNamesHint = apps.map((a) => a.name).join(', ');

    const rows = [
      {
        'Nama App':             exampleAppName,
        'Platform':             'Instagram',
        'Jenis Konten':         'Reel',
        'Caption':              'Caption lengkap di sini.',
        'Tanggal Upload':       today,
        'Tayangan':             8000,
        'Jangkauan':            5000,
        'Pemirsa':              4500,
        'Jumlah Bersih Interaksi': 250,
        'Suka & Tanggapan':     200,
        'Komen':                30,
        'Share':                20,
        'Save':                 15,
        'Klik Tautan':          12,
        'Balasan':              5,
        'Mengikuti':            8,
        'Waktu Tonton (detik)': 1800,
        'Rata-rata Waktu Tonton (detik)': 18,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 60 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 18 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 18 }, { wch: 24 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Konten Sosial Media');

    const noteRows = [
      ['Petunjuk Pengisian Template'],
      [''],
      ['1.', `Kolom "Nama App" harus cocok dengan: ${appNamesHint || '(belum ada app)'}`],
      ['2.', 'Tanggal Upload format YYYY-MM-DD (mis. 2026-05-07). Boleh juga format Excel Date.'],
      ['3.', `Platform: ${PLATFORM_OPTIONS.join(', ')}`],
      ['4.', `Jenis Konten: ${JENIS_KONTEN_OPTIONS.join(', ')}`],
      ['5.', 'Semua kolom angka isi angka saja (tanpa pemisah ribuan).'],
      ['6.', 'Waktu tonton & rata-rata waktu tonton dalam detik (mis. 90 = 1 menit 30 detik).'],
      ['7.', 'Caption boleh kosong. Nama App + Platform + Tanggal Upload wajib.'],
    ];
    const notesWs = XLSX.utils.aoa_to_sheet(noteRows);
    notesWs['!cols'] = [{ wch: 4 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, notesWs, 'Petunjuk');

    XLSX.writeFile(wb, 'template-social-media.xlsx');
  };

  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Memproses file…');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (rows.length === 0) {
        setImportStatus('❌ File kosong.');
        return;
      }

      const appByName = new Map(apps.map((a) => [a.name.toLowerCase().trim(), a]));
      const updates = new Map<string, Map<string, SocialMediaContent[]>>();
      let imported = 0;
      const skipped: string[] = [];

      const num = (v: unknown): number => {
        if (v === '' || v == null) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      rows.forEach((row, idx) => {
        const appName = String(row['Nama App'] ?? row['App'] ?? '').trim();
        const app = appByName.get(appName.toLowerCase());
        if (!app) {
          skipped.push(`Baris ${idx + 2}: App "${appName}" tidak dikenal`);
          return;
        }

        const rawDate = row['Tanggal Upload'] ?? row['Tanggal'] ?? row['Date'];
        const dateObj =
          typeof rawDate === 'number' ? excelDateToJSDate(rawDate) : new Date(String(rawDate));
        if (isNaN(dateObj.getTime())) {
          skipped.push(`Baris ${idx + 2}: Tanggal Upload tidak valid`);
          return;
        }
        const dateKey = format(dateObj, 'yyyy-MM-dd');

        const content: SocialMediaContent = {
          platform:              String(row['Platform'] ?? 'Instagram'),
          jenisKonten:           String(row['Jenis Konten'] ?? 'Feed'),
          caption:               String(row['Caption'] ?? ''),
          tanggalUpload:         dateKey,
          tayangan:              num(row['Tayangan']),
          jangkauan:             num(row['Jangkauan']),
          pemirsa:               num(row['Pemirsa']),
          jumlahBersihInteraksi: num(row['Jumlah Bersih Interaksi']),
          sukaTanggapan:         num(row['Suka & Tanggapan'] ?? row['Suka dan Tanggapan']),
          komen:                 num(row['Komen']),
          share:                 num(row['Share']),
          save:                  num(row['Save']),
          klikTautan:            num(row['Klik Tautan']),
          balasan:               num(row['Balasan']),
          mengikuti:             num(row['Mengikuti']),
          waktuTonton:           num(row['Waktu Tonton (detik)'] ?? row['Waktu Tonton']),
          rataRataWaktuTonton:   num(row['Rata-rata Waktu Tonton (detik)'] ?? row['Rata-rata Waktu Tonton']),
        };

        if (!updates.has(app.id)) updates.set(app.id, new Map());
        const byDate = updates.get(app.id)!;
        if (!byDate.has(dateKey)) byDate.set(dateKey, []);
        byDate.get(dateKey)!.push(content);
        imported += 1;
      });

      setApps(
        apps.map((app) => {
          const byDate = updates.get(app.id);
          if (!byDate) return app;
          const newDaily = { ...(app.dailyData || {}) };
          byDate.forEach((contents, dateKey) => {
            const existing = newDaily[dateKey]?.socialContent || [];
            newDaily[dateKey] = {
              ...(newDaily[dateKey] || {}),
              socialContent: [...existing, ...contents],
            };
          });
          return { ...app, dailyData: newDaily };
        }),
      );

      let msg = `✅ Berhasil impor ${imported} konten.`;
      if (skipped.length > 0) {
        msg += ` ${skipped.length} dilewat. ${skipped[0]}`;
      }
      setImportStatus(msg);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setImportStatus(`❌ Gagal: ${m}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddContent = (appId: string, content: SocialMediaContent) => {
    const date = content.tanggalUpload;
    setApps(
      apps.map((app) => {
        if (app.id !== appId) return app;
        const existing = app.dailyData?.[date]?.socialContent || [];
        return {
          ...app,
          dailyData: {
            ...app.dailyData,
            [date]: {
              ...(app.dailyData?.[date] || {}),
              socialContent: [...existing, content],
            },
          },
        };
      }),
    );
    setShowAddModal(false);
    toast.success('Konten ditambahkan', `${content.platform} · ${content.jenisKonten}`);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        {/* Header + actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl">
              <Smartphone className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Repository Konten Sosial Media
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {allContent.length} konten · 17 metrik per post
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <Search className="w-4 h-4 text-slate-400 ml-2" />
              <input
                type="text"
                placeholder="Cari caption / platform / jenis…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none px-2 py-1 w-52"
              />
            </div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Filter platform"
              className="bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600 outline-none px-4 py-2.5 rounded-2xl cursor-pointer"
            >
              {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              title="Download template Excel"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-emerald-400 hover:text-emerald-600 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Import konten dari file Excel"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Tambah Konten
            </button>
          </div>
        </div>

        {importStatus && (
          <div
            className={cn(
              'mb-6 p-4 rounded-2xl border flex items-start gap-3',
              importStatus.startsWith('❌')
                ? 'bg-rose-50 border-rose-100 text-rose-700'
                : importStatus.startsWith('✅')
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-slate-50 border-slate-100 text-slate-700',
            )}
          >
            <Upload className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-[11px] font-bold">{importStatus}</div>
            <button
              type="button"
              onClick={() => setImportStatus(null)}
              className="text-[10px] font-black opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Extra filter row: app, jenis, date range */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            aria-label="Filter app"
            className="bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 outline-none px-3 py-2 rounded-xl cursor-pointer"
          >
            {appOptions.map((a) => <option key={a} value={a}>{a === 'All' ? 'Semua App' : a}</option>)}
          </select>
          <select
            value={jenisFilter}
            onChange={(e) => setJenisFilter(e.target.value)}
            aria-label="Filter jenis konten"
            className="bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 outline-none px-3 py-2 rounded-xl cursor-pointer"
          >
            {jenisOptions.map((j) => <option key={j} value={j}>{j === 'All' ? 'Semua Jenis' : j}</option>)}
          </select>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dari</span>
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Tanggal dari"
              className="bg-transparent text-[11px] font-bold text-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sd</span>
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              aria-label="Tanggal sampai"
              className="bg-transparent text-[11px] font-bold text-slate-700 outline-none"
            />
          </div>
          <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest tabular-nums">
            {filteredContent.length} / {allContent.length} konten
          </span>
        </div>

        {/* Empty state */}
        {allContent.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-10 h-10 text-rose-300" />
            </div>
            <h4 className="text-lg font-black text-slate-700 mb-2">Belum ada konten</h4>
            <p className="text-sm text-slate-400 font-medium mb-8 max-w-md mx-auto">
              Mulai dokumentasikan konten sosial media. Klik tombol di bawah untuk menambahkan
              konten pertama.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Tambah Konten Pertama
            </button>
          </div>
        ) : (
          <>
            {/* Hero summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
              <HeroCard icon={Layers} label="Total Post" value={formatNumber(totals.posts)} gradient="from-indigo-500 to-violet-500" />
              <HeroCard icon={Eye} label="Tayangan" value={formatNumber(totals.tayangan)} gradient="from-violet-500 to-indigo-500" />
              <HeroCard icon={TrendingUp} label="Jangkauan" value={formatNumber(totals.jangkauan)} gradient="from-rose-500 to-pink-500" />
              <HeroCard icon={Heart} label="Interaksi" value={formatNumber(totals.jumlahBersihInteraksi)} gradient="from-emerald-500 to-teal-500" />
              <HeroCard icon={MessageCircle} label="Komen" value={formatNumber(totals.komen)} gradient="from-amber-500 to-orange-500" />
              <HeroCard icon={Share2} label="Share" value={formatNumber(totals.share)} gradient="from-cyan-500 to-sky-500" />
            </div>

            {/* Chart — 1 chart dengan filter metric + platform */}
            {chartData.length > 0 && (() => {
              const meta = METRIC_LABELS[chartMetric];
              const fmtY = (v: number) => meta.format === 'percent' ? `${v.toFixed(1)}%` : formatNumber(v);
              return (
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                      <div>
                        <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em]">Visualisasi</p>
                        <h4 className="text-sm font-black text-slate-900">
                          {meta.label}
                          {chartPlatform !== 'All' && <span className="text-slate-400"> · {chartPlatform}</span>}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={chartMetric}
                        onChange={(e) => setChartMetric(e.target.value as ChartMetric)}
                        aria-label="Pilih metric"
                        className="bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-700 outline-none px-3 py-1.5 rounded-lg uppercase tracking-widest cursor-pointer"
                      >
                        {Object.entries(METRIC_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <select
                        value={chartPlatform}
                        onChange={(e) => setChartPlatform(e.target.value)}
                        aria-label="Filter platform untuk chart"
                        className="bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-700 outline-none px-3 py-1.5 rounded-lg uppercase tracking-widest cursor-pointer"
                      >
                        {platformsForChart.map((p) => (
                          <option key={p} value={p}>{p === 'All' ? 'Semua Platform' : p}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setChartType('line')}
                          className={cn('px-2 py-1.5 rounded-md transition-all',
                            chartType === 'line' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}
                          title="Line chart"
                        ><LineChartIcon className="w-3.5 h-3.5" /></button>
                        <button
                          type="button"
                          onClick={() => setChartType('bar')}
                          className={cn('px-2 py-1.5 rounded-md transition-all',
                            chartType === 'bar' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}
                          title="Bar chart"
                        ><BarChart3 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    {chartType === 'line' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(d) => format(parseISO(d), 'd MMM')} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(v) => meta.format === 'percent' ? `${v}%` : String(v)} />
                        <Tooltip
                          labelFormatter={(d) => format(parseISO(String(d)), 'dd MMM yyyy')}
                          formatter={(v) => [fmtY(Number(v)), meta.label]}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }}
                        />
                        <Line type="monotone" dataKey={chartMetric}
                          stroke={meta.color} strokeWidth={2.5} dot={false} name={meta.label} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(d) => format(parseISO(d), 'd MMM')} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(v) => meta.format === 'percent' ? `${v}%` : String(v)} />
                        <Tooltip
                          labelFormatter={(d) => format(parseISO(String(d)), 'dd MMM yyyy')}
                          formatter={(v) => [fmtY(Number(v)), meta.label]}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }}
                        />
                        <Bar dataKey={chartMetric} fill={meta.color} name={meta.label} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {/* Table view */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                <div>
                  <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em]">Detail</p>
                  <h4 className="text-sm font-black text-slate-900">Tabel Konten · {filteredContent.length} baris</h4>
                </div>
              </div>
              {filteredContent.length === 0 ? (
                <div className="py-12 text-center">
                  <Smartphone className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada konten cocok filter</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead className="bg-slate-50/60 sticky top-0">
                      <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-4">App</th>
                        <th className="py-3.5 px-4">Platform</th>
                        <th className="py-3.5 px-4">Jenis</th>
                        <th className="py-3.5 px-4 max-w-[240px]">Caption</th>
                        <th className="py-3.5 px-4 text-right">Tayangan</th>
                        <th className="py-3.5 px-4 text-right">Jangkauan</th>
                        <th className="py-3.5 px-4 text-right">Pemirsa</th>
                        <th className="py-3.5 px-4 text-right">Interaksi</th>
                        <th className="py-3.5 px-4 text-right">Suka</th>
                        <th className="py-3.5 px-4 text-right">Komen</th>
                        <th className="py-3.5 px-4 text-right">Share</th>
                        <th className="py-3.5 px-4 text-right">Save</th>
                        <th className="py-3.5 px-4 text-right">Klik</th>
                        <th className="py-3.5 px-4 text-right">Mengikuti</th>
                        <th className="py-3.5 px-4 text-right">ER%</th>
                        <th className="py-3.5 px-4 w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContent.map((item, i) => {
                        const er = item.jangkauan > 0
                          ? (item.jumlahBersihInteraksi / item.jangkauan) * 100 : 0;
                        return (
                          <tr key={`${item.appId}-${item.date}-${item.contentIndex}-${i}`}
                            className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                            <td className="py-3 px-4 text-[11px] font-black text-slate-700 tabular-nums whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDateClick(item.tanggalUpload || item.date)}
                                className="hover:text-indigo-600 transition-colors"
                                title="Lihat di Kalender"
                              >
                                {item.tanggalUpload ? format(new Date(item.tanggalUpload), 'dd MMM yy') : '-'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-[11px] font-black text-slate-700 uppercase tracking-widest whitespace-nowrap">{item.appName}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-widest">{item.platform}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest">{item.jenisKonten}</span>
                            </td>
                            <td className="py-3 px-4 max-w-[240px]">
                              <p className="text-[11px] text-slate-700 font-medium line-clamp-2">{item.caption || <span className="text-slate-300">(tanpa caption)</span>}</p>
                              {item._fromKonten && (
                                <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                                  <Layers className="w-2.5 h-2.5" /> Skrip
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.tayangan)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.jangkauan)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.pemirsa)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.jumlahBersihInteraksi)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.sukaTanggapan)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.komen)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.share)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.save)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.klikTautan)}</td>
                            <td className="py-3 px-4 text-right text-[11px] font-black text-slate-900 tabular-nums">{formatNumber(item.mengikuti)}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black tabular-nums',
                                er > 5 ? 'bg-emerald-100 text-emerald-700' : er > 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                                {er.toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                {item._fromKonten ? (
                                  <button type="button" onClick={() => setActiveTab('konten')}
                                    className="p-1 hover:bg-indigo-50 rounded-md text-slate-400 hover:text-indigo-600"
                                    title="Edit di Skrip Konten"
                                  ><Layers className="w-3 h-3" /></button>
                                ) : (
                                  <button type="button" onClick={() => handleDelete(item.appId, item.date, item.contentIndex)}
                                    className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600"
                                    title="Hapus"
                                  ><Trash2 className="w-3 h-3" /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AddContentModal
          apps={apps}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddContent}
        />
      )}
    </div>
  );
};

// ============================================================
// AddContentModal — form 17 field
// ============================================================
interface AddModalProps {
  apps: AppData[];
  onClose: () => void;
  onSave: (appId: string, content: SocialMediaContent) => void;
}

const AddContentModal = ({ apps, onClose, onSave }: AddModalProps) => {
  const [appId, setAppId] = useState<string>(apps[0]?.id || '');
  const [content, setContent] = useState<SocialMediaContent>(emptyContent());
  const toast = useToast();

  const update = <K extends keyof SocialMediaContent>(field: K, value: SocialMediaContent[K]) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId) {
      toast.warning('Form belum lengkap', 'Pilih aplikasi dulu.');
      return;
    }
    if (!content.tanggalUpload) {
      toast.warning('Form belum lengkap', 'Tanggal upload wajib diisi.');
      return;
    }
    onSave(appId, content);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tambah Konten Sosial Media</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              17 metrik per post — semua angka dalam unit aslinya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5 text-slate-400 rotate-45" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Identitas */}
          <SectionLabel>Identitas</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Aplikasi">
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                required
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Upload">
              <input
                type="date"
                value={content.tanggalUpload}
                onChange={(e) => update('tanggalUpload', e.target.value)}
                required
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
            <Field label="Platform">
              <select
                value={content.platform}
                onChange={(e) => update('platform', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Jenis Konten">
              <select
                value={content.jenisKonten}
                onChange={(e) => update('jenisKonten', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {JENIS_KONTEN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Caption">
            <textarea
              rows={3}
              value={content.caption}
              onChange={(e) => update('caption', e.target.value)}
              placeholder="Teks caption lengkap…"
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 resize-y"
            />
          </Field>

          {/* Reach */}
          <SectionLabel>Reach</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Tayangan">
              <NumberInput value={content.tayangan} onChange={(v) => update('tayangan', v)} />
            </Field>
            <Field label="Jangkauan">
              <NumberInput value={content.jangkauan} onChange={(v) => update('jangkauan', v)} />
            </Field>
            <Field label="Pemirsa">
              <NumberInput value={content.pemirsa} onChange={(v) => update('pemirsa', v)} />
            </Field>
          </div>

          {/* Engagement */}
          <SectionLabel>Engagement</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Jumlah Bersih Interaksi">
              <NumberInput value={content.jumlahBersihInteraksi} onChange={(v) => update('jumlahBersihInteraksi', v)} />
            </Field>
            <Field label="Suka & Tanggapan">
              <NumberInput value={content.sukaTanggapan} onChange={(v) => update('sukaTanggapan', v)} />
            </Field>
            <Field label="Komen">
              <NumberInput value={content.komen} onChange={(v) => update('komen', v)} />
            </Field>
            <Field label="Share">
              <NumberInput value={content.share} onChange={(v) => update('share', v)} />
            </Field>
            <Field label="Save">
              <NumberInput value={content.save} onChange={(v) => update('save', v)} />
            </Field>
          </div>

          {/* Konversi */}
          <SectionLabel>Konversi</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Klik Tautan">
              <NumberInput value={content.klikTautan} onChange={(v) => update('klikTautan', v)} />
            </Field>
            <Field label="Balasan">
              <NumberInput value={content.balasan} onChange={(v) => update('balasan', v)} />
            </Field>
            <Field label="Mengikuti">
              <NumberInput value={content.mengikuti} onChange={(v) => update('mengikuti', v)} />
            </Field>
          </div>

          {/* Watch time */}
          <SectionLabel>Waktu Tonton</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Waktu Tonton (detik)">
              <NumberInput value={content.waktuTonton} onChange={(v) => update('waktuTonton', v)} />
            </Field>
            <Field label="Rata-rata Waktu Tonton (detik)">
              <NumberInput value={content.rataRataWaktuTonton} onChange={(v) => update('rataRataWaktuTonton', v)} />
            </Field>
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Simpan Konten
          </button>
        </div>
      </motion.form>
    </div>
  );
};

// ============================================================
// UI helpers
// ============================================================
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
      {label}
    </label>
    {children}
  </div>
);

const NumberInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <input
    type="number"
    min={0}
    value={value}
    onChange={(e) => onChange(Number(e.target.value) || 0)}
    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 tabular-nums"
  />
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="pt-2">
    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] border-b border-indigo-100 pb-1.5">
      {children}
    </p>
  </div>
);

// ============================================================
// HeroCard — kartu metric kecil bergradien (untuk dashboard ringkasan)
// ============================================================
const HeroCard = ({ icon: Icon, label, value, gradient }: {
  icon: typeof Eye;
  label: string;
  value: string;
  gradient: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    className={cn(
      'relative overflow-hidden p-4 rounded-2xl text-white shadow-lg bg-gradient-to-br',
      gradient,
    )}
  >
    <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
    <div className="relative flex items-start justify-between mb-3">
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className="text-[8px] font-black uppercase tracking-widest text-white/80 mb-1">{label}</p>
    <h3 className="text-xl font-black tracking-tight tabular-nums">{value}</h3>
  </motion.div>
);

export default SocialMediaAnalysis;
