-- SiMarsel all-in-one setup SQL
-- Generated from supabase/migrations/0001..0012 + seed apps
-- Paste ENTIRE file into Supabase SQL Editor -> Run


-- ============================================
-- supabase/migrations/0001_extensions.sql
-- ============================================
-- Enable required PostgreSQL extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- supabase/migrations/0002_profiles_and_roles.sql
-- ============================================
-- User roles and profiles (extends Supabase auth.users)
create type user_role as enum ('admin', 'marketing', 'sales');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'sales',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile row whenever a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'sales')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- supabase/migrations/0003_apps.sql
-- ============================================
-- Source applications (matches the app columns in the real downloader sheet)
create table public.apps (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  display_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

create index idx_apps_name on public.apps(name);

-- Seed default app list (idempotent). Names match the uppercase column
-- headers in the production downloader sheet.
insert into public.apps (name, display_name) values
  ('CEREBRUM', 'Cerebrum'),
  ('JADIASN', 'ASN'),
  ('JADIBUMN', 'BUMN'),
  ('JADIPOLISI', 'Polisi'),
  ('JADIPRAJURIT', 'Prajurit'),
  ('JADIBEASISWA', 'Beasiswa'),
  ('JADISEKDIN', 'Sekdin')
on conflict (name) do nothing;

-- ============================================
-- supabase/migrations/0004_transactions.sql
-- ============================================
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

-- ============================================
-- supabase/migrations/0005_downloaders.sql
-- ============================================
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

-- ============================================
-- supabase/migrations/0006_target_configs.sql
-- ============================================
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

-- ============================================
-- supabase/migrations/0007_daily_data.sql
-- ============================================
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

-- ============================================
-- supabase/migrations/0008_social_media_contents.sql
-- ============================================
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

-- ============================================
-- supabase/migrations/0009_audit_log.sql
-- ============================================
create type audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid not null,
  action audit_action not null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid references public.profiles(id),
  user_email text,
  user_role user_role,
  created_at timestamptz default now()
);

create index idx_audit_table on public.audit_logs(table_name);
create index idx_audit_record on public.audit_logs(record_id);
create index idx_audit_user on public.audit_logs(user_id);
create index idx_audit_created on public.audit_logs(created_at desc);

-- ============================================
-- supabase/migrations/0010_audit_triggers.sql
-- ============================================
-- Generic audit trigger: captures INSERT / UPDATE / DELETE with the calling user's
-- identity (pulled from profiles) and the diff of changed columns for UPDATEs.
create or replace function public.audit_trigger_function()
returns trigger as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_user_id uuid;
  v_user_email text;
  v_user_role user_role;
begin
  v_user_id := auth.uid();

  select email, role into v_user_email, v_user_role
  from public.profiles where id = v_user_id;

  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    insert into public.audit_logs(table_name, record_id, action, old_data, user_id, user_email, user_role)
    values (tg_table_name, old.id, 'DELETE', v_old, v_user_id, v_user_email, v_user_role);
    return old;

  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(key) into v_changed
    from jsonb_each(v_new)
    where v_new -> key is distinct from v_old -> key;

    if array_length(v_changed, 1) > 0 then
      insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email, user_role)
      values (tg_table_name, new.id, 'UPDATE', v_old, v_new, v_changed, v_user_id, v_user_email, v_user_role);
    end if;
    return new;

  elsif (tg_op = 'INSERT') then
    v_new := to_jsonb(new);
    insert into public.audit_logs(table_name, record_id, action, new_data, user_id, user_email, user_role)
    values (tg_table_name, new.id, 'INSERT', v_new, v_user_id, v_user_email, v_user_role);
    return new;
  end if;

  return null;
end;
$$ language plpgsql security definer;

create trigger audit_target_configs
  after insert or update or delete on public.target_configs
  for each row execute function public.audit_trigger_function();

create trigger audit_daily_data
  after insert or update or delete on public.daily_data
  for each row execute function public.audit_trigger_function();

create trigger audit_social_media
  after insert or update or delete on public.social_media_contents
  for each row execute function public.audit_trigger_function();

create trigger audit_apps
  after insert or update or delete on public.apps
  for each row execute function public.audit_trigger_function();

-- ============================================
-- supabase/migrations/0011_updated_at_triggers.sql
-- ============================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_target_configs_updated_at before update on public.target_configs
  for each row execute function public.set_updated_at();
