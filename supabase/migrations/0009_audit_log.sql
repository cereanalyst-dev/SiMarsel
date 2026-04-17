create type audit_action as enum ('INSERT', 'UPDATE', 'DELETE');

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid not null,
  action audit_action not null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid references public.profiles(id),
  user_email text,
  user_role user_role,
  created_at timestamptz default now()
);

create index idx_audit_table on public.audit_logs(table_name);
create index idx_audit_record on public.audit_logs(record_id);
create index idx_audit_user on public.audit_logs(user_id);
create index idx_audit_created on public.audit_logs(created_at desc);
