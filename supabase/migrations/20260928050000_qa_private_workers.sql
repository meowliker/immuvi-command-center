-- Private devices are separate from the legacy shared/Auto pool. Device credentials
-- have no table access: the RPCs below expose only the paired owner's assigned jobs.
create table public.qa_private_workers (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 100),
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  heartbeat_at timestamptz,
  generation_available boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.qa_private_workers enable row level security;
revoke all on public.qa_private_workers from public,anon,authenticated;
grant all on public.qa_private_workers to service_role;
alter table public.qa_image_runs add column private_worker_id uuid references public.qa_private_workers(id);
alter table public.qa_image_runs add column lease_id uuid;
alter table public.qa_image_runs add column lease_until timestamptz;
create index qa_private_image_queue on public.qa_image_runs(private_worker_id,created_at) where status='pending';

create function public.qa_private_worker_identity() returns public.qa_private_workers
language plpgsql security definer set search_path=public,pg_temp as $$
declare h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'); w public.qa_private_workers;
begin
  if length(coalesce(h->>'x-immuvi-worker-token',''))<>64 then raise exception 'Invalid worker credential' using errcode='42501'; end if;
  select * into w from public.qa_private_workers where id::text=h->>'x-immuvi-worker-id'
    and token_hash=encode(sha256(convert_to(h->>'x-immuvi-worker-token','UTF8')),'hex');
  if not found or not exists(select 1 from public.profiles where id=w.owner_id and is_active and not must_change_password)
    then raise exception 'Invalid worker credential' using errcode='42501'; end if;
  return w;
end $$;
revoke all on function public.qa_private_worker_identity() from public,anon,authenticated;

create function public.qa_private_workers_list() returns jsonb
language sql security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'enabled',w.enabled,
    'heartbeat_at',w.heartbeat_at,'generation_available',w.enabled and w.generation_available) order by w.created_at),'[]')
  from public.qa_private_workers w where w.owner_id=auth.uid()
    and exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password)
$$;
revoke all on function public.qa_private_workers_list() from public,anon;
grant execute on function public.qa_private_workers_list() to authenticated;

create function public.qa_private_worker_set_enabled(p_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.qa_private_workers set enabled=p_enabled where id=p_id and owner_id=auth.uid()
    and exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password);
  if not found then raise exception 'Worker is not owned by your account' using errcode='42501'; end if;
end $$;
revoke all on function public.qa_private_worker_set_enabled(uuid,boolean) from public,anon;
grant execute on function public.qa_private_worker_set_enabled(uuid,boolean) to authenticated;

create function public.qa_private_worker_heartbeat(p_available boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
  update public.qa_private_workers set heartbeat_at=now(),generation_available=p_available where id=w.id;
  return jsonb_build_object('enabled',w.enabled,'ownerId',w.owner_id,'workerId',w.id);
end $$;
revoke all on function public.qa_private_worker_heartbeat(boolean) from public;
grant execute on function public.qa_private_worker_heartbeat(boolean) to anon,authenticated;

-- Keep all existing creative/options validation; replace only the shared-worker
-- gate with the private owner lookup and bind the inserted job in the trigger.
create function public.qa_private_image_worker() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid;
begin
  select id into target from public.qa_private_workers where owner_id=auth.uid() and enabled and generation_available
    and heartbeat_at>now()-interval '45 seconds' order by heartbeat_at desc,id limit 1;
  if target is null then raise exception 'Your private image worker is offline or paused'; end if;
  return target;
end $$;
revoke all on function public.qa_private_image_worker() from public,anon,authenticated;

do $$
declare definition text; old_gate text:='if not exists(select 1 from public.qa_image_worker where id=''local-native'' and generation_available and heartbeat_at>now()-interval ''45 seconds'') then raise exception ''Native image worker is offline. Start the QA image worker first.''; end if;';
begin
  definition:=pg_get_functiondef('public.qa_generate_images(uuid,text,text,jsonb)'::regprocedure);
  if strpos(definition,old_gate)=0 then raise exception 'Image generation contract changed; review the private-worker migration'; end if;
  execute replace(definition,old_gate,'perform public.qa_private_image_worker();');
end $$;

create function public.qa_private_image_bind() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.role()='authenticated' then
    if new.requested_by<>auth.uid() then raise exception 'Requester identity mismatch' using errcode='42501'; end if;
    new.private_worker_id:=public.qa_private_image_worker();
  end if;
  return new;
end $$;
revoke all on function public.qa_private_image_bind() from public,anon,authenticated;
create trigger qa_private_image_bind before insert on public.qa_image_runs for each row execute function public.qa_private_image_bind();

create function public.qa_private_image_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); r public.qa_image_runs;
begin
  if not w.enabled or not w.generation_available or w.heartbeat_at<now()-interval '45 seconds' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
  -- An expired generation is failed, never replayed (generation may cost money).
  update public.qa_image_runs set status='failed',error='Worker interrupted. Review this run before generating again.',finished_at=now()
    where private_worker_id=w.id and requested_by=w.owner_id and status='running' and lease_until<now();
  if exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null; end if;
  update public.qa_image_runs job set status='failed',error='Requester no longer has product access.',finished_at=now()
    where private_worker_id=w.id and requested_by=w.owner_id and status='pending'
    and not exists(select 1 from public.profiles p where p.id=w.owner_id and (p.role='admin' or exists(select 1 from public.user_products u where u.user_id=w.owner_id and u.product_id=job.product_id)));
  select * into r from public.qa_image_runs where private_worker_id=w.id and requested_by=w.owner_id and status='pending'
    order by created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.qa_image_runs set status='running',started_at=now(),lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    where id=r.id returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.qa_private_image_claim() from public;
