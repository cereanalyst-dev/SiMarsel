import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Database, Menu } from 'lucide-react';
import { APP_NAME, MENU_ITEMS } from '../config/app.config';

interface Props {
  activeTab: string;
  rowsLoaded?: number;
  onOpenMobileMenu?: () => void;
}

export const TopBar = ({ activeTab, rowsLoaded, onOpenMobileMenu }: Props) => {
  const active = MENU_ITEMS.find((m) => m.id === activeTab);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="relative h-16 px-8 flex items-center justify-between sticky top-0 z-30"
      style={{
        background: 'rgba(250, 247, 242, 0.7)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      }}
    >
      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200/60" />

      {/* Left: burger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="lg:hidden p-2 rounded-xl hover:bg-white/70 text-slate-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <nav className="flex items-center gap-2 text-[13px]">
          <span className="hidden sm:inline text-slate-400 font-medium">{APP_NAME}</span>
          <ChevronRight className="hidden sm:block w-3 h-3 text-slate-300" />
          {active ? (
            <span className="font-semibold text-slate-900 tracking-tight">
              {active.label}
            </span>
          ) : (
            <span className="font-semibold text-slate-900">Dashboard</span>
          )}
        </nav>
      </div>

      {/* Right: meta info */}
      <div className="flex items-center gap-3">
        <p className="hidden md:block text-[11px] font-medium text-slate-400 tracking-tight">
          {format(now, 'EEEE, dd MMM · HH:mm')}
        </p>

        {typeof rowsLoaded === 'number' && rowsLoaded > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/70 border border-slate-200/60 rounded-full">
            <span className="relative flex items-center justify-center w-1.5 h-1.5">
              <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="relative w-1 h-1 rounded-full bg-emerald-500" />
            </span>
            <Database className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-700 tabular-nums">
              {rowsLoaded.toLocaleString('id-ID')}
            </p>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
