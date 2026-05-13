'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCompactIDR, formatNumber, formatPercent, clamp } from '@/lib/utils';

interface Product { name: string; revenue: number; trxCount: number; }
interface PromoEntry { code: string; count: number; }

interface Props {
  products: Product[];
  promoEntries: PromoEntry[];
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const SLIDES = [
  { key: 'products', label: 'Top Products', badge: 'cyan' as const },
  { key: 'promo',    label: 'Top Promo Code', badge: 'pink' as const },
];

const COLORS = ['#FFE53D', '#FF6B9D', '#5BC0EB', '#A6E22E', '#B388EB', '#FF8C42', '#FF5252', '#9CA3AF'];

export const TopRankCarousel = ({ products, promoEntries }: Props) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 60_000);
    return () => clearInterval(id);
  }, [paused]);

  const sortedProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const totalProductRev = sortedProducts.reduce((s, p) => s + p.revenue, 0);
  const maxProduct = sortedProducts[0]?.revenue ?? 0;

  const sortedPromo = [...promoEntries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((e) => ({ code: truncate(e.code || 'TANPA KODE', 16), count: e.count }));
  const totalPromo = sortedPromo.reduce((s, p) => s + p.count, 0);
  const maxPromo = sortedPromo[0]?.count ?? 0;

  const slide = SLIDES[idx];

  return (
    <Card
      variant="paper"
      className="flex flex-col gap-3 h-full w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant={slide.badge} className="!text-base md:!text-lg !px-3 !py-1.5">
          {slide.label}
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="white" size="sm" onClick={() => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)} aria-label="Sebelumnya">←</Button>
          <Button variant="white" size="sm" onClick={() => setIdx((i) => (i + 1) % SLIDES.length)} aria-label="Berikutnya">→</Button>
        </div>
      </div>

      {/* Content — items distribute equally to fill card height */}
      <div className="flex-1 min-h-0 flex flex-col">
        {idx === 0 ? (
          sortedProducts.length === 0 ? (
            <EmptyState text="Belum ada produk" />
          ) : (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {sortedProducts.map((p, i) => {
                const pct = maxProduct > 0 ? (p.revenue / maxProduct) * 100 : 0;
                const sharePct = totalProductRev > 0 ? (p.revenue / totalProductRev) * 100 : 0;
                return (
                  <div key={p.name} className="flex-1 flex items-center gap-3 min-h-0">
                    <span
                      className="w-12 h-12 flex items-center justify-center text-nb-black text-xl font-display flex-shrink-0 border-[2.5px] border-nb-black"
                      style={{ background: COLORS[i % COLORS.length] }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <p className="text-lg md:text-xl font-bold leading-tight line-clamp-2 break-words">
                          {p.name}
                        </p>
                        <span className="text-lg md:text-xl font-display tabular-nums flex-shrink-0">
                          {formatCompactIDR(p.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3.5 bg-white border-[2.5px] border-nb-black overflow-hidden">
                          <div
                            className="h-full bg-nb-black"
                            style={{ width: `${clamp(pct, 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-base font-bold tabular-nums text-nb-black/60 w-14 text-right">
                          {formatPercent(sharePct, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          sortedPromo.length === 0 ? (
            <EmptyState text="Belum ada promo" />
          ) : (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {sortedPromo.map((e, i) => {
                const pct = maxPromo > 0 ? (e.count / maxPromo) * 100 : 0;
                const sharePct = totalPromo > 0 ? (e.count / totalPromo) * 100 : 0;
                return (
                  <div key={e.code} className="flex-1 flex items-center gap-3 min-h-0">
                    <span
                      className="w-12 h-12 flex items-center justify-center text-nb-black text-xl font-display flex-shrink-0 border-[2.5px] border-nb-black"
                      style={{ background: COLORS[i % COLORS.length] }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <p className="font-display text-lg md:text-xl leading-tight truncate" title={e.code}>
                          {e.code}
                        </p>
                        <span className="text-lg md:text-xl font-display tabular-nums flex-shrink-0">
                          {formatNumber(e.count)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3.5 bg-white border-[2.5px] border-nb-black overflow-hidden">
                          <div
                            className="h-full bg-nb-black"
                            style={{ width: `${clamp(pct, 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-base font-bold tabular-nums text-nb-black/60 w-14 text-right">
                          {formatPercent(sharePct, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
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

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-32 flex items-center justify-center border-2 border-dashed border-nb-black/30">
    <p className="text-sm font-bold text-nb-black/50">{text}</p>
  </div>
);
