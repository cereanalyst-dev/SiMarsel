import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Briefcase, Calendar, ChevronRight, Edit2, Filter,
  Plus, Target as TargetIcon, Trash2, User as UserIcon, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  createKpiCard, createKpiDivision, createKpiMetric,
  deleteKpiCard, deleteKpiDivision, deleteKpiMetric,
  fetchKpiCards, fetchKpiDivisions, fetchKpiMetrics,
  updateKpiCard, updateKpiDivision, updateKpiMetric,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  KpiCard, KpiDivision, KpiMetric,
  NewKpiCard, NewKpiDivision, NewKpiMetric,
} from '../../types';

// ============================================================
// Helpers
// ============================================================
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const fmtPeriod = (year: number | null, month: number | null): string => {
  if (year == null) return 'Tanpa Periode';
  if (month == null) return String(year);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

const calcPencapaian = (achievement: number | null, target: number | null): number => {
  if (target == null || target === 0) return 0;
  if (achievement == null) return 0;
  return (achievement / target) * 100;
};

const calcScore = (pencapaianPct: number, bobot: number): number =>
  (pencapaianPct / 100) * bobot;

const fmtPct = (n: number): string =>
  `${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

// Display angka pakai locale Indonesia: ribuan dengan titik, desimal koma.
//   1000      → "1.000"
//   1500000   → "1.500.000"
//   1500.5    → "1.500,5"
const fmtNumberId = (n: number | null): string => {
  if (n == null) return '';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
};

// Parse string Indonesia-style ke number. Menerima:
//   "1.000.000"   → 1000000
//   "1.500,50"    → 1500.5
//   "1500"        → 1500
//   "0,5"         → 0.5
//   ""            → null
// Strategi: kalau ada koma, anggap sebagai desimal (titik = ribuan).
//           kalau cuma titik, anggap titik sebagai ribuan.
const parseLocaleNumber = (s: string): number | null => {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  let normalized: string;
  if (trimmed.includes(',')) {
    // Format Indonesia: titik = ribuan, koma = desimal
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else {
    // Cuma titik: anggap sebagai ribuan separator. Strip semua titik.
    // Catatan: "0.5" → 5. User Indonesia harusnya pakai "0,5" untuk 0,5.
    normalized = trimmed.replace(/\./g, '');
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

// ============================================================
// Main — 3 lapis: Divisi → Orang → Metrics
// ============================================================
export const KpiSection = () => {
  const toast = useToast();
  const [divisions, setDivisions] = useState<KpiDivision[]>([]);
  const [allCards, setAllCards] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDivisionId, setActiveDivisionId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const [showCreateDivision, setShowCreateDivision] = useState(false);
  const [editingDivision, setEditingDivision] = useState<KpiDivision | null>(null);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [editingCard, setEditingCard] = useState<KpiCard | null>(null);

  // Filter periode — global, dipakai di semua level (Lapis 1 & 2).
  // 'All' = semua periode, 'none' = card tanpa periode (legacy).
  const [filterYear, setFilterYear] = useState<'All' | 'none' | number>('All');
  const [filterMonth, setFilterMonth] = useState<'All' | number>('All');

  const refresh = useCallback(async () => {
    setLoading(true);
    const [divs, cards] = await Promise.all([
      fetchKpiDivisions(),
      fetchKpiCards(),
    ]);
    setDivisions(divs);
    setAllCards(cards);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeDivision = useMemo(
    () => divisions.find((d) => d.id === activeDivisionId) ?? null,
    [divisions, activeDivisionId],
  );
  const activeCard = useMemo(
    () => allCards.find((c) => c.id === activeCardId) ?? null,
    [allCards, activeCardId],
  );

  // Tahun yang muncul di data — buat populate dropdown filter.
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    allCards.forEach((c) => {
      if (c.period_year != null) set.add(c.period_year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [allCards]);

  // Apply filter — cards yang lolos kriteria periode.
  const filteredCards = useMemo(() => {
    return allCards.filter((c) => {
      if (filterYear === 'none') {
        if (c.period_year != null) return false;
        return true;
      }
      if (filterYear !== 'All') {
        if (c.period_year !== filterYear) return false;
      }
      if (filterMonth !== 'All') {
        if (c.period_month !== filterMonth) return false;
      }
      return true;
    });
  }, [allCards, filterYear, filterMonth]);

  const cardsByDivision = useMemo(() => {
    const map = new Map<string, KpiCard[]>();
    filteredCards.forEach((c) => {
      const key = c.division_id ?? '__none__';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    });
    return map;
  }, [filteredCards]);

  const filterActive = filterYear !== 'All' || filterMonth !== 'All';

  // --- Division handlers ---
  const handleSaveDivision = async (
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
      const updated = await updateKpiDivision(existingId, payload);
      if (updated) { toast.success('Divisi diupdate'); void refresh(); }
      else toast.error('Gagal update divisi');
    } else {
      const full: NewKpiDivision = {
        user_id: userId,
        name: payload.name,
        description: payload.description,
        position: 0,
      };
      const created = await createKpiDivision(full);
      if (created) { toast.success('Divisi dibuat'); void refresh(); }
      else toast.error('Gagal create divisi');
    }
    setEditingDivision(null);
    setShowCreateDivision(false);
  };

  const handleDeleteDivision = async (div: KpiDivision) => {
    const cardCount = cardsByDivision.get(div.id)?.length ?? 0;
    const msg = cardCount > 0
      ? `Hapus divisi "${div.name}" beserta ${cardCount} card di dalamnya?`
      : `Hapus divisi "${div.name}"?`;
    if (!window.confirm(msg)) return;
    const ok = await deleteKpiDivision(div.id);
    if (ok) {
      toast.success('Divisi dihapus');
      if (activeDivisionId === div.id) setActiveDivisionId(null);
      void refresh();
    } else toast.error('Gagal hapus divisi');
  };

  // --- Card handlers ---
  const handleSaveCard = async (
    payload: {
      name: string;
      description: string | null;
      division_id: string | null;
      period_year: number | null;
      period_month: number | null;
    },
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
        division_id: payload.division_id,
        name: payload.name,
        description: payload.description,
        period_year: payload.period_year,
        period_month: payload.period_month,
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
      setAllCards((prev) => prev.filter((c) => c.id !== card.id));
      if (activeCardId === card.id) setActiveCardId(null);
    } else toast.error('Gagal hapus card');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header dengan breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 mb-3">
            <TargetIcon className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Performance
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            KPI
          </h1>
          <Breadcrumb
            divisionName={activeDivision?.name ?? null}
            cardName={activeCard?.name ?? null}
            onClickRoot={() => { setActiveCardId(null); setActiveDivisionId(null); }}
            onClickDivision={() => setActiveCardId(null)}
          />
        </div>

        {/* Action button — beda per level */}
        {!activeCardId && !activeDivisionId && (
          <button
            type="button"
            onClick={() => setShowCreateDivision(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            Buat Divisi
          </button>
        )}
        {!activeCardId && activeDivisionId && (
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

      {/* Filter periode — hanya tampil di list view (Lapis 1 & 2). */}
      {!activeCard && (
        <PeriodFilterBar
          year={filterYear}
          month={filterMonth}
          availableYears={availableYears}
          onChangeYear={setFilterYear}
          onChangeMonth={setFilterMonth}
          totalMatched={filteredCards.length}
          totalAll={allCards.length}
          onReset={() => { setFilterYear('All'); setFilterMonth('All'); }}
          active={filterActive}
        />
      )}

      {/* Render lapis sesuai navigasi */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-[11px] font-bold text-slate-400">
          Memuat KPI…
        </div>
      ) : activeCard ? (
        <KpiCardDetail
          card={activeCard}
          onBack={() => setActiveCardId(null)}
          onEditCard={() => setEditingCard(activeCard)}
          onDeleteCard={() => void handleDeleteCard(activeCard)}
        />
      ) : activeDivision ? (
        <CardListView
          division={activeDivision}
          cards={cardsByDivision.get(activeDivision.id) ?? []}
          onBack={() => setActiveDivisionId(null)}
          onOpenCard={(c) => setActiveCardId(c.id)}
          onEditCard={(c) => setEditingCard(c)}
          onDeleteCard={(c) => void handleDeleteCard(c)}
          onCreateCard={() => setShowCreateCard(true)}
        />
      ) : (
        <DivisionListView
          divisions={divisions}
          cardCounts={(id) => cardsByDivision.get(id)?.length ?? 0}
          onOpen={(d) => setActiveDivisionId(d.id)}
          onEdit={(d) => setEditingDivision(d)}
          onDelete={(d) => void handleDeleteDivision(d)}
          onCreate={() => setShowCreateDivision(true)}
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showCreateDivision || editingDivision) && (
          <DivisionModal
            division={editingDivision}
            onClose={() => { setEditingDivision(null); setShowCreateDivision(false); }}
            onSave={(payload) => void handleSaveDivision(payload, editingDivision?.id ?? null)}
          />
        )}
        {(showCreateCard || editingCard) && (
          <CardModal
            card={editingCard}
            divisions={divisions}
            defaultDivisionId={activeDivisionId}
            onClose={() => { setEditingCard(null); setShowCreateCard(false); }}
            onSave={(payload) => void handleSaveCard(payload, editingCard?.id ?? null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================
// Breadcrumb
// ============================================================
function Breadcrumb({
  divisionName, cardName, onClickRoot, onClickDivision,
}: {
  divisionName: string | null;
  cardName: string | null;
  onClickRoot: () => void;
  onClickDivision: () => void;
}) {
  return (
    <p className="text-sm text-slate-500 font-medium mt-1.5 flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={onClickRoot}
        className={cn(
          'hover:text-emerald-600 transition-colors',
          divisionName || cardName ? 'underline-offset-2 hover:underline' : 'font-bold text-slate-700',
        )}
      >
        Semua Divisi
      </button>
      {divisionName && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button
            type="button"
            onClick={onClickDivision}
            className={cn(
              'hover:text-emerald-600 transition-colors',
              cardName ? 'underline-offset-2 hover:underline' : 'font-bold text-slate-700',
            )}
          >
            {divisionName}
          </button>
        </>
      )}
      {cardName && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="font-bold text-slate-700">{cardName}</span>
        </>
      )}
    </p>
  );
}

// ============================================================
// Filter bar — periode (tahun + bulan)
// ============================================================
function PeriodFilterBar({
  year, month, availableYears, onChangeYear, onChangeMonth,
  totalMatched, totalAll, onReset, active,
}: {
  year: 'All' | 'none' | number;
  month: 'All' | number;
  availableYears: number[];
  onChangeYear: (v: 'All' | 'none' | number) => void;
  onChangeMonth: (v: 'All' | number) => void;
  totalMatched: number;
  totalAll: number;
  onReset: () => void;
  active: boolean;
}) {
  // Tahun fallback list — tahun ini ± 2 tahun, supaya filter tetap usable
  // walau belum ada card yg punya periode.
  const fallbackYears = useMemo(() => {
    const now = new Date().getFullYear();
    return [now + 1, now, now - 1, now - 2];
  }, []);
  const yearOptions = availableYears.length > 0
    ? availableYears
    : fallbackYears;

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <Filter className="w-3.5 h-3.5" />
        Filter Periode
      </div>

      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={String(year)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'All') onChangeYear('All');
            else if (v === 'none') onChangeYear('none');
            else onChangeYear(Number(v));
          }}
          aria-label="Filter tahun"
          className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
        >
          <option value="All">SEMUA TAHUN</option>
          <option value="none">TANPA PERIODE</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
        <select
          value={String(month)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'All') onChangeMonth('All');
            else onChangeMonth(Number(v));
          }}
          aria-label="Filter bulan"
          disabled={year === 'All' || year === 'none'}
          className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <option value="All">SEMUA BULAN</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {active
          ? `${totalMatched} dari ${totalAll} card`
          : `Total: ${totalAll} card`}
      </p>

      {active && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl"
        >
          <X className="w-3 h-3" />
          Reset Filter
        </button>
      )}
    </div>
  );
}

// ============================================================
// Lapis 1 — Division list
// ============================================================
function DivisionListView({
  divisions, cardCounts, onOpen, onEdit, onDelete, onCreate,
}: {
  divisions: KpiDivision[];
  cardCounts: (id: string) => number;
  onOpen: (d: KpiDivision) => void;
  onEdit: (d: KpiDivision) => void;
  onDelete: (d: KpiDivision) => void;
  onCreate: () => void;
}) {
  if (divisions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-black text-slate-700 mb-1">Belum ada Divisi</p>
        <p className="text-xs text-slate-400 font-medium mb-4">
          Buat divisi (Marketing, Sales, dst) untuk mengelompokkan KPI per orang.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest"
        >
          <Plus className="w-4 h-4" />
          Buat Divisi
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {divisions.map((d) => {
        const count = cardCounts(d.id);
        return (
          <div
            key={d.id}
            className="group bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all relative"
          >
            <button
              type="button"
              onClick={() => onOpen(d)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 text-white flex items-center justify-center shadow-md">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                    Divisi
                  </p>
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {d.name}
                  </h3>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              {d.description && (
                <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-snug mb-2">
                  {d.description}
                </p>
              )}
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                <UserIcon className="w-2.5 h-2.5" />
                {count} Orang
              </span>
            </button>

            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(d); }}
                aria-label="Edit"
                className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 shadow-sm"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(d); }}
                aria-label="Hapus"
                className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 shadow-sm"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Lapis 2 — Card list (per orang dalam 1 divisi)
// ============================================================
function CardListView({
  division, cards, onBack, onOpenCard, onEditCard, onDeleteCard, onCreateCard,
}: {
  division: KpiDivision;
  cards: KpiCard[];
  onBack: () => void;
  onOpenCard: (c: KpiCard) => void;
  onEditCard: (c: KpiCard) => void;
  onDeleteCard: (c: KpiCard) => void;
  onCreateCard: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 text-white flex items-center justify-center shadow-md">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Divisi
          </p>
          <h2 className="text-lg font-black text-slate-900 truncate">{division.name}</h2>
          {division.description && (
            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
              {division.description}
            </p>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
          <UserIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-700 mb-1">Belum ada KPI orang</p>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Tambahkan card untuk anggota divisi {division.name}.
          </p>
          <button
            type="button"
            onClick={onCreateCard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            Buat Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div
              key={c.id}
              className="group bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-lg hover:border-emerald-200 transition-all relative"
            >
              <button
                type="button"
                onClick={() => onOpenCard(c)}
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
                      {c.name}
                    </h3>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                {c.description && (
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-snug mb-2">
                    {c.description}
                  </p>
                )}
                {c.period_year != null && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    <Calendar className="w-2.5 h-2.5" />
                    {fmtPeriod(c.period_year, c.period_month)}
                  </span>
                )}
              </button>

              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEditCard(c); }}
                  aria-label="Edit"
                  className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 shadow-sm"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteCard(c); }}
                  aria-label="Hapus"
                  className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 shadow-sm"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Lapis 3 — Card detail (metric tables per perspektif)
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

  const grouped = useMemo(() => {
    const map = new Map<string, KpiMetric[]>();
    metrics.forEach((m) => {
      const arr = map.get(m.perspektif) ?? [];
      arr.push(m);
      map.set(m.perspektif, arr);
    });
    return map;
  }, [metrics]);

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

  const grandTotal = useMemo(
    () => metrics.reduce(
      (sum, m) => sum + calcScore(calcPencapaian(m.achievement, m.target), m.bobot),
      0,
    ),
    [metrics],
  );

  return (
    <div className="space-y-6">
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
            {card.period_year != null && (
              <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                <Calendar className="w-2.5 h-2.5" />
                {fmtPeriod(card.period_year, card.period_month)}
              </span>
            )}
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
// Perspektif table — dengan total bobot & total score
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
              <th className="py-3 px-4 w-1/3">Metric Indicator</th>
              <th className="py-3 px-3 w-[90px]">Bobot (%)</th>
              <th className="py-3 px-3 w-[120px]">Target</th>
              <th className="py-3 px-3 w-[120px]">Achievement</th>
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
                {fmtNumberId(totalBobot)}%
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
          ⚠️ Total bobot {fmtNumberId(totalBobot)}% — idealnya 100% per perspektif.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Inline cell editors
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

// Number input dengan locale ID:
//   - blur (tampilan): "1.000.000"
//   - focus (edit): "1000000" (raw, supaya gampang ngetik)
function CellNumberInput({ value, onSave, placeholder, suffix }: {
  value: number | null;
  onSave: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));

  useEffect(() => {
    if (!focused) {
      setDraft(value == null ? '' : String(value));
    }
  }, [value, focused]);

  const display = focused
    ? draft
    : (value == null ? '' : fmtNumberId(value));

  const commit = () => {
    setFocused(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== null) onSave(null);
      return;
    }
    const parsed = parseLocaleNumber(trimmed);
    if (parsed == null) {
      // invalid — rollback ke nilai sebelumnya
      setDraft(value == null ? '' : String(value));
      return;
    }
    if (parsed !== value) onSave(parsed);
  };

  return (
    <div className="flex items-center gap-0.5">
      <input
        value={display}
        onChange={(e) => { setFocused(true); setDraft(e.target.value); }}
        onFocus={() => {
          setFocused(true);
          setDraft(value == null ? '' : String(value));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value == null ? '' : String(value));
            setFocused(false);
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
function DivisionModal({ division, onClose, onSave }: {
  division: KpiDivision | null;
  onClose: () => void;
  onSave: (payload: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(division?.name ?? '');
  const [description, setDescription] = useState(division?.description ?? '');

  return (
    <ModalShell title={division ? 'Edit Divisi' : 'Buat Divisi Baru'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Nama Divisi *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Marketing, Sales, Content, …"
            autoFocus
            className="form-input"
          />
        </FormField>
        <FormField label="Deskripsi (opsional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Deskripsi singkat divisi…"
            className="form-input"
          />
        </FormField>
      </div>
      <ModalFooter
        onClose={onClose}
        onSubmit={() => name.trim() && onSave({ name: name.trim(), description: description.trim() || null })}
        disabled={!name.trim()}
        submitLabel={division ? 'Simpan' : 'Buat'}
      />
    </ModalShell>
  );
}

function CardModal({ card, divisions, defaultDivisionId, onClose, onSave }: {
  card: KpiCard | null;
  divisions: KpiDivision[];
  defaultDivisionId: string | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description: string | null;
    division_id: string | null;
    period_year: number | null;
    period_month: number | null;
  }) => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [divisionId, setDivisionId] = useState<string>(
    card?.division_id ?? defaultDivisionId ?? (divisions[0]?.id ?? ''),
  );
  // Periode default = tahun ini, bulan ini (kalau create new). Edit pakai
  // existing data; null artinya "Tanpa Periode".
  const now = new Date();
  const [periodYear, setPeriodYear] = useState<number | null>(
    card ? card.period_year : now.getFullYear(),
  );
  const [periodMonth, setPeriodMonth] = useState<number | null>(
    card ? card.period_month : now.getMonth() + 1,
  );

  // Tahun pilihan: tahun ini ± 3 tahun (cukup buat KPI lookback/lookahead).
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalShell title={card ? 'Edit Card' : 'Buat Card Baru'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Divisi *">
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="form-input"
          >
            <option value="" disabled>Pilih divisi…</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Nama Orang *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. John Doe"
            autoFocus
            className="form-input"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tahun">
            <select
              value={periodYear == null ? '' : String(periodYear)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setPeriodYear(null);
                  setPeriodMonth(null);
                } else {
                  setPeriodYear(Number(v));
                }
              }}
              className="form-input"
            >
              <option value="">— Tanpa Periode —</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Bulan">
            <select
              value={periodMonth == null ? '' : String(periodMonth)}
              onChange={(e) => {
                const v = e.target.value;
                setPeriodMonth(v === '' ? null : Number(v));
              }}
              disabled={periodYear == null}
              className="form-input disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">— Tahunan —</option>
              {MONTH_NAMES.map((nm, i) => (
                <option key={nm} value={i + 1}>{nm}</option>
              ))}
            </select>
          </FormField>
        </div>
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
      <ModalFooter
        onClose={onClose}
        onSubmit={() => name.trim() && divisionId && onSave({
          name: name.trim(),
          description: description.trim() || null,
          division_id: divisionId,
          period_year: periodYear,
          period_month: periodYear == null ? null : periodMonth,
        })}
        disabled={!name.trim() || !divisionId}
        submitLabel={card ? 'Simpan' : 'Buat'}
      />
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
          placeholder="mis. Brand Awareness, Revenue Performance, …"
          autoFocus
          className="form-input"
        />
      </FormField>
      <ModalFooter
        onClose={onClose}
        onSubmit={() => name.trim() && onSave(name)}
        disabled={!name.trim()}
        submitLabel="Tambah"
      />
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

const ModalFooter = ({ onClose, onSubmit, disabled, submitLabel }: {
  onClose: () => void;
  onSubmit: () => void;
  disabled: boolean;
  submitLabel: string;
}) => (
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
      onClick={onSubmit}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:bg-slate-300 disabled:shadow-none"
    >
      <Plus className="w-3.5 h-3.5" />
      {submitLabel}
    </button>
  </div>
);

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
