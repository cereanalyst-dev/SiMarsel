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
-- 2) transactions : 1 baris per line item di Excel.
--    Duplicate trx_id dibolehkan (mis. 1 transaksi beli beberapa paket).
--    Primary key synthetic UUID supaya semua baris Excel tersimpan.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid         primary key default uuid_generate_v4(),
  trx_id            text,                   -- tidak unique, bisa duplicate
  user_id           uuid         references auth.users(id) on delete set null,

  -- Kolom sesuai urutan di Excel.
  -- Pakai `timestamp` (tanpa time zone) supaya nilainya tersimpan & ditampilkan
  -- persis seperti di Excel — tidak ter-convert ke UTC.
  transaction_date  timestamp,              -- "2026-02-19 00:00:00"
  payment_date      timestamp,              -- "2026-02-19 13:37:06"
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

create index if not exists idx_transactions_trx_id        on public.transactions (trx_id);
create index if not exists idx_transactions_payment_date on public.transactions (payment_date);
create index if not exists idx_transactions_source_app   on public.transactions (source_app);
create index if not exists idx_transactions_email        on public.transactions (email);
create index if not exists idx_transactions_content_name on public.transactions (content_name);

-- Unique per line item: kombinasi (trx_id, content_name).
-- Dipakai oleh upsert(onConflict='trx_id,content_name', ignoreDuplicates=true)
-- di kode supaya "Tambah Data" tidak menggandakan baris yang sudah ada.
-- Line item berbeda (trx_id sama, content_name beda) tetap bisa coexist.
-- Note: kolom NULL di Postgres unique dianggap "tidak sama", jadi baris dengan
-- NULL akan tetap bisa masuk berulang — biasanya aman karena data real punya
-- content_name.
alter table public.transactions
  drop constraint if exists transactions_uniq_trx_content;
alter table public.transactions
  add constraint transactions_uniq_trx_content
  unique (trx_id, content_name);

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
-- 4) api_sync_state : config & status per-platform untuk auto-fetch Markaz API
--    Dipakai oleh cron Vercel (jam 12:00 & 23:59 WIB) + tombol "Fetch Sekarang"
--    di Settings. Cron jalan server-side pakai service_role key, jadi RLS
--    dibuat per-user supaya dashboard cuma lihat row miliknya sendiri.
-- ---------------------------------------------------------------------------
create table if not exists public.api_sync_state (
  id                  uuid         primary key default uuid_generate_v4(),
  user_id             uuid         not null references auth.users(id) on delete cascade,
  platform            text         not null,                  -- lowercase: jadibumn, jadipolisi, ...
  enabled             boolean      not null default true,
  last_run_at         timestamptz,                            -- kapan cron/manual fetch dijalankan
  last_synced_date    date,                                   -- TANGGAL DATA terakhir yang di-fetch (parameter date ke API)
  last_status         text,                                   -- 'success' | 'error'
  last_error          text,
  last_tx_inserted    integer      not null default 0,
  last_dl_total       integer      not null default 0,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now(),
  unique (user_id, platform)
);

-- Migration safety untuk DB yang udah ada
alter table public.api_sync_state add column if not exists last_synced_date date;

create index if not exists idx_api_sync_state_user_enabled
  on public.api_sync_state (user_id, enabled);

drop trigger if exists trg_api_sync_state_touch on public.api_sync_state;
create trigger trg_api_sync_state_touch
  before update on public.api_sync_state
  for each row execute function public.touch_updated_at();

alter table public.api_sync_state enable row level security;

drop policy if exists "api_sync_state_select_own" on public.api_sync_state;
create policy "api_sync_state_select_own"
  on public.api_sync_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "api_sync_state_insert_own" on public.api_sync_state;
create policy "api_sync_state_insert_own"
  on public.api_sync_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "api_sync_state_update_own" on public.api_sync_state;
create policy "api_sync_state_update_own"
  on public.api_sync_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "api_sync_state_delete_own" on public.api_sync_state;
create policy "api_sync_state_delete_own"
  on public.api_sync_state for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) content_scripts : skrip konten (video/carousel/single post) per platform
