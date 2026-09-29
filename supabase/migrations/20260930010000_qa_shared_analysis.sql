-- QA-only winner briefs and Strategist. No device receives a service-role key.
alter table public.qa_private_workers add column analysis_protocol integer not null default 0 check(analysis_protocol in(0,1));
create table public.qa_shared_analysis_jobs (
 id uuid primary key, product_id text not null references public.products(id),
 worker_id uuid not null references public.qa_private_workers(id), requested_by uuid not null references auth.users(id),
 kind text not null check(kind in('variation','strategist')),
 status text not null default 'pending' check(status in('pending','running','done','failed')),
 parent_ad_id text, target_ad_id text, drive_file_id text, strategist_run_id bigint references public.strategist_runs(id),
 context jsonb not null, sealed_token text not null, expires_at timestamptz not null default now()+interval '7 days',
 started jsonb not null default '[]', units jsonb not null default '{}', intents jsonb not null default '{}', receipts jsonb not null default '{}',
 stage text not null default 'queued', error text, lease_id uuid, lease_until timestamptz,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index qa_analysis_winner on public.qa_shared_analysis_jobs(drive_file_id) where kind='variation';
create unique index qa_analysis_strategist_active on public.qa_shared_analysis_jobs(product_id) where kind='strategist' and status in('pending','running');
alter table public.qa_shared_analysis_jobs enable row level security;
revoke all on public.qa_shared_analysis_jobs from public,anon,authenticated;
grant all on public.qa_shared_analysis_jobs to service_role;

create function public.qa_shared_analysis_heartbeat(p_codex boolean,p_claude boolean,p_classifier boolean,p_images boolean) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
 perform public.qa_shared_producer_heartbeat(p_codex,p_claude,p_classifier,p_images);
 update public.qa_private_workers set analysis_protocol=1 where id=w.id;
 return 1;
end$$;
revoke all on function public.qa_shared_analysis_heartbeat(boolean,boolean,boolean,boolean) from public;
grant execute on function public.qa_shared_analysis_heartbeat(boolean,boolean,boolean,boolean) to anon,authenticated;

create function public.qa_analysis_workers(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'enabled',enabled,'heartbeat_at',heartbeat_at,
 'codex_active',codex_active,'classifier_available',classifier_available,'analysis_protocol',analysis_protocol,'delivery_public_key',delivery_public_key))
 from public.qa_private_workers where scope='shared' and product_id=p_product_id),'[]');
end$$;
revoke all on function public.qa_analysis_workers(text) from public,anon;
grant execute on function public.qa_analysis_workers(text) to authenticated;

create function public.qa_analysis_allowed(j public.qa_shared_analysis_jobs,w public.qa_private_workers) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select w.id=j.worker_id and w.scope='shared' and w.enabled and w.analysis_protocol=1
 and w.product_id=j.product_id and j.product_id='qa-sample-astrorekha'
 and public.qa_worker_product_access(j.requested_by,j.product_id) and j.sealed_token<>'' and j.expires_at>now()
 and exists(select 1 from public.products where id=j.product_id and config->>'clickup_list_id'='1301130000002447'
 and config->>'qa_brief_doc_id'='8cq1r3y-44896' and config->>'qa_brief_visibility'='PUBLIC')
 and (j.kind='strategist' or exists(select 1 from public.ads p join public.ads t on t.product_id=p.product_id
 join public.task_video_winners f on f.ad_id=p.id and f.drive_file_id=j.drive_file_id
 where p.id=j.parent_ad_id and t.id=j.target_ad_id and p.product_id=j.product_id and p.deleted_at is null and t.deleted_at is null
 and not coalesce((p.meta->>'_productBoundaryQuarantined')::boolean,false) and not coalesce((t.meta->>'_productBoundaryQuarantined')::boolean,false)
 and (p.id=t.id or t.parent_ad_id=p.id) and lower(p.status) in('winner','mild winner','scale')
 and f.file_name=j.context->>'winnerLabel'
 and coalesce(t.clickup_task_id,'')=coalesce(j.context->>'targetTask','')
 and not exists(select 1 from public.deleted_ads d where d.product_id=j.product_id and d.id in(p.id,t.id))))
