import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, Shield, ShieldAlert, ShieldCheck, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  APP_ACCENT_SUFFIX, APP_NAME, COMPANY_NAME, LOGO_PATH, MENU_ITEMS,
} from '../config/app.config';
import { ROLE_LABELS, type UserRole } from '../types';

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onSignOut?: () => void;
  userEmail?: string | null;
  userRole?: UserRole | null;
  userFullName?: string | null;
  // Mobile-only: controls slide-in open state
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const ROLE_BADGE: Record<UserRole, { bg: string; text: string; icon: typeof Shield }> = {
  admin:        { bg: 'bg-rose-50 border-rose-200',     text: 'text-rose-700',    icon: ShieldAlert },
  manager:      { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700',  icon: ShieldCheck },
  asst_manager: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700',  icon: Shield },
  staf:         { bg: 'bg-slate-100 border-slate-200',  text: 'text-slate-700',   icon: User },
};

export const Sidebar = ({
  activeTab, setActiveTab, onSignOut, userEmail, userRole, userFullName,
  mobileOpen = false, onCloseMobile,
}: Props) => {
  // Track expanded sub-menu group. Auto-expand kalau activeTab adalah child
  // dari salah satu group, supaya user gak harus klik 2x pas refresh.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    MENU_ITEMS.forEach((item) => {
      if (item.children?.some((c) => c.id === activeTab)) init.add(item.id);
    });
    return init;
  });

  // Re-evaluate kalau activeTab pindah ke child di group lain
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      MENU_ITEMS.forEach((item) => {
        if (item.children?.some((c) => c.id === activeTab)) next.add(item.id);
      });
      return next;
    });
  }, [activeTab]);

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    onCloseMobile?.();
  };

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mainItems = MENU_ITEMS.filter((m) => m.group === 'main');
  const systemItems = MENU_ITEMS.filter((m) => m.group === 'system');

  // Single-item button (no sub-menu)
  const renderLeaf = (item: (typeof MENU_ITEMS)[number]) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={cn(
          'group relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200',
          isActive
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
        )}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-indicator"
            className="absolute inset-y-2 -left-4 w-1 rounded-full bg-orange-500"
          />
        )}
        <item.icon
          className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            isActive ? 'text-orange-300' : 'text-slate-400 group-hover:text-slate-700',
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
      </button>
    );
  };

  // Group with children — render parent + collapsible sub-items
  const renderGroup = (item: (typeof MENU_ITEMS)[number]) => {
    const isOpen = expanded.has(item.id);
    const hasActiveChild = item.children?.some((c) => c.id === activeTab) ?? false;
    return (
      <div key={item.id}>
        <button
          onClick={() => toggleGroup(item.id)}
          className={cn(
            'group relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200',
            hasActiveChild
              ? 'text-slate-900 bg-white/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
          )}
        >
          <item.icon
            className={cn(
              'w-4 h-4 flex-shrink-0 transition-colors',
              hasActiveChild ? 'text-orange-600' : 'text-slate-400 group-hover:text-slate-700',
            )}
            strokeWidth={hasActiveChild ? 2.5 : 2}
          />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {isOpen && item.children && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden ml-4 mt-0.5 mb-1 pl-3 border-l border-slate-200/70 space-y-0.5"
            >
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                const isActive = activeTab === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => handleNavClick(child.id)}
                    className={cn(
                      'group relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                      isActive
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/60',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-indicator"
                        className="absolute inset-y-1 -left-3 w-0.5 rounded-full bg-orange-500"
                      />
                    )}
                    <ChildIcon
                      className={cn(
                        'w-3.5 h-3.5 flex-shrink-0',
                        isActive ? 'text-orange-300' : 'text-slate-400 group-hover:text-slate-700',
                      )}
                    />
                    <span className="flex-1 text-left">{child.label}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderItem = (item: (typeof MENU_ITEMS)[number]) =>
    item.children?.length ? renderGroup(item) : renderLeaf(item);

  const sidebarContent = (
    <aside
      className="w-72 flex flex-col h-full overflow-hidden relative"
      style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px) saturate(1.5)' }}
    >
      {/* Decorative gradient orbs — warm Bento accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-32 -right-10 w-40 h-40 bg-orange-200 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-32 -left-20 w-56 h-56 bg-purple-200 rounded-full blur-3xl opacity-25" />
      </div>

      {/* Right edge hairline */}
      <div className="absolute top-0 bottom-0 right-0 w-px bg-slate-200/60" />

      {/* Brand */}
      <div className="relative px-7 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 relative flex-shrink-0">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-orange-300 via-rose-300 to-violet-400 blur-md opacity-50" />
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="relative w-full h-full object-contain rounded-2xl ring-1 ring-white/80"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="leading-none">
            <h1 className="font-display text-3xl text-slate-900 tracking-tight">
              {APP_NAME}
              {APP_ACCENT_SUFFIX && (
                <span className="text-orange-600">{APP_ACCENT_SUFFIX}</span>
              )}
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">
              {COMPANY_NAME}
            </p>
          </div>
        </div>
      </div>

      {/* Divider with label */}
      <div className="relative px-7 flex items-center gap-3 mb-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">
          Navigasi
        </p>
        <span className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      </div>

      <nav className="relative flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {mainItems.map(renderItem)}

        {systemItems.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-3 pt-6 pb-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">
                Sistem
              </p>
              <span className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
            </div>
            {systemItems.map(renderItem)}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                Keluar
              </button>
            )}
          </>
        )}
      </nav>

      {/* Status card */}
      <div className="relative p-4 pt-3">
        <div className="relative rounded-2xl p-4 tile overflow-hidden">
          {userEmail ? (
            <>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-1.5">
                Akun Aktif
              </p>
              {userFullName && (
                <p className="text-[11px] font-bold text-slate-700 mb-0.5 truncate" title={userFullName}>
                  {userFullName}
                </p>
              )}
              <div className="flex items-center gap-2">
                <p
                  className="text-[11px] font-black text-slate-900 truncate flex-1 min-w-0"
                  title={userEmail}
                >
                  {userEmail}
                </p>
                {userRole && (() => {
                  const badge = ROLE_BADGE[userRole];
                  const Icon = badge.icon;
                  return (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider flex-shrink-0',
                        badge.bg, badge.text,
                      )}
                      title={`Role: ${ROLE_LABELS[userRole]}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {ROLE_LABELS[userRole]}
                    </span>
                  );
                })()}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-wider">
                  Synced · Supabase
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em] mb-1.5">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px] font-black text-slate-700">Mode Lokal</span>
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
              className="lg:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
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
                className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-white/80 text-slate-700 hover:bg-white transition-colors shadow-sm"
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
