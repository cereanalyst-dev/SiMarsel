import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  colorClass: string;
  subtitle?: string;
}

export const StatCard = ({ title, value, icon: Icon, trend, colorClass, subtitle }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileHover={{ y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col gap-4 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden group"
  >
    <div className="flex justify-between items-start">
      <div
        className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg shadow-slate-100',
          colorClass,
        )}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black',
            trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
          )}
        >
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
      </div>
      {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-1">{subtitle}</p>}
    </div>
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-all -z-10" />
  </motion.div>
);

export default StatCard;
