import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Plus, Trash2, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  bulkUploadPromoCodeRules, deletePromoCodeRule,
  downloadPromoCodeRulesTemplate, fetchPromoCodeRules, insertPromoCodeRule,
} from '../../lib/promoCodeRulesClient';
import {
  ASSIGNABLE_PROMO_CATEGORIES, PROMO_CATEGORY_TONE,
  type AssignablePromoCategory,
} from '../../lib/promoRules';
import type { PromoCodeRule } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  knownPlatforms: string[];          // dari apps user, lowercase
  onChanged?: () => void | Promise<void>;
}

export const PromoCodeSettingsDrawer = ({
  open, onClose, userId, knownPlatforms, onChanged,
}: Props) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rules, setRules] = useState<PromoCodeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formPlatform, setFormPlatform] = useState('');
  const [formCategory, setFormCategory] = useState<AssignablePromoCategory>('Sales');
  const [formCode, setFormCode] = useState('');

  // Filters
  const [filterPlatform, setFilterPlatform] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchPromoCodeRules(userId);
      setRules(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && userId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  // Default platform value: pakai dari knownPlatforms kalau ada
  useEffect(() => {
    if (!formPlatform && knownPlatforms.length > 0) {
      setFormPlatform(knownPlatforms[0]);
    }
  }, [knownPlatforms, formPlatform]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>(knownPlatforms.map((p) => p.toLowerCase()));
    rules.forEach((r) => set.add(r.platform.toLowerCase()));
    return Array.from(set).sort();
  }, [knownPlatforms, rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterPlatform !== 'All' && r.platform.toLowerCase() !== filterPlatform) return false;
      if (filterCategory !== 'All' && r.category !== filterCategory) return false;
      return true;
    });
  }, [rules, filterPlatform, filterCategory]);

  const handleAdd = async () => {
    if (!userId) return;
    const platform = formPlatform.trim().toLowerCase();
    const code = formCode.trim();
    if (!platform || !code) {
      toast.error('Lengkapi semua field', 'Platform dan kode wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const inserted = await insertPromoCodeRule(userId, {
        platform, category: formCategory, code,
      });
      if (inserted) {
        toast.success('Kode ditambahkan', `${platform.toUpperCase()} · ${formCategory} · ${inserted.code}`);
        setFormCode('');
        await reload();
        if (onChanged) await onChanged();
      } else {
        toast.error('Gagal menambahkan', 'Mungkin kombinasi platform+kode sudah ada.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule: PromoCodeRule) => {
    if (!window.confirm(`Hapus kode ${rule.code} (${rule.platform})?`)) return;
    const ok = await deletePromoCodeRule(rule.id);
    if (ok) {
      toast.success('Dihapus', `${rule.platform.toUpperCase()} · ${rule.code}`);
      await reload();
      if (onChanged) await onChanged();
    } else {
      toast.error('Gagal menghapus');
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setSubmitting(true);
    try {
      const res = await bulkUploadPromoCodeRules(userId, file);
      if (res.errors.length > 0) {
        toast.error(
          `Selesai dengan ${res.errors.length} error`,
          `${res.inserted} ditambah · ${res.skipped} dilewat. ${res.errors[0]}`,
        );
      } else {
        toast.success(
          'Upload selesai',
          `${res.inserted} kode ditambah · ${res.skipped} dilewat.`,
        );
      }
      await reload();
      if (onChanged) await onChanged();
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-0.5">
                  Setting
                </p>
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                  Kode Promo & Kategori
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPromoCodeRulesTemplate}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-black text-slate-700 uppercase tracking-widest transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel
              </button>
              <button
                type="button"
                disabled={submitting || !userId}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-[11px] font-black text-white uppercase tracking-widest transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {/* Add form */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Tambah Manual
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  list="promo-platform-list"
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  placeholder="platform"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-400"
                />
                <datalist id="promo-platform-list">
                  {platformOptions.map((p) => <option key={p} value={p} />)}
                </datalist>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as AssignablePromoCategory)}
                  aria-label="Kategori"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest focus:border-indigo-400"
                >
                  {ASSIGNABLE_PROMO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
                <input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="kode (mis. ADMINCEREBRUM)"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none focus:border-indigo-400"
                />
              </div>
              <button
                type="button"
                disabled={submitting || !userId}
                onClick={() => void handleAdd()}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl text-[11px] font-black text-white uppercase tracking-widest transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Kode
              </button>
            </div>

            {/* Filter + List */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filter:</span>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                aria-label="Filter platform"
                className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
              >
                <option value="All">SEMUA APP</option>
                {platformOptions.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label="Filter kategori"
                className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
              >
                <option value="All">SEMUA KATEGORI</option>
                {ASSIGNABLE_PROMO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
              <span className="ml-auto text-[11px] font-medium text-slate-400 uppercase tracking-wider tabular-nums">
                {filteredRules.length} / {rules.length} kode
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="px-6 py-10 text-center text-xs font-bold text-slate-400">
                  Memuat…
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs font-bold text-slate-400">
                  Belum ada kode. Tambah manual atau upload Excel.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/60 sticky top-0">
                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                      <th className="py-3 px-6 w-10">#</th>
                      <th className="py-3 px-6">Platform</th>
                      <th className="py-3 px-6">Kategori</th>
                      <th className="py-3 px-6">Kode</th>
                      <th className="py-3 px-6 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRules.map((r, i) => {
                      const tone = PROMO_CATEGORY_TONE[r.category];
                      return (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-6 text-xs font-black text-slate-400 tabular-nums">
                            {String(i + 1).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-6 text-xs font-black text-slate-700 uppercase tracking-widest">
                            {r.platform}
                          </td>
                          <td className="py-3 px-6">
                            <span className={cn(
                              'inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
                              tone.bg, tone.text,
                            )}>
                              {r.category}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-xs font-mono font-black text-slate-900">
                            {r.code}
                          </td>
                          <td className="py-3 px-6">
                            <button
                              type="button"
                              onClick={() => void handleDelete(r)}
                              aria-label="Hapus"
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default PromoCodeSettingsDrawer;
