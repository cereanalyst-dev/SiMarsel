import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { logger } from '../../lib/logger';
import { motion } from 'motion/react';
import { format, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import { Calendar, Download, FileSpreadsheet, Plus, Search, Smartphone, Trash2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../lib/formatters';
import { excelDateToJSDate } from '../../lib/excelDate';
import type { AppData, SocialMediaContent } from '../../types';

interface Props {
  apps: AppData[];
  setApps: (a: AppData[]) => void;
  setActiveTab: (tab: string) => void;
  setCalendarFocusDate: (date: Date) => void;
}

const emptyContent = (): SocialMediaContent => ({
  platform: 'Instagram',
  postingTime: '10:00',
  contentType: 'Feed',
  title: '',
  caption: '',
  cta: '',
  topic: '',
  reach: 0,
  engagement: 0,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  hook: '',
  link: '',
  objective: 'Awareness',
});

export const SocialMediaAnalysis = ({
  apps,
  setApps,
  setActiveTab,
  setCalendarFocusDate,
}: Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  const allContent = useMemo(() => {
    return apps
      .flatMap((app) =>
        Object.entries(app.dailyData || {}).flatMap(([date, dayData]) =>
          (dayData.socialContent || []).map((content, idx) => ({
            ...content,
            date,
            appId: app.id,
            appName: app.name,
            contentIndex: idx,
          })),
        ),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [apps]);

  const handleDateClick = (dateStr: string) => {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    setCalendarFocusDate(date);
    setActiveTab('calendar');
  };

  const filteredContent = useMemo(() => {
    const needle = searchTerm.toLowerCase();
    return allContent.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        (item.title || '').toLowerCase().includes(needle) ||
        (item.caption || '').toLowerCase().includes(needle) ||
        (item.hook || '').toLowerCase().includes(needle);
      const matchesPlatform = platformFilter === 'All' || item.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [allContent, searchTerm, platformFilter]);

  const platforms = useMemo(
    () => ['All', ...Array.from(new Set(allContent.map((i) => i.platform).filter(Boolean)))],
    [allContent],
  );

  const handleDelete = (appId: string, date: string, contentIndex: number) => {
    const confirmed = window.confirm('Yakin ingin hapus konten ini?');
    if (!confirmed) return;
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

  // ===================== IMPORT / TEMPLATE EXCEL =====================
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const appNamesHint = apps.map((a) => a.name).join(', ');
    const exampleAppName = apps[0]?.name ?? 'JADIBUMN';
    const today = format(new Date(), 'yyyy-MM-dd');

    const rows = [
      {
        'Nama App':   exampleAppName,
        'Tanggal':    today,
        'Jam Posting':'10:00',
        'Platform':   'Instagram',
        'Jenis Konten':'Reels',
        'Objective':  'Awareness',
        'Judul':      'Tips Jitu Lolos Tes BUMN 2026',
        'Hook':       'Jangan asal ikut tes — simak dulu...',
        'Caption':    'Caption lengkap di sini. Pakai kalimat persuasif dan CTA jelas.',
        'CTA':        'Daftar sekarang',
        'Topik':      'Persiapan tes BUMN',
        'Link':       'https://example.com',
        'Reach':      5000,
        'Engagement': 250,
        'Views':      8000,
        'Likes':      200,
        'Comments':   30,
        'Shares':     20,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 40 }, { wch: 40 }, { wch: 60 }, { wch: 20 }, { wch: 24 }, { wch: 30 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Konten Sosial Media');

    // Sheet kedua: petunjuk
    const noteRows = [
      ['Petunjuk Pengisian Template'],
      [''],
      ['1.', 'Kolom "Nama App" HARUS cocok dengan salah satu: ' + appNamesHint],
      ['2.', 'Tanggal format YYYY-MM-DD (mis. 2024-03-15). Boleh juga format Excel Date.'],
      ['3.', 'Jam Posting format HH:mm (24 jam), mis. 09:30, 14:15.'],
      ['4.', 'Platform: Instagram, TikTok, Facebook, Twitter/X, YouTube, LinkedIn.'],
      ['5.', 'Jenis Konten: Feed, Reels, Story, Video, Shorts, Live, Carousel.'],
      ['6.', 'Objective: Awareness, Engagement, Traffic, Conversion, Retention.'],
      ['7.', 'Kolom angka (Reach, Engagement, Views, Likes, Comments, Shares) isi angka saja.'],
      ['8.', 'Kolom teks kosong diperbolehkan kecuali Nama App dan Tanggal.'],
      ['9.', 'Baris contoh di sheet "Konten Sosial Media" boleh dihapus setelah diisi.'],
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
        setImportStatus('❌ File kosong. Tidak ada baris yang diimpor.');
        return;
      }

      const appByName = new Map(apps.map((a) => [a.name.toLowerCase().trim(), a]));

      // Collect updates: { appId → { date → [new content...] } }
      const updates = new Map<string, Map<string, SocialMediaContent[]>>();
      let imported = 0;
      const skipped: string[] = [];

      rows.forEach((row, idx) => {
        const appName = String(row['Nama App'] ?? row['App'] ?? '').trim();
        const app = appByName.get(appName.toLowerCase());
        if (!app) {
          skipped.push(`Baris ${idx + 2}: App "${appName}" tidak dikenal`);
          return;
        }

        const rawDate = row['Tanggal'] ?? row['Date'] ?? row['tanggal'];
        const dateObj =
          typeof rawDate === 'number' ? excelDateToJSDate(rawDate) : new Date(String(rawDate));
        if (isNaN(dateObj.getTime())) {
          skipped.push(`Baris ${idx + 2}: Tanggal tidak valid`);
          return;
        }
        const dateKey = format(dateObj, 'yyyy-MM-dd');

        const content: SocialMediaContent = {
          platform:    String(row['Platform'] ?? 'Instagram'),
          postingTime: String(row['Jam Posting'] ?? row['Posting Time'] ?? '10:00'),
          contentType: String(row['Jenis Konten'] ?? row['Content Type'] ?? 'Feed'),
          title:       String(row['Judul'] ?? row['Title'] ?? ''),
          caption:     String(row['Caption'] ?? ''),
          cta:         String(row['CTA'] ?? ''),
          topic:       String(row['Topik'] ?? row['Topic'] ?? ''),
          hook:        String(row['Hook'] ?? ''),
          link:        String(row['Link'] ?? ''),
          objective:   String(row['Objective'] ?? 'Awareness'),
          reach:      Number(row['Reach'])      || 0,
          engagement: Number(row['Engagement']) || 0,
          views:      Number(row['Views'])      || 0,
          likes:      Number(row['Likes'])      || 0,
          comments:   Number(row['Comments'])   || 0,
          shares:     Number(row['Shares'])     || 0,
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
        msg += ` ${skipped.length} baris di-skip. Cek Console untuk detail.`;
        logger.warn('Social media import skipped rows:', skipped);
      }
      setImportStatus(msg);
    } catch (err) {
      logger.error('Import social media error:', err);
      setImportStatus('❌ Gagal membaca file. Pastikan format sesuai template.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddContent = (appId: string, date: string, content: SocialMediaContent) => {
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
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
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
                Database seluruh konten yang telah diposting — {allContent.length} konten
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <Search className="w-4 h-4 text-slate-400 ml-2" />
              <input
                type="text"
                placeholder="Cari judul, caption, hook…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none px-2 py-1 w-52"
              />
            </div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600 outline-none px-4 py-2.5 rounded-2xl cursor-pointer"
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={handleDownloadTemplate}
              title="Download template Excel"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-emerald-400 hover:text-emerald-600 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
            <button
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
              onClick={() => setImportStatus(null)}
              className="text-[10px] font-black opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {allContent.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-10 h-10 text-rose-300" />
            </div>
            <h4 className="text-lg font-black text-slate-700 mb-2">Belum ada konten</h4>
            <p className="text-sm text-slate-400 font-medium mb-8 max-w-md mx-auto">
              Mulai dokumentasikan konten sosial media Anda. Klik tombol di bawah untuk menambahkan
              konten pertama.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Tambah Konten Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
            <table className="w-full text-left min-w-[1300px] border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                  <th className="py-4 px-4 rounded-tl-2xl">Platform</th>
                  <th className="py-4 px-4">App</th>
                  <th className="py-4 px-4">Tanggal</th>
                  <th className="py-4 px-4">Jenis</th>
                  <th className="py-4 px-4 text-center">Likes</th>
                  <th className="py-4 px-4 text-center">Comments</th>
                  <th className="py-4 px-4 text-center">Shares</th>
                  <th className="py-4 px-4 text-center">ER (%)</th>
                  <th className="py-4 px-4">Hook</th>
                  <th className="py-4 px-4">CTA</th>
                  <th className="py-4 px-4 rounded-tr-2xl text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredContent.map((item, i) => {
                  const er = item.reach > 0 ? (item.engagement / item.reach) * 100 : 0;
                  return (
                    <tr key={`${item.appId}-${item.date}-${item.contentIndex}-${i}`} className="hover:bg-rose-50/20 transition-colors group">
                      <td className="py-5 px-4">
                        <span className="px-3 py-1 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase tracking-wider">
                          {item.platform}
                        </span>
                      </td>
                      <td className="py-5 px-4 text-[10px] font-bold text-slate-500 uppercase">
                        {item.appName}
                      </td>
                      <td className="py-5 px-4 text-[11px] font-black text-slate-700">
                        {item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="py-5 px-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          {item.contentType}
                        </span>
                      </td>
                      <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                        {formatNumber(item.likes || 0)}
                      </td>
                      <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                        {formatNumber(item.comments || 0)}
                      </td>
                      <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                        {formatNumber(item.shares || 0)}
                      </td>
                      <td className="py-5 px-4 text-center">
                        <span
                          className={cn(
                            'text-[10px] font-black px-2 py-1 rounded-lg',
                            er > 5 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {er.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-5 px-4 text-[11px] text-slate-600 max-w-xs truncate" title={item.hook}>
                        {item.hook || '-'}
                      </td>
                      <td className="py-5 px-4 text-[11px] font-bold text-indigo-600 max-w-[150px] truncate" title={item.cta}>
                        {item.cta || '-'}
                      </td>
                      <td className="py-5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDateClick(item.date)}
                            className="p-2 hover:bg-indigo-50 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                            title="Lihat di Kalender Marsel"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.appId, item.date, item.contentIndex)}
                            className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                            title="Hapus konten"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredContent.length === 0 && (
              <div className="py-20 text-center">
                <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  Tidak ada konten yang cocok dengan filter
                </p>
              </div>
            )}
          </div>
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

// --- Add Content Modal ---

interface AddModalProps {
  apps: AppData[];
  onClose: () => void;
  onSave: (appId: string, date: string, content: SocialMediaContent) => void;
}

const AddContentModal = ({ apps, onClose, onSave }: AddModalProps) => {
  const [appId, setAppId] = useState<string>(apps[0]?.id || '');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [content, setContent] = useState<SocialMediaContent>(emptyContent());

  const update = <K extends keyof SocialMediaContent>(field: K, value: SocialMediaContent[K]) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId) {
      alert('Pilih aplikasi dulu.');
      return;
    }
    if (!date) {
      alert('Pilih tanggal dulu.');
      return;
    }
    onSave(appId, date, content);
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
              Catat performa konten yang sudah di-post.
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
          {/* App & Tanggal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Aplikasi">
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                required
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal Post">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
            <Field label="Jam Posting">
              <input
                type="time"
                value={content.postingTime}
                onChange={(e) => update('postingTime', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          </div>

          {/* Platform + Jenis + Objective */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Platform">
              <select
                value={content.platform}
                onChange={(e) => update('platform', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Facebook">Facebook</option>
                <option value="Twitter/X">Twitter/X</option>
                <option value="YouTube">YouTube</option>
                <option value="LinkedIn">LinkedIn</option>
              </select>
            </Field>
            <Field label="Jenis Konten">
              <select
                value={content.contentType}
                onChange={(e) => update('contentType', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Feed">Feed</option>
                <option value="Reels">Reels</option>
                <option value="Story">Story</option>
                <option value="Video">Video</option>
                <option value="Shorts">Shorts</option>
                <option value="Live">Live</option>
                <option value="Carousel">Carousel</option>
              </select>
            </Field>
            <Field label="Objective">
              <select
                value={content.objective}
                onChange={(e) => update('objective', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Awareness">Awareness</option>
                <option value="Engagement">Engagement</option>
                <option value="Traffic">Traffic</option>
                <option value="Conversion">Conversion</option>
                <option value="Retention">Retention</option>
              </select>
            </Field>
          </div>

          {/* Judul, Hook, Caption */}
          <Field label="Judul / Hook Singkat">
            <input
              type="text"
              value={content.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Misal: Tips Jitu Lolos Tes BUMN 2026"
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Hook (kalimat pembuka)">
            <input
              type="text"
              value={content.hook}
              onChange={(e) => update('hook', e.target.value)}
              placeholder="Misal: Jangan asal ikut tes — simak dulu..."
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field label="Caption">
            <textarea
              rows={3}
              value={content.caption}
              onChange={(e) => update('caption', e.target.value)}
              placeholder="Teks caption lengkap…"
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 resize-y"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CTA (Call To Action)">
              <input
                type="text"
                value={content.cta}
                onChange={(e) => update('cta', e.target.value)}
                placeholder="Misal: Daftar sekarang"
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
            <Field label="Topik">
              <input
                type="text"
                value={content.topic}
                onChange={(e) => update('topic', e.target.value)}
                placeholder="Misal: Tips interview"
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          </div>

          <Field label="Link Konten">
            <input
              type="url"
              value={content.link}
              onChange={(e) => update('link', e.target.value)}
              placeholder="https://…"
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          {/* Metrik */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Metrik Performa
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Reach">
                <NumberInput value={content.reach} onChange={(v) => update('reach', v)} />
              </Field>
              <Field label="Engagement">
                <NumberInput value={content.engagement} onChange={(v) => update('engagement', v)} />
              </Field>
              <Field label="Views">
                <NumberInput value={content.views} onChange={(v) => update('views', v)} />
              </Field>
              <Field label="Likes">
                <NumberInput value={content.likes} onChange={(v) => update('likes', v)} />
              </Field>
              <Field label="Comments">
                <NumberInput value={content.comments} onChange={(v) => update('comments', v)} />
              </Field>
              <Field label="Shares">
                <NumberInput value={content.shares} onChange={(v) => update('shares', v)} />
              </Field>
            </div>
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

// --- tiny UI helpers ---

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
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Number(e.target.value) || 0)}
    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
  />
);

export default SocialMediaAnalysis;
