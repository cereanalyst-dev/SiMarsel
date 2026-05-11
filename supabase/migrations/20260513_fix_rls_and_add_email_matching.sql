-- ============================================================
-- Migration 2026-05-13
-- 1. Fix infinite recursion di RLS user_roles
-- 2. Tambah kolom email di user_roles untuk matching
-- 3. Update trigger handle_new_user untuk simpan email juga
-- 4. Backfill email dari auth.users
-- ============================================================

-- --------------------------------------------------------------
-- 1. Fix RLS recursion
-- --------------------------------------------------------------
drop policy if exists user_roles_admin_write on public.user_roles;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create policy user_roles_admin_write
  on public.user_roles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read
  on public.user_roles for select
  using (auth.uid() is not null);

-- --------------------------------------------------------------
-- 2. Add email column
-- --------------------------------------------------------------
alter table public.user_roles
  add column if not exists email text;

create index if not exists idx_user_roles_email
  on public.user_roles (lower(email));

-- --------------------------------------------------------------
-- 3. Update trigger handle_new_user untuk simpan email
-- --------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'staf');
  if v_role not in ('admin', 'manager', 'asst_manager', 'staf') then
    v_role := 'staf';
  end if;

  insert into public.user_roles (user_id, role, full_name, email)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'full_name',
    new.email
  )
  on conflict (user_id) do update set
    email = excluded.email;

  return new;
end;
$$;

-- --------------------------------------------------------------
-- 4. Backfill email untuk user_roles existing
-- --------------------------------------------------------------
update public.user_roles ur
set email = u.email
from auth.users u
where u.id = ur.user_id and (ur.email is null or ur.email = '');
