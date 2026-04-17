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
