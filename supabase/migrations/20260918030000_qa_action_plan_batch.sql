-- Product-scoped, versioned local batches. Remote writes happen after commit.
create or replace function public.qa_plan_batch(p_product_id text, p_items jsonb, p_operation text, p_value text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; act public.manual_actions%rowtype; a public.ads%rowtype; saved jsonb;
  result jsonb:='[]'; source_id text; task_id text; stamp timestamptz; ms bigint;
begin
  perform public.qa_tracker_access(p_product_id);
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Task selection must be an array'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Select between 1 and 100 tasks'; end if;
  if p_operation is null or p_operation not in ('status','due','remove') then raise exception 'Unsupported bulk operation'; end if;
  if p_operation='status' and (p_value is null or p_value not in ('Untested','Approved','Assigned','To Do','In Production','Ready to Launch','Testing','Winner','Mild Winner','Scale','Complete','Loser','Killed')) then raise exception 'Invalid workflow status'; end if;
  if p_operation='due' then
    if p_value is null or (p_value<>'' and (p_value !~ '^\d{4}-\d{2}-\d{2}$' or (p_value::date)::text<>p_value)) then raise exception 'Invalid due date'; end if;
    ms:=case when p_value='' then null else (extract(epoch from (p_value||'T23:59:59Z')::timestamptz)*1000)::bigint end;
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_items) x where nullif(x->>'ad_id','') is not null group by x->>'ad_id' having count(*)>1)
    then raise exception 'Duplicate task links must be resolved before bulk editing'; end if;

  -- Preflight the whole selection before invoking helpers which mirror linked rows.
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    select * into act from public.manual_actions where product_id=p_product_id and id=(item->>'id')::uuid for update;
    if not found or act.updated_at is distinct from (item->>'updated_at')::timestamptz then raise exception 'Action Plan changed. Refresh before bulk editing.'; end if;
    if exists(select 1 from public.qa_clickup_creations where product_id=p_product_id and action_id=act.id and state in ('sending','uncertain','created')) then raise exception 'Recover unresolved ClickUp creation before bulk editing'; end if;
    source_id:=coalesce(nullif(act.payload->>'sourceAdId',''),nullif(act.payload->>'adId',''),nullif(act.payload->>'_sourceAdId',''));
    task_id:=coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''));
    if p_operation<>'remove' then
      if source_id is distinct from nullif(item->>'ad_id','') then raise exception 'Action Plan source identity is unresolved'; end if;
      if source_id is not null then
        select * into a from public.ads where product_id=p_product_id and id=source_id for update;
        if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
        if a.updated_at is distinct from (item->>'ad_updated_at')::timestamptz then raise exception 'Creative changed. Refresh before bulk editing.'; end if;
        if task_id is not null and task_id is distinct from coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId','')) then raise exception 'Action Plan task identity conflicts with the creative'; end if;
        if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=source_id or clickup_task_id=task_id)) then raise exception 'Deleted creative cannot be edited'; end if;
        if exists(select 1 from public.manual_actions m where m.product_id=p_product_id and m.id<>act.id and
          coalesce(nullif(m.payload->>'sourceAdId',''),nullif(m.payload->>'adId',''),nullif(m.payload->>'_sourceAdId',''))=source_id) then raise exception 'Duplicate task links must be resolved before bulk editing'; end if;
      elsif task_id is not null then raise exception 'Link the ClickUp task to a creative before bulk editing';
      end if;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into act from public.manual_actions where product_id=p_product_id and id=(item->>'id')::uuid;
    stamp:=clock_timestamp();
    if p_operation='remove' then
      delete from public.manual_actions where product_id=p_product_id and id=act.id;
      insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,source,metadata)
        values(p_product_id,act.id,coalesce(act.payload->>'_clickupId',act.payload->>'clickupTaskId'),'removed_from_plan','qa-next',
          jsonb_build_object('title',act.payload->>'title','linked_ad_id',coalesce(act.payload->>'sourceAdId',act.payload->>'adId')));
      result:=result||jsonb_build_array(jsonb_build_object('id',act.id,'removed',true));
    elsif nullif(item->>'ad_id','') is not null then
      saved:=public.qa_plan_edit(p_product_id,act.id,act.updated_at,item->>'ad_id',(item->>'ad_updated_at')::timestamptz,
        case when p_operation='status' then p_value end,case when p_operation='due' then p_value end);
      result:=result||jsonb_build_array(saved||jsonb_build_object('id',act.id));
    else
      update public.manual_actions set
        live_status=case when p_operation='status' then p_value else live_status end,
        payload=payload||case when p_operation='status' then jsonb_build_object('liveStatus',p_value,'_statusChangedAt',(extract(epoch from stamp)*1000)::bigint,'_liveStatusChangedAt',(extract(epoch from stamp)*1000)::bigint)
          else jsonb_build_object('dueDate',p_value,'_dueDateMs',ms,'_dueChangedAt',(extract(epoch from stamp)*1000)::bigint) end,
        approved_at=case when p_operation='status' and p_value='In Production' then stamp else approved_at end,
        delivered_at=case when p_operation='status' and p_value='Ready to Launch' then stamp else delivered_at end,
        launched_at=case when p_operation='status' and p_value='Testing' then stamp else launched_at end,
        killed_at=case when p_operation='status' and p_value in ('Loser','Killed') then stamp else killed_at end,
        scaled_at=case when p_operation='status' and p_value in ('Winner','Mild Winner','Scale') then stamp else scaled_at end,
        updated_at=stamp where product_id=p_product_id and id=act.id returning to_jsonb(manual_actions.*) into saved;
      insert into public.activity_events(product_id,action_id,event_type,field_name,old_value,new_value,source)
        values(p_product_id,act.id,case when p_operation='status' then 'status_changed' else 'due_changed' end,
          case when p_operation='status' then 'status' else 'due_date' end,case when p_operation='status' then act.live_status else act.payload->>'dueDate' end,p_value,'qa-next');
      result:=result||jsonb_build_array(jsonb_build_object('id',act.id,'action',saved));
    end if;
  end loop;
  return result;
end $$;
revoke all on function public.qa_plan_batch(text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.qa_plan_batch(text,jsonb,text,text) to authenticated;
