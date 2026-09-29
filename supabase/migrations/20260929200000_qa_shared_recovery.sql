-- Version-gated recovery. Apply during the consolidated QA rollout, not to production.
alter table public.qa_private_workers add column recovery_protocol integer not null default 1 check(recovery_protocol in (1,2));
alter table public.qa_private_inspiration_jobs
 add column recovery_version integer not null default 1 check(recovery_version in (1,2)),
 add column recovery_stage text not null default 'queued',
 add column attempts integer not null default 0,
 add column next_attempt_at timestamptz not null default now(),
 add column credential_expires_at timestamptz,
 add column generation_started boolean not null default false;

create function public.qa_shared_recovery_ready() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity();
begin
 if w.scope<>'shared' then raise exception 'Shared device required' using errcode='42501'; end if;
 update public.qa_private_workers set recovery_protocol=2 where id=w.id;
 return 2;
end $$;
revoke all on function public.qa_shared_recovery_ready() from public;
grant execute on function public.qa_shared_recovery_ready() to anon,authenticated;

create function public.qa_recovery_issue(j public.qa_private_inspiration_jobs,w public.qa_private_workers) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.qa_worker_job_access(w,j.requested_by,j.product_id) or not public.qa_worker_product_access(j.requested_by,j.product_id)
 then return 'Access changed. Requester and product authorization must be reviewed.'; end if;
 if not exists(select 1 from public.products p where p.id=j.product_id and p.id='qa-sample-astrorekha'
 and p.config->>'clickup_list_id'='1301130000002447' and j.context->>'listId'='1301130000002447'
 and p.config->>'qa_brief_doc_id'='8cq1r3y-44896' and j.context->>'libraryDocId'='8cq1r3y-44896'
 and p.config->>'qa_brief_tracker_page_id'='8cq1r3y-118036' and j.context->>'libraryTrackerPageId'='8cq1r3y-118036'
 and p.config->>'qa_brief_visibility'='PUBLIC' and j.context->>'docVisibility'='PUBLIC')
 then return 'QA delivery destination changed. Saved output requires review.'; end if;
 if not exists(select 1 from public.inspirations i where i.id=j.inspiration_id and i.product_id=j.product_id
 and i.url=j.source_url and i.updated_at=j.source_version and i.data->>'_qaCreatedBy'=j.requested_by::text)
 then return 'Inspiration changed. Saved output requires review.'; end if;
 if j.sealed_clickup_token='' or j.credential_expires_at is null or j.credential_expires_at<=now()
 then return 'Delivery authorization expired. Requeue with your ClickUp key to renew it.'; end if;
 return null;
end $$;
revoke all on function public.qa_recovery_issue(public.qa_private_inspiration_jobs,public.qa_private_workers) from public,anon,authenticated;

create function public.qa_recovery_expire(p_product text) returns void
language sql security definer set search_path=public,pg_temp as $$
 update public.qa_private_inspiration_jobs set sealed_clickup_token='',status='failed',recovery_stage='needs_attention',
 error='Delivery authorization expired. Requeue with your ClickUp key to renew it.',finished_at=now(),delivery_slot=false,lease_id=null,lease_until=null
 where product_id=p_product and recovery_version=2 and status in ('pending','running') and credential_expires_at<=now()
$$;
revoke all on function public.qa_recovery_expire(text) from public,anon,authenticated;

create function public.qa_recovery_initialize() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.qa_private_workers where id=new.worker_id and scope='shared' and recovery_protocol=2) then
  new.recovery_version:=2; new.credential_expires_at:=now()+interval '7 days';
 end if;
 return new;
end $$;
create trigger qa_recovery_initialize before insert on public.qa_private_inspiration_jobs for each row execute function public.qa_recovery_initialize();
revoke all on function public.qa_recovery_initialize() from public,anon,authenticated;

create or replace function pg_temp.replace_required(body text,old text,replacement text) returns text language plpgsql as $$
begin
 if strpos(body,old)=0 then raise exception 'Recovery migration contract changed: %',old; end if;
 return replace(body,old,replacement);