grant execute on function public.qa_private_image_claim() to anon,authenticated;

create function public.qa_private_image_renew(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
  update public.qa_image_runs set lease_until=now()+interval '2 minutes'
    where id=p_id and private_worker_id=w.id and requested_by=w.owner_id and status='running'
    and lease_id=p_lease and lease_until>now();
  return found;
end $$;
revoke all on function public.qa_private_image_renew(uuid,uuid) from public;
grant execute on function public.qa_private_image_renew(uuid,uuid) to anon,authenticated;

create function public.qa_private_image_upload(p_bucket text,p_name text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers; h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
begin
  if p_bucket<>'qa-producer-images' or p_name !~ '^[a-f0-9-]{36}/([1-9]|10)\.png$' or not h ? 'x-immuvi-worker-token' then return false; end if;
  w:=public.qa_private_worker_identity();
  return exists(select 1 from public.qa_image_runs r where r.id::text=split_part(p_name,'/',1)
    and r.private_worker_id=w.id and r.requested_by=w.owner_id and r.status='running' and r.lease_until>now()
    and r.lease_id::text=h->>'x-immuvi-worker-lease'
    and split_part(split_part(p_name,'/',2),'.',1)::integer<=(r.request->'options'->>'count')::integer);
end $$;
revoke all on function public.qa_private_image_upload(text,text) from public;
grant execute on function public.qa_private_image_upload(text,text) to anon,authenticated;
create policy qa_private_image_upload on storage.objects for insert to anon,authenticated
  with check(public.qa_private_image_upload(bucket_id,name));

create function public.qa_private_image_finish(p_id uuid,p_lease uuid,p_outputs jsonb,p_error text default null) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); r public.qa_image_runs; o jsonb; n integer:=0;
begin
  select * into r from public.qa_image_runs where id=p_id and private_worker_id=w.id and requested_by=w.owner_id and lease_id=p_lease for update;
  if not found then raise exception 'Worker job access denied' using errcode='42501'; end if;
  if r.status in ('done','failed') then return r.status; end if;
  if r.status<>'running' or r.lease_until<=now() then raise exception 'Job lease expired'; end if;
  if p_error is null then
    if jsonb_typeof(p_outputs) is distinct from 'array' or jsonb_array_length(p_outputs)<>(r.request->'options'->>'count')::integer
      or octet_length(p_outputs::text)>200000 then raise exception 'Invalid image outputs'; end if;
    for o in select value from jsonb_array_elements(p_outputs) loop
      n:=n+1;
      if o->>'path' is distinct from r.id||'/'||n||'.png' or o->>'bucket' is distinct from 'qa-producer-images'
        or not exists(select 1 from storage.objects where bucket_id='qa-producer-images' and name=o->>'path') then raise exception 'Image upload is missing'; end if;
    end loop;
  end if;
  update public.qa_image_runs set status=case when p_error is null then 'done' else 'failed' end,
    outputs=case when p_error is null then p_outputs else '[]'::jsonb end,error=left(p_error,700),finished_at=now() where id=r.id returning * into r;
  return r.status;
end $$;
revoke all on function public.qa_private_image_finish(uuid,uuid,jsonb,text) from public;
grant execute on function public.qa_private_image_finish(uuid,uuid,jsonb,text) to anon,authenticated;
