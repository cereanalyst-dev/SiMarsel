import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCompactIDR, formatPercent, clamp } from '@/lib/utils';

interface Product {
  name: string;
  revenue: number;
  trxCount: number;
}

interface Props {
  products: Product[];
}

const COLORS = ['#FFE53D', '#FF6B9D', '#5BC0EB', '#A6E22E', '#B388EB'];

export const TopProducts = ({ products }: Props) => {
  const sorted = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const total = sorted.reduce((s, p) => s + p.revenue, 0);
  const max = sorted[0]?.revenue ?? 0;

  return (
    <Card variant="paper" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="cyan" className="!text-sm !px-3 !py-1">Top Products</Badge>
        <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/60">
          Top 5
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="h-32 flex items-center justify-center border-2 border-dashed border-nb-black/30">
          <p className="text-sm font-bold text-nb-black/50">Belum ada produk</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((p, i) => {
            const pct = max > 0 ? (p.revenue / max) * 100 : 0;
            const sharePct = total > 0 ? (p.revenue / total) * 100 : 0;
            return (
              <div key={p.name} className="flex items-start gap-2.5">
                <span
                  className="w-7 h-7 flex items-center justify-center text-nb-black text-sm font-display flex-shrink-0 border-[2.5px] border-nb-black"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-bold leading-tight line-clamp-2 break-words">
                      {p.name}
                    </p>
                    <span className="text-sm font-display tabular-nums flex-shrink-0">
                      {formatCompactIDR(p.revenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white border-[2px] border-nb-black overflow-hidden">
                      <div
                        className="h-full bg-nb-black"
                        style={{ width: `${clamp(pct, 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-nb-black/60 w-10 text-right">
                      {formatPercent(sharePct, 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