end $$;
do $$ declare body text; signature text; begin
 -- A rollback to a legacy binary must stop advertising recovery support.
 body:=pg_get_functiondef('public.qa_private_runtime_heartbeat(boolean,boolean,boolean)'::regprocedure);
 body:=pg_temp.replace_required(body,'classifier_available=p_classifier and (p_codex or p_claude),heartbeat_at=now()',
  'classifier_available=p_classifier and (p_codex or p_claude),heartbeat_at=now(),recovery_protocol=1');
 execute body;
 foreach signature in array array['public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text)',
 'public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text)'] loop
  body:=pg_get_functiondef(signature::regprocedure);
  body:=pg_temp.replace_required(body,'and enabled and classifier_available',
   'and enabled and ((scope=''shared'' and recovery_protocol=2) or (classifier_available');
  body:=pg_temp.replace_required(body,'and heartbeat_at>now()-interval ''45 seconds'' and delivery_public_key is not null',
   'and heartbeat_at>now()-interval ''45 seconds'')) and delivery_public_key is not null');
  execute body;
 end loop;
 -- A legacy binary must neither claim nor fail a recovery-aware job.
 body:=pg_get_functiondef('public.qa_private_inspiration_claim()'::regprocedure);
 body:=pg_temp.replace_required(body,'where worker_id=w.id and status=''running'' and lease_until<now()',
  'where worker_id=w.id and recovery_version=1 and status=''running'' and lease_until<now()');
 body:=pg_temp.replace_required(body,'where worker_id=w.id and status=''pending''',
  'where worker_id=w.id and recovery_version=1 and status=''pending''');
 execute body;
 body:=pg_get_functiondef('public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text)'::regprocedure);
 body:=pg_temp.replace_required(body,'(delivery_started or result is not null)',
  '(delivery_started or result is not null or (recovery_version=2 and generation_started))');
 execute body;
 body:=pg_get_functiondef('public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text)'::regprocedure);
 body:=pg_temp.replace_required(body,'if j.status in (''pending'',''running'',''done'')',
  'if j.recovery_stage=''cancelled'' and j.lease_until>now() then raise exception ''Cancellation is settling. Retry after the previous worker lease expires.''; end if; if j.status in (''pending'',''running'',''done'')');
 body:=pg_temp.replace_required(body,'if j.result is null or ((j.delivery_started',
  'if (j.result is null and not (j.recovery_version=2 and not j.generation_started)) or ((j.delivery_started');
 body:=pg_temp.replace_required(body,'set status=''pending'',delivery_slot=false,',
  'set status=''pending'',recovery_version=case when w.scope=''shared'' and w.recovery_protocol=2 then 2 else j.recovery_version end,recovery_stage=''queued'',attempts=0,next_attempt_at=now(),credential_expires_at=now()+interval ''7 days'',delivery_slot=false,');
 execute body;
 -- Cancelled delivery can have an HTTP write in flight. Keep its fence until the
 -- original lease expires instead of allowing another tracker writer immediately.
 body:=pg_get_functiondef('public.qa_private_inspiration_delivery_lock(uuid,uuid)'::regprocedure);
 body:=pg_temp.replace_required(body,'other.status=''running'' and other.lease_until>now()',
  '(other.status=''running'' or other.recovery_stage=''cancelled'') and other.lease_until>now()');
 execute body;
 body:=pg_get_functiondef('public.qa_inspiration_workers_list(text)'::regprocedure);
 body:=pg_temp.replace_required(body,'''can_manage'',w.owner_id=auth.uid()',
  '''recovery_protocol'',w.recovery_protocol,''can_manage'',w.owner_id=auth.uid()');
 execute body;
 body:=pg_get_functiondef('public.qa_private_inspiration_status(text)'::regprocedure);
 body:=pg_temp.replace_required(body,'''status'',j.status',
  '''status'',case when j.recovery_version=2 and j.recovery_stage=''cancelled'' then ''cancelled'' when j.recovery_version=2 and j.status=''running'' and j.lease_until<=now() then ''pending'' else j.status end');
 body:=pg_temp.replace_required(body,'perform public.qa_tracker_access(p_product_id);',
  'perform public.qa_tracker_access(p_product_id); perform public.qa_recovery_expire(p_product_id);');
 body:=pg_temp.replace_required(body,'''has_result'',j.result is not null',
  '''recovery_version'',j.recovery_version,''recovery_stage'',case when j.recovery_version=2 and j.status=''running'' and j.lease_until<=now() then ''recovering'' else j.recovery_stage end,''attempts'',j.attempts,''next_attempt_at'',j.next_attempt_at,''can_cancel'',j.recovery_version=2 and j.requested_by=auth.uid() and j.status in (''pending'',''running''),''can_retry_processing'',j.recovery_version=2 and j.requested_by=auth.uid() and j.status=''failed'' and not j.generation_started and j.result is null,''generation_started'',j.generation_started,''has_result'',j.result is not null');
 execute body;
end $$;

create function public.qa_shared_runtime_heartbeat(p_codex boolean,p_claude boolean,p_classifier boolean) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Both updates share one transaction, so observers never see a partial capability.
 perform public.qa_private_runtime_heartbeat(p_codex,p_claude,p_classifier);
 return public.qa_shared_recovery_ready();
end $$;
revoke all on function public.qa_shared_runtime_heartbeat(boolean,boolean,boolean) from public;
grant execute on function public.qa_shared_runtime_heartbeat(boolean,boolean,boolean) to anon,authenticated;

create function public.qa_shared_inspiration_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs; issue text;
begin
 if w.scope<>'shared' or w.recovery_protocol<>2 then raise exception 'Recovery-aware shared device required' using errcode='42501'; end if;
 if not w.enabled or not w.classifier_available or w.heartbeat_at is null or w.heartbeat_at<now()-interval '45 seconds' then return null; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 perform public.qa_recovery_expire(w.product_id);
 -- Old interrupted attempts have no generation boundary checkpoint: never replay blindly.
 update public.qa_private_inspiration_jobs set status='failed',delivery_slot=false,sealed_clickup_token='',finished_at=now(),error='Previous worker interrupted. Review retained output before retrying.'
 where worker_id=w.id and recovery_version=1 and status='running' and lease_until<now();
 for j in select * from public.qa_private_inspiration_jobs where worker_id=w.id and recovery_version=2
 and (status='pending' or (status='running' and lease_until<now())) for update loop
  issue:=public.qa_recovery_issue(j,w);
  if issue is not null or j.attempts>=5 then
   update public.qa_private_inspiration_jobs set status='failed',recovery_stage='needs_attention',sealed_clickup_token='',delivery_slot=false,
    lease_id=null,lease_until=null,finished_at=now(),error=coalesce(issue,'Automatic retry limit reached. Review the saved output before requeueing.') where id=j.id;
  elsif j.status='running' then
   update public.qa_private_inspiration_jobs set status='pending',recovery_stage='recovering',delivery_slot=false,lease_id=null,lease_until=null,
    next_attempt_at=now()+interval '30 seconds',error=null where id=j.id;
  end if;
 end loop;
 if exists(select 1 from public.qa_private_inspiration_jobs where worker_id=w.id and status='running')
 or exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null; end if;
 select * into j from public.qa_private_inspiration_jobs where worker_id=w.id and status='pending' and next_attempt_at<=now()
 and public.qa_worker_job_access(w,requested_by,product_id) and public.qa_worker_product_access(requested_by,product_id)
 order by priority,created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 -- Pending v1 jobs have never started and can safely adopt the new contract.
 if j.recovery_version=1 then
  j.recovery_version:=2; j.credential_expires_at:=j.created_at+interval '7 days';
 end if;
 issue:=public.qa_recovery_issue(j,w);
 if issue is not null then
  update public.qa_private_inspiration_jobs set status='failed',recovery_stage='needs_attention',error=issue,sealed_clickup_token='',finished_at=now() where id=j.id;
  return null;
 end if;
 update public.qa_private_inspiration_jobs set status='running',recovery_version=2,credential_expires_at=j.credential_expires_at,
  attempts=attempts+1,recovery_stage=case when attempts>0 or result is not null then 'recovering' else 'source' end,
  lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',delivery_slot=false,error=null where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.qa_shared_inspiration_claim() from public;
grant execute on function public.qa_shared_inspiration_claim() to anon,authenticated;

-- Preserve the reviewed publication contract, with recovery checks in front of it.
alter function public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb) rename to qa_private_inspiration_checkpoint_v1;
revoke all on function public.qa_private_inspiration_checkpoint_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.qa_private_inspiration_checkpoint(p_id uuid,p_lease uuid,p_stage text,p_value jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs; issue text; answer jsonb;
begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and worker_id=w.id and lease_id=p_lease for update;
 if not found then raise exception 'Worker job access denied' using errcode='42501'; end if;
 if j.recovery_version=1 then return public.qa_private_inspiration_checkpoint_v1(p_id,p_lease,p_stage,p_value); end if;
 if j.status='done' and p_stage='complete' then return jsonb_build_object('status','done'); end if;
 if j.status<>'running' or j.lease_until<=now() then raise exception 'Job lease expired'; end if;
 issue:=public.qa_recovery_issue(j,w);
 if issue is not null then raise exception '%',issue using errcode='42501'; end if;
 if p_stage='generation-start' then
  if j.generation_started or j.result is not null then raise exception 'Generation already started; recover saved output'; end if;
  update public.qa_private_inspiration_jobs set generation_started=true,recovery_stage='generating' where id=j.id;
 elsif p_stage='retry' then
  if p_value->>'reason' not in ('interrupted','network','rate_limit','provider_unavailable') or p_value->>'reason' is null then raise exception 'Unsupported retry reason'; end if;
  update public.qa_private_inspiration_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,
   recovery_stage=case when attempts>=5 then 'needs_attention' else 'recovering' end,
   error=case when attempts>=5 then 'Automatic retry limit reached. Review saved output before requeueing.' else null end,
   sealed_clickup_token=case when attempts>=5 then '' else sealed_clickup_token end,
   finished_at=case when attempts>=5 then now() else null end,delivery_slot=false,lease_id=null,lease_until=null,
   next_attempt_at=now()+make_interval(secs=>case attempts when 1 then 30 when 2 then 120 when 3 then 600 else 1800 end) where id=j.id;
 elsif p_stage='result' and j.result is not null then
  if j.result<>p_value then raise exception 'Saved generation cannot be replaced'; end if;
 elsif p_stage='doc' and j.doc_id is not null then
  if j.doc_id is distinct from p_value->>'id' then raise exception 'Document receipt conflict'; end if;
 elsif p_stage='page' and j.page_id is not null then
  if j.page_id is distinct from p_value->>'id' then raise exception 'Page receipt conflict'; end if;
 elsif p_stage='delivery-start' and j.delivery_started then null;
 else
  answer:=public.qa_private_inspiration_checkpoint_v1(p_id,p_lease,p_stage,p_value);
  if p_stage in ('result','delivery-start','doc','page','complete','failed') then
   update public.qa_private_inspiration_jobs set recovery_stage=case p_stage when 'result' then 'saved' when 'complete' then 'done' when 'failed' then 'needs_attention' else 'delivery' end,
    delivery_slot=case when p_stage in ('failed','complete') then false else delivery_slot end where id=j.id;
  end if;
 end if;
 return coalesce(answer,jsonb_build_object('status',p_stage));
end $$;
revoke all on function public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb) from public;
grant execute on function public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb) to anon,authenticated;

create function public.qa_private_inspiration_cancel(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.qa_private_inspiration_jobs;
begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and requested_by=auth.uid() and recovery_version=2 for update;
 if not found then raise exception 'Job access denied' using errcode='42501'; end if;
 perform public.qa_tracker_access(j.product_id);
 if j.status not in ('pending','running') then return; end if;
 update public.qa_private_inspiration_jobs set status='failed',recovery_stage='cancelled',error='Cancelled. Saved outputs are retained; an in-flight external operation may still finish.',
 sealed_clickup_token='',lease_id=null,finished_at=now() where id=j.id;
end $$;
revoke all on function public.qa_private_inspiration_cancel(uuid) from public,anon;
grant execute on function public.qa_private_inspiration_cancel(uuid) to authenticated;
