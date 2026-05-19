'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  formatCompactIDR, formatNumber, formatPercent, clamp, titleCase,
} from '@/lib/utils';
import type { MetricBlock } from '@/types/database';

interface Props {
  blocks: MetricBlock[];     // 4 metric blocks (sales/dl/premium/conversion)
  hasTarget: boolean;
}

const fmt = (v: number, unit: MetricBlock['unit']): string =>
  unit === 'rp' ? formatCompactIDR(v)
  : unit === 'pct' ? formatPercent(v, 1)
  : formatNumber(v);

const COLOR_BY_PCT = (pct: number): string => {
  if (pct >= 100) return 'bg-nb-lime';
  if (pct >= 75)  return 'bg-nb-yellow';
  if (pct >= 50)  return 'bg-nb-orange';
  return 'bg-nb-red';
};

export const TargetCarousel = ({ blocks, hasTarget }: Props) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % blocks.length), 60_000);
    return () => clearInterval(id);
  }, [paused, blocks.length]);

  if (blocks.length === 0) {
    return (
      <Card variant="paper" className="h-full flex items-center justify-center">
        <p className="text-sm font-bold text-nb-black/60">Belum ada data app</p>
      </Card>
    );
  }

  const block = blocks[idx];
  const overallPct = block.target > 0 ? (block.total / block.target) * 100 : 0;

  return (
    <Card
      variant="paper"
      className="flex flex-col gap-3 h-full w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="black" className="!text-base md:!text-lg !px-3 !py-1.5">Pencapaian per App</Badge>
          <h3 className="font-display text-3xl md:text-4xl tracking-tight">{block.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="white" size="sm"
            onClick={() => setIdx((i) => (i - 1 + blocks.length) % blocks.length)}
            aria-label="Sebelumnya"
          >
            ←
          </Button>
          <Button
            variant="white" size="sm"
            onClick={() => setIdx((i) => (i + 1) % blocks.length)}
            aria-label="Berikutnya"
          >
            →
          </Button>
        </div>
      </div>

      {/* Total + overall % */}
      <div className="flex items-baseline justify-between gap-2 pb-3 border-b-2 border-dashed border-nb-black/30">
        <span className="font-display text-4xl md:text-5xl xl:text-6xl tracking-tight">
          {fmt(block.total, block.unit)}
        </span>
        {hasTarget && block.target > 0 && (
          <Badge
            variant={overallPct >= 100 ? 'lime' : overallPct >= 75 ? 'yellow' : overallPct >= 50 ? 'orange' : 'red'}
            className="!text-base !px-3 !py-1.5"
          >
            {formatPercent(overallPct, 0)} dari target
          </Badge>
        )}
      </div>

      {/* App list */}
      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        {block.apps.length === 0 ? (
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-nb-black/30">
            <p className="text-sm font-bold text-nb-black/50">Belum ada data</p>
          </div>
        ) : (
          block.apps.map((app, i) => {
            const pct = clamp(app.pct, 0, 999);
            return (
              <div key={app.app} className="flex items-center gap-3 py-2">
                {/* Rank */}
                <span className="w-10 h-10 flex items-center justify-center bg-nb-black text-white text-lg font-display flex-shrink-0">
                  {i + 1}
                </span>
                {/* Name + values */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="font-display text-xl md:text-2xl truncate">
                      {titleCase(app.app)}
                      {app.target > 0 && (
                        <span className="ml-1.5 text-sm md:text-base font-bold text-nb-black/55 tabular-nums">
                          ({fmt(app.target, block.unit)})
                        </span>
                      )}
                    </span>
                    <span className="text-lg md:text-xl font-display tabular-nums flex-shrink-0">
                      {fmt(app.value, block.unit)}
                    </span>
                  </div>
                  <div className="h-3.5 bg-white border-[2.5px] border-nb-black overflow-hidden">
                    <div
                      className={`h-full ${COLOR_BY_PCT(pct)} transition-all duration-300`}
                      style={{ width: `${clamp(pct, 0, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-lg font-bold tabular-nums w-16 text-right flex-shrink-0">
                  {hasTarget && app.target > 0 ? formatPercent(pct, 0) : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Slide indicator dots */}
      <div className="flex items-center justify-center gap-2 mt-1">
        {blocks.map((b, i) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Slide ${b.label}`}
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
