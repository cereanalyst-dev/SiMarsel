import { formatCurrency, formatNumber, getShortAppName } from '../lib/formatters';

interface Props {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; fill?: string }>;
  label?: string;
  metric: string;
}

export const CustomTooltip = ({ active, payload, label, metric }: Props) => {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  const renderValue = (value: number) => {
    if (metric === 'revenue') return formatCurrency(value);
    if (metric === 'conversion') return `${value.toFixed(2)}%`;
    return formatNumber(value);
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 min-w-[220px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">
        {label}
      </p>
      <div className="space-y-2.5">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-black text-slate-900 uppercase">Total {metric}</span>
          <span className="text-[10px] font-black text-indigo-600">{renderValue(total)}</span>
        </div>
        {sortedPayload.map((entry, i) => (
          <div key={i} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: entry.color ?? entry.fill ?? '#64748b' }}
              />
              <span className="text-[9px] font-bold text-slate-500 uppercase">
                {getShortAppName(entry.name ?? '')}
              </span>
            </div>
            <span className="text-[9px] font-black text-slate-700">{renderValue(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomTooltip;
