-- Tracker mutations run as the signed-in user and keep multi-table writes atomic.
create or replace function public.qa_tracker_access(p_product_id text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.has_product(p_product_id) or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and not must_change_password
  ) then raise exception 'Active product access is required'; end if;
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product is unavailable'; end if;
end;
$$;

create or replace function public.qa_tracker_save(
  p_product_id text, p_ad_id text, p_expected_updated_at timestamptz, p_values jsonb, p_custom jsonb default '{}'
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.ads%rowtype; previous public.ads%rowtype; m jsonb; pending jsonb; pair record; mirror jsonb := '{}';
  ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform public.qa_tracker_access(p_product_id);
  if jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_custom) is distinct from 'object' then raise exception 'Invalid creative values'; end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where k <> all(array[
    'format_name','ad_link','drive_link','ad_type','funnel_stage','status','angle','persona','meta'
  ])) then raise exception 'Unsupported creative field'; end if;
  if p_values ? 'meta' and (jsonb_typeof(p_values->'meta') <> 'object' or exists(
    select 1 from jsonb_object_keys(p_values->'meta') k where k <> all(array[
      'creativeStructure','hookType','productionStyle','creativeHypothesis','creativeUSP','winningElement','notes','dueDate','_dueDateMs'
    ]))) then raise exception 'Unsupported creative metadata'; end if;
  if p_ad_id is not null then
    select * into a from public.ads where id = p_ad_id and product_id = p_product_id for update;
    if not found or a.deleted_at is not null then raise exception 'Creative is no longer available'; end if;
    if a.updated_at is distinct from p_expected_updated_at then raise exception 'Creative changed. Reload it before saving; your draft has been kept.'; end if;
  else
    a.id := 'ad-' || gen_random_uuid()::text; a.product_id := p_product_id;
    a.status := 'Untested'; a.ad_type := 'Video'; a.funnel_stage := 'TOF'; a.ad_origin := 'Manual'; a.meta := '{}';
  end if;
  previous := a;
  a := jsonb_populate_record(a, p_values - 'meta');
  if nullif(trim(a.format_name), '') is null or nullif(trim(a.status), '') is null then raise exception 'Creative name and status are required'; end if;
  if coalesce(a.ad_link, '') !~ '^(https?://|$)' or coalesce(a.drive_link, '') !~ '^(https?://|$)' then raise exception 'Invalid creative link'; end if;
  m := coalesce(a.meta, '{}') || coalesce(p_values->'meta', '{}');
  pending := coalesce(m->'_trackerPending', '{}');
  for pair in select * from jsonb_each(p_values - 'meta') loop
    mirror := mirror || jsonb_build_object(case pair.key when 'format_name' then 'formatName' when 'ad_link' then 'adLink'
      when 'drive_link' then 'driveLink' when 'ad_type' then 'adType' when 'funnel_stage' then 'funnelStage' else pair.key end, pair.value);
    pending := pending || jsonb_build_object(pair.key, pair.value);
  end loop;
  m := m || mirror;
  for pair in select * from jsonb_each(coalesce(p_values->'meta', '{}') - '_dueDateMs') loop
    pending := pending || jsonb_build_object(pair.key, pair.value);
  end loop;
  for pair in select * from jsonb_each(p_custom) loop
    if jsonb_typeof(pair.value) <> 'object' or nullif(pair.value->>'name','') is null or not pair.value ? 'value' then raise exception 'Invalid custom field'; end if;
    if pair.key='__task_assignees' then
      if jsonb_typeof(pair.value->'value') is distinct from 'array' then raise exception 'Invalid assignees'; end if;
      if exists(select 1 from jsonb_array_elements_text(pair.value->'value') u where u !~ '^[1-9][0-9]*$') then raise exception 'Invalid assignees'; end if;
      m := m || jsonb_build_object('assignees',coalesce((select jsonb_agg(jsonb_build_object('id',u::bigint)) from jsonb_array_elements_text(pair.value->'value') u),'[]'::jsonb));
    end if;
    m := m || jsonb_build_object('_customFieldsRaw', coalesce(m->'_customFieldsRaw','{}') || jsonb_build_object(lower(pair.value->>'name'), pair.value->'value'));
    m := m || jsonb_build_object('_customFields', coalesce(m->'_customFields','{}') || jsonb_build_object(lower(pair.value->>'name'), coalesce(pair.value->>'display', pair.value->>'value','')));
    pending := pending || jsonb_build_object('custom:' || pair.key, pair.value->'value');
  end loop;
  if a.status is distinct from previous.status then a.last_status_change_at := ms; m := m || jsonb_build_object('lastStatusChangeAt', ms); end if;
  if (p_values->'meta') ? 'dueDate' then m := m || jsonb_build_object('_dueChangedAt', ms); end if;
  if coalesce(a.clickup_task_id, m->>'_clickupId', m->>'clickupTaskId', '') <> '' then m := m || jsonb_build_object('_trackerPending', pending); end if;
  if p_ad_id is null then
    insert into public.ads(id,product_id,format_name,ad_link,drive_link,ad_type,funnel_stage,status,angle,persona,ad_origin,meta,last_status_change_at)
      values(a.id,p_product_id,a.format_name,a.ad_link,a.drive_link,a.ad_type,a.funnel_stage,a.status,a.angle,a.persona,'Manual',m,ms) returning * into a;
  else
    update public.ads set format_name=a.format_name, ad_link=a.ad_link, drive_link=a.drive_link, ad_type=a.ad_type,
      funnel_stage=a.funnel_stage,status=a.status,angle=a.angle,persona=a.persona,meta=m,last_status_change_at=a.last_status_change_at
      where id=a.id and product_id=p_product_id returning * into a;
  end if;
  update public.manual_actions set live_status=case when p_values ? 'status' then a.status else live_status end,
    payload=payload || case when p_values ? 'format_name' then jsonb_build_object('title',a.format_name) else '{}'::jsonb end
    || case when p_values ? 'angle' then jsonb_build_object('angle',a.angle,'sourceAngle',a.angle) else '{}'::jsonb end
    || case when p_values ? 'persona' then jsonb_build_object('persona',a.persona,'sourcePersona',a.persona) else '{}'::jsonb end
    || case when (p_values->'meta') ? 'dueDate' then jsonb_build_object('dueDate',m->>'dueDate','_dueDateMs',m->'_dueDateMs') else '{}'::jsonb end
    || case when p_values ? 'status' then jsonb_build_object('liveStatus',a.status,'_liveStatusChangedAt',ms) else '{}'::jsonb end
  where product_id=p_product_id and (
    coalesce(payload->>'sourceAdId',payload->>'adId',payload->>'_sourceAdId')=a.id
    and (coalesce(payload->>'_clickupId',payload->>'clickupTaskId','')='' or coalesce(a.clickup_task_id,'')='' or coalesce(payload->>'_clickupId',payload->>'clickupTaskId')=a.clickup_task_id)
  );
  return to_jsonb(a);
