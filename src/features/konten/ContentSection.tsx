import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Edit2, FileText, Film, Image as ImageIcon, Layers, Plus, Search,
  Smartphone, Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  createContentScript,
  deleteContentScript,
  fetchContentScripts,
  updateContentScript,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  CarouselContent, ContentScript, ContentStatus, ContentType, NewContentScript,
} from '../../types';
import ContentEditorDrawer from './ContentEditorDrawer';
import ImportExportButtons from './ImportExportButtons';

interface Props {
  detectedPlatforms?: string[];
}

const TYPE_META: Record<ContentType, { label: string; icon: typeof Film }> = {
  video: { label: 'Video', icon: Film },
  carousel: { label: 'Carousel', icon: Layers },
  single_post: { label: 'Single Post', icon: ImageIcon },
};

const STATUS_META: Record<ContentStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',     bg: 'bg-slate-100',  text: 'text-slate-700',   dot: 'bg-slate-500' },
  review:    { label: 'Review',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  approved:  { label: 'Approved',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  published: { label: 'Published', bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
};

// Dropdown options + warna badge per nilai
const INFO_SKRIP_OPTIONS = ['progress', 'skrip ready', 'skrip urgent'] as const;
const TALENT_OPTIONS = ['analisis', 'take', 'done'] as const;
const CREATIVE_OPTIONS = ['progress', 'editing', 'done'] as const;
const QC_OPTIONS = ['revisi', 'done', 'cancel'] as const;

const TONE_BY_VALUE: Record<string, { bg: string; text: string }> = {
  // status workflow
  'progress':      { bg: 'bg-amber-50',   text: 'text-amber-700' },
  'editing':       { bg: 'bg-amber-50',   text: 'text-amber-700' },
  'analisis':      { bg: 'bg-amber-50',   text: 'text-amber-700' },
  'take':          { bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  'skrip ready':   { bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  'skrip urgent':  { bg: 'bg-rose-50',    text: 'text-rose-700' },
  'revisi':        { bg: 'bg-orange-50',  text: 'text-orange-700' },
  'done':          { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'cancel':        { bg: 'bg-slate-100',  text: 'text-slate-500' },
};

export const ContentSection = ({ detectedPlatforms = [] }: Props) => {
  const toast = useToast();

  const [platform, setPlatform] = useState<string>(detectedPlatforms[0]?.toLowerCase() || 'jadiasn');
  const [typeTab, setTypeTab] = useState<ContentType>('video');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [search, setSearch] = useState('');
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer (untuk skrip lengkap: TAHAPAN, CAPTION, dll)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ContentScript | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await fetchContentScripts({ platform, type: typeTab });
    setScripts(rows);
    setLoading(false);
  }, [platform, typeTab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (detectedPlatforms.length > 0) {
      const lower = detectedPlatforms.map((p) => p.toLowerCase());
      if (!lower.includes(platform)) setPlatform(lower[0]);
    }
  }, [detectedPlatforms, platform]);

  const filtered = useMemo(() => {
    return scripts.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${s.title ?? ''} ${s.info_skrip ?? ''} ${s.editor ?? ''} ${s.catatan ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scripts, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const acc: Record<ContentStatus | 'all', number> = {
      all: scripts.length,
      draft: 0, review: 0, approved: 0, published: 0,
    };
    scripts.forEach((s) => { acc[s.status] += 1; });
    return acc;
  }, [scripts]);

  // Optimistic update + save
  const updateRow = async (id: string, patch: Partial<ContentScript>) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const result = await updateContentScript(id, patch as Partial<NewContentScript>);
    if (!result) {
      toast.error('Gagal simpan', 'Perubahan tidak tersimpan, refresh halaman.');
      void refresh();
    }
  };

  const handleEditDeep = (s: ContentScript) => {
    setEditingScript(s);
    setEditorOpen(true);
  };

  const handleNewRow = async () => {
    // Bikin row baru langsung di DB dengan default minimal,
    // user lalu edit cell-nya inline.
    const supabase = getSupabase();
    let userId: string | null = null;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    const emptyContent = typeTab === 'carousel'
      ? ({ slides: [{ tema: '', skrip: '', kpt: '' }], caption: '' } as CarouselContent)
      : {};

    const payload: NewContentScript = {
      user_id: userId,
      platform,
      type: typeTab,
      scheduled_date: null,
      tgl_tay: null,
      title: '',
      status: 'draft',
      assigned_to: null,
      info_skrip: null,
      talent: null,
      editor: null,
      poster: null,
      creative: null,
      link_video: null,
      link_canva: null,
      cc: null,
      upload_status: null,
      link_konten: null,
      keterangan: null,
      catatan: null,
      content: emptyContent,
    };

    const result = await createContentScript(payload);
    if (result) {
      setScripts((prev) => [result, ...prev]);
      toast.success('Baris baru ditambahkan', 'Klik cell untuk mulai mengisi.');
    } else {
      toast.error('Gagal tambah baris');
    }
  };

  const handleDelete = async (s: ContentScript) => {
    if (!window.confirm(`Hapus skrip "${s.title || 'Tanpa Judul'}"?`)) return;
    const ok = await deleteContentScript(s.id);
    if (ok) {
      setScripts((prev) => prev.filter((x) => x.id !== s.id));
      toast.success('Skrip dihapus');
    } else {
      toast.error('Gagal hapus skrip');
    }
  };

  const platformsList = detectedPlatforms.length > 0
    ? detectedPlatforms.map((p) => p.toLowerCase())
    : [platform];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Content Hub
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Manajemen Konten
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Kelola skrip seperti spreadsheet — edit cell langsung di tabel,
            atau klik tombol pencil untuk masuk skrip detail (TAHAPAN, CAPTION).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ImportExportButtons platform={platform} onImported={() => void refresh()} />
          <button
            type="button"
            onClick={() => void handleNewRow()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Baris
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Platform"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              {platformsList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
            {(['video', 'carousel', 'single_post'] as ContentType[]).map((t) => {
              const Icon = TYPE_META[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeTab(t)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                    typeTab === t ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-700',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {TYPE_META[t].label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
            {(['all', 'draft', 'review', 'approved', 'published'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700',
                )}
              >
                {s === 'all' ? 'All' : STATUS_META[s].label}
                <span className="ml-1 text-slate-400 font-medium">({statusCounts[s]})</span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul / editor / catatan..."
              className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[11px] font-bold text-slate-400">
            Memuat skrip…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => void handleNewRow()} />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1900px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-amber-100 border-b-2 border-amber-300">
                  <Th sticky w="60px">No Skrip</Th>
                  <Th w="120px">Tanggal Buat</Th>
                  <Th w="200px">USP / Keyword</Th>
                  <Th w="130px">Info Skrip</Th>
                  <Th w="110px">Talent</Th>
                  <Th w="140px">Editor</Th>
                  <Th w="120px">Creative</Th>
                  <Th w="220px">Link Video</Th>
                  <Th w="100px">QC</Th>
                  <Th w="120px">Upload</Th>
                  <Th w="220px">Link Konten</Th>
                  <Th w="200px">Catatan</Th>
                  <Th w="80px" align="center">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <Row key={s.id}
                    s={s}
                    idx={idx}
                    onUpdate={updateRow}
                    onEdit={handleEditDeep}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContentEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); void refresh(); }}
        existing={editingScript}
        defaultPlatform={platform}
        defaultType={typeTab}
      />
    </div>
  );
};

// ============================================================
// Row component — semua cell editable inline
// ============================================================
function Row({ s, idx, onUpdate, onEdit, onDelete }: {
  s: ContentScript;
  idx: number;
  onUpdate: (id: string, patch: Partial<ContentScript>) => void | Promise<void>;
  onEdit: (s: ContentScript) => void;
  onDelete: (s: ContentScript) => void | Promise<void>;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.01 }}
      className="border-b border-slate-100 hover:bg-amber-50/20 group"
    >
      {/* No skrip */}
      <td className="py-2 px-3 text-xs font-black text-slate-400 tabular-nums sticky left-0 bg-white group-hover:bg-amber-50/40 z-10 border-r border-slate-100">
        {String(idx + 1).padStart(2, '0')}
      </td>

      {/* Tanggal Buat */}
      <DateCell value={s.tgl_tay} onChange={(v) => onUpdate(s.id, { tgl_tay: v })} />

      {/* USP/Keyword (title) */}
      <TextCell value={s.title} onChange={(v) => onUpdate(s.id, { title: v })} placeholder="Try Out CPNS..." bold />

      {/* Info Skrip */}
      <DropdownCell
        value={s.info_skrip}
        options={INFO_SKRIP_OPTIONS}
        onChange={(v) => onUpdate(s.id, { info_skrip: v })}
      />

      {/* Talent */}
      <DropdownCell
        value={s.talent}
        options={TALENT_OPTIONS}
        onChange={(v) => onUpdate(s.id, { talent: v })}
      />

      {/* Editor (manual text) */}
      <TextCell value={s.editor} onChange={(v) => onUpdate(s.id, { editor: v })} placeholder="Nama editor..." />

      {/* Creative */}
      <DropdownCell
        value={s.creative}
        options={CREATIVE_OPTIONS}
        onChange={(v) => onUpdate(s.id, { creative: v })}
      />

      {/* Link Video */}
      <TextCell value={s.link_video} onChange={(v) => onUpdate(s.id, { link_video: v })} placeholder="https://..." asLink />

      {/* QC (cc column) */}
      <DropdownCell
        value={s.cc}
        options={QC_OPTIONS}
        onChange={(v) => onUpdate(s.id, { cc: v })}
      />

      {/* Upload (scheduled_date) */}
      <DateCell value={s.scheduled_date} onChange={(v) => onUpdate(s.id, { scheduled_date: v })} />

      {/* Link Konten */}
      <TextCell value={s.link_konten} onChange={(v) => onUpdate(s.id, { link_konten: v })} placeholder="https://..." asLink />

      {/* Catatan */}
      <TextCell value={s.catatan} onChange={(v) => onUpdate(s.id, { catatan: v })} />

      {/* Action */}
      <td className="py-2 px-2 text-center">
        <div className="inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(s)}
            aria-label="Edit skrip detail"
            title="Buka skrip detail"
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete(s)}
            aria-label="Hapus"
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// ============================================================
// Inline editable cells
// ============================================================

function Th({ children, sticky, w, align = 'left' }: {
  children: React.ReactNode;
  sticky?: boolean;
  w?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      style={w ? { minWidth: w, width: w } : undefined}
      className={cn(
        'py-3 px-3 text-[9px] font-black text-amber-900 uppercase tracking-widest border-r border-amber-200',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        sticky && 'sticky left-0 bg-amber-100 z-30',
      )}
    >
      {children}
    </th>
  );
}

function TextCell({ value, onChange, placeholder, asLink, bold }: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  asLink?: boolean;
  bold?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const commit = () => {
    if (draft !== (value ?? '')) {
      onChange(draft || null);
    }
  };

  return (
    <td className="p-0 align-middle border-r border-slate-100">
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ref.current?.blur();
          if (e.key === 'Escape') {
            setDraft(value ?? '');
            ref.current?.blur();
          }
        }}
        placeholder={placeholder}
        className={cn(
          'sheet-cell',
          bold && 'font-black text-slate-900',
          asLink && draft && 'text-indigo-600 underline-offset-2 hover:underline',
        )}
      />
    </td>
  );
}

function DateCell({ value, onChange }: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const display = value ? value.slice(0, 10) : '';
  return (
    <td className="p-0 align-middle border-r border-slate-100">
      <input
        type="date"
        value={display}
        onChange={(e) => onChange(e.target.value || null)}
        className="sheet-cell tabular-nums"
      />
    </td>
  );
}

function DropdownCell({ value, options, onChange }: {
  value: string | null;
  options: readonly string[];
  onChange: (v: string | null) => void;
}) {
  const tone = value ? TONE_BY_VALUE[value.toLowerCase()] : null;
  return (
    <td className={cn('p-0 align-middle border-r border-slate-100')}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          'sheet-cell font-black uppercase tracking-widest text-[10px] text-center',
          tone ? `${tone.bg} ${tone.text}` : '',
        )}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o.toUpperCase()}</option>
        ))}
      </select>
    </td>
  );
}

// ============================================================
// Empty state
// ============================================================
const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="py-16 text-center">
    <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 flex items-center justify-center mb-4">
      <FileText className="w-8 h-8 text-rose-400" />
    </div>
    <h4 className="text-sm font-black text-slate-700 mb-1">Belum ada skrip</h4>
    <p className="text-xs text-slate-400 font-medium mb-6">
      Mulai dengan menambah baris pertama untuk platform ini.
    </p>
    <button
      type="button"
      onClick={onCreate}
      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
    >
      <Plus className="w-3.5 h-3.5" />
      Tambah Baris Pertama
    </button>
  </div>
);

export default ContentSection;
