import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check, ChevronDown, Edit2, FileText, Film, Image as ImageIcon, Layers, Plus, Search,
  Smartphone, Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  deleteContentScript,
  fetchContentScripts,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  ContentScript, ContentStatus, ContentType,
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
  'progress':      { bg: 'bg-amber-100',   text: 'text-amber-800' },
  'editing':       { bg: 'bg-amber-100',   text: 'text-amber-800' },
  'analisis':      { bg: 'bg-amber-100',   text: 'text-amber-800' },
  'take':          { bg: 'bg-cyan-100',    text: 'text-cyan-800' },
  'skrip ready':   { bg: 'bg-yellow-100',  text: 'text-yellow-800' },
  'skrip urgent':  { bg: 'bg-rose-100',    text: 'text-rose-800' },
  'revisi':        { bg: 'bg-orange-100',  text: 'text-orange-800' },
  'done':          { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'cancel':        { bg: 'bg-slate-200',   text: 'text-slate-600' },
};

// Border ring per nilai — bikin badge berasa solid kayak chip Material
const TONE_RING: Record<string, string> = {
  'progress':      'border-amber-300',
  'editing':       'border-amber-300',
  'analisis':      'border-amber-300',
  'take':          'border-cyan-300',
  'skrip ready':   'border-yellow-300',
  'skrip urgent':  'border-rose-300',
  'revisi':        'border-orange-300',
  'done':          'border-emerald-300',
  'cancel':        'border-slate-300',
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

    // Pakai supabase langsung biar bisa baca pesan error spesifik
    // (CRUD helper di dataAccess kembalikan null kalau error, nutupin pesan)
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Supabase belum terkonfigurasi');
      return;
    }
    const { error } = await supabase
      .from('content_scripts')
      .update(patch)
      .eq('id', id);

    if (error) {
      // Common: "column 'talent' of relation 'content_scripts' does not exist"
      // → user belum run schema migration
      const msg = error.message;
      if (/column .* does not exist/i.test(msg)) {
        toast.error(
          'Kolom belum ada di DB',
          'Run schema.sql terbaru di Supabase SQL Editor (kolom talent/editor/last_synced_date).',
        );
      } else if (/permission|policy|denied/i.test(msg)) {
        toast.error('Akses ditolak (RLS)', msg);
      } else {
        toast.error('Gagal simpan', msg);
      }
      // Revert optimistic update
      void refresh();
    }
  };

  const handleEditDeep = (s: ContentScript) => {
    setEditingScript(s);
    setEditorOpen(true);
  };

  // Tambah Skrip → buka drawer kosong (auto-save aktif di drawer)
  const handleNewSkrip = () => {
    setEditingScript(null);
    setEditorOpen(true);
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
            onClick={handleNewSkrip}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Buat Skrip
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
          <EmptyState onCreate={() => void handleNewSkrip()} />
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
        // onSaved cuma refresh list — gak nutup drawer (auto-save di drawer
        // bisa fire berkali-kali sambil user terus ngedit)
        onSaved={() => void refresh()}
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
      {/* No skrip — klik buka drawer detail */}
      <td className="p-0 sticky left-0 bg-white group-hover:bg-amber-50/40 z-10 border-r border-slate-100">
        <button
          type="button"
          onClick={() => onEdit(s)}
          title="Buka detail skrip"
          className="w-full h-full px-3 py-2 text-xs font-black text-rose-600 tabular-nums hover:bg-rose-50 hover:text-rose-700 transition-colors text-left underline-offset-2 hover:underline cursor-pointer"
        >
          {String(idx + 1).padStart(2, '0')}
        </button>
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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 0,
  });

  // Hitung posisi popover (fixed) berdasarkan rect tombol trigger
  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 140),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();

    // Tutup popover kalau scroll / resize / klik luar / Escape
    const closeOnScroll = () => setOpen(false);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open, computePosition]);

  const tone = value ? TONE_BY_VALUE[value.toLowerCase()] : null;
  const ring = value ? TONE_RING[value.toLowerCase()] : null;
  const displayValue = value ? value.toUpperCase() : '—';

  return (
    <td className="p-0 align-middle border-r border-slate-100">
      <div className="w-full p-1.5">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'w-full px-2.5 py-1.5 inline-flex items-center justify-between gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            'border',
            tone
              ? `${tone.bg} ${tone.text} ${ring ?? 'border-transparent'} hover:shadow-md`
              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100',
            open && 'ring-2 ring-rose-400/40',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown
            className={cn('w-3 h-3 opacity-70 transition-transform flex-shrink-0', open && 'rotate-180')}
          />
        </button>

        {/* Popover di-portal ke document.body biar gak ke-clip overflow parent */}
        {createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  zIndex: 9999,
                }}
                className="bg-white rounded-xl border border-slate-200 shadow-2xl p-1"
                role="listbox"
              >
                <DropdownOption
                  label="—"
                  tone={null}
                  ring={null}
                  selected={!value}
                  onClick={() => { onChange(null); setOpen(false); }}
                  showCheck={false}
                />
                {options.map((opt) => {
                  const t = TONE_BY_VALUE[opt.toLowerCase()];
                  const r = TONE_RING[opt.toLowerCase()];
                  const isSelected = value === opt;
                  return (
                    <DropdownOption
                      key={opt}
                      label={opt.toUpperCase()}
                      tone={t}
                      ring={r}
                      selected={isSelected}
                      showCheck
                      onClick={() => { onChange(opt); setOpen(false); }}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      </div>
    </td>
  );
}

function DropdownOption({
  label, tone, ring, selected, onClick, showCheck,
}: {
  label: string;
  tone: { bg: string; text: string } | null | undefined;
  ring: string | null | undefined;
  selected: boolean;
  onClick: () => void;
  showCheck: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={selected}
      className={cn(
        'w-full px-2.5 py-1.5 my-0.5 inline-flex items-center justify-between gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-left transition-all',
        tone
          ? `${tone.bg} ${tone.text} ${ring ?? ''} border`
          : 'text-slate-400 hover:bg-slate-50 border border-transparent',
        selected && 'ring-2 ring-rose-400/60 ring-inset',
        'hover:scale-[1.02] hover:shadow-sm active:scale-[0.99]',
      )}
    >
      <span className="truncate">{label}</span>
      {showCheck && selected && <Check className="w-3 h-3 opacity-70 flex-shrink-0" />}
    </button>
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
      Mulai dengan membuat skrip pertama untuk platform ini.
    </p>
    <button
      type="button"
      onClick={onCreate}
      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
    >
      <Plus className="w-3.5 h-3.5" />
      Buat Skrip Pertama
    </button>
  </div>
);

export default ContentSection;
