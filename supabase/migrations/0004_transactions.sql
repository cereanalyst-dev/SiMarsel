create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  trx_id text not null,
  transaction_date date,
  payment_date date not null,
  source_app text not null,
  methode_name text,
  revenue bigint not null default 0,
  promo_code text,
  content_name text,
  full_name text,
  email text,
  phone text,
  payment_status text,
  year int generated always as (extract(year from payment_date)) stored,
  month int generated always as (extract(month from payment_date)) stored,
  year_month text generated always as (to_char(payment_date, 'YYYY-MM')) stored,
  created_at timestamptz default now(),
  imported_by uuid references public.profiles(id),
  import_batch_id uuid,
  unique(trx_id, source_app)
);

create index idx_trx_payment_date on public.transactions(payment_date);
create index idx_trx_source_app on public.transactions(source_app);
create index idx_trx_year_month on public.transactions(year_month);
create index idx_trx_content_name on public.transactions(content_name);
