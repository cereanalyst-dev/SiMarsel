import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Activity, ChevronRight, Database, Menu, Zap } from 'lucide-react';
import { APP_NAME, MENU_ITEMS } from '../config/app.config';

interface Props {
  activeTab: string;
  rowsLoaded?: number;
  onOpenMobileMenu?: () => void;
  realtimeLive?: boolean;
}

export const TopBar = ({ activeTab, rowsLoaded, onOpenMobileMenu, realtimeLive = false }: Props) => {
  const active = MENU_ITEMS.find((m) => m.id === activeTab);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative h-14 bg-white/80 backdrop-blur-xl border-b border-slate-200/70 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: burger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <nav className="flex items-center gap-2 text-[13px] min-w-0">
          <span className="hidden sm:inline text-slate-400 font-medium">{APP_NAME}</span>
          <ChevronRight className="hidden sm:block w-3 h-3 text-slate-300 flex-shrink-0" />
          <span className="font-semibold text-slate-900 tracking-tight truncate">
            {active ? active.label : 'Dashboard'}
          </span>
        </nav>
      </div>

      {/* Right: meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <p className="hidden md:block text-[11px] text-slate-400 font-medium">
          {format(now, 'dd MMM · HH:mm')}
        </p>

        {typeof rowsLoaded === 'number' && rowsLoaded > 0 && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/70 rounded-md">
            <Database className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-600 tabular-nums">
              {rowsLoaded.toLocaleString('id-ID')}
            </span>
          </div>
        )}

        {realtimeLive ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-md"
            title="Auto-sync aktif">
            <Zap className="w-3 h-3 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/70 rounded-md">
            <Activity className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500">Idle</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