$$;
revoke all on function public.qa_analysis_allowed(public.qa_shared_analysis_jobs,public.qa_private_workers) from public,anon,authenticated;

create function public.qa_analysis_enqueue(p_id uuid,p_product_id text,p_worker_id uuid,p_kind text,p_sealed_token text,
 p_parent text default null,p_target text default null,p_file text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers;j public.qa_shared_analysis_jobs;p public.products;a public.ads;t public.ads;f public.task_video_winners;c jsonb;rid bigint;
begin
 perform public.qa_tracker_access(p_product_id);
 perform pg_advisory_xact_lock(hashtext('qa-analysis:'||p_product_id));
 select * into w from public.qa_private_workers where id=p_worker_id and scope='shared' and product_id=p_product_id and enabled and analysis_protocol=1;
 if not found then raise exception 'Shared analysis worker is unavailable';end if;
 if w.heartbeat_at>now()-interval '45 seconds' and (not w.codex_active or (p_kind='variation' and not w.classifier_available)) then raise exception 'Required engine is inactive';end if;
 if p_id is null or p_kind not in('variation','strategist') or p_kind is null or p_sealed_token is null or length(p_sealed_token)<>512 or p_sealed_token !~ '^[A-Za-z0-9+/=]+$' then raise exception 'Invalid analysis request';end if;
 select * into j from public.qa_shared_analysis_jobs where id=p_id for update;
 if found then
  if j.requested_by<>auth.uid() or j.worker_id<>p_worker_id or j.product_id<>p_product_id or j.kind<>p_kind
   or j.parent_ad_id is distinct from p_parent or j.target_ad_id is distinct from p_target or j.drive_file_id is distinct from p_file then raise exception 'Request identity conflict' using errcode='42501';end if;
  if j.status='failed' then
   j.sealed_token:=p_sealed_token;j.expires_at:=now()+interval '7 days';
   if not public.qa_analysis_allowed(j,w) then raise exception 'Analysis destination or access changed';end if;
   if j.lease_until>now() then raise exception 'Previous attempt is settling; retry after its lease expires';end if;
   update public.qa_shared_analysis_jobs set status='pending',stage='recovering',sealed_token=p_sealed_token,expires_at=j.expires_at,
    lease_id=null,lease_until=null,attempts=0,next_attempt_at=now(),error=null,finished_at=null where id=j.id;
   update public.strategist_runs set status='pending',error=null,finished_at=null where id=j.strategist_run_id;
   update public.variation_brief_queue set status='blocked',error_message='Queued on shared worker' where id=j.id;
   j.status:='pending';
  end if;
  return jsonb_build_object('id',j.id,'status',j.status);
 end if;
 select * into p from public.products where id=p_product_id;
 if p.id is distinct from 'qa-sample-astrorekha' or p.config->>'clickup_list_id' is distinct from '1301130000002447'
 or p.config->>'qa_brief_doc_id' is distinct from '8cq1r3y-44896' or p.config->>'qa_brief_visibility' is distinct from 'PUBLIC' then raise exception 'QA destination changed';end if;
 c:=jsonb_build_object('product',jsonb_build_object('id',p.id,'name',p.name,'production',p.config->'production'),
 'listId','1301130000002447','libraryDocId','8cq1r3y-44896',
 'angles',coalesce((select jsonb_agg(name order by name) from public.angles where product_id=p.id and archived_at is null),'[]'),
 'personas',coalesce((select jsonb_agg(name order by name) from public.personas where product_id=p.id and archived_at is null),'[]'));
 if p_kind='variation' then
  select * into a from public.ads where id=p_parent and product_id=p.id and deleted_at is null;
  select * into t from public.ads where id=p_target and product_id=p.id and deleted_at is null;
  select * into f from public.task_video_winners where ad_id=a.id and drive_file_id=p_file;
  if a.id is null or t.id is null or f.id is null or p_file !~ '^[A-Za-z0-9_-]{28,}$'
   or coalesce(lower(a.status),'') not in('winner','mild winner','scale') or (t.id<>a.id and t.parent_ad_id is distinct from a.id) then raise exception 'Choose a winning file and its creative or variation';end if;
  if exists(select 1 from public.variation_briefs where drive_file_id=p_file)
   or exists(select 1 from public.qa_shared_analysis_jobs where drive_file_id=p_file) then raise exception 'A brief or retained run already exists for this file; open or resume it';end if;
  c:=c||jsonb_build_object('parentName',a.format_name,'targetName',t.format_name,'winnerLabel',f.file_name,'targetTask',coalesce(t.clickup_task_id,''),
   'sourceUrl','https://drive.google.com/file/d/'||p_file||'/view');
  -- Legacy queue is a read-only display mirror, never claimable by old workers.
  insert into public.variation_brief_queue(id,parent_ad_id,target_ad_id,drive_file_id,status,error_message)
   values(p_id,a.id,t.id,p_file,'blocked','Queued on shared worker');
 else
  if p_parent is not null or p_target is not null or p_file is not null then raise exception 'Unexpected Strategist target';end if;
  insert into public.strategist_runs(product_id,status,trigger,run_date,worker_id) values(p.id,'pending','manual',current_date,'shared:'||w.id) returning id into rid;
  c:=c||jsonb_build_object('cached',coalesce((select jsonb_agg(to_jsonb(s)) from public.strategist_processed s where product_id=p.id),'[]'));
 end if;
 insert into public.qa_shared_analysis_jobs(id,product_id,worker_id,requested_by,kind,parent_ad_id,target_ad_id,drive_file_id,strategist_run_id,context,sealed_token)
 values(p_id,p.id,w.id,auth.uid(),p_kind,p_parent,p_target,p_file,rid,c,p_sealed_token) returning * into j;
 if not public.qa_analysis_allowed(j,w) then raise exception 'Analysis authorization denied';end if;
 return jsonb_build_object('id',j.id,'status',j.status);
end$$;
revoke all on function public.qa_analysis_enqueue(uuid,text,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.qa_analysis_enqueue(uuid,text,uuid,text,text,text,text,text) to authenticated;

create function public.qa_analysis_status(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'product_id',product_id,'worker_id',worker_id,
 'status',case when status='running' and lease_until<=now() then 'pending' else status end,'stage',stage,'error',error,
 'parent_ad_id',parent_ad_id,'target_ad_id',target_ad_id,'drive_file_id',drive_file_id,'created_at',created_at,'finished_at',finished_at,
 'can_resume',requested_by=auth.uid() and status='failed','url',receipts->>'url') order by created_at desc)
 from public.qa_shared_analysis_jobs where product_id=p_product_id),'[]');
