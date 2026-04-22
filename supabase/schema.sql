-- ===========================================================================
-- SiMarsel Supabase Schema
-- ===========================================================================
-- Kolom-kolom di sini disesuaikan dengan format file Excel yang di-upload user:
--
--   • transactions : match 1:1 kolom di sheet TRANSAKSI
--       transaction_date | payment_date | trx_id | source_app | methode_name |
--       revenue | promo_code | content_name | full_name | email | phone |
--       payment_status
--
--   • downloaders : Excel sheet DOWNLOADER pakai format WIDE
--       (Tanggal | CEREBRUM | JADIASN | JADIBUMN | JADIPOLISI | dst.)
--     Di database kita simpan dalam format LONG supaya fleksibel menambah app
--     baru tanpa perlu ALTER TABLE:
--       (date, source_app, count)
--     Konversi wide → long terjadi otomatis di kode saat upload. User cukup
--     upload Excel apa adanya.
--
-- Jalankan file ini sekali di Supabase SQL Editor → Run.
-- ===========================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1) apps_snapshot : operational state per-user (targets, dailyData, socialContent)
-- ---------------------------------------------------------------------------
create table if not exists public.apps_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  apps jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_apps_snapshot_touch on public.apps_snapshot;
create trigger trg_apps_snapshot_touch
  before update on public.apps_snapshot
  for each row execute function public.touch_updated_at();

alter table public.apps_snapshot enable row level security;

drop policy if exists "apps_snapshot_select_own" on public.apps_snapshot;
create policy "apps_snapshot_select_own"
  on public.apps_snapshot for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "apps_snapshot_insert_own" on public.apps_snapshot;
create policy "apps_snapshot_insert_own"
  on public.apps_snapshot for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "apps_snapshot_update_own" on public.apps_snapshot;
create policy "apps_snapshot_update_own"
  on public.apps_snapshot for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2) transactions : 1 baris per transaksi (pkey = trx_id agar upsert idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  trx_id            text         primary key,
  user_id           uuid         references auth.users(id) on delete set null,

  -- Kolom sesuai urutan di Excel
  transaction_date  text,                   -- dari Excel apa adanya ("2026-02-19 00:00:00")
  payment_date      timestamptz,            -- canonical (sudah di-parse jadi timestamp)
  source_app        text,                   -- mis. "jadibumn", "jadipolisi", "cerebrum"
  methode_name      text,                   -- mis. "DANA", "Indomaret", "QRIS"
  revenue           numeric      not null default 0,
  promo_code        text,                   -- bisa NULL
  content_name      text,                   -- nama paket / produk
  full_name         text,
  email             text,
  phone             text,                   -- disimpan text karena angka telepon besar
  payment_status    text,                   -- mis. "paid", "pending"

  uploaded_at       timestamptz  not null default now()
);

create index if not exists idx_transactions_payment_date on public.transactions (payment_date);
create index if not exists idx_transactions_source_app   on public.transactions (source_app);
create index if not exists idx_transactions_email        on public.transactions (email);
create index if not exists idx_transactions_content_name on public.transactions (content_name);

alter table public.transactions enable row level security;

-- Siapapun yang sudah login boleh baca & tulis transaksi (single-org).
-- Ubah ke RLS per-user kalau mau multi-tenant.
drop policy if exists "transactions_read_auth" on public.transactions;
create policy "transactions_read_auth"
  on public.transactions for select
  to authenticated
  using (true);

drop policy if exists "transactions_write_auth" on public.transactions;
create policy "transactions_write_auth"
  on public.transactions for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 3) downloaders : format LONG (date, source_app, count) — wide→long terjadi di app
-- ---------------------------------------------------------------------------
create table if not exists public.downloaders (
  date         date         not null,         -- dari kolom "Tanggal"
  source_app   text         not null,         -- nama kolom di Excel (CEREBRUM, JADIASN, ...)
  count        integer      not null default 0,
  user_id      uuid         references auth.users(id) on delete set null,
  uploaded_at  timestamptz  not null default now(),
  primary key (date, source_app)
);

create index if not exists idx_downloaders_date       on public.downloaders (date);
create index if not exists idx_downloaders_source_app on public.downloaders (source_app);

alter table public.downloaders enable row level security;

drop policy if exists "downloaders_read_auth" on public.downloaders;
create policy "downloaders_read_auth"
  on public.downloaders for select
  to authenticated
  using (true);

drop policy if exists "downloaders_write_auth" on public.downloaders;
create policy "downloaders_write_auth"
  on public.downloaders for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Helper views (opsional — membantu eksplorasi di SQL editor)
-- ---------------------------------------------------------------------------

-- Downloader kembali ke format WIDE (1 baris per tanggal) untuk preview cepat.
create or replace view public.downloaders_wide as
select
  date,
  sum(case when source_app = 'CEREBRUM'      then count end) as cerebrum,
  sum(case when source_app = 'JADIASN'       then count end) as jadiasn,
  sum(case when source_app = 'JADIBUMN'      then count end) as jadibumn,
  sum(case when source_app = 'JADIPOLISI'    then count end) as jadipolisi,
  sum(case when source_app = 'JADIPRAJURIT'  then count end) as jadiprajurit,
  sum(case when source_app = 'JADIBEASISWA'  then count end) as jadibeasiswa,
  sum(case when source_app = 'JADISEKDIN'    then count end) as jadisekdin,
  sum(count)                                                 as total
from public.downloaders
group by date
order by date;

-- Ringkasan harian (revenue + jumlah transaksi + unique buyer per app)
create or replace view public.transactions_daily_by_app as
select
  date_trunc('day', payment_date)::date as date,
  upper(source_app)                     as source_app,
  sum(revenue)                          as revenue,
  count(*)                              as transactions,
  count(distinct coalesce(email, phone, full_name, trx_id)) as unique_buyers
from public.transactions
where payment_date is not null
group by 1, 2
order by 1 desc, 2;
