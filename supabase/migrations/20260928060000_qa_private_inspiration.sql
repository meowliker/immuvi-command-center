alter table public.qa_private_workers add column codex_active boolean not null default false;
alter table public.qa_private_workers add column claude_active boolean not null default false;
alter table public.qa_private_workers add column classifier_available boolean not null default false;
alter table public.qa_private_workers add column delivery_public_key text;
create sequence public.qa_test_brief_number;
revoke all on sequence public.qa_test_brief_number from public,anon,authenticated;
create table public.qa_private_inspiration_jobs (
 id uuid primary key,
 product_id text not null references public.products(id) on delete cascade,
 inspiration_id text not null references public.inspirations(id) on delete cascade,
 requested_by uuid not null references auth.users(id),
 worker_id uuid not null references public.qa_private_workers(id),
 status text not null default 'pending' check(status in ('pending','running','done','failed')),
 source_url text not null,
 source_version timestamptz not null,
 context jsonb not null,
 sealed_clickup_token text not null,
 brief_number bigint not null default nextval('public.qa_test_brief_number'),
 lease_id uuid,
 lease_until timestamptz,
 result jsonb,
 doc_id text,
 page_id text,
 delivery_started boolean not null default false,
 error text,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create unique index qa_private_inspiration_active on public.qa_private_inspiration_jobs(product_id,inspiration_id) where status in ('pending','running');
alter table public.qa_private_inspiration_jobs enable row level security;
revoke all on public.qa_private_inspiration_jobs from public,anon,authenticated;
grant all on public.qa_private_inspiration_jobs to service_role;

create or replace function public.qa_private_workers_list() returns jsonb
language sql security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'enabled',w.enabled,'heartbeat_at',w.heartbeat_at,
 'generation_available',w.enabled and w.generation_available,'codex_active',w.codex_active,'claude_active',w.claude_active,
 'classifier_available',w.enabled and w.classifier_available,'delivery_public_key',w.delivery_public_key) order by w.created_at),'[]')
 from public.qa_private_workers w where w.owner_id=auth.uid()
 and exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password)
$$;
create function public.qa_private_runtime_heartbeat(p_codex boolean,p_claude boolean,p_classifier boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
 update public.qa_private_workers set codex_active=p_codex,claude_active=p_claude,
 classifier_available=p_classifier and (p_codex or p_claude),heartbeat_at=now() where id=w.id;
end $$;
revoke all on function public.qa_private_runtime_heartbeat(boolean,boolean,boolean) from public;
grant execute on function public.qa_private_runtime_heartbeat(boolean,boolean,boolean) to anon,authenticated;

create function public.qa_private_inspiration_enqueue(p_request_id uuid,p_product_id text,p_id text,p_worker_id uuid,p_sealed_token text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers; i public.inspirations; j public.qa_private_inspiration_jobs; p public.products; snapshot jsonb;
begin
 perform public.qa_tracker_access(p_product_id);
 select * into j from public.qa_private_inspiration_jobs where id=p_request_id;
 if found then
   if j.requested_by<>auth.uid() or j.product_id<>p_product_id or j.inspiration_id<>p_id or j.worker_id<>p_worker_id then raise exception 'Request identity conflict'; end if;
   return jsonb_build_object('id',j.id,'status',j.status,'inspirationId',j.inspiration_id);
 end if;
 select * into w from public.qa_private_workers where id=p_worker_id and owner_id=auth.uid() and enabled and classifier_available
 and heartbeat_at>now()-interval '45 seconds' and delivery_public_key is not null;
 if not found then raise exception 'Your private classifier is offline or unavailable'; end if;
 if p_sealed_token is null or length(p_sealed_token)<>512 or p_sealed_token !~ '^[A-Za-z0-9+/=]+$' then raise exception 'Invalid sealed delivery credential'; end if;
 select * into p from public.products where id=p_product_id for share;
 if coalesce(p.config->>'clickup_list_id','')<>'1301130000002447' then raise exception 'Only the approved ClickUp test list is allowed'; end if;
 select * into i from public.inspirations where id=p_id and product_id=p_product_id for update;
 if not found or i.data->>'_qaCreatedBy' is distinct from auth.uid()::text then raise exception 'Only your own QA inspirations can use your private worker'; end if;
 if i.data->>'_clickupDocPageUrl' is not null or exists(select 1 from public.inspiration_results where product_id=p_product_id and ins_id=p_id)
 then raise exception 'This inspiration already has a result; open it instead of regenerating'; end if;
 if exists(select 1 from public.qa_private_inspiration_jobs where product_id=p_product_id and inspiration_id=p_id and (delivery_started or result is not null))
 then raise exception 'Saved generation or delivery requires recovery, not a new generation'; end if;
 snapshot:=jsonb_build_object('product',jsonb_build_object('id',p.id,'name',p.name,'production',p.config->'production'),
   'angles',coalesce((select jsonb_agg(name order by name) from public.angles where product_id=p_product_id and archived_at is null),'[]'),
   'personas',coalesce((select jsonb_agg(name order by name) from public.personas where product_id=p_product_id and archived_at is null),'[]'),
   'platform',i.platform,'listId','1301130000002447');
 insert into public.qa_private_inspiration_jobs(id,product_id,inspiration_id,requested_by,worker_id,source_url,source_version,context,sealed_clickup_token)
 values(p_request_id,p_product_id,p_id,auth.uid(),w.id,i.url,i.updated_at,snapshot,p_sealed_token) returning * into j;
 -- The legacy queue is a display mirror only. It is never pending/claimable by a legacy worker.
 update public.inspiration_queue set status='blocked',worker_assignment='private:'||w.id,error_message='Queued on your private worker',queued_at=now()
 where product_id=p_product_id and ins_id=p_id;
 return jsonb_build_object('id',j.id,'status',j.status,'inspirationId',j.inspiration_id);
end $$;
revoke all on function public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text) to authenticated;

create function public.qa_private_inspiration_status(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'inspiration_id',inspiration_id,'status',status,'error',error,'created_at',created_at,'finished_at',finished_at,'doc_id',doc_id,'page_id',page_id) order by created_at desc)
 from public.qa_private_inspiration_jobs where product_id=p_product_id and requested_by=auth.uid()),'[]');
