import {
  LayoutDashboard, TrendingUp, Target, Package, Calendar, MessageSquare, Settings, LogOut,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  activeTab: string;
  setActiveTab: (t: string) => void;
  onSignOut?: () => void;
  userEmail?: string | null;
}

const menuItems = [
  { id: 'overview', icon: LayoutDashboard, label: 'Ringkasan Performa' },
  { id: 'optimasi', icon: TrendingUp, label: 'Optimasi Harga' },
  { id: 'target', icon: Target, label: 'Strategi & Target' },
  { id: 'packages', icon: Package, label: 'Performa Produk' },
  { id: 'calendar', icon: Calendar, label: 'Kalender Paket' },
  { id: 'social', icon: MessageSquare, label: 'Analisa Sosial Media' },
];
const accountItems = [{ id: 'settings', icon: Settings, label: 'Settings' }];

export const Sidebar = ({ activeTab, setActiveTab, onSignOut, userEmail }: Props) => (
  <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-y-auto">
    <div className="p-8 border-b border-slate-800 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 flex items-center justify-center">
          <img src="/maungmarsel.jpeg" alt="Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight leading-none">
            SiMarsel<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">PT. Cerebrum Edukanesia</p>
        </div>
      </div>
    </div>

    <div className="flex-1 px-4 space-y-8">
      <div>
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Menu Utama</p>
        <div className="space-y-1">
          {menuItems.map((item) => (
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
          ))}
        </div>
      </div>

      <div>
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Sistem</p>
        <div className="space-y-1">
          {accountItems.map((item) => (
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
                <item.icon className={cn('w-5 h-5', activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
                {item.label}
              </div>
            </button>
          ))}
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

export default Sidebar;
