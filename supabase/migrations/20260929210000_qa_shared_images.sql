-- Shared Producer is opt-in by runtime protocol. Secrets never enter readable runs.
alter table public.qa_private_workers add column image_protocol integer not null default 0 check(image_protocol in(0,1));
alter table public.qa_private_workers drop constraint qa_shared_product;
alter table public.qa_private_workers add constraint qa_shared_product check
 ((scope='private' and product_id is null) or (scope='shared' and product_id='qa-sample-astrorekha'));
create table public.qa_shared_image_jobs (
 id uuid primary key references public.qa_image_runs(id) on delete cascade,
 protocol integer not null default 1 check(protocol=1),
 task_id text not null check(task_id ~ '^[a-zA-Z0-9_-]+$'),
 list_id text not null default '1301130000002447' check(list_id='1301130000002447'),
 sealed_token text not null,
 expires_at timestamptz not null default now()+interval '7 days',
 stage text not null default 'queued',
 started jsonb not null default '[]',
 outputs jsonb not null default '[]',
 intents jsonb not null default '{}',
 receipts jsonb not null default '{}',
 comment_started boolean not null default false,
 comment_id text,
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now()
);
alter table public.qa_shared_image_jobs enable row level security;
revoke all on public.qa_shared_image_jobs from public,anon,authenticated;
grant all on public.qa_shared_image_jobs to service_role;

create function public.qa_shared_image_ready(p_available boolean) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
 if w.scope<>'shared' or w.recovery_protocol<>2 then raise exception 'Shared recovery contract required';end if;
 update public.qa_private_workers set image_protocol=1,generation_available=p_available where id=w.id;
 return 1;
end$$;
revoke all on function public.qa_shared_image_ready(boolean) from public;
grant execute on function public.qa_shared_image_ready(boolean) to anon,authenticated;

create function public.qa_shared_producer_heartbeat(p_codex boolean,p_claude boolean,p_classifier boolean,p_images boolean) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_shared_runtime_heartbeat(p_codex,p_claude,p_classifier);
 return public.qa_shared_image_ready(p_images);
end$$;
revoke all on function public.qa_shared_producer_heartbeat(boolean,boolean,boolean,boolean) from public;
grant execute on function public.qa_shared_producer_heartbeat(boolean,boolean,boolean,boolean) to anon,authenticated;

create function public.qa_image_workers_list(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'scope',w.scope,'enabled',w.enabled,
 'heartbeat_at',w.heartbeat_at,'generation_available',w.enabled and w.generation_available,'image_protocol',w.image_protocol,
 'delivery_public_key',w.delivery_public_key) order by w.created_at)
 from public.qa_private_workers w where public.qa_worker_job_access(w,auth.uid(),p_product_id)),'[]');
end$$;
revoke all on function public.qa_image_workers_list(text) from public,anon;
grant execute on function public.qa_image_workers_list(text) to authenticated;

create function pg_temp.image_replace(body text,old text,replacement text) returns text language plpgsql as $$
begin
 if strpos(body,old)=0 then raise exception 'Shared Producer contract changed: %',old;end if;
 return replace(body,old,replacement);
end$$;
do $$ declare body text;begin
 -- Old binaries cannot claim, expire or complete a shared generation.
 body:=pg_get_functiondef('public.qa_private_image_claim()'::regprocedure);
 body:=pg_temp.image_replace(body,'if not w.enabled','if w.scope<>''private'' then return null;end if; if not w.enabled');execute body;
 body:=pg_get_functiondef('public.qa_private_image_finish(uuid,uuid,jsonb,text)'::regprocedure);
 body:=pg_temp.image_replace(body,'select * into r','if w.scope<>''private'' then raise exception ''Shared Producer checkpoint required'';end if; select * into r');execute body;
 -- A rollback must not retain a capability it cannot execute.
 body:=pg_get_functiondef('public.qa_private_runtime_heartbeat(boolean,boolean,boolean)'::regprocedure);
 body:=pg_temp.image_replace(body,'recovery_protocol=1','recovery_protocol=1,image_protocol=0');execute body;
end$$;

-- Only the enqueue wrapper can select shared routing. The transaction setting is
-- not an HTTP header, and is cleared before returning. Existing private RPC stays private.
create or replace function public.qa_private_image_worker() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; chosen text:=current_setting('immuvi.shared_image_worker',true);
begin
 if nullif(chosen,'') is not null then
  select id into target from public.qa_private_workers w where id::text=chosen and scope='shared'
   and product_id='qa-sample-astrorekha' and enabled and image_protocol=1
   and public.qa_worker_product_access(auth.uid(),product_id);
 else
  select id into target from public.qa_private_workers where owner_id=auth.uid() and scope='private'
   and enabled and generation_available and heartbeat_at>now()-interval '45 seconds' order by heartbeat_at desc,id limit 1;
 end if;
 if target is null then raise exception 'Selected image worker is unavailable';end if;
 return target;
