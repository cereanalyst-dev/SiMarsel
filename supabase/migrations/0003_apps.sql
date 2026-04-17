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
