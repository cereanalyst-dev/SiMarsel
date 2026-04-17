create table public.daily_data (
  id uuid primary key default uuid_generate_v4(),
  app_id uuid not null references public.apps(id) on delete cascade,
  date date not null,

  target_downloader int default 0,
  target_sales bigint default 0,
  target_user_premium int default 0,
  manual_target_downloader int,
  manual_target_sales bigint,
  manual_target_premium int,

  actual_downloader int,
  actual_sales bigint,
  actual_user_premium int,

  estimasi_harga bigint default 0,
  channel text,
  promo text,
  premium text,
  benefit text,
  benefit2 text,
  event text,
  activity text,
  extra text,
  bcan text,
  story text,
  chat text,
  live text,
  ads text,
  daily_insight text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id),
  unique(app_id, date)
);

create index idx_daily_date on public.daily_data(date);
create index idx_daily_app on public.daily_data(app_id);
create index idx_daily_app_date on public.daily_data(app_id, date);
