-- Shared Run next moves an owned job ahead of all waiting jobs for this product
-- and device. Private ordering remains owner-only; running work is untouched.
create or replace function public.qa_private_inspiration_move(p_id uuid,p_direction text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.qa_private_inspiration_jobs; w public.qa_private_workers; ids uuid[]; pos integer; target integer; moved uuid;
begin
 if p_direction is null or p_direction not in ('up','down','top') then raise exception 'Invalid queue direction'; end if;
 select * into j from public.qa_private_inspiration_jobs where id=p_id and requested_by=auth.uid();
 if not found then raise exception 'Private job access denied' using errcode='42501'; end if;
 perform public.qa_tracker_access(j.product_id);
 select * into w from public.qa_private_workers where id=j.worker_id;
 if not found or not public.qa_worker_job_access(w,auth.uid(),j.product_id) then raise exception 'Private worker access denied'; end if;
 perform pg_advisory_xact_lock(hashtext('qa-private-worker:'||j.worker_id));
 select array_agg(id order by priority,created_at,id) into ids from public.qa_private_inspiration_jobs
 where worker_id=j.worker_id and (w.scope='shared' or requested_by=auth.uid()) and product_id=j.product_id and status='pending';
 pos:=array_position(ids,p_id);
 if pos is null then raise exception 'Task has already started or is no longer queued. Refresh the queue.'; end if;
 target:=case p_direction when 'top' then 1 when 'up' then greatest(1,pos-1) else least(array_length(ids,1),pos+1) end;
 if target=pos then return; end if;
 moved:=ids[pos];
 if target<pos then
   for n in reverse pos..target+1 loop ids[n]:=ids[n-1]; end loop;
 else ids[pos]:=ids[target]; end if;
 ids[target]:=moved;
 with slots as (select priority,row_number() over(order by priority,created_at,id) n from public.qa_private_inspiration_jobs where id=any(ids))
 update public.qa_private_inspiration_jobs q set priority=s.priority from slots s where q.id=ids[s.n::integer];
end $$;
