import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  show: (t: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, { icon: typeof Info; bar: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bar: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  error:   { icon: XCircle,      bar: 'bg-rose-500',    iconColor: 'text-rose-500' },
  warning: { icon: TriangleAlert, bar: 'bg-amber-500',   iconColor: 'text-amber-500' },
  info:    { icon: Info,         bar: 'bg-indigo-500',  iconColor: 'text-indigo-500' },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const duration = t.duration ?? (t.kind === 'error' ? 6000 : 3500);
    setItems((prev) => [...prev, { ...t, id, duration }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show({ kind: 'success', title, description }),
      error:   (title, description) => show({ kind: 'error',   title, description }),
      warning: (title, description) => show({ kind: 'warning', title, description }),
      info:    (title, description) => show({ kind: 'info',    title, description }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[200] bottom-6 right-6 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard = ({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) => {
  const style = KIND_STYLE[item.kind];
  const Icon = style.icon;

  useEffect(() => {
    const d = item.duration ?? 3500;
    if (d <= 0) return;
    const timer = setTimeout(onDismiss, d);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative"
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', style.bar)} />
      <div className="flex gap-3 p-4 pl-5">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', style.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900 leading-tight">{item.title}</p>
          {item.description && (
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="flex-shrink-0 w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};