end$$;

create function public.qa_shared_image_enqueue(p_request_id uuid,p_product_id text,p_ad_id text,p_options jsonb,p_worker_id uuid,p_sealed_token text,p_task_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.qa_image_runs; w public.qa_private_workers; a public.ads;
begin
 perform public.qa_tracker_access(p_product_id);
 if p_product_id<>'qa-sample-astrorekha' or not exists(select 1 from public.products where id=p_product_id and config->>'clickup_list_id'='1301130000002447') then raise exception 'Shared QA destination changed';end if;
 select * into w from public.qa_private_workers where id=p_worker_id and scope='shared' and product_id=p_product_id and enabled and image_protocol=1
 and (generation_available or heartbeat_at is null or heartbeat_at<now()-interval '45 seconds');
 if not found then raise exception 'Shared image worker is not enabled';end if;
 if p_sealed_token is null or length(p_sealed_token) not between 100 and 2000 then raise exception 'Encrypted ClickUp authorization required';end if;
 select * into a from public.ads where id=p_ad_id and product_id=p_product_id for update;
 if not found or coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),a.meta->>'clickupTaskId') is distinct from p_task_id then raise exception 'Task mapping changed';end if;
 select * into r from public.qa_image_runs where id=p_request_id;
 if found then
  if r.requested_by<>auth.uid() or r.private_worker_id<>w.id or r.ad_id<>p_ad_id or r.product_id<>p_product_id then raise exception 'Request identity conflict';end if;
  return jsonb_build_object('id',r.id,'status',r.status);
 end if;
 perform set_config('immuvi.shared_image_worker',w.id::text,true);
 r:=public.qa_generate_images(p_request_id,p_product_id,p_ad_id,p_options);
 perform set_config('immuvi.shared_image_worker','',true);
 update public.qa_image_runs set request=request||jsonb_build_object('memoryMarkdown',coalesce((select markdown from public.strategist_memory where product_id=p_product_id limit 1),'')) where id=r.id;
 insert into public.qa_shared_image_jobs(id,task_id,sealed_token) values(r.id,p_task_id,p_sealed_token);
 return jsonb_build_object('id',r.id,'status',r.status);
end$$;
revoke all on function public.qa_shared_image_enqueue(uuid,text,text,jsonb,uuid,text,text) from public,anon;
grant execute on function public.qa_shared_image_enqueue(uuid,text,text,jsonb,uuid,text,text) to authenticated;

create function public.qa_shared_image_retry(p_id uuid,p_product_id text,p_ad_id text,p_worker_id uuid,p_sealed_token text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.qa_image_runs;w public.qa_private_workers;
begin
 perform public.qa_tracker_access(p_product_id);
 select * into r from public.qa_image_runs where id=p_id and product_id=p_product_id and ad_id=p_ad_id
 and private_worker_id=p_worker_id and requested_by=auth.uid() for update;
 if not found then raise exception 'Only the requester may resume this shared run' using errcode='42501';end if;
 select * into w from public.qa_private_workers where id=p_worker_id and scope='shared' and enabled and image_protocol=1;
 if not found then raise exception 'Original shared Producer is unavailable';end if;
 if r.status in('pending','running','done') then return jsonb_build_object('id',r.id,'status',r.status);end if;
 if p_sealed_token is null or length(p_sealed_token) not between 100 and 2000 then raise exception 'Encrypted ClickUp authorization required';end if;
 update public.qa_shared_image_jobs set sealed_token=p_sealed_token,expires_at=now()+interval '7 days',attempts=0,next_attempt_at=now(),stage='recovering' where id=r.id;
 if not found or not public.qa_shared_image_allowed(r,w) then raise exception 'Producer destination or access changed';end if;
 update public.qa_image_runs set status='pending',error=null,finished_at=null,lease_id=null,lease_until=null where id=r.id;
 return jsonb_build_object('id',r.id,'status','pending');
end$$;
revoke all on function public.qa_shared_image_retry(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.qa_shared_image_retry(uuid,text,text,uuid,text) to authenticated;

create function public.qa_shared_image_allowed(r public.qa_image_runs,w public.qa_private_workers) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select w.scope='shared' and w.enabled and w.image_protocol=1 and r.private_worker_id=w.id
 and r.product_id=w.product_id and public.qa_worker_product_access(r.requested_by,r.product_id)
 and exists(select 1 from public.qa_shared_image_jobs j join public.ads a on a.id=r.ad_id and a.product_id=r.product_id
 join public.products p on p.id=r.product_id where j.id=r.id and j.expires_at>now() and j.sealed_token<>''
 and p.config->>'clickup_list_id'=j.list_id and a.deleted_at is null
 and not coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false)
 and coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),a.meta->>'clickupTaskId')=j.task_id
 and not exists(select 1 from public.deleted_ads where product_id=r.product_id and (id=r.ad_id or clickup_task_id=j.task_id)))
