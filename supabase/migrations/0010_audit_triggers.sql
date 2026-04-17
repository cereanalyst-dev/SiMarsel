-- Generic audit trigger: captures INSERT / UPDATE / DELETE with the calling user's
-- identity (pulled from profiles) and the diff of changed columns for UPDATEs.
create or replace function public.audit_trigger_function()
returns trigger as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_user_id uuid;
  v_user_email text;
  v_user_role user_role;
begin
  v_user_id := auth.uid();

  select email, role into v_user_email, v_user_role
  from public.profiles where id = v_user_id;

  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    insert into public.audit_logs(table_name, record_id, action, old_data, user_id, user_email, user_role)
    values (tg_table_name, old.id, 'DELETE', v_old, v_user_id, v_user_email, v_user_role);
    return old;

  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(key) into v_changed
    from jsonb_each(v_new)
    where v_new -> key is distinct from v_old -> key;

    if array_length(v_changed, 1) > 0 then
      insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email, user_role)
      values (tg_table_name, new.id, 'UPDATE', v_old, v_new, v_changed, v_user_id, v_user_email, v_user_role);
    end if;
    return new;

  elsif (tg_op = 'INSERT') then
    v_new := to_jsonb(new);
    insert into public.audit_logs(table_name, record_id, action, new_data, user_id, user_email, user_role)
    values (tg_table_name, new.id, 'INSERT', v_new, v_user_id, v_user_email, v_user_role);
    return new;
  end if;

  return null;
end;
$$ language plpgsql security definer;

create trigger audit_target_configs
  after insert or update or delete on public.target_configs
  for each row execute function public.audit_trigger_function();

create trigger audit_daily_data
  after insert or update or delete on public.daily_data
  for each row execute function public.audit_trigger_function();

create trigger audit_social_media
  after insert or update or delete on public.social_media_contents
  for each row execute function public.audit_trigger_function();

create trigger audit_apps
  after insert or update or delete on public.apps
  for each row execute function public.audit_trigger_function();
