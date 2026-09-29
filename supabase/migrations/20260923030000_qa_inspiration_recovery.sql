-- Restore only the missing source record; results and downstream records are never rewritten.
create or replace function public.qa_inspiration_recover(p_product_id text,p_request_id uuid,p_queue_id uuid,p_expected_queue jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.inspiration_queue%rowtype; i public.inspirations%rowtype;
  receipt public.qa_inspiration_receipts%rowtype; req jsonb; result jsonb; snapshot jsonb;
  prefix text; owners int; owner_id text; author text; stamp timestamptz:=clock_timestamp();
  blocked text:='Classifier dispatch is disabled in QA until an isolated test worker and destination are verified.';
begin
  perform public.qa_tracker_access(p_product_id);
  if p_request_id is null or p_queue_id is null or jsonb_typeof(p_expected_queue) is distinct from 'object' then raise exception 'A queue snapshot is required'; end if;
  req:=jsonb_build_object('operation','recover','queueId',p_queue_id,'queue',p_expected_queue);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  select * into q from public.inspiration_queue where id=p_queue_id and product_id=p_product_id for update;
  if not found then raise exception 'Queue entry is no longer available'; end if;
  snapshot:=to_jsonb(q);
  if snapshot is distinct from to_jsonb(jsonb_populate_record(null::public.inspiration_queue,p_expected_queue)) then raise exception 'Queue changed. Close recovery and reopen the entry.'; end if;
  if coalesce(lower(q.status),'') not in ('failed','error','blocked','classified','done','completed') then raise exception 'Only terminal or blocked queue entries can be recovered'; end if;
  if nullif(trim(q.ins_id),'') is null or length(q.ins_id)>200 then raise exception 'Queue source identity is invalid'; end if;
  if q.url !~ '^https?://[^/@[:space:]?#]+([/?#]|$)' or length(q.url)>4000 then raise exception 'Queue source URL is invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('qa-inspiration-recover-id:'||q.ins_id));
  if exists(select 1 from public.inspirations where id=q.ins_id) then raise exception 'Source identity already exists. Refresh the library.'; end if;
  if exists(select 1 from public.inspiration_queue where ins_id=q.ins_id and product_id<>p_product_id)
    or exists(select 1 from public.inspiration_results where ins_id=q.ins_id and product_id<>p_product_id) then raise exception 'Source identity is ambiguous across products'; end if;
  prefix:=substring(q.ins_id from '^([A-Za-z0-9]+)-INS-[0-9]+$');
  if prefix is not null then
    select count(*),min(id) into owners,owner_id from public.products
      where regexp_replace(upper(coalesce(nullif(config->>'ins_prefix',''),left((select string_agg(left(w,1),'') from unnest(regexp_split_to_array(trim(name),'\s+')) w),3),'QA')),'[^A-Z0-9]','','g')=upper(prefix);
    if owners>1 or (owners=1 and owner_id<>p_product_id) then raise exception 'Source prefix is ambiguous or belongs to another product'; end if;
  end if;
  if exists(select 1 from public.qa_inspiration_receipts where product_id=p_product_id and request->>'operation'='delete' and request->>'id'=q.ins_id) then raise exception 'This inspiration was explicitly deleted. Recovery cannot restore it.'; end if;
  if exists(select 1 from public.inspirations where product_id=p_product_id and regexp_replace(url,'[/#]+$','','g')=regexp_replace(q.url,'[/#]+$','','g')) then raise exception 'This source URL already has a library record. Recovery cannot merge identities.'; end if;
  select coalesce(nullif(full_name,''),nullif(username,''),auth.uid()::text) into author from public.profiles where id=auth.uid();
  insert into public.inspirations(id,product_id,url,title,platform,added_by,status,created_at,updated_at,data)
    values(q.ins_id,p_product_id,q.url,q.ins_id,q.platform,author,'Blocked',q.queued_at,stamp,
      jsonb_build_object('formatName',q.ins_id,'_qaRecoveredBy',auth.uid(),'_qaRecoveredAt',stamp,'_qaRecoveredQueue',snapshot)) returning * into i;
  -- Keep retry chronology and attempts so an existing result does not become artificially stale.
  update public.inspiration_queue set status='blocked',worker_assignment='blocked:qa-isolation',claimed_by=null,claimed_at=null,error_message=blocked
    where id=q.id and product_id=p_product_id returning * into q;
  result:=jsonb_build_object('requestId',p_request_id,'productId',p_product_id,'operation','recover','id',i.id,
    'row',to_jsonb(i),'queue',to_jsonb(q),'dispatchEnabled',false);
  insert into public.qa_inspiration_receipts(request_id,product_id,user_id,request,response) values(p_request_id,p_product_id,auth.uid(),req,result);
  return result;
end $$;
revoke all on function public.qa_inspiration_recover(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_recover(text,uuid,uuid,jsonb) to authenticated;