$$;
revoke all on function public.qa_shared_image_allowed(public.qa_image_runs,public.qa_private_workers) from public,anon,authenticated;

create function public.qa_shared_image_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();r public.qa_image_runs;j public.qa_shared_image_jobs;
begin
 if w.scope<>'shared' or not w.enabled or w.image_protocol<>1 or not w.generation_available or w.heartbeat_at is null or w.heartbeat_at<now()-interval '45 seconds' then return null;end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 for r in select q.* from public.qa_image_runs q join public.qa_shared_image_jobs x on x.id=q.id
 where q.private_worker_id=w.id and q.status in('pending','running') and (q.status='pending' or q.lease_until<now()) for update of q loop
  select * into j from public.qa_shared_image_jobs where id=r.id;
  if not public.qa_shared_image_allowed(r,w) or j.attempts>=5 then
   update public.qa_image_runs set status='failed',error='Producer needs review: authorization, destination or retry limit changed.',finished_at=now(),lease_id=null where id=r.id;
   update public.qa_shared_image_jobs set sealed_token='',stage='needs_attention' where id=r.id;
  elsif r.status='running' then
   update public.qa_image_runs set status='pending',lease_id=null where id=r.id;
   update public.qa_shared_image_jobs set stage='recovering',next_attempt_at=now()+interval '30 seconds' where id=r.id;
  end if;
 end loop;
 if exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') or
 exists(select 1 from public.qa_private_inspiration_jobs where worker_id=w.id and status='running') then return null;end if;
 select q.* into r from public.qa_image_runs q join public.qa_shared_image_jobs x on x.id=q.id
 where q.private_worker_id=w.id and q.status='pending' and x.next_attempt_at<=now() and public.qa_shared_image_allowed(q,w)
 order by q.created_at,q.id for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.qa_image_runs set status='running',started_at=coalesce(started_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',error=null where id=r.id returning * into r;
 update public.qa_shared_image_jobs set attempts=attempts+1 where id=r.id returning * into j;
 return to_jsonb(r)||jsonb_build_object('delivery',to_jsonb(j));
end$$;
revoke all on function public.qa_shared_image_claim() from public;
grant execute on function public.qa_shared_image_claim() to anon,authenticated;

create function public.qa_shared_image_checkpoint(p_id uuid,p_lease uuid,p_stage text,p_value jsonb default '{}') returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();r public.qa_image_runs;j public.qa_shared_image_jobs;n integer;k text; prior jsonb;
begin
 select * into r from public.qa_image_runs where id=p_id and private_worker_id=w.id and lease_id=p_lease for update;
 if not found or w.scope<>'shared' then raise exception 'Producer lease denied' using errcode='42501';end if;
 if r.status='done' and p_stage='complete' then return 'done';end if;
 if r.status<>'running' or r.lease_until<=now() or not public.qa_shared_image_allowed(r,w) then raise exception 'Producer lease or authorization expired' using errcode='42501';end if;
 select * into j from public.qa_shared_image_jobs where id=r.id for update;
 if octet_length(p_value::text)>200000 then raise exception 'Producer checkpoint too large';end if;
 if p_stage in('generation-start','output','attachment-start','attachment') then
  n:=(p_value->>'variation')::integer;k:=n::text;
  if n is null or n<1 or n>(r.request->'options'->>'count')::integer then raise exception 'Invalid variation';end if;
 end if;
 if p_stage='heartbeat' then null;
 elsif p_stage='generation-start' then
  if j.started @> jsonb_build_array(n) then raise exception 'Generation already started; recover saved output';end if;
  if n>1 and not j.receipts ? (n-1)::text then raise exception 'Previous variation is not delivered';end if;
  j.started:=j.started||jsonb_build_array(n);
 elsif p_stage='output' then
  if not j.started @> jsonb_build_array(n) or p_value->>'path' is distinct from r.id||'/'||n||'.png'
   or p_value->>'bucket' is distinct from 'qa-producer-images' or coalesce(p_value->>'sha256','') !~ '^[a-f0-9]{64}$'
   or not exists(select 1 from storage.objects where bucket_id='qa-producer-images' and name=p_value->>'path') then raise exception 'Invalid saved image';end if;
  select value into prior from jsonb_array_elements(j.outputs) where (value->>'variation')::integer=n;
  if prior is not null and prior<>p_value then raise exception 'Saved output changed';end if;
  if prior is null then
   if jsonb_array_length(j.outputs)<>n-1 then raise exception 'Images must be ordered';end if;
   j.outputs:=j.outputs||jsonb_build_array(p_value);
  end if;
 elsif p_stage='attachment-start' then
  if jsonb_array_length(j.outputs)<n then raise exception 'Image not saved';end if;
  if j.intents ? k then raise exception 'Attachment outcome uncertain; reconcile first';end if;
  j.intents:=jsonb_set(j.intents,array[k],p_value);
 elsif p_stage='attachment' then
  if not j.intents ? k or coalesce(p_value->>'id','')='' or coalesce(p_value->>'url','') !~ '^https://' then raise exception 'Invalid attachment receipt';end if;
  -- Signed attachment URLs may rotate; the verified attachment identity cannot.
  if j.receipts ? k and j.receipts->k->>'id' is distinct from p_value->>'id' then raise exception 'Attachment receipt changed';end if;
  j.receipts:=jsonb_set(j.receipts,array[k],p_value);
 elsif p_stage='comment-start' then
  if j.comment_started then raise exception 'Comment outcome uncertain; reconcile first';end if;
  if (select count(*) from jsonb_object_keys(j.receipts))<>(r.request->'options'->>'count')::integer then raise exception 'Attachments incomplete';end if;
  j.comment_started:=true;
 elsif p_stage='comment' then
  if not j.comment_started or coalesce(p_value->>'id','')='' or j.comment_id is not null and j.comment_id<>p_value->>'id' then raise exception 'Invalid comment receipt';end if;
  j.comment_id:=p_value->>'id';
 elsif p_stage='complete' then
  if j.comment_id is null or (select count(*) from jsonb_object_keys(j.receipts))<>(r.request->'options'->>'count')::integer
   or p_value->>'status' is distinct from 'Ready to Launch' then raise exception 'Delivery incomplete';end if;
  update public.qa_image_runs set status='done',outputs=(select jsonb_agg(o || (j.receipts->(o->>'variation')) order by (o->>'variation')::integer) from jsonb_array_elements(j.outputs) o),finished_at=now(),error=null where id=r.id;
  update public.ads set status='Ready to Launch',last_status_change_at=(extract(epoch from now())*1000)::bigint,
   meta=coalesce(meta,'{}')||jsonb_build_object('lastStatusChangeAt',(extract(epoch from now())*1000)::bigint)
   where id=r.ad_id and product_id=r.product_id;
  j.sealed_token:='';
 elsif p_stage='retry' then
  if j.attempts>=5 then raise exception 'Retry limit reached';end if;
  update public.qa_image_runs set status='pending',lease_id=null,lease_until=null where id=r.id;
  j.next_attempt_at:=now()+make_interval(secs=>case j.attempts when 1 then 30 when 2 then 120 when 3 then 600 else 1800 end);
 elsif p_stage='failed' then
  update public.qa_image_runs set status='failed',error=left(p_value->>'error',700),finished_at=now() where id=r.id;
  j.sealed_token:='';
 else raise exception 'Unknown Producer checkpoint';end if;
 update public.qa_shared_image_jobs set started=j.started,outputs=j.outputs,intents=j.intents,receipts=j.receipts,
 comment_started=j.comment_started,comment_id=j.comment_id,sealed_token=j.sealed_token,next_attempt_at=j.next_attempt_at,
 stage=case when p_stage='heartbeat' then stage else p_stage end where id=r.id;
 update public.qa_image_runs set lease_until=now()+interval '2 minutes' where id=r.id and status='running';
 return case when p_stage='complete' then 'done' else p_stage end;
end$$;
revoke all on function public.qa_shared_image_checkpoint(uuid,uuid,text,jsonb) from public;
grant execute on function public.qa_shared_image_checkpoint(uuid,uuid,text,jsonb) to anon,authenticated;

-- Shared objects are readable only by the assigned device's live lease. Private
-- storage policy remains owner-only. No device receives a service role key.
create function public.qa_shared_image_storage(p_bucket text,p_name text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers;h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
begin
 if p_bucket<>'qa-producer-images' or p_name !~ '^[a-f0-9-]{36}/([1-9]|10)\.png$' or not h ? 'x-immuvi-worker-token' then return false;end if;
 w:=public.qa_private_worker_identity();
 return exists(select 1 from public.qa_image_runs r where r.id::text=split_part(p_name,'/',1) and r.status='running'
 and r.lease_id::text=h->>'x-immuvi-worker-lease' and r.lease_until>now() and public.qa_shared_image_allowed(r,w)
 and split_part(split_part(p_name,'/',2),'.',1)::integer<=(r.request->'options'->>'count')::integer);
end$$;
revoke all on function public.qa_shared_image_storage(text,text) from public;
grant execute on function public.qa_shared_image_storage(text,text) to anon,authenticated;
create policy qa_shared_image_insert on storage.objects for insert to anon,authenticated with check(public.qa_shared_image_storage(bucket_id,name));
create policy qa_shared_image_read on storage.objects for select to anon,authenticated using(public.qa_shared_image_storage(bucket_id,name));