end$$;
revoke all on function public.qa_analysis_status(text) from public,anon;
grant execute on function public.qa_analysis_status(text) to authenticated;

create function public.qa_analysis_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();j public.qa_shared_analysis_jobs;
begin
 if w.scope<>'shared' or not w.enabled or w.analysis_protocol<>1 or not w.codex_active or w.heartbeat_at is null or w.heartbeat_at<now()-interval '45 seconds' then return null;end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 for j in select * from public.qa_shared_analysis_jobs where worker_id=w.id and (status='pending' or status='running' and lease_until<=now()) for update loop
  if not public.qa_analysis_allowed(j,w) or j.attempts>=5 then
   update public.qa_shared_analysis_jobs set status='failed',stage='needs_attention',sealed_token='',lease_id=null,finished_at=now(),error='Authorization, destination or retry limit requires review.' where id=j.id;
   update public.strategist_runs set status='failed',finished_at=now(),error='Shared run requires review.' where id=j.strategist_run_id;
   update public.variation_brief_queue set status='failed',processed_at=now(),error_message='Shared run requires review.' where id=j.id;
  elsif j.status='running' then
   update public.qa_shared_analysis_jobs set status='pending',stage='recovering',lease_id=null,next_attempt_at=now()+interval '30 seconds' where id=j.id;
  end if;
 end loop;
 if exists(select 1 from public.qa_shared_analysis_jobs where worker_id=w.id and status='running')
 or exists(select 1 from public.qa_private_inspiration_jobs where worker_id=w.id and status='running')
 or exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null;end if;
 select * into j from public.qa_shared_analysis_jobs where worker_id=w.id and status='pending' and next_attempt_at<=now()
 and (kind='strategist' or w.classifier_available) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.qa_shared_analysis_jobs set status='running',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=j.id returning * into j;
 update public.strategist_runs set status='running',started_at=coalesce(started_at,now()) where id=j.strategist_run_id;
 update public.variation_brief_queue set status='processing',claimed_by=w.id::text,claimed_at=now(),error_message=null where id=j.id;
 return to_jsonb(j);
