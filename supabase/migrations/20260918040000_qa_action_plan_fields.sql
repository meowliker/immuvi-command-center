create or replace function public.qa_plan_fields(p_product_id text,p_action_id uuid,p_expected_updated_at timestamptz,
  p_ad_id text,p_ad_updated_at timestamptz,p_custom jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare act public.manual_actions%rowtype; a public.ads%rowtype; saved jsonb; task_id text; pair record;
  raw jsonb:='{}'; labels jsonb:='{}'; mappings jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  if a.updated_at is distinct from p_ad_updated_at then raise exception 'Creative changed. Reopen assignments before saving.'; end if;
  select * into act from public.manual_actions where product_id=p_product_id and id=p_action_id for update;
  if not found or act.updated_at is distinct from p_expected_updated_at then raise exception 'Action Plan changed. Reopen assignments before saving.'; end if;
  if coalesce(nullif(act.payload->>'sourceAdId',''),nullif(act.payload->>'adId',''),nullif(act.payload->>'_sourceAdId','')) is distinct from a.id then raise exception 'Action Plan source identity is unresolved'; end if;
  task_id:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
  if coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),task_id) is distinct from task_id then raise exception 'Action Plan task identity conflicts with the creative'; end if;
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=task_id)) then raise exception 'Deleted creative cannot be edited'; end if;
  if exists(select 1 from public.qa_clickup_creations where product_id=p_product_id and (ad_id=a.id or action_id=act.id) and state in ('sending','uncertain','created')) then raise exception 'Recover unresolved ClickUp creation before editing'; end if;
  if jsonb_typeof(p_custom) is distinct from 'object' then raise exception 'Invalid custom fields'; end if;
  if (select count(*) from jsonb_object_keys(p_custom))>100 then raise exception 'Too many custom fields'; end if;
  select config->'clickup_sync'->'mappings' into mappings from public.products where id=p_product_id;
  if jsonb_typeof(mappings) is distinct from 'object' then mappings:='{}'; end if;
  for pair in select * from jsonb_each(p_custom) loop
    if jsonb_typeof(pair.value) is distinct from 'object' or nullif(trim(pair.value->>'name'),'') is null or not pair.value ? 'value' then raise exception 'Invalid custom field'; end if;
    if pair.key<>'__task_assignees' and (lower(trim(pair.value->>'name')) in ('angle','angle tag','persona','persona tag','status','ad type','funnel stage')
      or exists(select 1 from jsonb_each_text(mappings) m where m.value=pair.key)) then raise exception 'Edit canonical fields through the creative editor'; end if;
    if pair.key='__task_assignees' and (pair.value->>'name'<>'Task assignees' or pair.value->>'type' is distinct from 'users') then raise exception 'Invalid native assignee field'; end if;
    if pair.value->>'type'='users' then
      if jsonb_typeof(pair.value->'value') is distinct from 'array' then raise exception 'Invalid people assignment'; end if;
      if exists(select 1 from jsonb_array_elements_text(pair.value->'value') u where u !~ '^[1-9][0-9]*$' or length(u)>15) then raise exception 'Invalid people assignment'; end if;
    end if;
    raw:=raw||jsonb_build_object(lower(pair.value->>'name'),pair.value->'value');
    labels:=labels||jsonb_build_object(lower(pair.value->>'name'),coalesce(pair.value->>'display',pair.value->>'value',''));
  end loop;
  if p_custom='{}'::jsonb then return jsonb_build_object('ad',to_jsonb(a),'action',to_jsonb(act)); end if;
  saved:=public.qa_tracker_save(p_product_id,a.id,p_ad_updated_at,'{}',p_custom);
  update public.manual_actions set payload=payload||jsonb_build_object(
    '_customFieldsRaw',coalesce(payload->'_customFieldsRaw','{}')||raw,'_customFields',coalesce(payload->'_customFields','{}')||labels)
    ||case when p_custom ? '__task_assignees' then jsonb_build_object('assignees',saved->'meta'->'assignees') else '{}'::jsonb end,
    updated_at=clock_timestamp() where product_id=p_product_id and id=act.id returning * into act;
  for pair in select * from jsonb_each(p_custom) loop
    insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,field_name,old_value,new_value,source,metadata)
      values(p_product_id,act.id,task_id,case when pair.value->>'type'='users' then 'assignment_changed' else 'custom_field_changed' end,
        pair.value->>'name',case when pair.key='__task_assignees' then a.meta->>'assignees' else a.meta->'_customFieldsRaw'->>lower(pair.value->>'name') end,
        pair.value->>'value','qa-next',jsonb_build_object('linked_ad_id',a.id,'field_id',pair.key));
  end loop;
  return jsonb_build_object('ad',saved,'action',to_jsonb(act));
end $$;
revoke all on function public.qa_plan_fields(text,uuid,timestamptz,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_plan_fields(text,uuid,timestamptz,text,timestamptz,jsonb) to authenticated;
