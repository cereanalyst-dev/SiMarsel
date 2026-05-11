-- ============================================================
-- Migration 2026-05-15
-- Rename kolom target_repeat_order → target_premium di target_config.
-- Semantik: jumlah user yang beli (user premium) per bulan per app.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'target_config'
      and column_name = 'target_repeat_order'
  ) then
    alter table public.target_config rename column target_repeat_order to target_premium;
  end if;
end $$;
