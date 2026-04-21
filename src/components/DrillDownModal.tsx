import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { formatCurrency, formatNumber, getShortAppName } from '../lib/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  metric: string;
  appColors: Record<string, string>;
}

export const DrillDownModal = ({ isOpen, onClose, data, metric, appColors }: Props) => {
  if (!isOpen || !data) return null;

  const breakdown = Object.entries(data.appBreakdown || {})
    .map(([app, vals]: [string, any]) => ({
      app,
      value: vals[metric] || 0,
      color: appColors[app],
    }))
    .sort((a, b) => b.value - a.value);

  const total = breakdown.reduce((sum, item) => sum + item.value, 0);
  const renderValue = (v: number) => {
    if (metric === 'revenue') return formatCurrency(v);
    if (metric === 'conversion') return `${v.toFixed(2)}%`;
    return formatNumber(v);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Detail Kontribusi: {data.name}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{metric}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup detail"
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5 text-slate-400 rotate-45" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Total {metric}
            </p>
            <h4 className="text-2xl font-black text-slate-900">{renderValue(total)}</h4>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Breakdown per Aplikasi
            </p>
            {breakdown.map((item) => (
              <div key={item.app} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-700">{getShortAppName(item.app)}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{renderValue(item.value)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: item.color,
                      width: `${(item.value / (total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DrillDownModal;