end;
$$;

create or replace function public.qa_tracker_delete(p_product_id text,p_ad_id text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.ads%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where id=p_ad_id and product_id=p_product_id for update;
  if not found then raise exception 'Creative is unavailable'; end if;
  if a.deleted_at is not null then return to_jsonb(a); end if;
  if a.updated_at is distinct from p_expected_updated_at then raise exception 'Creative changed. Refresh before deleting.'; end if;
  insert into public.deleted_ads(id,product_id,clickup_task_id,format_name,deleted_by,reason)
    values(a.id,p_product_id,coalesce(a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId'),a.format_name,auth.uid()::text,'qa-tracker')
    on conflict(id) do nothing;
  update public.ads set deleted_at=now() where id=a.id and product_id=p_product_id returning * into a;
  delete from public.manual_actions where product_id=p_product_id and
    coalesce(payload->>'sourceAdId',payload->>'adId',payload->>'_sourceAdId')=a.id and
    (coalesce(payload->>'_clickupId',payload->>'clickupTaskId','')='' or coalesce(a.clickup_task_id,'')='' or coalesce(payload->>'_clickupId',payload->>'clickupTaskId')=a.clickup_task_id);
  update public.matrix_cells set creative_assignments=creative_assignments-a.id,
    meta=coalesce((select jsonb_object_agg(key,value) from jsonb_each(meta) where key<>a.id and left(key,length(a.id)+2)<>a.id||'||'),'{}')
    where product_id=p_product_id and (creative_assignments ? a.id or meta ? a.id or exists(
      select 1 from jsonb_object_keys(meta) k where left(k,length(a.id)+2)=a.id||'||'));
  if nullif(a.meta->>'_fromInspoId','') is not null and not exists (
    select 1 from public.ads where product_id=p_product_id and deleted_at is null and meta->>'_fromInspoId'=a.meta->>'_fromInspoId'
  ) then update public.inspirations set status='Classified' where product_id=p_product_id and id=a.meta->>'_fromInspoId' and status='Testing'; end if;
  return to_jsonb(a);
end;
$$;

create or replace function public.qa_tracker_winner(p_product_id text,p_ad_id text,p_file_id text,p_name text,p_remove boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.ads%rowtype; artifacts jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where id=p_ad_id and product_id=p_product_id for update;
  if not found or a.deleted_at is not null then raise exception 'Creative is unavailable'; end if;
  if p_file_id !~ '^[A-Za-z0-9_-]+$' or nullif(p_file_id,'') is null then raise exception 'Invalid Drive file'; end if;
  if not p_remove and a.status not in ('Winner','Mild Winner','Scale') then raise exception 'Mark the creative as a winner first'; end if;
  if p_remove then delete from public.task_video_winners where ad_id=a.id and drive_file_id=p_file_id;
  else
    insert into public.task_video_winners(ad_id,drive_file_id,file_name,web_view_url,marked_by)
      values(a.id,p_file_id,coalesce(nullif(trim(p_name),''),a.format_name),'https://drive.google.com/file/d/'||p_file_id||'/view',auth.uid()::text)
      on conflict(ad_id,drive_file_id) do update set file_name=excluded.file_name, web_view_url=excluded.web_view_url;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',drive_file_id,'name',file_name,'url',web_view_url) order by marked_winner_at),'[]')
    into artifacts from public.task_video_winners where ad_id=a.id;
  update public.ads set meta=coalesce(meta,'{}')||jsonb_build_object('_winningArtifacts',artifacts) where id=a.id returning * into a;
  return to_jsonb(a);
end;
$$;

create or replace function public.qa_tracker_ack_push(p_product_id text,p_ad_id text,p_sent jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare a public.ads%rowtype; pending jsonb; pair record;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where id=p_ad_id and product_id=p_product_id for update;
  if not found or a.deleted_at is not null then raise exception 'Creative is unavailable'; end if;
  pending := coalesce(a.meta->'_trackerPending','{}');
  for pair in select * from jsonb_each(p_sent) loop
    if pending->pair.key = pair.value then pending := pending-pair.key; end if;
  end loop;
  update public.ads set meta=meta||jsonb_build_object('_trackerPending',pending) where id=a.id;
end;
$$;

revoke all on function public.qa_tracker_access(text), public.qa_tracker_save(text,text,timestamptz,jsonb,jsonb),
  public.qa_tracker_delete(text,text,timestamptz), public.qa_tracker_winner(text,text,text,text,boolean),
  public.qa_tracker_ack_push(text,text,jsonb) from public,anon;
grant execute on function public.qa_tracker_access(text), public.qa_tracker_save(text,text,timestamptz,jsonb,jsonb),
  public.qa_tracker_delete(text,text,timestamptz), public.qa_tracker_winner(text,text,text,text,boolean),
  public.qa_tracker_ack_push(text,text,jsonb) to authenticated;

create or replace function public.qa_tracker_spawn(p_product_id text,p_parent_id text,p_expected_updated_at timestamptz,
  p_kind text,p_rows jsonb,p_winner_file_id text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare parent public.ads%rowtype; child public.ads%rowtype; row jsonb; num integer; v_angle_id text; v_persona_id text; editors jsonb; reviewers jsonb; due text;
  stage text; axis text; child_name text; m jsonb; winner jsonb; ids jsonb := '[]';
begin
  perform public.qa_tracker_access(p_product_id);
  select * into parent from public.ads where id=p_parent_id and product_id=p_product_id for update;
  if not found or parent.deleted_at is not null then raise exception 'Parent creative is unavailable'; end if;
  if parent.updated_at is distinct from p_expected_updated_at then raise exception 'Parent changed. Reopen the variation form.'; end if;
  if parent.status not in ('Winner','Mild Winner','Scale') then raise exception 'Choose a winning creative'; end if;
  if p_kind not in ('variation','funnel') or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) not between 1 and 20 then raise exception 'Choose 1 to 20 variations or funnel stages'; end if;
  select id into v_angle_id from public.angles where product_id=p_product_id and lower(name)=lower(parent.angle) and archived_at is null order by id limit 1;
  select id into v_persona_id from public.personas where product_id=p_product_id and lower(name)=lower(parent.persona) and archived_at is null order by id limit 1;
  if v_angle_id is null or v_persona_id is null then raise exception 'Add the parent angle and persona to this product before spawning'; end if;
  if nullif(p_winner_file_id,'') is not null then
    select jsonb_build_object('id',drive_file_id,'name',file_name,'url',web_view_url) into winner
      from public.task_video_winners where ad_id=parent.id and drive_file_id=p_winner_file_id;
    if winner is null then raise exception 'Selected winning file is no longer available'; end if;
  end if;
  select coalesce(max(variation_number),0) into num from public.ads where product_id=p_product_id and parent_ad_id=parent.id;
  for row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(row) is distinct from 'object' then raise exception 'Invalid variation'; end if;
    if jsonb_typeof(coalesce(row->'editorIds','[]')) is distinct from 'array' or jsonb_typeof(coalesce(row->'reviewerIds','[]')) is distinct from 'array'
      then raise exception 'Invalid assignees'; end if;
    if exists(select 1 from jsonb_array_elements_text(coalesce(row->'editorIds','[]')||coalesce(row->'reviewerIds','[]')) u where u !~ '^[1-9][0-9]*$') then raise exception 'Invalid assignees'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',u::bigint)),'[]') into editors from jsonb_array_elements_text(coalesce(row->'editorIds','[]')) u;
    select coalesce(jsonb_agg(jsonb_build_object('id',u::bigint)),'[]') into reviewers from jsonb_array_elements_text(coalesce(row->'reviewerIds','[]')) u;
    due := coalesce(row->>'dueDate','');
    if due<>'' and (due !~ '^\d{4}-\d{2}-\d{2}$' or (due::date)::text<>due) then raise exception 'Invalid due date'; end if;
    stage := case when p_kind='funnel' then row->>'stage' else parent.funnel_stage end;
    if p_kind='funnel' then
      if stage not in ('TOF','MOF','BOF') or stage is null then raise exception 'Invalid funnel stage'; end if;
      if exists(select 1 from public.ads where product_id=p_product_id and deleted_at is null
        and angle=parent.angle and persona=parent.persona and funnel_stage=stage) then continue; end if;
      child.id := 'ad-'||gen_random_uuid()::text; child_name := parent.format_name||' - '||stage;
    else
      axis := coalesce(nullif(trim(row->>'axis'),''),'Hook');
      loop
        num := num+1; child.id := parent.id||'-V'||num;
        exit when not exists(select 1 from public.ads where id=child.id) and not exists(select 1 from public.deleted_ads where id=child.id);
      end loop;
      child_name := parent.format_name||' - V'||num||' - '||axis;
    end if;
    m := jsonb_build_object('taskType','format','_sourceAdId',parent.id,'_fromTrackerAdId',parent.id,
      '_sourceClickupId',coalesce(parent.clickup_task_id,''),'_sourceFormatName',parent.format_name,'parentTaskName',parent.format_name,
      '_sourceFormatDriveLink',coalesce(winner->>'url',parent.drive_link,''),'_sourceFormatAdLink',coalesce(parent.ad_link,''),
      'creativeStructure',coalesce(parent.meta->>'creativeStructure',''),'hookType',coalesce(parent.meta->>'hookType',''),
      'productionStyle',coalesce(parent.meta->>'productionStyle',''),'creativeUSP',coalesce(parent.meta->>'creativeUSP',''),
      'notes',coalesce(row->>'brief',''),'variationNotes',coalesce(row->>'brief',''),
      'creativeHypothesis',coalesce(row->>'hypothesis',''),'variationFromText',coalesce(row->>'from',''),
      'variationToText',coalesce(row->>'to',''),'variationHypothesis',coalesce(row->>'hypothesis',''),
      'variationBrief',coalesce(row->>'brief',''),'dueDate',due,
      '_dueDateMs',case when due<>'' then (extract(epoch from (due||'T23:59:59Z')::timestamptz)*1000)::bigint else null end,
      'assignees',editors,'_customFieldsRaw',jsonb_build_object('editor',editors,'reviewer',reviewers),
      'variationChanges',case when p_kind='variation' then jsonb_build_array(axis) else '[]'::jsonb end);
    if winner is not null then m := m||jsonb_build_object('_sourceWinningArtifact',winner); end if;
    insert into public.ads(id,product_id,format_name,ad_link,drive_link,ad_type,funnel_stage,status,angle,persona,parent_ad_id,variation_number,ad_origin,meta)
      values(child.id,p_product_id,child_name,'','',parent.ad_type,stage,'Untested',parent.angle,parent.persona,
        case when p_kind='variation' then parent.id else null end,case when p_kind='variation' then num else null end,
        case when p_kind='variation' then 'Winner Variation' else 'Funnel Expansion' end,m) returning * into child;
    ids := ids||jsonb_build_array(child.id);
    insert into public.matrix_cells(product_id,angle_id,persona_id,creative_assignments)
      values(p_product_id,v_angle_id,v_persona_id,jsonb_build_array(child.id))
      on conflict(product_id,angle_id,persona_id) do update set creative_assignments=matrix_cells.creative_assignments||excluded.creative_assignments;
  end loop;
  return ids;
end;
$$;
revoke all on function public.qa_tracker_spawn(text,text,timestamptz,text,jsonb,text) from public,anon;
grant execute on function public.qa_tracker_spawn(text,text,timestamptz,text,jsonb,text) to authenticated;
