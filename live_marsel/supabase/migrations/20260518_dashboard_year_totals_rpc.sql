-- ============================================================
-- RPC: dashboard_year_totals(year_param int)
-- Pre-aggregate totals tahunan untuk YearlyKpi card di Live Dashboard.
-- Aman dipanggil dengan anon key (SECURITY INVOKER + RLS public read aktif).
-- ============================================================

create or replace function public.dashboard_year_totals(year_param int)
returns table (
  total_sales bigint,
  total_trx bigint,
  total_premium bigint,
  total_downloader bigint
)
language sql
stable
as $$
  with tx as (
    select revenue, email
    from public.transactions
    where extract(year from coalesce(transaction_date, payment_date, created_at::date)) = year_param
  ),
  dl as (
    select count
    from public.downloaders
    where extract(year from date) = year_param
  )
  select
    (select coalesce(sum(revenue), 0)::bigint from tx) as total_sales,
    (select count(*)::bigint from tx) as total_trx,
    (select count(distinct lower(trim(email)))::bigint from tx where email is not null and trim(email) <> '') as total_premium,
    (select coalesce(sum(count), 0)::bigint from dl) as total_downloader;
$$;

-- Grant execute to anon (public read pattern di SiMarsel)
grant execute on function public.dashboard_year_totals(int) to anon, authenticated;
