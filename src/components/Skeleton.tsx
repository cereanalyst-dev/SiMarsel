import { cn } from '../lib/utils';

// Base skeleton pulse — dipakai untuk bangun varian lain.
export const Skeleton = ({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    aria-hidden="true"
    className={cn(
      'animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]',
      className,
    )}
    {...rest}
  />
);

// Card skeleton — mimic StatCard / MetricCard shape.
export const CardSkeleton = () => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <Skeleton className="w-9 h-9 rounded-xl" />
      <Skeleton className="w-24 h-3" />
    </div>
    <Skeleton className="w-32 h-7 mb-2" />
    <Skeleton className="w-20 h-3" />
  </div>
);

// Hero skeleton — mimic gradient hero card di Overview.
export const HeroSkeleton = () => (
  <div className="relative overflow-hidden rounded-[2rem] p-7 bg-gradient-to-br from-slate-200 to-slate-300">
    <Skeleton className="w-14 h-14 rounded-2xl mb-10 bg-white/30" />
    <Skeleton className="w-40 h-9 mb-3 bg-white/40" />
    <Skeleton className="w-24 h-3 bg-white/30" />
  </div>
);

// Table rows skeleton.
export const TableSkeleton = ({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) => (
  <div className="w-full">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 py-4 border-b border-slate-50">
        {Array.from({ length: cols }).map((__, c) => (
          <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'flex-[2]')} />
        ))}
      </div>
    ))}
  </div>
);

// Chart skeleton — large rectangular area + bars.
export const ChartSkeleton = ({ height = 500 }: { height?: number }) => (
  <div className="relative w-full" style={{ height }}>
    <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white rounded-2xl" />
    <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);
