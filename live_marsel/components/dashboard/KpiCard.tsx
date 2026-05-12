import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPercent, clamp } from '@/lib/utils';

type CardVariant = 'paper' | 'yellow' | 'pink' | 'cyan' | 'lime' | 'purple' | 'orange';

interface Props {
  label: string;
  value: string;
  target?: string | null;
  pct?: number | null;
  variant?: CardVariant;
  hint?: string;
}

const PROGRESS_COLOR = (pct: number): string => {
  if (pct >= 100) return 'bg-nb-lime';
  if (pct >= 75)  return 'bg-nb-yellow';
  if (pct >= 50)  return 'bg-nb-orange';
  return 'bg-nb-red';
};

const PROGRESS_BADGE = (pct: number): { variant: 'lime' | 'yellow' | 'orange' | 'red'; label: string } => {
  if (pct >= 100) return { variant: 'lime', label: 'TERCAPAI' };
  if (pct >= 75)  return { variant: 'yellow', label: 'HAMPIR' };
  if (pct >= 50)  return { variant: 'orange', label: 'SETENGAH' };
  return { variant: 'red', label: 'KURANG' };
};

export const KpiCard = ({ label, value, target, pct, variant = 'paper', hint }: Props) => {
  const pctValue = pct ?? 0;
  const badge = PROGRESS_BADGE(pctValue);
  return (
    <Card variant={variant} className="!shadow-nb flex flex-col gap-3 md:gap-4 !p-5 md:!p-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base md:text-lg font-display uppercase tracking-wider text-nb-black/80">
          {label}
        </p>
        {pct != null && (
          <Badge variant={badge.variant} className="!text-base !px-3 !py-1.5">
            {formatPercent(pctValue, 0)}
          </Badge>
        )}
      </div>
      <h3 className="text-5xl md:text-6xl xl:text-7xl font-display tracking-tight text-nb-black break-all leading-none">
        {value}
      </h3>
      {target != null && (
        <div className="space-y-1.5 md:space-y-2 mt-auto">
          <div className="h-3.5 md:h-4 bg-white border-[2.5px] border-nb-black overflow-hidden">
            <div
              className={`h-full ${PROGRESS_COLOR(pctValue)} transition-all duration-300`}
              style={{ width: `${clamp(pctValue, 0, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm md:text-base font-bold text-nb-black/70">
            <span>Target: {target}</span>
            <span>{badge.label}</span>
          </div>
        </div>
      )}
      {hint && <p className="text-sm md:text-base text-nb-black/60 mt-auto">{hint}</p>}
    </Card>
  );
};
