import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Activity, ChevronRight, Database, Menu } from 'lucide-react';
import { APP_NAME, LOGO_PATH, MENU_ITEMS } from '../config/app.config';

interface Props {
  activeTab: string;
  rowsLoaded?: number;
  onOpenMobileMenu?: () => void;
}

export const TopBar = ({ activeTab, rowsLoaded, onOpenMobileMenu }: Props) => {
  const active = MENU_ITEMS.find((m) => m.id === activeTab);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000); // update tiap menit
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Decorative accent under topbar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-200/40 to-transparent" />

      {/* Left: burger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          <span>{APP_NAME}</span>
          <ChevronRight className="w-3 h-3" />
        </div>
        {active ? (
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <active.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 tracking-tight leading-none">
                {active.label}
              </p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {format(now, 'EEEE, dd MMM yyyy · HH:mm')}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-black text-slate-900">Dashboard</p>
        )}
      </div>

      {/* Right: data status + logo */}
      <div className="flex items-center gap-6">
        {typeof rowsLoaded === 'number' && rowsLoaded > 0 && (
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            <div className="leading-none">
              <p className="text-[8px] font-black text-emerald-600/70 uppercase tracking-widest">
                Data Terhubung
              </p>
              <p className="text-[11px] font-black text-emerald-700 mt-0.5">
                {rowsLoaded.toLocaleString('id-ID')} baris
              </p>
            </div>
            <Database className="w-3.5 h-3.5 text-emerald-500" />
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-slate-100/70 rounded-xl">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
            Live
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 ring-2 ring-slate-100 rounded-lg overflow-hidden">
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
