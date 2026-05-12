'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatCompactIDR, formatNumber, formatPercent,
  normalizeApp, appFromTrxId, parsePromoCodes,
  jakartaDay, jakartaDateOnly, monthRangeJakarta, jakartaParts,
} from '@/lib/utils';
import type {
  Transaction, Download, Target, AppAggregate, DailyPoint, MetricBlock,
} from '@/types/database';
import { KpiCard } from './KpiCard';
import { PerformanceCarousel } from './PerformanceCarousel';
import { TargetCarousel } from './TargetCarousel';
import { TopRankCarousel } from './TopRankCarousel';
import { Badge } from '@/components/ui/Badge';

// =============================================================
// Types
// =============================================================
interface Props {
  initialTransactions: Transaction[];
  initialDownloads: Download[];
  initialTargets: Target[];
  period: { year: number; month: number };
}

// Caps untuk hindari memory blow-up dari realtime burst
const TRX_CAP = 5000;
const DL_CAP  = 730;

// =============================================================
// Component
// =============================================================
export const DashboardClient = ({
  initialTransactions, initialDownloads, initialTargets, period,
}: Props) => {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [downloads, setDownloads] = useState<Download[]>(initialDownloads);
  const [targets] = useState<Target[]>(initialTargets);

  // Realtime subscribe
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        setTransactions((prev) => mergeRow<Transaction>(prev, payload as unknown as RealtimePayload<Transaction>, 'trx_id', TRX_CAP));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'downloaders' }, (payload) => {
        setDownloads((prev) => mergeDownload(prev, payload as unknown as RealtimePayload<Download>, DL_CAP));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'target_config' }, () => {
        // Targets kompleks (ada year_month filter) — refetch sederhana via reload
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ============================================================
  // Period range filter
  // ============================================================
  const range = useMemo(() => monthRangeJakarta(period.year, period.month), [period.year, period.month]);

  const trxInRange = useMemo(() => {
    const startStr = jakartaDateOnly(range.start);
    return transactions.filter((t) => {
      const d = t.transaction_date ?? t.payment_date ?? t.created_at;
      if (!d) return false;
      const ds = jakartaDateOnly(d);
      if (ds < startStr) return false;
      const p = jakartaParts(d);
      return p.year === period.year && p.month === period.month;
    });
  }, [transactions, range.start, period.year, period.month]);

  const downloadsInRange = useMemo(() => {
    return downloads.filter((d) => {
      if (!d.date) return false;
      const [y, m] = d.date.split('-').map(Number);
      return y === period.year && m === period.month;
    });
  }, [downloads, period.year, period.month]);

  const targetByApp = useMemo(() => {
    const map = new Map<string, Target>();
    targets.forEach((t) => map.set(normalizeApp(t.source_app), t));
    return map;
  }, [targets]);

  // ============================================================
  // Per-app aggregation
  // ============================================================
  const perApp = useMemo<AppAggregate[]>(() => {
    const acc = new Map<string, {
      sales: number; trxCount: number; downloaders: number;
      emails: Set<string>;
    }>();

    trxInRange.forEach((t) => {
      const app = normalizeApp(t.source_app || appFromTrxId(t.trx_id));
      if (!app) return;
      const cur = acc.get(app) ?? { sales: 0, trxCount: 0, downloaders: 0, emails: new Set() };
      cur.sales += Number(t.revenue) || 0;
      cur.trxCount += 1;
      if (t.email) cur.emails.add(t.email.trim().toLowerCase());
      acc.set(app, cur);
    });

    downloadsInRange.forEach((d) => {
      const app = normalizeApp(d.source_app);
      if (!app) return;
      const cur = acc.get(app) ?? { sales: 0, trxCount: 0, downloaders: 0, emails: new Set() };
      cur.downloaders += Number(d.count) || 0;
      acc.set(app, cur);
    });

    return Array.from(acc.entries()).map(([app, v]) => {
      const target = targetByApp.get(app) ?? null;
      const conversion = v.downloaders > 0 ? (v.trxCount / v.downloaders) * 100 : 0;
      return {
        app, sales: v.sales, trxCount: v.trxCount,
        downloaders: v.downloaders, premium: v.emails.size,
        conversion, target,
      };
    });
  }, [trxInRange, downloadsInRange, targetByApp]);

  // ============================================================
  // Totals
  // ============================================================
  const totals = useMemo(() => {
    const totalSales = perApp.reduce((s, a) => s + a.sales, 0);
    const totalTrx = perApp.reduce((s, a) => s + a.trxCount, 0);
    const totalDl = perApp.reduce((s, a) => s + a.downloaders, 0);
    const allEmails = new Set<string>();
    trxInRange.forEach((t) => { if (t.email) allEmails.add(t.email.trim().toLowerCase()); });
    return {
      sales: totalSales,
      trx: totalTrx,
      downloaders: totalDl,
      premium: allEmails.size,
      avgPrice: totalTrx > 0 ? totalSales / totalTrx : 0,
      conversion: totalDl > 0 ? (totalTrx / totalDl) * 100 : 0,
    };
  }, [perApp, trxInRange]);

  // ============================================================
  // Aggregate target
  // ============================================================
  const aggregateTarget = useMemo(() => {
    const ts = Array.from(targetByApp.values());
    const sales = ts.reduce((s, t) => s + (Number(t.sales_target) || 0), 0);
    const dl = ts.reduce((s, t) => s + (Number(t.downloader_target) || 0), 0);
    const prem = ts.reduce((s, t) => s + (Number(t.premium_user_target) || 0), 0);
    const convT = ts.filter((t) => t.conversion_target > 0);
    const conv = convT.length > 0 ? convT.reduce((s, t) => s + Number(t.conversion_target), 0) / convT.length : 0;
    const apT = ts.filter((t) => t.avg_price_target > 0);
    const ap = apT.length > 0 ? apT.reduce((s, t) => s + Number(t.avg_price_target), 0) / apT.length : 0;
    return { sales, downloaders: dl, premium: prem, conversion: conv, avgPrice: ap };
  }, [targetByApp]);

  const dailyTargets = useMemo(() => ({
    sales:       aggregateTarget.sales / range.lastDay,
    downloaders: aggregateTarget.downloaders / range.lastDay,
    premium:     aggregateTarget.premium / range.lastDay,
    conversion:  aggregateTarget.conversion,
  }), [aggregateTarget, range.lastDay]);

  // ============================================================
  // Daily breakdown
  // ============================================================
  const daily = useMemo<DailyPoint[]>(() => {
    const today = jakartaParts();
    const isCurrentMonth = today.year === period.year && today.month === period.month;
    const lastDayToShow = isCurrentMonth ? today.day : range.lastDay;

    const buckets: DailyPoint[] = Array.from({ length: lastDayToShow }, (_, i) => ({
      day: i + 1,
      date: `${period.year}-${String(period.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      sales: 0, trxCount: 0, downloaders: 0, premium: 0, conversion: 0,
    }));
    const emailsByDay: Map<number, Set<string>> = new Map();

    trxInRange.forEach((t) => {
      const d = t.transaction_date ?? t.payment_date ?? t.created_at;
      if (!d) return;
      const day = jakartaDay(d);
      if (day < 1 || day > lastDayToShow) return;
      const idx = day - 1;
      buckets[idx].sales += Number(t.revenue) || 0;
      buckets[idx].trxCount += 1;
      if (t.email) {
        const set = emailsByDay.get(day) ?? new Set();
        set.add(t.email.trim().toLowerCase());
        emailsByDay.set(day, set);
      }
    });
    downloadsInRange.forEach((d) => {
      if (!d.date) return;
      const day = Number(d.date.split('-')[2]);
      if (day < 1 || day > lastDayToShow) return;
      buckets[day - 1].downloaders += Number(d.count) || 0;
    });
    buckets.forEach((b) => {
      b.premium = emailsByDay.get(b.day)?.size ?? 0;
      b.conversion = b.downloaders > 0 ? (b.trxCount / b.downloaders) * 100 : 0;
    });
    return buckets;
  }, [trxInRange, downloadsInRange, period.year, period.month, range.lastDay]);

  // ============================================================
  // Top rank slices
  // ============================================================
  const promoEntries = useMemo(() => {
    const acc = new Map<string, number>();
    trxInRange.forEach((t) => {
      const codes = parsePromoCodes(t.promo_code);
      if (codes.length === 0) {
        acc.set('TANPA KODE', (acc.get('TANPA KODE') ?? 0) + 1);
      } else {
        codes.forEach((c) => {
          const k = c.toUpperCase().trim();
          acc.set(k, (acc.get(k) ?? 0) + 1);
        });
      }
    });
    return Array.from(acc.entries()).map(([code, count]) => ({ code, count }));
  }, [trxInRange]);

  const topProducts = useMemo(() => {
    const acc = new Map<string, { revenue: number; trxCount: number }>();
    trxInRange.forEach((t) => {
      const name = (t.content_name || 'Tanpa Nama').trim();
      const cur = acc.get(name) ?? { revenue: 0, trxCount: 0 };
      cur.revenue += Number(t.revenue) || 0;
      cur.trxCount += 1;
      acc.set(name, cur);
    });
    return Array.from(acc.entries()).map(([name, v]) => ({ name, ...v }));
  }, [trxInRange]);

  // ============================================================
  // Per-app blocks for TargetCarousel
  // ============================================================
  const blocks = useMemo<MetricBlock[]>(() => {
    // Tampilkan SEMUA app (sort desc by value, no top-N slice)
    const sortDesc = <T extends { value: number }>(arr: T[]) =>
      arr.sort((a, b) => b.value - a.value);

    const salesApps = perApp.map((a) => ({
      app: a.app, value: a.sales,
      target: a.target?.sales_target ?? 0,
      pct: a.target?.sales_target ? (a.sales / a.target.sales_target) * 100 : 0,
    }));
    const dlApps = perApp.map((a) => ({
      app: a.app, value: a.downloaders,
      target: a.target?.downloader_target ?? 0,
      pct: a.target?.downloader_target ? (a.downloaders / a.target.downloader_target) * 100 : 0,
    }));
    const premApps = perApp.map((a) => ({
      app: a.app, value: a.premium,
      target: a.target?.premium_user_target ?? 0,
      pct: a.target?.premium_user_target ? (a.premium / a.target.premium_user_target) * 100 : 0,
    }));
    const convApps = perApp.map((a) => ({
      app: a.app, value: a.conversion,
      target: a.target?.conversion_target ?? 0,
      pct: a.target?.conversion_target ? (a.conversion / a.target.conversion_target) * 100 : 0,
    }));

    return [
      { key: 'sales', label: 'Sales', unit: 'rp', total: totals.sales, target: aggregateTarget.sales, apps: sortDesc(salesApps) },
      { key: 'downloaders', label: 'Downloader', unit: 'num', total: totals.downloaders, target: aggregateTarget.downloaders, apps: sortDesc(dlApps) },
      { key: 'premium', label: 'Premium', unit: 'num', total: totals.premium, target: aggregateTarget.premium, apps: sortDesc(premApps) },
      { key: 'conversion', label: 'Konversi', unit: 'pct', total: totals.conversion, target: aggregateTarget.conversion, apps: sortDesc(convApps) },
    ];
  }, [perApp, totals, aggregateTarget]);

  const hasTarget = aggregateTarget.sales > 0 || targetByApp.size > 0;

  // ============================================================
  // Render
  // ============================================================
  return (
    <main className="max-w-screen mx-auto px-4 md:px-6 py-4 md:py-5 space-y-4 md:space-y-5">
      {/* Period KPI section */}
      <section className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="black" className="!text-sm md:!text-base !px-3 !py-1.5">
              Periode {period.year}
            </Badge>
            <span className="text-[11px] md:text-xs font-display uppercase tracking-widest text-nb-black/60">
              Performa Bulan Berjalan
            </span>
          </div>
          <Badge variant={hasTarget ? 'lime' : 'red'} className="!text-xs md:!text-sm !px-3 !py-1">
            {hasTarget ? `${targetByApp.size} app punya target` : 'Belum ada target'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard label="Sales" value={formatCompactIDR(totals.sales)} target={hasTarget ? formatCompactIDR(aggregateTarget.sales) : null} pct={hasTarget && aggregateTarget.sales > 0 ? (totals.sales / aggregateTarget.sales) * 100 : null} variant="yellow" />
          <KpiCard label="Downloader" value={formatNumber(totals.downloaders)} target={hasTarget ? formatNumber(aggregateTarget.downloaders) : null} pct={hasTarget && aggregateTarget.downloaders > 0 ? (totals.downloaders / aggregateTarget.downloaders) * 100 : null} variant="cyan" />
          <KpiCard label="Premium" value={formatNumber(totals.premium)} target={hasTarget ? formatNumber(aggregateTarget.premium) : null} pct={hasTarget && aggregateTarget.premium > 0 ? (totals.premium / aggregateTarget.premium) * 100 : null} variant="pink" />
          <KpiCard label="Konversi" value={formatPercent(totals.conversion, 1)} target={hasTarget ? formatPercent(aggregateTarget.conversion, 1) : null} pct={hasTarget && aggregateTarget.conversion > 0 ? (totals.conversion / aggregateTarget.conversion) * 100 : null} variant="lime" />
          <KpiCard label="Avg Price" value={formatCompactIDR(totals.avgPrice)} target={hasTarget ? formatCompactIDR(aggregateTarget.avgPrice) : null} pct={hasTarget && aggregateTarget.avgPrice > 0 ? (totals.avgPrice / aggregateTarget.avgPrice) * 100 : null} variant="purple" />
        </div>
      </section>

      {/* Layout 3 kolom equal height: Performa (6) | Pencapaian (3) | TopRank (3) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 md:gap-4 items-stretch">
        {/* Performa Harian — wider, left */}
        <div className="xl:col-span-6 flex">
          <PerformanceCarousel
            data={daily}
            totals={{
              sales: totals.sales,
              downloaders: totals.downloaders,
              premium: totals.premium,
              conversion: totals.conversion,
            }}
            dailyTargets={dailyTargets}
          />
        </div>

        {/* Pencapaian per App — semua app, scrollable */}
        <div className="xl:col-span-3 flex">
          <TargetCarousel blocks={blocks} hasTarget={hasTarget} />
        </div>

        {/* Top Rank slider (TopProducts ↔ PromoCode) */}
        <div className="xl:col-span-3 flex">
          <TopRankCarousel products={topProducts} promoEntries={promoEntries} />
        </div>
      </section>
    </main>
  );
};

// =============================================================
// Realtime helpers
// =============================================================
type RealtimePayload<T> = { eventType: string; new: T; old: T };

function mergeRow<T>(
  prev: T[],
  payload: RealtimePayload<T>,
  pk: keyof T,
  cap: number,
): T[] {
  if (payload.eventType === 'DELETE') {
    const oldKey = payload.old?.[pk];
    return prev.filter((r) => r[pk] !== oldKey);
  }
  if (!payload.new) return prev;
  const newKey = payload.new[pk];
  const filtered = prev.filter((r) => r[pk] !== newKey);
  const next = [payload.new, ...filtered];
  return next.slice(0, cap);
}

function mergeDownload(
  prev: Download[],
  payload: RealtimePayload<Download>,
  cap: number,
): Download[] {
  const matchKey = (a: Download, b: Download) =>
    a.source_app === b.source_app && a.date === b.date;
  if (payload.eventType === 'DELETE') {
    return prev.filter((r) => !matchKey(r, payload.old));
  }
  if (!payload.new) return prev;
  const filtered = prev.filter((r) => !matchKey(r, payload.new));
  return [payload.new, ...filtered].slice(0, cap);
}