--    Multi-user collaboration: creator + assigned_to + status workflow.
--    Field umum di kolom; field type-specific (per video/carousel/post) di
--    JSONB `content` supaya fleksibel.
-- ---------------------------------------------------------------------------
create table if not exists public.content_scripts (
  id              uuid         primary key default uuid_generate_v4(),
  user_id         uuid         references auth.users(id) on delete set null,

  platform        text         not null,                       -- jadiasn, cerebrum, jadibumn, ...
  type            text         not null check (type in ('video', 'carousel', 'single_post')),
  scheduled_date  date,                                         -- tanggal upload yang direncanakan
  tgl_tay         date,                                         -- tanggal tayang aktual

  title           text,                                         -- judul/keyword utama
  status          text         not null default 'draft'
                  check (status in ('draft', 'review', 'approved', 'published')),
  assigned_to     text,                                         -- email user

  -- Operational fields umum
  info_skrip      text,                                         -- dropdown: progress, skrip ready, skrip urgent
  talent          text,                                         -- dropdown: analisis, take, done
  editor          text,                                         -- manual text (nama editor)
  poster          text,                                         -- URL atau deskripsi
  creative        text,                                         -- dropdown: progress, editing, done
  link_video      text,                                         -- URL hasil
  link_canva      text,                                         -- URL Canva
  cc              text,                                         -- dropdown QC: revisi, done, cancel
  upload_status   text,                                         -- DONE, PROGRESS, etc.
  link_konten     text,                                         -- URL konten final
  keterangan      text,
  catatan         text,

  -- Type-specific (JSONB)
  -- video:        { kata_kunci, ad_grup, link_contoh_video, visual_hook, hook,
  --                 tahapan_1, tahapan_2, tahapan_3, tahapan_4_cta,
  --                 footage, keterangan_skrip, caption_tiktok, caption_instagram }
  -- carousel:     { tema, slides: [{ skrip, kpt }, ...], caption }
  -- single_post:  { title_judul, sumber, image_ilustrasi, isi, cta, keterangan, caption }
  content         jsonb        not null default '{}'::jsonb,

  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create index if not exists idx_content_scripts_platform   on public.content_scripts (platform);
create index if not exists idx_content_scripts_type       on public.content_scripts (type);
create index if not exists idx_content_scripts_status     on public.content_scripts (status);
create index if not exists idx_content_scripts_scheduled  on public.content_scripts (scheduled_date);
create index if not exists idx_content_scripts_assigned   on public.content_scripts (assigned_to);

-- Migration safety: tambah kolom talent + editor kalau belum ada
-- (untuk DB yang sudah punya tabel content_scripts dari versi awal).
alter table public.content_scripts add column if not exists talent text;
alter table public.content_scripts add column if not exists editor text;

drop trigger if exists trg_content_scripts_touch on public.content_scripts;
create trigger trg_content_scripts_touch
  before update on public.content_scripts
  for each row execute function public.touch_updated_at();

alter table public.content_scripts enable row level security;

-- Multi-user collaboration: semua authenticated user bisa read & write semua
-- skrip. Workflow protection (status, assigned_to) di-enforce di app, bukan
-- DB. Cocok untuk team kecil yang saling percaya. Kalau perlu fine-grained
-- per-user lock, bisa diubah ke per-row policy.
drop policy if exists "content_scripts_read_auth" on public.content_scripts;
create policy "content_scripts_read_auth"
  on public.content_scripts for select
  to authenticated
  using (true);

drop policy if exists "content_scripts_write_auth" on public.content_scripts;
create policy "content_scripts_write_auth"
  on public.content_scripts for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 6) monthly_performance : snapshot rekap bulanan per app.
--    User upload Excel, sistem cleanse + aggregate per app, simpan
--    snapshot ini (raw transactions di Excel TIDAK disimpan).
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_performance (
  id                uuid         primary key default uuid_generate_v4(),
  user_id           uuid         not null references auth.users(id) on delete cascade,
  year_month        text         not null,                -- '2026-04'
  source_app        text         not null,                -- jadiasn, jadibumn, dll
  status_filter     text         not null default 'all',  -- 'all' / 'berhasil' / 'pending' / 'cancel'
  total_transaksi   integer      not null default 0,
  total_berhasil    integer      not null default 0,
  total_pending     integer      not null default 0,
  total_expired     integer      not null default 0,
  total_dibatalkan  integer      not null default 0,
  conversion_rate   numeric      not null default 0,      -- berhasil / total × 100
  total_sales       numeric      not null default 0,
  harga_rata_rata   numeric      not null default 0,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),
  unique (user_id, year_month, source_app, status_filter)
);

