import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/dashboard/Header';
import { YearlyKpi } from '@/components/dashboard/YearlyKpi';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import {
  parsePeriodParam, monthRangeJakarta, jakartaDateOnly,
} from '@/lib/utils';
import type { Transaction, Download, Target, YearTotals } from '@/types/database';

// Force dynamic — selalu fresh data dari Supabase + realtime hookup di client
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 1000;
const HARD_CAP  = 50000;
const YEAR_HARD_CAP = 200000;  // year-wide fetch may be large

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

// =============================================================
// Paginate helper — bypass Supabase 1000-row default cap
// =============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginate<T>(makeQuery: () => any, cap = HARD_CAP): Promise<T[]> {
  const result: T[] = [];
  let from = 0;
  while (result.length < cap) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    result.push(...(data as T[]));
    if ((data as T[]).length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return result;
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const range = monthRangeJakarta(period.year, period.month);

  const supabase = await createClient();

  const startDate = jakartaDateOnly(range.start);
  // End exclusive — pakai last day of month
  const endDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(range.lastDay).padStart(2, '0')}`;
  const yearMonth = `${period.year}-${String(period.month).padStart(2, '0')}`;
  const yearStart = `${period.year}-01-01`;
  const yearEnd = `${period.year}-12-31`;

  // Fetch data parallel — current period + year-wide raw rows
  const [transactions, downloads, targetConfigs, yearTrxRaw, yearDlRaw] = await Promise.all([
    paginate<Transaction>(() =>
      supabase
        .from('transactions')
        .select('*')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false }),
    ),
    paginate<Download>(() =>
      supabase
        .from('downloaders')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
    ),
    // target_config — filter by year_month
    supabase
      .from('target_config')
      .select('*')
      .eq('year_month', yearMonth)
      .then(({ data }) => data ?? []),
    // Year-wide transactions: SELECT minimal (revenue saja) buat hitung total.
    // Premium = count rows, jadi tidak perlu email.
    paginate<{ revenue: number | null }>(
      () =>
        supabase
          .from('transactions')
          .select('revenue')
          .gte('payment_date', yearStart)
          .lte('payment_date', yearEnd),
      YEAR_HARD_CAP,
    ),
    // Year-wide downloaders: cuma count
    paginate<{ count: number | null }>(
      () =>
        supabase
          .from('downloaders')
          .select('count')
          .gte('date', yearStart)
          .lte('date', yearEnd),
      YEAR_HARD_CAP,
    ),
  ]);

  // Map target_config → Target FE shape
  const targets: Target[] = (targetConfigs as Array<{
    app_name?: string;
    source_app?: string;
    target_sales?: number;
    target_downloader?: number;
    target_premium?: number;
    target_repeat_order?: number;
    target_conversion?: number;
    avg_price?: number;
    avg_price_target?: number;
    sales_target?: number;
    downloader_target?: number;
    premium_user_target?: number;
    conversion_target?: number;
  }>).map((t) => ({
    source_app: (t.app_name ?? t.source_app ?? '').toLowerCase(),
    sales_target: Number(t.target_sales ?? t.sales_target ?? 0),
    downloader_target: Number(t.target_downloader ?? t.downloader_target ?? 0),
    premium_user_target: Number(t.target_premium ?? t.target_repeat_order ?? t.premium_user_target ?? 0),
    conversion_target: Number(t.target_conversion ?? t.conversion_target ?? 0),
    avg_price_target: Number(t.avg_price ?? t.avg_price_target ?? 0),
  }));

  // Compute year totals.
  // Premium = count baris transaksi (= total_trx). Match dengan SiMarsel
  // operational sheet — 1 user beli 5x dihitung 5 premium.
  const yearTotals: YearTotals = {
    total_sales: yearTrxRaw.reduce((s, t) => s + (Number(t.revenue) || 0), 0),
    total_trx: yearTrxRaw.length,
    total_premium: yearTrxRaw.length,
    total_downloader: yearDlRaw.reduce((s, d) => s + (Number(d.count) || 0), 0),
  };

  return (
    <>
      <Header period={period} />
      <div className="max-w-screen mx-auto px-4 md:px-6 pt-4">
        <YearlyKpi year={period.year} totals={yearTotals} />
      </div>
      <DashboardClient
        initialTransactions={transactions}
        initialDownloads={downloads}
        initialTargets={targets}
        period={period}
      />
    </>
  );
}
