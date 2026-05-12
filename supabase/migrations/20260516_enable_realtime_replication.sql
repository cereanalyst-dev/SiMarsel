-- ============================================================
-- Migration 2026-05-16
-- Enable Supabase Realtime untuk tabel kolaboratif.
-- Setelah ini, frontend bisa subscribe via supabase.channel() dan
-- dapat notifikasi WebSocket setiap kali row di-INSERT/UPDATE/DELETE.
-- ============================================================

-- Set replica identity ke FULL — Realtime butuh ini supaya event
-- DELETE membawa old row data (bukan cuma id).
alter table public.tasks            replica identity full;
alter table public.apps_snapshot    replica identity full;
alter table public.kpi_divisions    replica identity full;
alter table public.kpi_cards        replica identity full;
alter table public.kpi_metrics      replica identity full;
alter table public.target_config    replica identity full;
alter table public.user_roles       replica identity full;

-- Tambah tabel ke publication 'supabase_realtime' supaya event di-broadcast.
-- Idempotent: cek dulu, kalau belum ada baru tambah.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'tasks',
      'apps_snapshot',
      'kpi_divisions',
      'kpi_cards',
      'kpi_metrics',
      'target_config',
      'user_roles'
    ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
