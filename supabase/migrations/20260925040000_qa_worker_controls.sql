-- QA only: pause is a cooperative request, never a process termination.
alter table public.worker_registry add column if not exists control_revision uuid not null default gen_random_uuid();
alter table public.worker_registry alter column enabled set default false;
create table if not exists public.qa_worker_control_receipts (
  request_id uuid primary key, actor_id uuid not null references auth.users(id) on delete cascade,
  request jsonb not null, response jsonb not null, created_at timestamptz not null default now()
);
alter table public.qa_worker_control_receipts enable row level security;
revoke all on public.qa_worker_control_receipts from public,anon,authenticated;

create or replace function public.qa_guard_worker_control() returns trigger
language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.enabled is distinct from false then raise exception 'Worker enabling is blocked until an isolated QA destination is verified'; end if;
    new.control_revision:=gen_random_uuid();
  else
    if new.worker_id is distinct from old.worker_id then raise exception 'Worker identity cannot be changed'; end if;
    if new.enabled is distinct from old.enabled then
      if new.enabled is distinct from false then raise exception 'Worker enabling is blocked until an isolated QA destination is verified'; end if;
      new.control_revision:=gen_random_uuid();
    else
      -- Heartbeats do not invalidate a pending pause request.
      new.control_revision:=old.control_revision;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists qa_guard_worker_control on public.worker_registry;
create trigger qa_guard_worker_control before insert or update on public.worker_registry
  for each row execute function public.qa_guard_worker_control();

create or replace function public.qa_workers_page(p_after text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rows jsonb;
begin
  perform public.qa_product_admin_access();
  select coalesce(jsonb_agg(to_jsonb(w) order by worker_id collate "C"),'[]') into rows
    from (select * from public.worker_registry where p_after is null or worker_id collate "C">p_after collate "C"
      order by worker_id collate "C" limit 200) w;
  return rows;
end $$;

create or replace function public.qa_worker_pause(p_request_id uuid,p_worker_id text,p_revision uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare req jsonb; receipt public.qa_worker_control_receipts%rowtype; worker public.worker_registry%rowtype; result jsonb;
begin
  perform public.qa_product_admin_access();
  if p_request_id is null or p_revision is null or length(coalesce(p_worker_id,'')) not between 1 and 200 then raise exception 'Invalid worker pause request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qa-worker-request:'||p_request_id::text,0));
  req:=jsonb_build_object('workerId',p_worker_id,'revision',p_revision);
  select * into receipt from public.qa_worker_control_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id<>auth.uid() or receipt.request<>req then raise exception 'Worker request identity conflicts'; end if;
    return receipt.response;
  end if;
  select * into worker from public.worker_registry where worker_id=p_worker_id for update;
  if not found then raise exception 'Worker is unavailable. Refresh and review.'; end if;
  if worker.control_revision<>p_revision then raise exception 'Worker control changed. Refresh and review.'; end if;
  update public.worker_registry set enabled=false where worker_id=p_worker_id returning * into worker;
  result:=jsonb_build_object('requestId',p_request_id,'workerId',p_worker_id,'revision',worker.control_revision,
    'enabled',false,'dispatchEnabled',false,'operation','pause','acknowledgedAt',clock_timestamp());
  insert into public.admin_audit_log(actor_id,action,meta) values(auth.uid(),'qa_worker_pause',
    jsonb_build_object('requestId',p_request_id,'workerId',p_worker_id,'revision',worker.control_revision));
  insert into public.qa_worker_control_receipts(request_id,actor_id,request,response) values(p_request_id,auth.uid(),req,result);
  return result;
end $$;

-- No legacy anon or authenticated writer may bypass the pause-only RPC.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='worker_registry' loop
    execute format('drop policy %I on public.worker_registry',p.policyname);
  end loop;
end $$;
alter table public.worker_registry enable row level security;
revoke all on public.worker_registry from public,anon,authenticated;
grant select on public.worker_registry to authenticated;
create policy qa_workers_read on public.worker_registry for select to authenticated using (
  exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password)
);
revoke all on function public.qa_guard_worker_control(),public.qa_workers_page(text),public.qa_worker_pause(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.qa_workers_page(text),public.qa_worker_pause(uuid,text,uuid) to authenticated;
