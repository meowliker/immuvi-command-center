create sequence public.qa_private_queue_order;
revoke all on sequence public.qa_private_queue_order from public,anon,authenticated;
alter table public.qa_private_inspiration_jobs add column priority bigint;
with ranked as (select id,row_number() over(order by created_at,id) n from public.qa_private_inspiration_jobs)
update public.qa_private_inspiration_jobs j set priority=r.n from ranked r where r.id=j.id;
select setval('public.qa_private_queue_order',coalesce((select max(priority) from public.qa_private_inspiration_jobs),0)+1,false);
alter table public.qa_private_inspiration_jobs alter column priority set default nextval('public.qa_private_queue_order');
alter table public.qa_private_inspiration_jobs alter column priority set not null;
alter table public.qa_private_inspiration_jobs add column delivery_slot boolean not null default false;

create function public.qa_private_inspiration_move(p_id uuid,p_direction text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.qa_private_inspiration_jobs; ids uuid[]; pos integer; target integer; moved uuid;
begin
 if p_direction is null or p_direction not in ('up','down','top') then raise exception 'Invalid queue direction'; end if;
 select * into j from public.qa_private_inspiration_jobs where id=p_id and requested_by=auth.uid();
 if not found then raise exception 'Private job access denied' using errcode='42501'; end if;
 perform public.qa_tracker_access(j.product_id);
 if not exists(select 1 from public.qa_private_workers where id=j.worker_id and owner_id=auth.uid()) then raise exception 'Private worker access denied'; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||j.worker_id));
 -- Claims use the same lock. A running task cannot be moved or interrupted.
 select array_agg(id order by priority,created_at,id) into ids from public.qa_private_inspiration_jobs
 where worker_id=j.worker_id and requested_by=auth.uid() and product_id=j.product_id and status='pending';
 pos:=array_position(ids,p_id);
 if pos is null then raise exception 'Task has already started or is no longer queued. Refresh the queue.'; end if;
 target:=case p_direction when 'top' then 1 when 'up' then greatest(1,pos-1) else least(array_length(ids,1),pos+1) end;
 if target=pos then return; end if;
 moved:=ids[pos];
 if target<pos then
   for n in reverse pos..target+1 loop ids[n]:=ids[n-1]; end loop;
 else ids[pos]:=ids[target]; end if;
 ids[target]:=moved;
 -- Preserve existing numeric slots, so newly enqueued work remains last.
 with slots as (select priority,row_number() over(order by priority,created_at,id) n from public.qa_private_inspiration_jobs where id=any(ids))
 update public.qa_private_inspiration_jobs q set priority=s.priority from slots s where q.id=ids[s.n::integer];
end $$;
revoke all on function public.qa_private_inspiration_move(uuid,text) from public,anon;
grant execute on function public.qa_private_inspiration_move(uuid,text) to authenticated;

create or replace function public.qa_private_inspiration_claim() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs;
begin
 if not w.enabled or not w.classifier_available or w.heartbeat_at<now()-interval '45 seconds' then return null; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||w.id));
 update public.qa_private_inspiration_jobs set status='failed',delivery_slot=false,error='Worker interrupted; saved results and delivery receipts retained for review.',finished_at=now(),sealed_clickup_token=''
 where worker_id=w.id and requested_by=w.owner_id and status='running' and lease_until<now();
 if (select count(*) from public.qa_private_inspiration_jobs where worker_id=w.id and status='running')>=2
 or exists(select 1 from public.qa_image_runs where private_worker_id=w.id and status='running') then return null; end if;
 select * into j from public.qa_private_inspiration_jobs job where worker_id=w.id and requested_by=w.owner_id and status='pending'
 and exists(select 1 from public.profiles p where p.id=w.owner_id and (p.role='admin' or exists(select 1 from public.user_products u where u.user_id=w.owner_id and u.product_id=job.product_id)))
 order by priority,created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update public.qa_private_inspiration_jobs set status='running',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',delivery_slot=false where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

-- Classification can overlap, but library read/modify/write delivery must not.
-- This lock spans workers/processes and expires with the job's renewed lease.
create function public.qa_private_inspiration_delivery_lock(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.qa_private_workers:=public.qa_private_worker_identity(); j public.qa_private_inspiration_jobs; destination text;
begin
 select * into j from public.qa_private_inspiration_jobs where id=p_id and worker_id=w.id and requested_by=w.owner_id and lease_id=p_lease;
 if not found or j.status<>'running' or j.lease_until<=now() then raise exception 'Worker job lease expired or denied'; end if;
 destination:=coalesce(j.context->>'libraryDocId',j.product_id);
 perform pg_advisory_xact_lock(hashtext('qa-private-delivery:'||destination));
 if exists(select 1 from public.qa_private_inspiration_jobs other where other.id<>j.id and other.status='running' and other.lease_until>now() and other.delivery_slot
 and coalesce(other.context->>'libraryDocId',other.product_id)=destination) then return false; end if;
 update public.qa_private_inspiration_jobs set delivery_slot=true where id=j.id;
 return true;
end $$;
revoke all on function public.qa_private_inspiration_delivery_lock(uuid,uuid) from public;
grant execute on function public.qa_private_inspiration_delivery_lock(uuid,uuid) to anon,authenticated;

do $$ declare body text; marker text; begin
 select pg_get_functiondef('public.qa_private_inspiration_status(text)'::regprocedure) into body;
 marker:='''has_result'',result is not null';
 if position(marker in body)=0 then raise exception 'Status contract changed'; end if;
 execute replace(body,marker,'''worker_id'',worker_id,''priority'',priority,'||marker);
 select pg_get_functiondef('public.qa_private_inspiration_retry_delivery(uuid,text,text,uuid,text)'::regprocedure) into body;
 marker:='set status=''pending'',sealed_clickup_token=p_sealed_token';
 if position(marker in body)=0 then raise exception 'Recovery contract changed'; end if;
 execute replace(body,marker,'set status=''pending'',delivery_slot=false,priority=nextval(''public.qa_private_queue_order''),sealed_clickup_token=p_sealed_token');
end $$;