create index if not exists idx_monthly_perf_user_month
  on public.monthly_performance (user_id, year_month);

drop trigger if exists trg_monthly_perf_touch on public.monthly_performance;
create trigger trg_monthly_perf_touch
  before update on public.monthly_performance
  for each row execute function public.touch_updated_at();

alter table public.monthly_performance enable row level security;

drop policy if exists "monthly_perf_select_own" on public.monthly_performance;
create policy "monthly_perf_select_own"
  on public.monthly_performance for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "monthly_perf_write_own" on public.monthly_performance;
create policy "monthly_perf_write_own"
  on public.monthly_performance for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

-- Ringkasan bulanan per app (full history) — dipakai Asisten AI
-- untuk analisa trend long-term tanpa token blow up.
create or replace view public.transactions_monthly_by_app as
select
  to_char(date_trunc('month', payment_date), 'YYYY-MM') as year_month,
  upper(source_app)                                      as source_app,
  sum(revenue)                                           as revenue,
  count(*)                                               as transactions,
  count(distinct coalesce(email, phone, full_name, trx_id)) as unique_buyers,
  round(sum(revenue) / nullif(count(*), 0))              as aov
from public.transactions
where payment_date is not null
group by 1, 2
order by 1, 2;

-- Aggregate per paket per app (full history) — buat rekomendasi paket +
-- copy generation. AI dapat data lengkap tanpa harus baca raw transactions.
create or replace view public.packages_summary as
select
  upper(source_app)                                      as source_app,
  content_name,
  count(*)                                               as transaction_count,
  sum(revenue)                                           as total_revenue,
  round(avg(revenue))                                    as avg_price,
  min(revenue)                                           as min_price,
  max(revenue)                                           as max_price,
  to_char(min(payment_date), 'YYYY-MM-DD')               as first_sold,
  to_char(max(payment_date), 'YYYY-MM-DD')               as last_sold,
  count(distinct coalesce(email, phone, full_name, trx_id)) as unique_buyers
from public.transactions
where content_name is not null
  and content_name <> ''
  and payment_date is not null
group by upper(source_app), content_name
order by sum(revenue) desc;

-- ---------------------------------------------------------------------------
-- Overview stats — computed di server, single row hasil query.
-- Dipakai dashboard untuk skip fetch 294K rows saat load awal.
-- Kalau filter dipakai, dashboard fetch raw data dan aggregate di client
-- (karena view ini tidak accept param).
-- ---------------------------------------------------------------------------
create or replace view public.overview_stats as
with base as (
  select
    trim(coalesce(email, ''))      as email,
    trim(coalesce(trx_id, ''))     as trx_id,
    revenue
  from public.transactions
),
tx_sum as (
  select
    sum(revenue)       as total_revenue,
    count(*)           as total_transaksi,
    round(sum(revenue) / nullif(count(*), 0)) as aov
  from public.transactions
),
unique_buyer as (
  select count(distinct email) as unique_buyers
  from base where email <> ''
),
repeat_order as (
  select count(*) as user_repeat_order
  from (
    select email from base
    where email <> '' and trx_id <> ''
    group by email
    having count(distinct trx_id) >= 2
  ) t
),
dl_sum as (
  select coalesce(sum(count), 0) as total_downloader
  from public.downloaders
)
select
  t.total_revenue,
  t.total_transaksi,
  t.aov,
  u.unique_buyers,
  r.user_repeat_order,
  d.total_downloader,
  case
    when d.total_downloader > 0
      then round((t.total_transaksi::numeric / d.total_downloader) * 10000) / 100
    else 0
  end as konversi_pct
from tx_sum t, unique_buyer u, repeat_order r, dl_sum d;
