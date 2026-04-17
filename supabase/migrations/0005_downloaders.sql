create table public.downloaders (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  source_app text not null,
  count int not null default 0,
  year int generated always as (extract(year from date)) stored,
  month int generated always as (extract(month from date)) stored,
  year_month text generated always as (to_char(date, 'YYYY-MM')) stored,
  created_at timestamptz default now(),
  imported_by uuid references public.profiles(id),
  import_batch_id uuid,
  unique(date, source_app)
);

create index idx_dl_date on public.downloaders(date);
create index idx_dl_source_app on public.downloaders(source_app);
