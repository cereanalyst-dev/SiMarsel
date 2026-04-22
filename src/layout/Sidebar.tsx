import { LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  APP_ACCENT_SUFFIX, APP_NAME, COMPANY_NAME, LOGO_PATH, MENU_ITEMS,
} from '../config/app.config';

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onSignOut?: () => void;
  userEmail?: string | null;
}

export const Sidebar = ({ activeTab, setActiveTab, onSignOut, userEmail }: Props) => {
  const mainItems = MENU_ITEMS.filter((m) => m.group === 'main');
  const systemItems = MENU_ITEMS.filter((m) => m.group === 'system');

  const renderItem = (item: (typeof MENU_ITEMS)[number]) => (
    <button
      key={item.id}
      onClick={() => setActiveTab(item.id)}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group',
        activeTab === item.id
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
      )}
    >
      <div className="flex items-center gap-3">
        <item.icon
          className={cn(
            'w-5 h-5',
            activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300',
          )}
        />
        {item.label}
      </div>
      {activeTab === item.id && (
        <motion.div layoutId="activeTab" className="w-1.5 h-1.5 bg-white rounded-full" />
      )}
    </button>
  );

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="p-8 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center">
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="w-full h-full object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none">
              {APP_NAME}
              {APP_ACCENT_SUFFIX && <span className="text-indigo-500">{APP_ACCENT_SUFFIX}</span>}
            </h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">
              {COMPANY_NAME}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-8">
        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">
            Menu Utama
          </p>
          <div className="space-y-1">{mainItems.map(renderItem)}</div>
        </div>

        {systemItems.length > 0 && (
          <div>
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">
              Sistem
            </p>
            <div className="space-y-1">
              {systemItems.map(renderItem)}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 transition-all"
                >
                  <LogOut className="w-5 h-5 text-slate-500" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 mt-auto">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            {userEmail ? 'Masuk sebagai' : 'Status Server'}
          </p>
          {userEmail ? (
            <p className="text-[11px] font-black text-white truncate" title={userEmail}>
              {userEmail}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-black text-white">Online &amp; Terkoneksi</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
