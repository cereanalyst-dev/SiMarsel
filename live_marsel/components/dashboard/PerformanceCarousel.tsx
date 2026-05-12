'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  formatCompactIDR, formatNumber, formatPercent,
} from '@/lib/utils';
import type { DailyPoint, MetricKey } from '@/types/database';

interface SlideMeta {
  key: MetricKey;
  label: string;
  unit: 'rp' | 'num' | 'pct';
  color: string;
}

const SLIDES: SlideMeta[] = [
  { key: 'sales',       label: 'Sales',       unit: 'rp',  color: '#FFE53D' },
  { key: 'downloaders', label: 'Downloader',  unit: 'num', color: '#5BC0EB' },
  { key: 'premium',     label: 'Premium',     unit: 'num', color: '#FF6B9D' },
  { key: 'conversion',  label: 'Konversi',    unit: 'pct', color: '#A6E22E' },
];

interface Props {
  data: DailyPoint[];
  totals?: {
    sales: number;
    downloaders: number;
    premium: number;
    conversion: number;
  };
  dailyTargets?: {
    sales: number;
    downloaders: number;
    premium: number;
    conversion: number;
  };
}

const fmt = (v: number, unit: SlideMeta['unit']): string =>
  unit === 'rp' ? formatCompactIDR(v)
  : unit === 'pct' ? formatPercent(v, 1)
  : formatNumber(v);

export const PerformanceCarousel = ({ data, totals, dailyTargets }: Props) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 60_000);
    return () => clearInterval(id);
  }, [paused]);

  const slide = SLIDES[idx];
  const target = dailyTargets?.[slide.key] ?? 0;
  const totalValue = totals?.[slide.key] ?? 0;

  const chartData = useMemo(
    () => data.map((d) => ({ day: d.day, value: d[slide.key] })),
    [data, slide.key],
  );

  const dataMax = Math.max(0, ...chartData.map((d) => d.value));
  const yMax = Math.max(dataMax, target * 1.15) * 1.05;

  return (
    <Card
      variant="paper"
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="black" className="!text-sm md:!text-base !px-3 !py-1.5">Performa Harian</Badge>
          <h3 className="font-display text-2xl md:text-3xl tracking-tight">
            {slide.label}
          </h3>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/60">Total Bulan Ini</span>
            <span className="text-base md:text-lg font-display tabular-nums">
              {fmt(totalValue, slide.unit)}
            </span>
          </div>
          <Button
            variant="white" size="sm"
            onClick={() => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
            aria-label="Sebelumnya"
          >
            ←
          </Button>
          <Button
            variant="white" size="sm"
            onClick={() => setIdx((i) => (i + 1) % SLIDES.length)}
            aria-label="Berikutnya"
          >
            →
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 md:h-80">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-nb-black/30">
            <p className="text-sm font-bold text-nb-black/50">Belum ada data periode ini</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0A0A0A" strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fontWeight: 700, fill: '#0A0A0A' }}
                stroke="#0A0A0A"
                strokeWidth={2}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#0A0A0A' }}
                stroke="#0A0A0A"
                strokeWidth={2}
                tickFormatter={(v: any) => fmt(v, slide.unit)}
                width={70}
              />
              <Tooltip
                cursor={{ fill: 'rgba(10,10,10,0.05)' }}
                formatter={(v: any) => [fmt(v, slide.unit), slide.label]}
                labelFormatter={(label) => `Hari ${label}`}
              />
              {target > 0 && (
                <ReferenceLine
                  y={target}
                  stroke="#0A0A0A"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{
                    value: `Target ${fmt(target, slide.unit)}`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fontWeight: 800,
                    fill: '#0A0A0A',
                  }}
                />
              )}
              <Bar dataKey="value" radius={0} stroke="#0A0A0A" strokeWidth={2}>
                {chartData.map((d, i) => {
                  const v = d.value;
                  const color =
                    v <= 0 ? '#9CA3AF'
                    : target > 0 && v >= target ? '#A6E22E'
                    : target > 0 && v < target ? '#FF5252'
                    : slide.color;
                  return <Cell key={i} fill={color} />;
                })}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: any) => fmt(v, slide.unit)}
                  style={{ fontSize: 10, fontWeight: 800, fill: '#0A0A0A' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Slide indicator dots */}
      <div className="flex items-center justify-center gap-2 mt-1">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Slide ${s.label}`}
            className={
              `h-2.5 transition-all border-2 border-nb-black ` +
              (i === idx ? 'w-8 bg-nb-black' : 'w-2.5 bg-white')
            }
          />
        ))}
      </div>
    </Card>
  );
};
