'use client';

import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/utils';

interface PromoEntry {
  code: string;
  count: number;
}

interface Props {
  entries: PromoEntry[];
}

const COLORS = ['#FFE53D', '#5BC0EB', '#FF6B9D', '#A6E22E', '#B388EB', '#FF8C42', '#FF5252', '#9CA3AF'];

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const PromoRank = ({ entries }: Props) => {
  const top = [...entries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((e) => ({
      code: truncate(e.code || 'TANPA KODE', 14),
      count: e.count,
    }));

  return (
    <Card variant="paper" className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Badge variant="pink">Top Promo Code</Badge>
      </div>

      {top.length === 0 ? (
        <div className="h-56 flex items-center justify-center border-2 border-dashed border-nb-black/30">
          <p className="text-sm font-bold text-nb-black/50">Belum ada promo</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={top} margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#0A0A0A' }}
                stroke="#0A0A0A"
                strokeWidth={2}
                width={100}
              />
              <Tooltip
                cursor={{ fill: 'rgba(10,10,10,0.05)' }}
                formatter={(v: number) => [formatNumber(v), 'Trx']}
              />
              <Bar dataKey="count" stroke="#0A0A0A" strokeWidth={2}>
                {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList
                  dataKey="count"
                  position="right"
                  formatter={(v: number) => formatNumber(v)}
                  style={{ fontSize: 10, fontWeight: 800, fill: '#0A0A0A' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