create trigger set_daily_data_updated_at before update on public.daily_data
  for each row execute function public.set_updated_at();
create trigger set_social_media_updated_at before update on public.social_media_contents
  for each row execute function public.set_updated_at();

-- ============================================
-- supabase/migrations/0012_rls_policies.sql
-- ============================================
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.transactions enable row level security;
alter table public.downloaders enable row level security;
alter table public.target_configs enable row level security;
alter table public.daily_data enable row level security;
alter table public.social_media_contents enable row level security;
alter table public.audit_logs enable row level security;

-- Role-check helper functions (security definer so they bypass RLS when reading profiles).
create or replace function public.current_user_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.is_admin()
returns boolean as $$
  select public.current_user_role() = 'admin';
$$ language sql security definer stable;

create or replace function public.is_marketing_or_admin()
returns boolean as $$
  select public.current_user_role() in ('admin', 'marketing');
$$ language sql security definer stable;

-- profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin());
create policy "Only admin can delete profile" on public.profiles
  for delete using (public.is_admin());

-- apps
create policy "All authenticated can view apps" on public.apps
  for select using (auth.role() = 'authenticated');
create policy "Marketing/admin can insert apps" on public.apps
  for insert with check (public.is_marketing_or_admin());
create policy "Marketing/admin can update apps" on public.apps
  for update using (public.is_marketing_or_admin());
create policy "Admin can delete apps" on public.apps
  for delete using (public.is_admin());

-- transactions
create policy "All authenticated can view transactions" on public.transactions
  for select using (auth.role() = 'authenticated');
create policy "Marketing/admin can insert transactions" on public.transactions
  for insert with check (public.is_marketing_or_admin());
create policy "Admin can update transactions" on public.transactions
  for update using (public.is_admin());
create policy "Admin can delete transactions" on public.transactions
  for delete using (public.is_admin());

-- downloaders
create policy "All authenticated can view downloaders" on public.downloaders
  for select using (auth.role() = 'authenticated');
create policy "Marketing/admin can insert downloaders" on public.downloaders
  for insert with check (public.is_marketing_or_admin());
create policy "Admin can update downloaders" on public.downloaders
  for update using (public.is_admin());
create policy "Admin can delete downloaders" on public.downloaders
  for delete using (public.is_admin());

-- target_configs
create policy "All authenticated can view target_configs" on public.target_configs
  for select using (auth.role() = 'authenticated');
create policy "Marketing/admin can insert target_configs" on public.target_configs
  for insert with check (public.is_marketing_or_admin());
create policy "Marketing/admin can update target_configs" on public.target_configs
  for update using (public.is_marketing_or_admin());
create policy "Admin can delete target_configs" on public.target_configs
  for delete using (public.is_admin());

-- daily_data (collaborative: all roles may read/write, only admin may delete)
create policy "All authenticated can view daily_data" on public.daily_data
  for select using (auth.role() = 'authenticated');
create policy "All authenticated can insert daily_data" on public.daily_data
  for insert with check (auth.role() = 'authenticated');
create policy "All authenticated can update daily_data" on public.daily_data
  for update using (auth.role() = 'authenticated');
create policy "Admin can delete daily_data" on public.daily_data
  for delete using (public.is_admin());

-- social_media_contents
create policy "All authenticated can view social_media_contents" on public.social_media_contents
  for select using (auth.role() = 'authenticated');
create policy "Marketing/admin can insert social_media_contents" on public.social_media_contents
  for insert with check (public.is_marketing_or_admin());
create policy "Marketing/admin can update social_media_contents" on public.social_media_contents
  for update using (public.is_marketing_or_admin());
create policy "Admin can delete social_media_contents" on public.social_media_contents
  for delete using (public.is_admin());

-- audit_logs (admin-only read; inserts come from trigger in a security definer context)
create policy "Only admin can view audit logs" on public.audit_logs
  for select using (public.is_admin());

-- ============================================
-- Seed apps
-- ============================================
insert into public.apps (name) values
  ('JADIASN'), ('JADIBUMN'), ('JADIPOLRI'),
  ('JADIPPPK'), ('JADITNI'),  ('JADICPNS'),
  ('CEREBRUM')
on conflict (name) do nothing;
