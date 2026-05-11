-- ============================================================
-- Migration 2026-05-11
-- 1. Tambah kolom due_time di tasks (deadline jam)
-- 2. Buat tabel user_roles untuk role-based access (manager/asst/staf/admin)
-- ============================================================

-- --------------------------------------------------------------
-- 1. due_time di tasks
-- --------------------------------------------------------------
alter table public.tasks
  add column if not exists due_time time;

comment on column public.tasks.due_time is
  'Jam deadline (HH:MM, 24h). Null = sepanjang hari.';

-- --------------------------------------------------------------
-- 2. user_roles — role per user
--    Hierarchy: admin > manager > asst_manager > staf
-- --------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid         primary key references auth.users(id) on delete cascade,
  role        text         not null default 'staf'
              check (role in ('admin', 'manager', 'asst_manager', 'staf')),
  full_name   text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists idx_user_roles_role on public.user_roles (role);

drop trigger if exists trg_user_roles_touch on public.user_roles;
create trigger trg_user_roles_touch
  before update on public.user_roles
  for each row execute function public.touch_updated_at();

alter table public.user_roles enable row level security;

-- Semua authenticated user bisa baca semua role (untuk tampilan assignment)
drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read
  on public.user_roles for select
  using (auth.uid() is not null);

-- Hanya admin yang bisa insert/update/delete role
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write
  on public.user_roles for all
  using (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'admin'
    )
  );

-- User bisa lihat & edit row sendiri (kecuali field role)
drop policy if exists user_roles_self on public.user_roles;
create policy user_roles_self
  on public.user_roles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- CARA SET ADMIN PERTAMA KALI:
--   1. Login sebagai user yang mau jadi admin
--   2. Jalankan di SQL editor (sebagai postgres / service_role):
--      insert into public.user_roles (user_id, role, full_name)
--      values ('<UUID_USER>', 'admin', '<Nama>')
--      on conflict (user_id) do update set role = 'admin';
-- ============================================================
