import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCompactIDR, formatNumber, formatPercent } from '@/lib/utils';
import type { YearTotals } from '@/types/database';

interface Props {
  year: number;
  totals: YearTotals | null;
}

type Variant = 'yellow' | 'pink' | 'cyan' | 'lime' | 'purple';

// Inline SVG icons — no extra deps, scales crisp at any size
const ICONS: Record<string, React.ReactNode> = {
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 md:w-9 md:h-9">
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 md:w-9 md:h-9">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="w-8 h-8 md:w-9 md:h-9">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 md:w-9 md:h-9">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 md:w-9 md:h-9">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
};

const BigStat = ({
  label, value, subtitle, variant, icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  variant: Variant;
  icon: React.ReactNode;
}) => (
  <Card variant={variant} className="!shadow-nb !p-4 md:!p-5 flex flex-col gap-2 md:gap-3 h-full">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] md:text-sm font-display uppercase tracking-widest text-nb-black/80 leading-tight">
        {label}
      </p>
      <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-[2.5px] border-nb-black flex items-center justify-center flex-shrink-0 text-nb-black">
        {icon}
      </div>
    </div>
    <h3 className="text-3xl md:text-4xl xl:text-5xl font-display tracking-tight text-nb-black leading-none break-all">
      {value}
    </h3>
    <p className="text-[11px] md:text-xs font-bold text-nb-black/70 mt-auto leading-tight">
      {subtitle}
    </p>
  </Card>
);

export const YearlyKpi = ({ year, totals }: Props) => {
  const sales = totals?.total_sales ?? 0;
  const trx = totals?.total_trx ?? 0;
  const dl = totals?.total_downloader ?? 0;
  const prem = totals?.total_premium ?? 0;
  const konversi = dl > 0 ? (trx / dl) * 100 : 0;
  const aov = trx > 0 ? sales / trx : 0;

  return (
    <section className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="black" className="!text-sm md:!text-base !px-3 !py-1.5">
          Total Tahun {year}
        </Badge>
        <span className="text-[11px] md:text-xs font-display uppercase tracking-widest text-nb-black/60">
          Rekap Akumulasi Keseluruhan
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        <BigStat
          label="Total Sales"
          value={formatCompactIDR(sales)}
          subtitle={`${formatNumber(trx)} transaksi`}
          variant="yellow"
          icon={ICONS.sales}
        />
        <BigStat
          label="Total Downloader"
          value={formatNumber(dl)}
          subtitle="seluruh app, sepanjang tahun"
          variant="cyan"
          icon={ICONS.download}
        />
        <BigStat
          label="Total Premium"
          value={formatNumber(prem)}
          subtitle="email unik yang transaksi"
          variant="pink"
          icon={ICONS.star}
        />
        <BigStat
          label="Konversi"
          value={formatPercent(konversi, 1)}
          subtitle="trx ÷ downloader · setahun"
          variant="lime"
          icon={ICONS.target}
        />
        <BigStat
          label="AOV"
          value={formatCompactIDR(aov)}
          subtitle="rata-rata nilai transaksi"
          variant="purple"
          icon={ICONS.trending}
        />
      </div>
    </section>
  );
};
