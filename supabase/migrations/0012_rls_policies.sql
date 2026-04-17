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
