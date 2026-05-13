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

const COLORS = ['#FFE53D', '#5BC0EB', '#FF6B9D', '#A6E22E', '#B388EB'];

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const PromoRank = ({ entries }: Props) => {
  const top = [...entries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((e) => ({
      code: truncate(e.code || 'TANPA KODE', 12),
      count: e.count,
    }));

  return (
    <Card variant="paper" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="pink" className="!text-sm !px-3 !py-1">Top Promo Code</Badge>
        <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/60">
          Top 5
        </span>
      </div>

      {top.length === 0 ? (
        <div className="h-32 flex items-center justify-center border-2 border-dashed border-nb-black/30">
          <p className="text-sm font-bold text-nb-black/50">Belum ada promo</p>
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={top} margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fontSize: 11, fontWeight: 800, fill: '#0A0A0A' }}
                stroke="#0A0A0A"
                strokeWidth={2}
                width={90}
              />
              <Tooltip
                cursor={{ fill: 'rgba(10,10,10,0.05)' }}
                formatter={(v: any) => [formatNumber(v), 'Trx']}
              />
              <Bar dataKey="count" stroke="#0A0A0A" strokeWidth={2}>
                {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList
                  dataKey="count"
                  position="right"
                  formatter={(v: any) => formatNumber(v)}
                  style={{ fontSize: 11, fontWeight: 800, fill: '#0A0A0A' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
