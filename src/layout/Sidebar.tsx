import { ChevronRight, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  APP_ACCENT_SUFFIX, APP_NAME, COMPANY_NAME, LOGO_PATH, MENU_ITEMS,
} from '../config/app.config';

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onSignOut?: () => void;
  userEmail?: string | null;
  // Mobile-only: controls slide-in open state
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar = ({
  activeTab, setActiveTab, onSignOut, userEmail, mobileOpen = false, onCloseMobile,
}: Props) => {
  const handleNavClick = (id: string) => {
    setActiveTab(id);
    onCloseMobile?.();
  };
  const mainItems = MENU_ITEMS.filter((m) => m.group === 'main');
  const systemItems = MENU_ITEMS.filter((m) => m.group === 'system');

  const renderItem = (item: (typeof MENU_ITEMS)[number]) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={cn(
          'group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
          isActive
            ? 'bg-white text-slate-900 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)]'
            : 'text-slate-300 hover:text-white hover:bg-white/5',
        )}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-indicator"
            className="absolute inset-y-1.5 -left-4 w-1 rounded-full bg-amber-400"
          />
        )}
        <item.icon
          className={cn(
            'w-4.5 h-4.5 flex-shrink-0 transition-colors',
            isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-amber-300',
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
    );
  };

  const sidebarContent = (
    <aside
      className="w-72 flex flex-col h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #0f172a 0%, #111c36 50%, #0b1424 100%)',
      }}
    >
      {/* Decorative layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-indigo-500/10 to-transparent" />
        <div className="absolute top-20 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-20 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Brand */}
      <div className="relative px-7 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 relative flex-shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 blur-md opacity-50" />
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="relative w-full h-full object-contain rounded-2xl ring-2 ring-white/10"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="leading-none">
            <h1 className="text-[22px] font-black text-white tracking-tight">
              {APP_NAME}
              {APP_ACCENT_SUFFIX && (
                <span className="text-amber-400">{APP_ACCENT_SUFFIX}</span>
              )}
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1.5">
              {COMPANY_NAME}
            </p>
          </div>
        </div>
      </div>

      {/* Divider with label */}
      <div className="relative px-7 flex items-center gap-3 mb-5">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em]">
          Navigasi
        </p>
        <span className="flex-1 h-px bg-gradient-to-r from-slate-700/50 to-transparent" />
      </div>

      <nav className="relative flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {mainItems.map(renderItem)}

        {systemItems.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-3 pt-6 pb-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em]">
                Sistem
              </p>
              <span className="flex-1 h-px bg-gradient-to-r from-slate-700/50 to-transparent" />
            </div>
            {systemItems.map(renderItem)}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="w-4.5 h-4.5 text-slate-500" />
                Keluar
              </button>
            )}
          </>
        )}
      </nav>

      {/* Status card */}
      <div className="relative p-5 pt-4">
        <div className="relative rounded-2xl p-4 bg-white/[0.03] border border-white/5 overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-400/10 rounded-full blur-2xl" />
          {userEmail ? (
            <>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em] mb-1.5">
                Akun Aktif
              </p>
              <p
                className="text-[11px] font-black text-white truncate"
                title={userEmail}
              >
                {userEmail}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-300/80 uppercase tracking-wider">
                  Synced · Supabase
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em] mb-1.5">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] font-black text-white">Mode Lokal</span>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop — sticky */}
      <div className="hidden lg:block sticky top-0 h-screen">{sidebarContent}</div>

      {/* Mobile — overlay slide-in */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 shadow-2xl"
            >
              <button
                onClick={onCloseMobile}
                aria-label="Tutup menu"
                className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
