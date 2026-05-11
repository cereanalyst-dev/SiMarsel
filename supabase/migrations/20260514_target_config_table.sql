-- ============================================================
-- Migration 2026-05-14
-- Tabel target_config — penyimpanan target bulanan per app yang mudah
-- di-query. Saat ini juga di-mirror di apps_snapshot.apps[].targetConfig
-- (JSONB) untuk kompatibilitas UI; tabel ini cuma untuk inspeksi DB.
-- ============================================================

create table if not exists public.target_config (
  id                  uuid         primary key default uuid_generate_v4(),
  user_id             uuid         references auth.users(id) on delete cascade,
  app_name            text         not null,
  year_month          text         not null,   -- 'YYYY-MM'
  target_downloader   integer      not null default 0,
  target_sales        numeric      not null default 0,
  target_premium integer      not null default 0,
  target_conversion   numeric      not null default 0,
  avg_price           numeric      not null default 0,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now(),
  unique (user_id, app_name, year_month)
);

create index if not exists idx_target_config_user_app
  on public.target_config (user_id, app_name);
create index if not exists idx_target_config_year_month
  on public.target_config (year_month);

drop trigger if exists trg_target_config_touch on public.target_config;
create trigger trg_target_config_touch
  before update on public.target_config
  for each row execute function public.touch_updated_at();

alter table public.target_config enable row level security;

-- User bisa lihat semua target (collaborative)
drop policy if exists target_config_read on public.target_config;
create policy target_config_read
  on public.target_config for select
  using (auth.uid() is not null);

-- User bisa insert/update/delete row sendiri
drop policy if exists target_config_write on public.target_config;
create policy target_config_write
  on public.target_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Backfill: extract dari apps_snapshot.apps[].targetConfig (JSONB)
-- ============================================================
insert into public.target_config (
  user_id, app_name, year_month,
  target_downloader, target_sales, target_premium,
  target_conversion, avg_price
)
select
  s.user_id,
  (app->>'name') as app_name,
  tc.key as year_month,
  coalesce((tc.value->>'targetDownloader')::integer, 0),
  coalesce((tc.value->>'targetSales')::numeric, 0),
  coalesce((tc.value->>'targetRepeatOrder')::integer, 0),
  coalesce((tc.value->>'targetConversion')::numeric, 0),
  coalesce((tc.value->>'avgPrice')::numeric, 0)
from public.apps_snapshot s,
     jsonb_array_elements(s.apps) as app,
     jsonb_each(coalesce(app->'targetConfig', '{}'::jsonb)) as tc
where app->>'name' is not null
on conflict (user_id, app_name, year_month) do update set
  target_downloader   = excluded.target_downloader,
  target_sales        = excluded.target_sales,
  target_premium = excluded.target_premium,
  target_conversion   = excluded.target_conversion,
  avg_price           = excluded.avg_price;