end$$;
revoke all on function public.qa_analysis_claim() from public;
grant execute on function public.qa_analysis_claim() to anon,authenticated;

create function public.qa_analysis_checkpoint(p_id uuid,p_lease uuid,p_stage text,p_value jsonb default '{}') returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();j public.qa_shared_analysis_jobs;k text:=p_value->>'key';v jsonb;row jsonb;
begin
 select * into j from public.qa_shared_analysis_jobs where id=p_id and worker_id=w.id and lease_id=p_lease for update;
 if not found or w.scope<>'shared' then raise exception 'Analysis lease denied' using errcode='42501';end if;
 if j.status='done' and p_stage='complete' then return 'done';end if;
 if j.status<>'running' or j.lease_until<=now() or not public.qa_analysis_allowed(j,w) then raise exception 'Analysis authorization or lease expired' using errcode='42501';end if;
 if octet_length(p_value::text)>5000000 then raise exception 'Analysis checkpoint too large';end if;
 if p_stage in('start','unit') and (k is null or k !~ '^[a-zA-Z0-9_-]{1,100}$' or coalesce(p_value->>'identity','') !~ '^[a-f0-9]{64}$') then raise exception 'Invalid unit';end if;
 if p_stage='heartbeat' then null;
 elsif p_stage='start' then
  if j.started ? k then raise exception 'Generation already started; recover saved output';end if;
  j.started:=j.started||jsonb_build_array(k);j.intents:=jsonb_set(j.intents,array[k],to_jsonb(p_value->>'identity'));
 elsif p_stage='unit' then
  if not j.started ? k or j.intents->>k is distinct from p_value->>'identity' or not p_value ? 'value' then raise exception 'Unit was not started';end if;
  v:=p_value-'key';
  if j.units ? k and j.units->k<>v then raise exception 'Saved unit is immutable';end if;
  j.units:=jsonb_set(j.units,array[k],v);
 elsif p_stage='page-start' then
  if j.kind<>'variation' or not j.units ? 'brief' or j.receipts ? 'started' then raise exception 'Page outcome requires review';end if;
  j.receipts:=j.receipts||'{"started":true}';
 elsif p_stage='page' then
  if j.kind<>'variation' or not j.receipts ? 'started' or coalesce(p_value->>'id','') !~ '^[A-Za-z0-9_-]+$'
   or j.receipts ? 'id' and j.receipts->>'id'<>p_value->>'id' then raise exception 'Invalid page receipt';end if;
  j.receipts:=j.receipts||jsonb_build_object('id',p_value->>'id','url','https://app.clickup.com/9016762494/docs/8cq1r3y-44896/'||(p_value->>'id'));
 elsif p_stage='complete' then
  if j.kind='variation' then
   if not j.receipts ? 'id' or p_value->>'verified' is distinct from 'true' or coalesce(j.units#>>'{brief,value,markdown}','')='' then raise exception 'Brief delivery is incomplete';end if;
   if exists(select 1 from public.variation_briefs where drive_file_id=j.drive_file_id and ad_id<>j.parent_ad_id) then raise exception 'Winner brief identity conflict';end if;
   insert into public.variation_briefs(drive_file_id,ad_id,brief_markdown,clickup_doc_page_url,generated_by)
    values(j.drive_file_id,j.parent_ad_id,j.units#>>'{brief,value,markdown}',j.receipts->>'url',w.id::text)
    on conflict(drive_file_id) do update set brief_markdown=excluded.brief_markdown,clickup_doc_page_url=excluded.clickup_doc_page_url,generated_at=now(),generated_by=excluded.generated_by;
   update public.ads set meta=coalesce(meta,'{}')||jsonb_build_object('winnerBriefUrl',j.receipts->>'url') where id=j.target_ad_id and product_id=j.product_id;
   update public.variation_brief_queue set status='done',processed_at=now(),error_message=null where id=j.id;
  else
   v:=j.units#>'{memory,value}';
   if coalesce(v->>'markdown','')='' or v#>>'{json,product_id}' is distinct from j.product_id or jsonb_typeof(v->'rows') is distinct from 'array' then raise exception 'Strategist memory is incomplete';end if;
   for row in select value from jsonb_array_elements(v->'rows') loop
    insert into public.strategist_processed(product_id,clickup_task_id,content_hash,brief_json,is_winner,status,spend,revenue)
    values(j.product_id,row->>'clickup_task_id',row->>'content_hash',row->'brief_json',(row->>'is_winner')::boolean,row->>'status',(row->>'spend')::numeric,(row->>'revenue')::numeric)
    on conflict(product_id,clickup_task_id) do update set content_hash=excluded.content_hash,brief_json=excluded.brief_json,is_winner=excluded.is_winner,status=excluded.status,spend=excluded.spend,revenue=excluded.revenue,last_synthesized=now();
   end loop;
   insert into public.strategist_memory(product_id,json,markdown) values(j.product_id,v->'json',v->>'markdown')
    on conflict(product_id) do update set json=excluded.json,markdown=excluded.markdown,updated_at=now();
   update public.strategist_runs set status='done',finished_at=now(),tasks_processed=(v->>'processed')::integer,tasks_skipped=(v->>'skipped')::integer,error=null where id=j.strategist_run_id;
  end if;
  j.status:='done';j.sealed_token:='';j.finished_at:=now();
 elsif p_stage='retry' then
  if j.attempts>=5 then raise exception 'Retry limit reached';end if;
  j.status:='pending';j.lease_id:=null;j.next_attempt_at:=now()+make_interval(secs=>case j.attempts when 1 then 30 when 2 then 120 when 3 then 600 else 1800 end);
 elsif p_stage='failed' then
  j.status:='failed';j.sealed_token:='';j.error:=left(p_value->>'error',700);j.finished_at:=now();
  update public.strategist_runs set status='failed',finished_at=now(),error=j.error where id=j.strategist_run_id;
  update public.variation_brief_queue set status='failed',processed_at=now(),error_message=j.error where id=j.id;
 else raise exception 'Unknown analysis checkpoint';end if;
 update public.qa_shared_analysis_jobs set started=j.started,units=j.units,intents=j.intents,receipts=j.receipts,status=j.status,
 sealed_token=j.sealed_token,finished_at=j.finished_at,error=j.error,lease_id=j.lease_id,next_attempt_at=j.next_attempt_at,
 lease_until=case when j.status='running' then now()+interval '2 minutes' else j.lease_until end,
 stage=case when p_stage='heartbeat' then stage else p_stage end where id=j.id;
 return j.status;
end$$;
revoke all on function public.qa_analysis_checkpoint(uuid,uuid,text,jsonb) from public;
grant execute on function public.qa_analysis_checkpoint(uuid,uuid,text,jsonb) to anon,authenticated;

-- The same database worker lock fences all three queues. Rollback binaries lose
-- the analysis capability and cannot overlap a still-leased analysis attempt.
do $$ declare body text;sig text;needle text;begin
 foreach sig in array array['public.qa_shared_inspiration_claim()','public.qa_shared_image_claim()'] loop
  body:=pg_get_functiondef(sig::regprocedure);
  needle:='perform pg_advisory_xact_lock(hashtext(''qa-private-worker:''||w.id));';
  if strpos(body,needle)=0 then raise exception 'Claim contract changed';end if;
  body:=replace(body,needle,needle||' if exists(select 1 from public.qa_shared_analysis_jobs where worker_id=w.id and status=''running'' and lease_until>now()) then return null;end if;');execute body;
 end loop;
 body:=pg_get_functiondef('public.qa_private_runtime_heartbeat(boolean,boolean,boolean)'::regprocedure);
 if strpos(body,'image_protocol=0')=0 then raise exception 'Heartbeat contract changed';end if;
 execute replace(body,'image_protocol=0','image_protocol=0,analysis_protocol=0');
end$$;

-- Outputs and legacy mirrors are readable under existing product RLS, but may
-- only be produced by fenced worker RPCs, not browser-supplied model results.
revoke insert,update,delete on public.strategist_runs,public.strategist_memory,public.strategist_processed,
 public.variation_briefs,public.variation_brief_queue from authenticated;
