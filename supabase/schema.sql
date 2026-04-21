-- SiMarsel Supabase schema
-- Run this in the Supabase SQL editor.
-- Assumes a single tenant or small team where every authenticated user can
-- see all data. Adjust the RLS policies if you need per-user isolation.

-- ---------- extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- apps_snapshot ----------
-- Holds the operational state (targets, dailyData, socialContent) as a single
-- JSONB document per user so the dashboard can persist plans across devices.
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
end; $$;

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

drop policy if exists "apps_snapshot_upsert_own" on public.apps_snapshot;
create policy "apps_snapshot_upsert_own"
  on public.apps_snapshot for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "apps_snapshot_update_own" on public.apps_snapshot;
create policy "apps_snapshot_update_own"
  on public.apps_snapshot for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- transactions ----------
create table if not exists public.transactions (
  trx_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  source_app text,
  methode_name text,
  content_name text,
  promo_code text,
  full_name text,
  email text,
  phone text,
  payment_status text,
  revenue numeric not null default 0,
  transaction_date text,
  payment_date timestamptz,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_transactions_payment_date on public.transactions (payment_date);
create index if not exists idx_transactions_source_app on public.transactions (source_app);

alter table public.transactions enable row level security;

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

-- ---------- downloaders ----------
create table if not exists public.downloaders (
  date date not null,
  source_app text not null,
  count integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  primary key (date, source_app)
);

create index if not exists idx_downloaders_date on public.downloaders (date);

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