end $$;
revoke all on function public.qa_private_inspiration_status(text) from public,anon;
grant execute on function public.qa_private_inspiration_status(text) to authenticated;

create function public.qa_private_inspiration_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs;
begin
 if not w.enabled or not w.classifier_available or w.heartbeat_at<now()-interval '45 seconds' then return null; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 update public.qa_private_inspiration_jobs set status='failed',error='Worker interrupted; saved results and delivery receipts retained for review.',finished_at=now()
 where worker_id=w.id and requested_by=w.owner_id and status='running' and lease_until<now();
 if exists(select 1 from public.qa_private_inspiration_jobs where worker_id=w.id and status='running')
 or exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null; end if;
 select * into j from public.qa_private_inspiration_jobs job where worker_id=w.id and requested_by=w.owner_id and status='pending'
 and exists(select 1 from public.profiles p where p.id=w.owner_id and (p.role='admin' or exists(select 1 from public.user_products u where u.user_id=w.owner_id and u.product_id=job.product_id)))
 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.qa_private_inspiration_jobs set status='running',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.qa_private_inspiration_claim() from public;
grant execute on function public.qa_private_inspiration_claim() to anon,authenticated;

create function public.qa_private_inspiration_checkpoint(p_id uuid,p_lease uuid,p_stage text,p_value jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs; r public.inspiration_results; i public.inspirations; imported jsonb; url text;
begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and worker_id=w.id and requested_by=w.owner_id and lease_id=p_lease for update;
 if not found then raise exception 'Worker job access denied' using errcode='42501'; end if;
 if j.status='done' then return jsonb_build_object('status','done'); end if;
 if j.status<>'running' or j.lease_until<=now() then raise exception 'Job lease expired'; end if;
 if p_stage not in ('heartbeat','failed') and not exists(select 1 from public.products where id=j.product_id and config->>'clickup_list_id'='1301130000002447') then raise exception 'Product destination changed'; end if;
 if p_stage='heartbeat' then
   update public.qa_private_inspiration_jobs set lease_until=now()+interval '2 minutes' where id=j.id;
 elsif p_stage='result' then
   r:=jsonb_populate_record(null::public.inspiration_results,p_value);
   imported:=public.qa_inspiration_import_data(r);
   if octet_length(p_value::text)>500000 then raise exception 'Result too large'; end if;
   update public.qa_private_inspiration_jobs set result=p_value where id=j.id;
 elsif p_stage='delivery-start' then
   if j.result is null or j.delivery_started then raise exception 'Delivery already started or generation missing'; end if;
   update public.qa_private_inspiration_jobs set delivery_started=true where id=j.id;
 elsif p_stage='doc' then
   if not j.delivery_started or j.doc_id is not null or coalesce(p_value->>'id','') !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid document receipt'; end if;
   update public.qa_private_inspiration_jobs set doc_id=p_value->>'id' where id=j.id;
 elsif p_stage='page' then
   if j.doc_id is null or j.page_id is not null or coalesce(p_value->>'id','') !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid page receipt'; end if;
   update public.qa_private_inspiration_jobs set page_id=p_value->>'id' where id=j.id;
 elsif p_stage='complete' then
   if j.result is null or j.doc_id is null or j.page_id is null then raise exception 'Missing verified result or document receipt'; end if;
   select * into i from public.inspirations where id=j.inspiration_id and product_id=j.product_id for update;
   if not found or i.url<>j.source_url or i.updated_at is distinct from j.source_version then raise exception 'Inspiration changed while generation was running; result retained for review'; end if;
   url:='https://app.clickup.com/9016762494/docs/'||j.doc_id||'/'||j.page_id;
   insert into public.inspiration_results(ins_id,product_id,source_url,platform,metadata,classification,brief,duration_seconds,frames_extracted,clickup_doc_page_url,clickup_doc_id)
   values(j.inspiration_id,j.product_id,j.source_url,j.context->>'platform',j.result->'metadata',j.result->'classification',j.result->'brief',
     (j.result->>'duration_seconds')::numeric,(j.result->>'frames_extracted')::integer,url,j.page_id) returning * into r;
   imported:=public.qa_inspiration_import_data(r);
   imported:=imported||jsonb_build_object('bodyCopy',r.metadata->>'body_text','brand',r.metadata->>'page_name','captionTimeline',r.metadata->'caption_timeline',
     'hookText',r.metadata->>'hook_text','detectedAngle',r.classification->>'detected_angle','detectedPersona',r.classification->>'detected_persona',
     'duration_seconds',r.duration_seconds,'_privateWorkerJob',j.id,'sourceUrl',j.source_url,
     'adType',r.classification->>'photo_video','headline',r.metadata->>'headline','ctaText',r.metadata->>'cta_text','landingUrl',r.metadata->>'link_url',
     '_angleScope',case when exists(select 1 from public.angles where product_id=j.product_id and archived_at is null and name=r.classification->>'angle') then 'product' else 'inspiration' end,
     '_personaScope',case when exists(select 1 from public.personas where product_id=j.product_id and archived_at is null and name=r.classification->>'persona') then 'product' else 'inspiration' end,
     '_anglePromptDone',true,'_personaPromptDone',true,'_angleLocked',true,'_personaLocked',true);
   update public.inspirations set data=coalesce(data,'{}')||imported,status='Classified',title=imported->>'formatName',updated_at=clock_timestamp() where id=i.id;
   update public.inspiration_queue set status='classified',error_message=null,processed_at=now() where product_id=j.product_id and ins_id=j.inspiration_id;
   update public.qa_private_inspiration_jobs set status='done',finished_at=now(),sealed_clickup_token='' where id=j.id;
 elsif p_stage='failed' then
   update public.qa_private_inspiration_jobs set status='failed',error=left(p_value->>'error',700),finished_at=now(),sealed_clickup_token='' where id=j.id;
   update public.inspiration_queue set error_message=left(p_value->>'error',700) where product_id=j.product_id and ins_id=j.inspiration_id;
 else raise exception 'Unsupported worker checkpoint'; end if;
 return jsonb_build_object('status',case when p_stage='complete' then 'done' else p_stage end);
end $$;
revoke all on function public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb) from public;
grant execute on function public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb) to anon,authenticated;

-- Both job types use the same device mutex; an image claim must also respect
-- an active inspiration lease even when two processes briefly overlap.
do $$ declare body text; marker text:='perform pg_advisory_xact_lock(hashtext(''qa-private-worker:''||w.id));'; begin
 select pg_get_functiondef('public.qa_private_image_claim()'::regprocedure) into body;
 if position(marker in body)=0 then raise exception 'Image claim contract changed'; end if;
 body:=replace(body,marker,marker||E'\n if exists(select 1 from public.qa_private_inspiration_jobs where worker_id=w.id and status=''running'' and lease_until>now()) then return null; end if;');
 execute body;
end $$;
