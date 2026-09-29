create table if not exists public.qa_stale_cleanup_previews (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null, product_id text not null,
  product_version timestamptz, product_name text not null, task_ids jsonb not null,
  manifest text not null, plan jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.qa_stale_cleanup_receipts (
  request_id uuid primary key, actor_id uuid not null, request jsonb not null, response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.qa_stale_cleanup_previews enable row level security;
alter table public.qa_stale_cleanup_receipts enable row level security;
revoke all on public.qa_stale_cleanup_previews,public.qa_stale_cleanup_receipts from public,anon,authenticated;

create or replace function public.qa_stale_mentions(p_value jsonb,p_ids text[]) returns boolean
language plpgsql immutable set search_path=public as $$
declare entry record; value jsonb; begin
  if jsonb_typeof(p_value)='string' then return (p_value#>>'{}')=any(p_ids); end if;
  if jsonb_typeof(p_value)='array' then
    for value in select * from jsonb_array_elements(p_value) loop if public.qa_stale_mentions(value,p_ids) then return true; end if; end loop;
  elsif jsonb_typeof(p_value)='object' then
    for entry in select * from jsonb_each(p_value) loop
      if entry.key=any(p_ids) or exists(select 1 from unnest(p_ids) id where left(entry.key,length(id)+2)=id||'||') or public.qa_stale_mentions(entry.value,p_ids) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function public.qa_stale_cleanup_plan(p_product_id text,p_task_ids jsonb,p_at timestamptz) returns jsonb
language plpgsql set search_path=public as $$
declare a public.ads%rowtype; item record; refs jsonb:='[]'; extra jsonb; task text; reason text; protected jsonb:='{}';
  candidates jsonb:='[]'; ids text[]; total integer:=0;
begin
  if (select count(*) from public.ads where product_id=p_product_id)>5000 then raise exception 'Cleanup exceeds the 5000-row review limit'; end if;
  -- Preserve any product-owned record that mentions an ad/remote identity, including
  -- JSON keys and historical workflow records. False positives keep user work.
  for item in select distinct ns.nspname,cl.relname,att.attname from pg_constraint c
    join pg_class cl on cl.oid=c.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
    join pg_attribute att on att.attrelid=c.conrelid and att.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.products'::regclass and array_length(c.conkey,1)=1
      and cl.relname not in ('ads','deleted_ads') loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from %I.%I t where %I=$1',item.nspname,item.relname,item.attname) into extra using p_product_id;
    refs:=refs||extra;
  end loop;
  select refs||coalesce(jsonb_agg(to_jsonb(c)),'[]') into refs from public.qa_clickup_creations c where product_id=p_product_id;
  for a in select * from public.ads where product_id=p_product_id order by id loop
    reason:=null;
    task:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
    ids:=array_remove(array[a.id,task],null);
    if a.deleted_at is not null or exists(select 1 from public.deleted_ads d where d.product_id=p_product_id and (d.id=a.id or d.clickup_task_id=task)) then reason:='already removed';
    elsif a.meta ? '_productBoundaryQuarantined' then reason:='quarantined';
    elsif a.parent_ad_id is not null or a.variation_number is not null or coalesce(a.meta->>'parentAdId',a.meta->>'parent_ad_id','')<>''
      or a.ad_origin='Winner Variation' or a.meta->>'adOrigin'='Winner Variation' or a.meta->>'taskType'='variation' then reason:='variation';
    elsif coalesce(a.ad_origin,'')<>'ClickUp' or a.meta->>'adOrigin' in ('New Find','Manual','Funnel Expansion')
      or nullif(a.meta->>'_clickupListId','') is null or task is null then reason:='local or unverified origin';
    elsif task !~ '^[a-zA-Z0-9_-]+$' or exists(select 1 from unnest(array[a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId']) t where nullif(t,'') is not null and t<>task) then reason:='ambiguous identity';
    elsif p_task_ids ? task then reason:='current ClickUp task';
    elsif a.meta ?| array['_appCreated','_fromInspoId','_sourceAdId','_fromTrackerAdId','_appActionId','_qaCreationJob'] or coalesce(a.meta->'_trackerPending','{}')<>'{}' then reason:='local work';
    elsif a.created_at is null or a.updated_at is null or greatest(a.created_at,a.updated_at)>p_at-interval '5 minutes' then reason:='recent or undated';
    elsif a.status in ('Winner','Mild Winner','Scale') or exists(select 1 from public.task_video_winners w where w.ad_id=a.id) then reason:='winner';
    elsif exists(select 1 from public.variation_briefs b where b.ad_id=a.id)
      or exists(select 1 from public.variation_brief_queue q where q.parent_ad_id=a.id or q.target_ad_id=a.id) then reason:='variation brief';
    elsif public.qa_stale_mentions(refs,ids) or exists(select 1 from public.ads other where other.product_id=p_product_id and other.id<>a.id and public.qa_stale_mentions(to_jsonb(other),ids)) then reason:='referenced work';
    end if;
    if a.deleted_at is null then total:=total+1; end if;
    if reason is null then candidates:=candidates||jsonb_build_array(jsonb_build_object('id',a.id,'name',coalesce(a.format_name,a.id),'taskId',task));
    else protected:=jsonb_set(protected,array[reason],to_jsonb(coalesce((protected->>reason)::integer,0)+1)); end if;
  end loop;
  if jsonb_array_length(candidates)>500 then raise exception 'More than 500 candidates require a separate manual review'; end if;
  if total>0 and jsonb_array_length(candidates)::numeric/total>0.8 then raise exception 'Cleanup would remove over 80 percent of active creatives. Review the link and sync first.'; end if;
  return jsonb_build_object('candidates',candidates,'protected',protected);
end $$;

create or replace function public.qa_stale_cleanup_scope(p_actor uuid,p_product_id text,p_task_ids jsonb,p_product_version timestamptz) returns public.products
language plpgsql set search_path=public as $$
declare p public.products%rowtype; previous_count numeric;
begin
  perform public.qa_account_actor(p_actor);
  select * into p from public.products where id=p_product_id for update;
  if not found or p.updated_at is distinct from p_product_version then raise exception 'Product changed. Review a new cleanup preview.'; end if;
  if coalesce(p.config->>'clickup_list_id',p.config->>'clickupListId','')<>'901616718146' then raise exception 'Only the linked QA test list can be cleaned'; end if;
  if jsonb_typeof(p_task_ids) is distinct from 'array' then raise exception 'Invalid ClickUp snapshot'; end if;
  if jsonb_array_length(p_task_ids) not between 1 and 40000 or exists(select 1 from jsonb_array_elements(p_task_ids) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^[a-zA-Z0-9_-]+$')
    or jsonb_array_length(p_task_ids)<>(select count(distinct v) from jsonb_array_elements_text(p_task_ids) v) then raise exception 'A complete nonempty ClickUp snapshot is required'; end if;
  if coalesce(p.config->>'last_synced_count','0') !~ '^[0-9]+$' then raise exception 'Previous sync count is invalid'; end if;
  previous_count:=coalesce(p.config->>'last_synced_count','0')::numeric;
  if jsonb_array_length(p_task_ids)<previous_count*0.5 then raise exception 'ClickUp count is below half the last sync. Cleanup is blocked.'; end if;
  return p;
end $$;

create or replace function public.qa_stale_cleanup_preview(p_actor uuid,p_product_id text,p_task_ids jsonb,p_product_version timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.products%rowtype; manifest jsonb; plan jsonb; preview public.qa_stale_cleanup_previews%rowtype;
begin
  p:=public.qa_stale_cleanup_scope(p_actor,p_product_id,p_task_ids,p_product_version);
  lock table public.task_video_winners,public.variation_briefs,public.variation_brief_queue in share mode;
  manifest:=public.qa_product_manifest(p_product_id,true);
  if (manifest->>'blocked')::boolean then raise exception 'Queued or running product work blocks cleanup'; end if;
  plan:=public.qa_stale_cleanup_plan(p_product_id,p_task_ids,now());
  insert into public.qa_stale_cleanup_previews(actor_id,product_id,product_version,product_name,task_ids,manifest,plan)
    values(p_actor,p_product_id,p.updated_at,p.name,p_task_ids,manifest->>'revision',plan) returning * into preview;
  return plan||jsonb_build_object('previewId',preview.id,'productId',p_product_id,'productName',p.name,'listId','901616718146',
    'remoteCount',jsonb_array_length(p_task_ids),'expiresAt',preview.created_at+interval '10 minutes','dispatchEnabled',false);
end $$;

create or replace function public.qa_stale_cleanup_receipt(p_actor uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare receipt public.qa_stale_cleanup_receipts%rowtype;
begin
  perform public.qa_account_actor(p_actor);
  if jsonb_typeof(p_request) is distinct from 'object' or p_request->>'operation' is distinct from 'commit'
    or nullif(p_request->>'productId','') is null or nullif(p_request->>'requestId','') is null or nullif(p_request->>'previewId','') is null
    or jsonb_typeof(p_request->'confirmName') is distinct from 'string'
    or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('operation','productId','requestId','previewId','confirmName')) then raise exception 'Invalid cleanup confirmation'; end if;
  select * into receipt from public.qa_stale_cleanup_receipts where request_id=(p_request->>'requestId')::uuid;
  if found then
    if receipt.actor_id<>p_actor or receipt.request<>p_request then raise exception 'Cleanup request identity conflicts'; end if;
    return receipt.response;
  end if;
  return null;
end $$;

create or replace function public.qa_stale_cleanup_commit(p_actor uuid,p_product_id text,p_task_ids jsonb,p_product_version timestamptz,p_request jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.products%rowtype; preview public.qa_stale_cleanup_previews%rowtype; manifest jsonb; plan jsonb; result jsonb; item jsonb; ids jsonb:='[]';
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-cleanup:'||coalesce(p_request->>'requestId',''),0));
  result:=public.qa_stale_cleanup_receipt(p_actor,p_request);
  if result is not null then return result; end if;
  if p_request->>'productId' is distinct from p_product_id then raise exception 'Cleanup product mismatch'; end if;
  p:=public.qa_stale_cleanup_scope(p_actor,p_product_id,p_task_ids,p_product_version);
  lock table public.task_video_winners,public.variation_briefs,public.variation_brief_queue in share mode;
  select * into preview from public.qa_stale_cleanup_previews where id=(p_request->>'previewId')::uuid;
  if not found or preview.actor_id<>p_actor or preview.product_id<>p_product_id then raise exception 'Cleanup preview is unavailable'; end if;
  if preview.created_at<now()-interval '10 minutes' then raise exception 'Cleanup preview expired. Review a new preview.'; end if;
  if preview.product_version is distinct from p.updated_at or p_request->>'confirmName' is distinct from p.name then raise exception 'Product confirmation changed. Review a new preview.'; end if;
  if p_task_ids<>preview.task_ids then raise exception 'ClickUp changed since preview. Review a new preview.'; end if;
  manifest:=public.qa_product_manifest(p_product_id,true);
  if (manifest->>'blocked')::boolean or manifest->>'revision'<>preview.manifest then raise exception 'Product work changed since preview. Review a new preview.'; end if;
  plan:=public.qa_stale_cleanup_plan(p_product_id,p_task_ids,preview.created_at);
  if plan<>preview.plan then raise exception 'Creative protections changed. Review a new preview.'; end if;
  if jsonb_array_length(plan->'candidates')=0 then raise exception 'No stale creatives to remove'; end if;
  for item in select * from jsonb_array_elements(plan->'candidates') loop
    insert into public.deleted_ads(id,product_id,clickup_task_id,format_name,deleted_by,reason)
      values(item->>'id',p_product_id,item->>'taskId',item->>'name',p_actor::text,'qa-stale-list-cleanup');
    update public.ads set deleted_at=now() where id=item->>'id' and product_id=p_product_id;
    ids:=ids||jsonb_build_array(item->>'id');
  end loop;
  result:=jsonb_build_object('requestId',p_request->>'requestId','previewId',preview.id,'productId',p_product_id,'deletedIds',ids,'dispatchEnabled',false);
  insert into public.admin_audit_log(actor_id,action,target_product,meta) values(p_actor,'qa_stale_ad_cleanup',p_product_id,
    jsonb_build_object('requestId',p_request->>'requestId','previewId',preview.id,'deletedIds',ids,'remoteCount',jsonb_array_length(p_task_ids)));
  insert into public.qa_stale_cleanup_receipts(request_id,actor_id,request,response) values((p_request->>'requestId')::uuid,p_actor,p_request,result);
  return result;
end $$;
revoke all on function public.qa_stale_mentions(jsonb,text[]),public.qa_stale_cleanup_plan(text,jsonb,timestamptz),
  public.qa_stale_cleanup_scope(uuid,text,jsonb,timestamptz),public.qa_stale_cleanup_preview(uuid,text,jsonb,timestamptz),
  public.qa_stale_cleanup_receipt(uuid,jsonb),public.qa_stale_cleanup_commit(uuid,text,jsonb,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_stale_cleanup_preview(uuid,text,jsonb,timestamptz),public.qa_stale_cleanup_receipt(uuid,jsonb),
  public.qa_stale_cleanup_commit(uuid,text,jsonb,timestamptz,jsonb) to service_role;
