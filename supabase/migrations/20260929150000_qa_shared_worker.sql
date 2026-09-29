-- Explicit shared QA scope. Existing devices remain private by default.
-- One job table preserves cross-destination uniqueness, receipts and delivery locks.
alter table public.qa_private_workers add column scope text not null default 'private' check(scope in ('private','shared'));
alter table public.qa_private_workers add column product_id text references public.products(id);
alter table public.qa_private_workers add constraint qa_shared_product check
 ((scope='private' and product_id is null) or (scope='shared' and product_id='qa-sample-astrorekha' and not generation_available));

create function public.qa_worker_product_access(p_user uuid,p_product text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=p_user and p.is_active and not p.must_change_password
 and (p.role='admin' or exists(select 1 from public.user_products u where u.user_id=p_user and u.product_id=p_product)))
$$;
revoke all on function public.qa_worker_product_access(uuid,text) from public,anon,authenticated;

create function public.qa_worker_job_access(w public.qa_private_workers,p_user uuid,p_product text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select (w.scope='private' and w.owner_id=p_user) or
 (w.scope='shared' and w.product_id=p_product and public.qa_worker_product_access(p_user,p_product))
$$;
revoke all on function public.qa_worker_job_access(public.qa_private_workers,uuid,text) from public,anon,authenticated;

create function public.qa_inspiration_workers_list(p_product_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.qa_tracker_access(p_product_id);
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'scope',w.scope,
 'enabled',w.enabled,'heartbeat_at',w.heartbeat_at,'classifier_available',w.enabled and w.classifier_available,
 'codex_active',w.codex_active,'claude_active',w.claude_active,'delivery_public_key',w.delivery_public_key,
 'can_manage',w.owner_id=auth.uid()) order by w.created_at)
 from public.qa_private_workers w where public.qa_worker_job_access(w,auth.uid(),p_product_id)),'[]');
end $$;
revoke all on function public.qa_inspiration_workers_list(text) from public,anon;
grant execute on function public.qa_inspiration_workers_list(text) to authenticated;

-- Guarded substitutions retain the reviewed content/delivery/recovery contract.
-- Abort migration rather than silently dropping a guard after upstream changes.
create function pg_temp.replace_required(body text,old text,replacement text) returns text language plpgsql as $$
begin
 if strpos(body,old)=0 then raise exception 'Shared migration contract changed: %',old; end if;
 return replace(body,old,replacement);
end $$;
do $$ declare body text; signature text; begin
 -- Private listing and image routing must NEVER include shared devices.
 foreach signature in array array['public.qa_private_workers_list()','public.qa_private_image_worker()'] loop
  body:=pg_get_functiondef(signature::regprocedure);
  body:=pg_temp.replace_required(body,'owner_id=auth.uid()','owner_id=auth.uid() and scope=''private''');
  execute body;
 end loop;
 foreach signature in array array[
 'public.qa_private_inspiration_enqueue(uuid,text,text,uuid,text)',
 'public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text)'] loop
  body:=pg_get_functiondef(signature::regprocedure);
  body:=pg_temp.replace_required(body,'owner_id=auth.uid()',
   'public.qa_worker_job_access(qa_private_workers,auth.uid(),p_product_id)');
  body:=pg_temp.replace_required(body,'''private:''||w.id', 'w.scope||'':''||w.id');
  body:=pg_temp.replace_required(body,'if p_sealed_token is null',
   'if w.scope=''shared'' and not exists(select 1 from public.products where id=p_product_id and id=''qa-sample-astrorekha'' and config->>''qa_brief_doc_id''=''8cq1r3y-44896'' and config->>''qa_brief_tracker_page_id''=''8cq1r3y-118036'' and config->>''qa_brief_visibility''=''PUBLIC'') then raise exception ''Shared QA destination changed''; end if; if p_sealed_token is null');
  execute body;
 end loop;
 -- Every leased inspiration operation checks the assigned device and requester.
 foreach signature in array array[
 'public.qa_private_inspiration_checkpoint(uuid,uuid,text,jsonb)',
 'public.qa_private_inspiration_delivery_rejected(uuid,uuid,integer,text)',
 'public.qa_private_inspiration_tracker_rows(uuid,uuid)',
 'public.qa_private_inspiration_delivery_lock(uuid,uuid)'] loop
  body:=pg_get_functiondef(signature::regprocedure);
  body:=pg_temp.replace_required(body,'requested_by=w.owner_id','public.qa_worker_job_access(w,requested_by,product_id)');
  execute body;
 end loop;
 body:=pg_get_functiondef('public.qa_private_inspiration_move(uuid,text)'::regprocedure);
 body:=pg_temp.replace_required(body,'owner_id=auth.uid()',
  'public.qa_worker_job_access(qa_private_workers,auth.uid(),j.product_id)');
 execute body;
end $$;

create or replace function public.qa_private_inspiration_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs;
begin
 if not w.enabled or not w.classifier_available or w.heartbeat_at is null or w.heartbeat_at<now()-interval '45 seconds' then return null; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 update public.qa_private_inspiration_jobs set status='failed',delivery_slot=false,error='Worker interrupted; saved results and delivery receipts retained for review.',finished_at=now(),sealed_clickup_token=''
 where worker_id=w.id and status='running' and lease_until<now();
 if (select count(*) from public.qa_private_inspiration_jobs where worker_id=w.id and status='running')>=(case when w.scope='shared' then 1 else 2 end)
 or exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null; end if;
 select * into j from public.qa_private_inspiration_jobs job where worker_id=w.id and status='pending'
 and public.qa_worker_job_access(w,requested_by,product_id) and public.qa_worker_product_access(requested_by,product_id)
 order by priority,created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update public.qa_private_inspiration_jobs set status='running',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',delivery_slot=false where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

-- Shared enrollment is administrator-only; the runtime never receives a service key.
create function public.qa_shared_worker_enroll(p_id uuid,p_owner uuid,p_hash text,p_public_key text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active and not must_change_password)
 or p_owner<>auth.uid() then raise exception 'QA administrator required' using errcode='42501'; end if;
 if p_public_key not like '-----BEGIN PUBLIC KEY-----%' or length(p_public_key)>2000 then raise exception 'Invalid public key'; end if;
 if not exists(select 1 from public.products where id='qa-sample-astrorekha'
 and config->>'clickup_list_id'='1301130000002447' and config->>'qa_brief_doc_id'='8cq1r3y-44896'
 and config->>'qa_brief_tracker_page_id'='8cq1r3y-118036' and config->>'qa_brief_visibility'='PUBLIC')
 then raise exception 'QA destination identities do not match'; end if;
 insert into public.qa_private_workers(id,owner_id,name,token_hash,delivery_public_key,scope,product_id,enabled)
 values(p_id,p_owner,'Mac mini - QA',p_hash,p_public_key,'shared','qa-sample-astrorekha',false);
end $$;
revoke all on function public.qa_shared_worker_enroll(uuid,uuid,text,text) from public,anon;
grant execute on function public.qa_shared_worker_enroll(uuid,uuid,text,text) to authenticated;

do $$ declare body text; begin
 body:=pg_get_functiondef('public.qa_private_worker_heartbeat(boolean)'::regprocedure);
 body:=pg_temp.replace_required(body,'''workerId'',w.id','''workerId'',w.id,''scope'',w.scope');
 execute body;
end $$;
