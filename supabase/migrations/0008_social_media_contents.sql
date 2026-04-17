create table public.social_media_contents (
  id uuid primary key default uuid_generate_v4(),
  daily_data_id uuid not null references public.daily_data(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  date date not null,

  platform text not null,
  posting_time time,
  content_type text,
  title text,
  caption text,
  cta text,
  topic text,
  objective text,
  link text,

  reach int default 0,
  engagement int default 0,
  views int default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id)
);

create index idx_social_daily on public.social_media_contents(daily_data_id);
create index idx_social_date on public.social_media_contents(date);
create index idx_social_platform on public.social_media_contents(platform);
