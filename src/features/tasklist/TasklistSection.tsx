import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import {
  Calendar, Edit2, ExternalLink, Filter, KanbanSquare,
  Plus, Tag, Trash2, User as UserIcon, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import {
  createTask, deleteTask, fetchTasks, updateTask,
} from '../../lib/dataAccess';
import { getSupabase } from '../../lib/supabase';
import type {
  NewTask, Task, TaskDepartment, TaskPriority, TaskStatus,
} from '../../types';

// ============================================================
// Constants
// ============================================================
const STATUS_COLUMNS: Array<{
  id: TaskStatus;
  label: string;
  color: string;
  bg: string;
}> = [
  { id: 'request',  label: 'Request',     color: 'text-amber-700',   bg: 'bg-amber-50/60' },
  { id: 'todo',     label: 'To Do',       color: 'text-indigo-700',  bg: 'bg-indigo-50/60' },
  { id: 'progress', label: 'In Progress', color: 'text-violet-700',  bg: 'bg-violet-50/60' },
  { id: 'done',     label: 'Done',        color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
];

const DEPT_TONE: Record<TaskDepartment, { bg: string; text: string; label: string }> = {
  marketing: { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Marketing' },
  sales:     { bg: 'bg-cyan-50',    text: 'text-cyan-700',    label: 'Sales' },
  general:   { bg: 'bg-slate-100',  text: 'text-slate-600',   label: 'General' },
};

const PRIORITY_TONE: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  low:    { bg: 'bg-slate-100',  text: 'text-slate-500',   label: 'Low' },
  medium: { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Medium' },
  high:   { bg: 'bg-amber-100',  text: 'text-amber-800',   label: 'High' },
  urgent: { bg: 'bg-rose-100',   text: 'text-rose-800',    label: 'Urgent' },
};

interface TasklistSectionProps {
  setActiveTab?: (tab: string) => void;
  setCalendarFocusDate?: (date: Date | null) => void;
}

// ============================================================
// Main component
// ============================================================
export const TasklistSection = ({
  setActiveTab,
  setCalendarFocusDate,
}: TasklistSectionProps = {}) => {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [deptFilter, setDeptFilter] = useState<'All' | TaskDepartment>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All');
  const [search, setSearch] = useState('');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createInColumn, setCreateInColumn] = useState<TaskStatus>('request');

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchTasks();
    setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (deptFilter !== 'All' && t.department !== deptFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${t.title} ${t.description ?? ''} ${t.assigned_to ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, deptFilter, priorityFilter, search]);

  // Group by status untuk Kanban
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    STATUS_COLUMNS.forEach((c) => map.set(c.id, []));
    filteredTasks.forEach((t) => {
      const arr = map.get(t.status) ?? [];
      arr.push(t);
      map.set(t.status, arr);
    });
    return map;
  }, [filteredTasks]);

  // Drag-drop: pindah status saat di-drop
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );
    const result = await updateTask(taskId, { status: targetStatus });
    if (!result) {
      toast.error('Gagal pindah task');
      void refresh();
    }
  };

  const handleSaveTask = async (
    payload: Partial<NewTask>,
    existingId: string | null,
  ) => {
    const supabase = getSupabase();
    let userId: string | null = null;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    if (existingId) {
      const updated = await updateTask(existingId, payload);
      if (updated) {
        toast.success('Task diupdate');
        void refresh();
      } else {
        toast.error('Gagal update task');
      }
    } else {
      const fullPayload: NewTask = {
        user_id: userId,
        title: payload.title ?? '',
        description: payload.description ?? null,
        status: payload.status ?? 'request',
        department: payload.department ?? 'general',
        priority: payload.priority ?? 'medium',
        assigned_to: payload.assigned_to ?? null,
        due_date: payload.due_date ?? null,
        labels: payload.labels ?? null,
        related_paket: payload.related_paket ?? null,
        related_skrip: payload.related_skrip ?? null,
        position: 0,
      };
      const created = await createTask(fullPayload);
      if (created) {
        toast.success('Task dibuat');
        void refresh();
      } else {
        toast.error('Gagal create task');
      }
    }
    setEditingTask(null);
    setShowCreate(false);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`Hapus task "${task.title}"?`)) return;
    const ok = await deleteTask(task.id);
    if (ok) {
      toast.success('Task dihapus');
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      toast.error('Gagal hapus task');
    }
  };

  // Stats
  const counts = useMemo(() => {
    const acc: Record<TaskStatus, number> = { request: 0, todo: 0, progress: 0, done: 0 };
    filteredTasks.forEach((t) => { acc[t.status] += 1; });
    return acc;
  }, [filteredTasks]);

  // Navigasi ke Kalender Marsel pada tanggal due_date task tertentu.
  const openInCalendar = useCallback((task: Task) => {
    if (!task.due_date || !setActiveTab || !setCalendarFocusDate) return;
    setCalendarFocusDate(parseISO(task.due_date));
    setActiveTab('calendar');
  }, [setActiveTab, setCalendarFocusDate]);

  return (
    <motion.div
      key="tasklist"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 mb-3">
            <KanbanSquare className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Task Board
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Tasklist
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Papan kerja lintas departemen — Marketing &amp; Sales bisa share progress.
            Drag card antar kolom untuk update status. Task dengan due date juga
            tampil di Kalender Marsel.
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setCreateInColumn('request'); setShowCreate(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-cyan-100 transition-all"
        >
          <Plus className="w-4 h-4" />
          Buat Task
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value as 'All' | TaskDepartment)}
              aria-label="Filter departemen"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="All">SEMUA DEPT</option>
              <option value="marketing">MARKETING</option>
              <option value="sales">SALES</option>
              <option value="general">GENERAL</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'All' | TaskPriority)}
              aria-label="Filter priority"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="All">SEMUA PRIORITY</option>
              <option value="urgent">URGENT</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari title / assignee / deskripsi..."
              className="flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 min-w-0"
            />
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Total: {filteredTasks.length}
          </p>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-[11px] font-bold text-slate-400">
          Memuat tasks…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = tasksByStatus.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => void handleDrop(e, col.id)}
                className={cn(
                  'rounded-2xl border-2 border-dashed border-slate-200 p-3 min-h-[400px] transition-all',
                  col.bg,
                )}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-black uppercase tracking-widest', col.color)}>
                      {col.label}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white text-slate-500 border border-slate-200">
                      {counts[col.id]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCreateInColumn(col.id); setShowCreate(true); }}
                    aria-label="Tambah task"
                    className="p-1 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  <AnimatePresence>
                    {colTasks.length === 0 ? (
                      <div className="text-center py-6 text-[10px] font-bold text-slate-300 italic">
                        Tarik card ke sini
                      </div>
                    ) : (
                      colTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isDragging={draggingId === t.id}
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={() => setEditingTask(t)}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <AnimatePresence>
        {(showCreate || editingTask) && (
          <TaskModal
            task={editingTask}
            defaultStatus={createInColumn}
            onClose={() => { setEditingTask(null); setShowCreate(false); }}
            onSave={(payload) => void handleSaveTask(payload, editingTask?.id ?? null)}
            onDelete={editingTask ? () => void handleDeleteTask(editingTask) : undefined}
            onOpenCalendar={
              editingTask?.due_date && setActiveTab && setCalendarFocusDate
                ? () => { openInCalendar(editingTask); setEditingTask(null); }
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================
// Card
// ============================================================
function TaskCard({ task, isDragging, onDragStart, onDragEnd, onClick }: {
  task: Task;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const dept = DEPT_TONE[task.department];
  const prio = PRIORITY_TONE[task.priority];
  const overdue = task.due_date && task.status !== 'done'
    && new Date(task.due_date) < new Date(new Date().toISOString().slice(0, 10));

  return (
    // Pakai plain <div> untuk native HTML5 drag — motion.div punya gesture
    // system sendiri yang konflik dengan onDragStart/onDragEnd typing.
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-3 cursor-grab active:cursor-grabbing transition-all',
        'hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5',
        isDragging && 'rotate-2 shadow-xl opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest', dept.bg, dept.text)}>
          {dept.label}
        </span>
        <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest', prio.bg, prio.text)}>
          {prio.label}
        </span>
      </div>

      <h4 className="text-xs font-black text-slate-900 leading-snug mb-1.5 line-clamp-2">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-[10px] text-slate-500 font-medium leading-snug mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {task.due_date && (
          <span className={cn(
            'inline-flex items-center gap-1 text-[9px] font-bold',
            overdue ? 'text-rose-600' : 'text-slate-400',
          )}>
            <Calendar className="w-2.5 h-2.5" />
            {format(parseISO(task.due_date), 'dd MMM')}
            {overdue && <span className="font-black uppercase">· Lewat</span>}
          </span>
        )}
        {task.assigned_to && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 truncate max-w-[120px]">
            <UserIcon className="w-2.5 h-2.5" />
            {task.assigned_to}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Modal — create / edit
// ============================================================
function TaskModal({ task, defaultStatus, onClose, onSave, onDelete, onOpenCalendar }: {
  task: Task | null;
  defaultStatus: TaskStatus;
  onClose: () => void;
  onSave: (payload: Partial<NewTask>) => void;
  onDelete?: () => void;
  onOpenCalendar?: () => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
  const [department, setDepartment] = useState<TaskDepartment>(task?.department ?? 'general');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [labels, setLabels] = useState((task?.labels ?? []).join(', '));

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description || null,
      status,
      department,
      priority,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      labels: labels ? labels.split(',').map((s) => s.trim()).filter(Boolean) : null,
    });
  };

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
        className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-cyan-500 to-indigo-500" />
            <div>
              <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.2em]">
                {isEdit ? 'Edit Task' : 'Buat Task Baru'}
              </p>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {title || 'Tanpa Judul'}
              </h3>
            </div>
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

        <div className="p-6 space-y-4">
          <FormField label="Judul *">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Follow-up lead BUMN minggu ini"
              className="form-input"
              autoFocus
            />
          </FormField>

          <FormField label="Deskripsi">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detail tambahan..."
              className="form-input"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="form-input"
              >
                {STATUS_COLUMNS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Departemen">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as TaskDepartment)}
                className="form-input"
              >
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="general">General</option>
              </select>
            </FormField>

            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="form-input"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </FormField>

            <FormField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="form-input"
              />
            </FormField>

            <FormField label="Assigned To" wide>
              <input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="email atau nama..."
                className="form-input"
              />
            </FormField>

            <FormField label="Labels (pisahkan koma)" wide>
              <input
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="urgent, follow-up, bumn"
                className="form-input"
              />
            </FormField>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              )}
              {onOpenCalendar && (
                <button
                  type="button"
                  onClick={onOpenCalendar}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-cyan-600 hover:bg-cyan-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Lihat di Kalender
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all',
                  'bg-cyan-600 hover:bg-cyan-700 shadow-lg shadow-cyan-100',
                  'disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
                )}
              >
                {isEdit ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {isEdit ? 'Simpan' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FormField = ({ label, children, wide }: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <label className={cn('flex flex-col gap-1', wide && 'col-span-2')}>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    {children}
  </label>
);

export default TasklistSection;
