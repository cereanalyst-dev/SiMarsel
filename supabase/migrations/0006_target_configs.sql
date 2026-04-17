create table public.target_configs (
  id uuid primary key default uuid_generate_v4(),
  app_id uuid not null references public.apps(id) on delete cascade,
  target_month text not null,
  target_downloader int default 0,
  target_user_premium int default 0,
  target_sales bigint default 0,
  target_conversion numeric(5,2) default 0,
  avg_price bigint default 0,
  is_target_set boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id),
  unique(app_id, target_month)
);

create index idx_target_month on public.target_configs(target_month);
create index idx_target_app on public.target_configs(app_id);
