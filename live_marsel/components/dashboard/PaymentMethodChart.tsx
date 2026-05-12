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
    <Card variant="paper" className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Badge variant="black">Payment Method</Badge>
      </div>

      {sorted.length === 0 ? (
        <div className="h-56 flex items-center justify-center border-2 border-dashed border-nb-black/30">
          <p className="text-sm font-bold text-nb-black/50">Belum ada data</p>
        </div>
      ) : (
        <>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sorted}
                  dataKey="value"
                  innerRadius="55%"
                  outerRadius="90%"
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
              <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/60">
                Total
              </span>
              <span className="font-display text-lg md:text-xl tracking-tight">
                {formatCompactIDR(total)}
              </span>
            </div>
          </div>

          {/* Legend 2-col */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {sorted.slice(0, 8).map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 truncate">
                <span
                  className="w-3 h-3 border-2 border-nb-black flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-bold truncate" title={s.name}>{s.name}</span>
                <span className="ml-auto text-nb-black/60 tabular-nums">
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
