create or replace function public.qa_plan_creative(p_product_id text,p_action_id uuid,p_expected_updated_at timestamptz,
  p_ad_id text,p_ad_updated_at timestamptz,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare act public.manual_actions%rowtype; a public.ads%rowtype; saved jsonb; task_id text; source_id text;
  pair record; changes jsonb:='{}'; meta_changes jsonb:='{}'; old_values jsonb; mirror jsonb:='{}';
begin
  perform public.qa_tracker_access(p_product_id);
  if jsonb_typeof(p_values) is distinct from 'object' or octet_length(p_values::text)>100000 then raise exception 'Invalid creative details'; end if;
  if exists(select 1 from jsonb_each(p_values) p where p.key<>all(array['format_name','angle','persona','ad_type','funnel_stage','ad_link','drive_link','meta'])
    or (p.key<>'meta' and jsonb_typeof(p.value)<>'string')) then raise exception 'Unsupported creative detail'; end if;
  if p_values ? 'meta' then
    if jsonb_typeof(p_values->'meta') is distinct from 'object' then raise exception 'Invalid creative metadata'; end if;
    if exists(select 1 from jsonb_each(p_values->'meta') p where p.key<>all(array['hookType','creativeStructure','productionStyle','creativeUSP','winningElement','creativeHypothesis','notes'])
      or jsonb_typeof(p.value)<>'string') then raise exception 'Unsupported creative metadata'; end if;
  end if;
  if p_values ? 'format_name' and length(trim(p_values->>'format_name')) not between 1 and 500 then raise exception 'Enter a task name of 1 to 500 characters.'; end if;
  -- Match the creative-before-action lock order used by the other plan mutations.
  if p_ad_id is not null then
    select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
    if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
    if a.updated_at is distinct from p_ad_updated_at then raise exception 'Creative changed. Reopen the editor before saving; your draft has been kept.'; end if;
  end if;
  select * into act from public.manual_actions where product_id=p_product_id and id=p_action_id for update;
  if not found or act.updated_at is distinct from p_expected_updated_at then raise exception 'Action Plan changed. Reopen the editor before saving; your draft has been kept.'; end if;
  source_id:=coalesce(nullif(act.payload->>'sourceAdId',''),nullif(act.payload->>'adId',''),nullif(act.payload->>'_sourceAdId',''));
  if p_ad_id is null then
    if source_id is not null or coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId','')) is not null then raise exception 'Link this action to its creative before editing'; end if;
    if exists(select 1 from jsonb_object_keys(p_values) k where k<>'format_name') then raise exception 'Standalone actions support task-name editing only'; end if;
    if p_values ? 'format_name' and act.payload->>'title' is distinct from p_values->>'format_name' then
      insert into public.activity_events(product_id,action_id,event_type,field_name,old_value,new_value,source)
        values(p_product_id,act.id,'creative_field_changed','format_name',act.payload->>'title',p_values->>'format_name','qa-next');
      update public.manual_actions set payload=payload||jsonb_build_object('title',p_values->>'format_name'),updated_at=clock_timestamp()
        where id=act.id and product_id=p_product_id returning * into act;
    end if;
    return jsonb_build_object('ad',null,'action',to_jsonb(act));
  end if;
  if source_id is distinct from a.id then raise exception 'Action Plan source identity is unresolved'; end if;
  task_id:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
  if coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),task_id) is distinct from task_id then raise exception 'Action Plan task identity conflicts with the creative'; end if;
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=task_id)) then raise exception 'Deleted creative cannot be edited'; end if;
  if exists(select 1 from public.qa_clickup_creations where product_id=p_product_id and (ad_id=a.id or action_id=act.id) and state in ('sending','uncertain','created')) then raise exception 'Recover unresolved ClickUp creation before editing'; end if;
  old_values:=to_jsonb(a);
  for pair in select * from jsonb_each(p_values-'meta') loop
    if coalesce(old_values->pair.key,'""') is distinct from pair.value then changes:=changes||jsonb_build_object(pair.key,pair.value); end if;
  end loop;
  for pair in select * from jsonb_each(coalesce(p_values->'meta','{}')) loop
    if coalesce(a.meta->pair.key,'""') is distinct from pair.value then meta_changes:=meta_changes||jsonb_build_object(pair.key,pair.value); end if;
  end loop;
  if changes ? 'angle' and changes->>'angle'<>'' and not exists(select 1 from public.angles where product_id=p_product_id and name=changes->>'angle') then raise exception 'Select an existing product angle'; end if;
  if changes ? 'persona' and changes->>'persona'<>'' and not exists(select 1 from public.personas where product_id=p_product_id and name=changes->>'persona') then raise exception 'Select an existing product persona'; end if;
  if meta_changes<>'{}' then changes:=changes||jsonb_build_object('meta',meta_changes); end if;
  if changes='{}' then return jsonb_build_object('ad',to_jsonb(a),'action',to_jsonb(act)); end if;
  saved:=public.qa_tracker_save(p_product_id,a.id,p_ad_updated_at,changes,'{}');
  for pair in select * from jsonb_each(changes-'meta') loop
    mirror:=mirror||jsonb_build_object(case pair.key when 'format_name' then 'title' when 'ad_type' then 'adType' when 'funnel_stage' then 'funnelStage'
      when 'ad_link' then 'adLink' when 'drive_link' then 'driveLink' else pair.key end,pair.value);
  end loop;
  mirror:=mirror||meta_changes;
  update public.manual_actions set payload=payload||mirror,updated_at=clock_timestamp() where product_id=p_product_id and id=act.id returning * into act;
  for pair in select * from jsonb_each((changes-'meta')||meta_changes) loop
    insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,field_name,old_value,new_value,source,metadata)
      values(p_product_id,act.id,task_id,'creative_field_changed',pair.key,
        case when meta_changes ? pair.key then a.meta->>pair.key else old_values->>pair.key end,pair.value#>>'{}','qa-next',jsonb_build_object('linked_ad_id',a.id));
  end loop;
  return jsonb_build_object('ad',saved,'action',to_jsonb(act));
end $$;
revoke all on function public.qa_plan_creative(text,uuid,timestamptz,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_plan_creative(text,uuid,timestamptz,text,timestamptz,jsonb) to authenticated;
