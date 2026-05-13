'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCompactIDR, formatPercent } from '@/lib/utils';

interface Slice {
  name: string;
  value: number;
}

interface Props {
  slices: Slice[];
}

const COLORS = ['#FFE53D', '#FF6B9D', '#5BC0EB', '#A6E22E', '#FF8C42', '#B388EB', '#FF5252', '#9CA3AF'];

export const PaymentMethodChart = ({ slices }: Props) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const sorted = [...slices].sort((a, b) => b.value - a.value);

  return (
    <Card variant="paper" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="black" className="!text-sm !px-3 !py-1">Payment Method</Badge>
        <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/60">
          Per Revenue
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="h-32 flex items-center justify-center border-2 border-dashed border-nb-black/30">
          <p className="text-sm font-bold text-nb-black/50">Belum ada data</p>
        </div>
      ) : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sorted}
                  dataKey="value"
                  innerRadius="58%"
                  outerRadius="92%"
                  stroke="#0A0A0A"
                  strokeWidth={3}
                  paddingAngle={1}
                >
                  {sorted.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => {
                    const n = Number(v) || 0;
                    return [
                      `${formatCompactIDR(n)} (${formatPercent(total > 0 ? (n / total) * 100 : 0, 1)})`,
                      'Revenue',
                    ] as [string, string];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-display uppercase tracking-wider text-nb-black/60">
                Total
              </span>
              <span className="font-display text-base md:text-lg tracking-tight">
                {formatCompactIDR(total)}
              </span>
            </div>
          </div>

          {/* Compact legend — single column for narrow card */}
          <div className="grid grid-cols-1 gap-1 text-xs">
            {sorted.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 truncate">
                <span
                  className="w-3 h-3 border-2 border-nb-black flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-bold truncate flex-1" title={s.name}>{s.name}</span>
                <span className="text-nb-black/60 tabular-nums font-bold">
                  {formatPercent(total > 0 ? (s.value / total) * 100 : 0, 0)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
