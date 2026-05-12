import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCompactIDR, formatNumber } from '@/lib/utils';
import type { YearTotals } from '@/types/database';

interface Props {
  year: number;
  totals: YearTotals | null;
}

// Inline SVG icons — no extra deps, scales crisp at any size
const IconSales = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 md:w-10 md:h-10">
    <path d="M12 1v22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 md:w-10 md:h-10">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="w-9 h-9 md:w-10 md:h-10">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const BigStat = ({
  label, value, subtitle, variant, icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  variant: 'yellow' | 'pink' | 'cyan';
  icon: React.ReactNode;
}) => (
  <Card variant={variant} className="!shadow-nb !p-5 md:!p-6 flex items-center gap-4 md:gap-5">
    {/* Icon box — white square with neubrutalism shadow */}
    <div className="w-16 h-16 md:w-20 md:h-20 bg-white border-[3px] border-nb-black shadow-nb-sm flex items-center justify-center flex-shrink-0 text-nb-black">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] md:text-sm font-display uppercase tracking-widest text-nb-black/70 mb-1">
        {label}
      </p>
      <h3 className="text-4xl md:text-6xl xl:text-7xl font-display tracking-tight text-nb-black leading-none mb-1 md:mb-2 break-all">
        {value}
      </h3>
      <p className="text-xs md:text-sm font-bold text-nb-black/70">
        {subtitle}
      </p>
    </div>
  </Card>
);

export const YearlyKpi = ({ year, totals }: Props) => {
  const sales = totals?.total_sales ?? 0;
  const trx = totals?.total_trx ?? 0;
  const dl = totals?.total_downloader ?? 0;
  const prem = totals?.total_premium ?? 0;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <BigStat
          label="Total Sales"
          value={formatCompactIDR(sales)}
          subtitle={`${formatNumber(trx)} transaksi`}
          variant="yellow"
          icon={<IconSales />}
        />
        <BigStat
          label="Total Downloader"
          value={formatNumber(dl)}
          subtitle="seluruh app, sepanjang tahun"
          variant="cyan"
          icon={<IconDownload />}
        />
        <BigStat
          label="Total User Premium"
          value={formatNumber(prem)}
          subtitle="email unik yang transaksi"
          variant="pink"
          icon={<IconStar />}
        />
      </div>
    </section>
  );
};
