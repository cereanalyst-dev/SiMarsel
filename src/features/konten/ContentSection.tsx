import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import {
  CheckCircle2, Clock, Edit2, FileText, Film, Image as ImageIcon,
  Layers, Plus, Search, Smartphone, Trash2, UserCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  deleteContentScript,
  fetchContentScripts,
} from '../../lib/dataAccess';
import type { ContentScript, ContentStatus, ContentType } from '../../types';
import ContentEditorDrawer from './ContentEditorDrawer';

interface Props {
  detectedPlatforms?: string[];
}

type TypeTab = 'all' | ContentType;

const TYPE_META: Record<ContentType, { label: string; icon: typeof Film; color: string }> = {
  video: { label: 'Video', icon: Film, color: 'rose' },
  carousel: { label: 'Carousel', icon: Layers, color: 'violet' },
  single_post: { label: 'Single Post', icon: ImageIcon, color: 'cyan' },
};

const STATUS_META: Record<ContentStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',      bg: 'bg-slate-100',  text: 'text-slate-700',   dot: 'bg-slate-500' },
  review:    { label: 'Review',     bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  approved:  { label: 'Approved',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  published: { label: 'Published',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
};

export const ContentSection = ({ detectedPlatforms = [] }: Props) => {
  const toast = useToast();

  const [platform, setPlatform] = useState<string>(detectedPlatforms[0]?.toLowerCase() || 'jadiasn');
  const [typeTab, setTypeTab] = useState<TypeTab>('video');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [search, setSearch] = useState('');
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ContentScript | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await fetchContentScripts({
      platform,
      type: typeTab === 'all' ? undefined : typeTab,
    });
    setScripts(rows);
    setLoading(false);
  }, [platform, typeTab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-update platform default kalau detected list berubah & current platform gak ada
  useEffect(() => {
    if (detectedPlatforms.length > 0) {
      const lower = detectedPlatforms.map((p) => p.toLowerCase());
      if (!lower.includes(platform)) {
        setPlatform(lower[0]);
      }
    }
  }, [detectedPlatforms, platform]);

  // Filter di client (search + status)
  const filtered = useMemo(() => {
    return scripts.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${s.title ?? ''} ${s.info_skrip ?? ''} ${s.keterangan ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scripts, statusFilter, search]);

  // Stats per status untuk badge counts di filter
  const statusCounts = useMemo(() => {
    const acc: Record<ContentStatus | 'all', number> = {
      all: scripts.length,
      draft: 0, review: 0, approved: 0, published: 0,
    };
    scripts.forEach((s) => { acc[s.status] += 1; });
    return acc;
  }, [scripts]);

  const handleEdit = (s: ContentScript) => {
    setEditingScript(s);
    setEditorOpen(true);
  };

  const handleNew = () => {
    setEditingScript(null);
    setEditorOpen(true);
  };

  const handleDelete = async (s: ContentScript) => {
    if (!window.confirm(`Hapus skrip "${s.title || 'Tanpa Judul'}"?`)) return;
    const ok = await deleteContentScript(s.id);
    if (ok) {
      toast.success('Skrip dihapus');
      void refresh();
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
            Kelola skrip video, carousel &amp; single post per platform — kolaborasi tim
            dengan workflow status (Draft → Review → Approved → Published).
          </p>
        </div>

        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-100 transition-all"
        >
          <Plus className="w-4 h-4" />
          Buat Skrip
        </button>
      </div>

      {/* Top toolbar: platform + type tabs + status + search */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Platform"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              {platformsList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Type tabs */}
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
                    typeTab === t
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-700',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {TYPE_META[t].label}
                </button>
              );
            })}
          </div>

          {/* Status filter pill */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
            {(['all', 'draft', 'review', 'approved', 'published'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-700',
                )}
              >
                {s === 'all' ? 'All' : STATUS_META[s].label}
                <span className="ml-1 text-slate-400 font-medium">({statusCounts[s]})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul / keyword..."
              className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* List/Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[11px] font-bold text-slate-400">
            Memuat skrip…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={handleNew} type={typeTab} />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50/60 sticky top-0">
                <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-5 w-12">#</th>
                  <th className="py-4 px-5">Judul / Keyword</th>
                  <th className="py-4 px-5 w-32">Tgl Upload</th>
                  <th className="py-4 px-5 w-28">Status</th>
                  <th className="py-4 px-5 w-44">Assigned To</th>
                  <th className="py-4 px-5 w-32">Update</th>
                  <th className="py-4 px-5 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const statusM = STATUS_META[s.status];
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => handleEdit(s)}
                    >
                      <td className="py-4 px-5 text-xs font-black text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-black text-slate-900 truncate max-w-md">
                            {s.title || <span className="text-slate-300 italic">Tanpa judul</span>}
                          </span>
                          {s.info_skrip && (
                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-md">
                              {s.info_skrip}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[11px] font-bold text-slate-600 tabular-nums">
                        {s.scheduled_date
                          ? format(new Date(s.scheduled_date), 'dd MMM yyyy')
                          : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="py-4 px-5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest',
                          statusM.bg, statusM.text,
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', statusM.dot)} />
                          {statusM.label}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {s.assigned_to ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            {s.assigned_to}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">–</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-[10px] font-bold text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(s.updated_at), 'dd MMM, HH:mm')}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                            aria-label="Edit"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleDelete(s); }}
                            aria-label="Delete"
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor drawer */}
      <ContentEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); void refresh(); }}
        existing={editingScript}
        defaultPlatform={platform}
        defaultType={typeTab === 'all' ? 'video' : typeTab}
      />
    </div>
  );
};

// ============================================================
// Empty state
// ============================================================
const EmptyState = ({ onCreate, type }: { onCreate: () => void; type: TypeTab }) => {
  const Icon = type === 'all' ? FileText : TYPE_META[type as ContentType].icon;
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-rose-400" />
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
      <CheckCircle2 className="hidden" /> {/* keep import used by status */}
    </div>
  );
};

export default ContentSection;
