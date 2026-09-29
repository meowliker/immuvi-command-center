-- QA-only durable reload requests. No broadcast is sent by installing this migration.
create table if not exists public.qa_force_reloads (
  id uuid primary key,
  actor_id uuid references auth.users(id) on delete set null,
  triggered_by text not null,
  triggered_at timestamptz not null default clock_timestamp()
);
alter table public.qa_force_reloads enable row level security;
revoke all on public.qa_force_reloads from public,anon,authenticated;
grant select on public.qa_force_reloads to authenticated;
drop policy if exists qa_reload_read on public.qa_force_reloads;
create policy qa_reload_read on public.qa_force_reloads for select to authenticated using (
  exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password)
);
create or replace function public.qa_reload_state() returns jsonb
language plpgsql security definer set search_path=public as $$
declare latest jsonb; observed_at timestamptz:=clock_timestamp();
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password) then raise exception 'Active account required'; end if;
  select to_jsonb(r) into latest from public.qa_force_reloads r order by triggered_at desc,id desc limit 1;
  return jsonb_build_object('latest',latest,'serverNow',observed_at);
end $$;
create or replace function public.qa_request_reload(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare entry public.qa_force_reloads%rowtype; actor text;
begin
  perform public.qa_product_admin_access();
  if p_request_id is null then raise exception 'Request ID required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qa-reload',0));
  select * into entry from public.qa_force_reloads where id=p_request_id;
  if found then
    if entry.actor_id<>auth.uid() then raise exception 'Reload request identity conflicts'; end if;
    return to_jsonb(entry);
  end if;
  if exists(select 1 from public.qa_force_reloads where triggered_at>clock_timestamp()-interval '30 seconds') then raise exception 'A team reload was recently requested. Wait before retrying.'; end if;
  select coalesce(nullif(username,''),nullif(full_name,''),email,'Admin') into actor from public.profiles where id=auth.uid();
  insert into public.qa_force_reloads(id,actor_id,triggered_by) values(p_request_id,auth.uid(),actor) returning * into entry;
  insert into public.admin_audit_log(actor_id,action,meta) values(auth.uid(),'qa_force_reload',jsonb_build_object('requestId',p_request_id));
  return to_jsonb(entry);
end $$;
revoke all on function public.qa_reload_state(),public.qa_request_reload(uuid) from public,anon,authenticated;
grant execute on function public.qa_reload_state(),public.qa_request_reload(uuid) to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.qa_force_reloads;
exception when duplicate_object then null;
end $$;
