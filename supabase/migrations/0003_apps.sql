-- Source applications (JADIASN, JADIBUMN, etc.)
create table public.apps (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  display_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

create index idx_apps_name on public.apps(name);

-- Seed default app list (idempotent)
insert into public.apps (name, display_name) values
  ('JADIASN', 'ASN'),
  ('JADIBUMN', 'BUMN'),
  ('JADIPOLRI', 'POLRI'),
  ('JADIPPPK', 'PPPK'),
  ('JADITNI', 'TNI'),
  ('JADICPNS', 'CPNS'),
  ('CEREBRUM', 'CEREBRUM')
on conflict (name) do nothing;
