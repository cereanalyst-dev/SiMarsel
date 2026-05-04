import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ChevronRight, Edit2, Plus, Target as TargetIcon,
  Trash2, User as UserIcon, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  createKpiCard, createKpiMetric, deleteKpiCard, deleteKpiMetric,
  fetchKpiCards, fetchKpiMetrics, updateKpiCard, updateKpiMetric,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  KpiCard, KpiMetric, NewKpiCard, NewKpiMetric,
} from '../../types';

// ============================================================
// Helpers — pencapaian & score selalu dihitung di client supaya
// editing realtime tanpa round-trip ke DB.
// ============================================================
const calcPencapaian = (achievement: number | null, target: number | null): number => {
  if (target == null || target === 0) return 0;
  if (achievement == null) return 0;
  return (achievement / target) * 100; // dalam persen, mis. 85 = 85%
};

const calcScore = (pencapaianPct: number, bobot: number): number =>
  (pencapaianPct / 100) * bobot;

const fmtPct = (n: number): string =>
  `${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const fmtNumber = (n: number | null): string =>
  n == null ? '' : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ============================================================
// Main — list cards atau detail
// ============================================================
export const KpiSection = () => {
  const toast = useToast();
  const [cards, setCards] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [editingCard, setEditingCard] = useState<KpiCard | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchKpiCards();
    setCards(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaveCard = async (
    payload: { name: string; description: string | null },
    existingId: string | null,
  ) => {
    const supabase = getSupabase();
    let userId: string | null = null;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    }
    if (existingId) {
      const updated = await updateKpiCard(existingId, payload);
      if (updated) { toast.success('Card diupdate'); void refresh(); }
      else toast.error('Gagal update card');
    } else {
      const full: NewKpiCard = {
        user_id: userId,
        name: payload.name,
        description: payload.description,
        position: 0,
      };
      const created = await createKpiCard(full);
      if (created) { toast.success('Card dibuat'); void refresh(); }
      else toast.error('Gagal create card');
    }
    setEditingCard(null);
    setShowCreateCard(false);
  };

  const handleDeleteCard = async (card: KpiCard) => {
    if (!window.confirm(`Hapus card "${card.name}" beserta semua metric-nya?`)) return;
    const ok = await deleteKpiCard(card.id);
    if (ok) {
      toast.success('Card dihapus');
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (activeCardId === card.id) setActiveCardId(null);
    } else toast.error('Gagal hapus card');
  };

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeCardId) ?? null,
    [cards, activeCardId],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 mb-3">
            <TargetIcon className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Performance
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            KPI
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Kartu KPI per orang. Klik card untuk lihat & edit metric per perspektif.
            Pencapaian &amp; score dihitung otomatis dari achievement / target.
          </p>
        </div>

        {!activeCardId && (
          <button
            type="button"
            onClick={() => setShowCreateCard(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Buat Card
          </button>
        )}
      </div>

      {/* List view atau detail view */}
      {activeCard ? (
        <KpiCardDetail
          card={activeCard}
          onBack={() => setActiveCardId(null)}
          onEditCard={() => setEditingCard(activeCard)}
          onDeleteCard={() => void handleDeleteCard(activeCard)}
        />
      ) : loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-[11px] font-bold text-slate-400">
          Memuat KPI cards…
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
          <UserIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-700 mb-1">Belum ada KPI card</p>
          <p className="text-xs text-slate-400 font-medium">
            Klik tombol &ldquo;Buat Card&rdquo; di atas untuk mulai.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <KpiCardItem
              key={c.id}
              card={c}
              onOpen={() => setActiveCardId(c.id)}
              onEdit={() => setEditingCard(c)}
              onDelete={() => void handleDeleteCard(c)}
            />
          ))}
        </div>
      )}

      {/* Modal create/edit card */}
      <AnimatePresence>
        {(showCreateCard || editingCard) && (
          <CardModal
            card={editingCard}
            onClose={() => { setEditingCard(null); setShowCreateCard(false); }}
            onSave={(payload) => void handleSaveCard(payload, editingCard?.id ?? null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================
// Card list item — hanya nama orang sesuai request user.
// ============================================================
function KpiCardItem({ card, onOpen, onEdit, onDelete }: {
  card: KpiCard;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all relative">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
              KPI Owner
            </p>
            <h3 className="text-base font-black text-slate-900 truncate">
              {card.name}
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        {card.description && (
          <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-snug">
            {card.description}
          </p>
        )}
      </button>

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          aria-label="Edit"
          className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 shadow-sm"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Hapus"
          className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 shadow-sm"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Card detail — list metric grouped by perspektif + edit inline.
// ============================================================
function KpiCardDetail({ card, onBack, onEditCard, onDeleteCard }: {
  card: KpiCard;
  onBack: () => void;
  onEditCard: () => void;
  onDeleteCard: () => void;
}) {
  const toast = useToast();
  const [metrics, setMetrics] = useState<KpiMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPerspektif, setShowAddPerspektif] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchKpiMetrics(card.id);
    setMetrics(data);
    setLoading(false);
  }, [card.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Group by perspektif (preserve insertion order)
  const grouped = useMemo(() => {
    const map = new Map<string, KpiMetric[]>();
    metrics.forEach((m) => {
      const arr = map.get(m.perspektif) ?? [];
      arr.push(m);
      map.set(m.perspektif, arr);
    });
    return map;
  }, [metrics]);

  // Optimistic patch — update local state lalu DB. Rollback kalau gagal.
  const patchLocal = (id: string, patch: Partial<NewKpiMetric>) => {
    setMetrics((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const handlePatchMetric = async (id: string, patch: Partial<NewKpiMetric>) => {
    const before = metrics.find((m) => m.id === id);
    patchLocal(id, patch);
    const updated = await updateKpiMetric(id, patch);
    if (!updated && before) {
      toast.error('Gagal simpan');
      patchLocal(id, before);
    }
  };

  const handleAddMetric = async (perspektif: string) => {
    const lastInGroup = (grouped.get(perspektif) ?? []).slice(-1)[0];
    const payload: NewKpiMetric = {
      card_id: card.id,
      perspektif,
      metric_indicator: '',
      bobot: 0,
      target: null,
      achievement: null,
      position: lastInGroup ? lastInGroup.position + 1 : metrics.length,
    };
    const created = await createKpiMetric(payload);
    if (created) {
      setMetrics((prev) => [...prev, created]);
    } else {
      toast.error('Gagal tambah metric');
    }
  };

  const handleDeleteMetric = async (id: string) => {
    const ok = await deleteKpiMetric(id);
    if (ok) {
      setMetrics((prev) => prev.filter((m) => m.id !== id));
    } else {
      toast.error('Gagal hapus metric');
    }
  };

  const handleAddPerspektif = async (name: string) => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    if (grouped.has(trimmed)) {
      toast.warning('Perspektif sudah ada');
      return;
    }
    await handleAddMetric(trimmed);
    setShowAddPerspektif(false);
  };

  // Total score across all groups (max teoritis 100% × jumlah perspektif)
  const grandTotal = useMemo(
    () => metrics.reduce(
      (sum, m) => sum + calcScore(calcPencapaian(m.achievement, m.target), m.bobot),
      0,
    ),
    [metrics],
  );

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              KPI Detail
            </p>
            <h2 className="text-lg font-black text-slate-900">{card.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Grand Total
            </p>
            <p className="text-xl font-black text-emerald-600 tabular-nums">
              {fmtPct(grandTotal)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEditCard}
              aria-label="Edit card"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDeleteCard}
              aria-label="Hapus card"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Metric tables — 1 per perspektif */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-[11px] font-bold text-slate-400">
          Memuat metric…
        </div>
      ) : grouped.size === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
          <p className="text-sm font-black text-slate-700 mb-1">Belum ada metric</p>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Klik &ldquo;Tambah Perspektif&rdquo; untuk mulai isi KPI.
          </p>
          <button
            type="button"
            onClick={() => setShowAddPerspektif(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            Tambah Perspektif
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([perspektif, rows]) => (
            <PerspektifTable
              key={perspektif}
              perspektif={perspektif}
              rows={rows}
              onPatchMetric={(id, patch) => void handlePatchMetric(id, patch)}
              onAddMetric={() => void handleAddMetric(perspektif)}
              onDeleteMetric={(id) => void handleDeleteMetric(id)}
              onRenamePerspektif={async (newName) => {
                const trimmed = newName.trim();
                if (!trimmed || trimmed === perspektif) return;
                if (grouped.has(trimmed)) {
                  toast.warning('Perspektif sudah ada');
                  return;
                }
                // Update semua metric di grup ini ke perspektif baru
                await Promise.all(
                  rows.map((r) => updateKpiMetric(r.id, { perspektif: trimmed })),
                );
                void refresh();
              }}
            />
          ))}

          <button
            type="button"
            onClick={() => setShowAddPerspektif(true)}
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all"
          >
            + Tambah Perspektif Baru
          </button>
        </div>
      )}

      <AnimatePresence>
        {showAddPerspektif && (
          <PerspektifModal
            onClose={() => setShowAddPerspektif(false)}
            onSave={(name) => void handleAddPerspektif(name)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Perspektif table — 1 group, dengan total score row.
// ============================================================
function PerspektifTable({
  perspektif, rows, onPatchMetric, onAddMetric, onDeleteMetric, onRenamePerspektif,
}: {
  perspektif: string;
  rows: KpiMetric[];
  onPatchMetric: (id: string, patch: Partial<NewKpiMetric>) => void;
  onAddMetric: () => void;
  onDeleteMetric: (id: string) => void;
  onRenamePerspektif: (newName: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(perspektif);

  const totalBobot = rows.reduce((s, r) => s + r.bobot, 0);
  const totalScore = rows.reduce(
    (s, r) => s + calcScore(calcPencapaian(r.achievement, r.target), r.bobot),
    0,
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-100">
        {editingName ? (
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => { setEditingName(false); onRenamePerspektif(draftName); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setEditingName(false); onRenamePerspektif(draftName); }
              if (e.key === 'Escape') { setEditingName(false); setDraftName(perspektif); }
            }}
            autoFocus
            className="bg-white border border-emerald-200 rounded-lg px-3 py-1 text-sm font-black text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-300"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraftName(perspektif); setEditingName(true); }}
            className="text-sm font-black text-emerald-900 uppercase tracking-wider hover:underline underline-offset-4"
          >
            {perspektif}
          </button>
        )}
        <button
          type="button"
          onClick={onAddMetric}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-black uppercase tracking-widest"
        >
          <Plus className="w-3 h-3" />
          Metric
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
              <th className="py-3 px-4 w-1/3">Metric Indicator</th>
              <th className="py-3 px-3 w-[80px]">Bobot (%)</th>
              <th className="py-3 px-3 w-[100px]">Target</th>
              <th className="py-3 px-3 w-[100px]">Achievement</th>
              <th className="py-3 px-3 w-[110px] text-emerald-700">% Pencapaian</th>
              <th className="py-3 px-3 w-[90px] text-indigo-700">Score</th>
              <th className="py-3 px-3 w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pencapaian = calcPencapaian(r.achievement, r.target);
              const score = calcScore(pencapaian, r.bobot);
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                  <td className="py-2 px-4">
                    <CellInput
                      value={r.metric_indicator}
                      placeholder="mis. Total Views"
                      onSave={(v) => onPatchMetric(r.id, { metric_indicator: v })}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <CellNumberInput
                      value={r.bobot}
                      onSave={(v) => onPatchMetric(r.id, { bobot: v ?? 0 })}
                      suffix="%"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <CellNumberInput
                      value={r.target}
                      onSave={(v) => onPatchMetric(r.id, { target: v })}
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <CellNumberInput
                      value={r.achievement}
                      onSave={(v) => onPatchMetric(r.id, { achievement: v })}
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 px-3 text-xs font-black text-emerald-700 tabular-nums">
                    {fmtPct(pencapaian)}
                  </td>
                  <td className="py-2 px-3 text-xs font-black text-indigo-700 tabular-nums">
                    {fmtPct(score)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteMetric(r.id)}
                      aria-label="Hapus metric"
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[11px] font-bold text-slate-400 italic">
                  Belum ada metric. Klik &ldquo;+ Metric&rdquo; di atas untuk tambah.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
              <td className="py-3 px-4 text-[10px] uppercase tracking-widest text-slate-700">Total</td>
              <td className={cn(
                'py-3 px-3 text-xs tabular-nums',
                Math.abs(totalBobot - 100) < 0.01 ? 'text-emerald-700' : 'text-amber-600',
              )}>
                {fmtNumber(totalBobot)}%
              </td>
              <td colSpan={3} />
              <td className="py-3 px-3 text-xs text-indigo-700 tabular-nums">
                {fmtPct(totalScore)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(totalBobot - 100) > 0.01 && rows.length > 0 && (
        <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 text-[10px] font-bold text-amber-700">
          ⚠️ Total bobot {fmtNumber(totalBobot)}% — idealnya 100% per perspektif.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Inline cell editors — debounced save on blur / Enter.
// ============================================================
function CellInput({ value, placeholder, onSave }: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      placeholder={placeholder}
      className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-md px-2 py-1 text-xs font-bold text-slate-700 outline-none transition-all"
    />
  );
}

function CellNumberInput({ value, onSave, placeholder, suffix }: {
  value: number | null;
  onSave: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== null) onSave(null);
      return;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      setDraft(value == null ? '' : String(value));
      return;
    }
    if (parsed !== value) onSave(parsed);
  };

  return (
    <div className="flex items-center gap-0.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value == null ? '' : String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder ?? '0'}
        inputMode="decimal"
        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-md px-2 py-1 text-xs font-bold text-slate-700 outline-none transition-all tabular-nums"
      />
      {suffix && <span className="text-[10px] font-bold text-slate-400">{suffix}</span>}
    </div>
  );
}

// ============================================================
// Modals
// ============================================================
function CardModal({ card, onClose, onSave }: {
  card: KpiCard | null;
  onClose: () => void;
  onSave: (payload: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [description, setDescription] = useState(card?.description ?? '');

  return (
    <ModalShell title={card ? 'Edit Card' : 'Buat Card Baru'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Nama Orang *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. John Doe"
            autoFocus
            className="form-input"
          />
        </FormField>
        <FormField label="Deskripsi (opsional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Role, divisi, atau catatan…"
            className="form-input"
          />
        </FormField>
      </div>
      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => name.trim() && onSave({ name: name.trim(), description: description.trim() || null })}
          disabled={!name.trim()}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:bg-slate-300 disabled:shadow-none"
        >
          <Plus className="w-3.5 h-3.5" />
          Simpan
        </button>
      </div>
    </ModalShell>
  );
}

function PerspektifModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <ModalShell title="Tambah Perspektif" onClose={onClose}>
      <FormField label="Nama Perspektif *">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Brand Awareness, Revenue Performance, SEO Performance…"
          autoFocus
          className="form-input"
        />
      </FormField>
      <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => name.trim() && onSave(name)}
          disabled={!name.trim()}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:bg-slate-300 disabled:shadow-none"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Tutup"
      />
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-cyan-500" />
            <h3 className="text-base font-black text-slate-900 tracking-tight">{title}</h3>
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
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

const FormField = ({ label, children }: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    {children}
  </label>
);

export default KpiSection;
