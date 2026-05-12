import { Card } from '@/components/ui/Card';
import { formatCompactIDR, formatNumber } from '@/lib/utils';
import type { YearTotals } from '@/types/database';

interface Props {
  year: number;
  totals: YearTotals | null;
}

const BigStat = ({
  label, value, variant,
}: {
  label: string;
  value: string;
  variant: 'yellow' | 'pink' | 'cyan';
}) => (
  <Card variant={variant} className="!shadow-nb">
    <p className="text-xs md:text-sm font-display uppercase tracking-wider text-nb-black/70 mb-2">
      {label}
    </p>
    <h3 className="text-3xl md:text-5xl xl:text-6xl font-display tracking-tight text-nb-black break-all leading-none">
      {value}
    </h3>
  </Card>
);

export const YearlyKpi = ({ year, totals }: Props) => {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] md:text-xs font-display uppercase tracking-widest text-nb-black/60">
          Total Tahun
        </span>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight">{year}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStat
          label="Sales"
          value={formatCompactIDR(totals?.total_sales ?? 0)}
          variant="yellow"
        />
        <BigStat
          label="Downloader"
          value={formatNumber(totals?.total_downloader ?? 0)}
          variant="cyan"
        />
        <BigStat
          label="Premium"
          value={formatNumber(totals?.total_premium ?? 0)}
          variant="pink"
        />
      </div>
    </section>
  );
};
