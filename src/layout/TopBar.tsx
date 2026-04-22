import { Search } from 'lucide-react';
import { APP_NAME, LOGO_PATH } from '../config/app.config';

export const TopBar = () => (
  <div className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-30">
    <div className="relative w-96">
      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Search Anything"
        aria-label="Search"
        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
      />
    </div>
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 flex items-center justify-center">
        <img
          src={LOGO_PATH}
          alt={APP_NAME}
          className="w-full h-full object-contain rounded-lg"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="text-right hidden sm:block">
        <p className="text-sm font-black text-slate-900 leading-none">{APP_NAME}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          Dashboard
        </p>
      </div>
    </div>
  </div>
);

export default TopBar;
