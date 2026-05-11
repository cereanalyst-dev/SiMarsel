-- ============================================================
-- Migration 2026-05-12
-- Auto-create user_roles row saat user baru sign up.
-- Role & full_name diambil dari options.data di signUp.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'staf');
  v_full_name := new.raw_user_meta_data->>'full_name';

  -- Validasi role; kalau invalid fallback ke 'staf'
  if v_role not in ('admin', 'manager', 'asst_manager', 'staf') then
    v_role := 'staf';
  end if;

  insert into public.user_roles (user_id, role, full_name)
  values (new.id, v_role, v_full_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Backfill: bikin user_roles untuk user existing yang belum punya row.
-- Default role = 'staf'. Admin tinggal upgrade via Manajemen Role.
-- ============================================================
insert into public.user_roles (user_id, role, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'staf') as role,
  u.raw_user_meta_data->>'full_name' as full_name
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null;
