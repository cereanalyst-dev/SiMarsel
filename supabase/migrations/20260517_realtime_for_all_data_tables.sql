-- ============================================================
-- Migration 2026-05-17
-- Enable Realtime untuk SISA tabel data: transactions, downloaders,
-- insight_hasil, content_scripts, promo_code_rules, monthly_performance.
-- Setelah ini, semua perubahan dari n8n / user lain langsung tampil di UI.
-- ============================================================

-- Set replica identity FULL
alter table public.transactions          replica identity full;
alter table public.downloaders           replica identity full;
alter table public.insight_hasil         replica identity full;
alter table public.content_scripts       replica identity full;
alter table public.promo_code_rules      replica identity full;
alter table public.monthly_performance   replica identity full;

-- Tambah ke publication
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'transactions',
      'downloaders',
      'insight_hasil',
      'content_scripts',
      'promo_code_rules',
      'monthly_performance'
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
