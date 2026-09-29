-- QA Matrix creation is atomic; no Action Plan or external writes occur here.
create or replace function public.qa_matrix_create(p_product_id text,p_angle_id text,p_persona_id text,
  p_kind text,p_items jsonb,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare ang public.angles%rowtype; per public.personas%rowtype; src public.ads%rowtype; ins public.inspirations%rowtype;
  item jsonb; m jsonb; d jsonb; win jsonb; new_id text; existing_id text; ids jsonb:='[]';
  label text; link text; adtype text; funnel text; origin text; idx integer:=0; digest text; prior jsonb;
  product public.products%rowtype; words text[]; prefix text; serial bigint; saved_serial bigint; suffix text;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into product from public.products where id=p_product_id;
  words:=regexp_split_to_array(coalesce(nullif(trim(product.name),''),'IM'),'\s+');
  prefix:=upper(case when array_length(words,1)>1 then left(words[1],1)||left(words[2],1) else left(words[1],2) end);
  saved_serial:=coalesce((product.config->'_qaMatrixNameSerials'->>prefix)::bigint,0);
  -- The product lock serializes allocation. Retain the high-water after deletion;
  -- ignore legacy inflated 4+ digit imports when first seeding the counter.
  select greatest(saved_serial,coalesce(max((substring(substr(name,length(prefix)+2) from '^([0-9]{1,3})(?![0-9])'))::bigint),0)) into serial
    from (
      select format_name as name from public.ads where product_id=p_product_id
      union all select meta->>'_cuName' from public.ads where product_id=p_product_id
      union all select payload->>'format' from public.manual_actions where product_id=p_product_id
      union all select payload->>'title' from public.manual_actions where product_id=p_product_id
    ) names where upper(left(name,length(prefix)+1))=prefix||'-';
  select * into ang from public.angles where id=p_angle_id and product_id=p_product_id and archived_at is null for share;
  if not found then raise exception 'Active angle is unavailable'; end if;
  select * into per from public.personas where id=p_persona_id and product_id=p_product_id and archived_at is null for share;
  if not found then raise exception 'Active persona is unavailable'; end if;
  if p_kind is null or p_kind not in ('tracker','inspiration','blank') or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 50 or p_request_id is null then raise exception 'Choose 1 to 50 sources'; end if;
  digest:=md5(jsonb_build_array(p_angle_id,p_persona_id,p_kind,p_items)::text);
  select meta->'_matrixResultIds' into prior from public.ads
    where product_id=p_product_id and meta->>'_matrixRequestId'=p_request_id::text limit 1;
  if prior is not null then
    if exists(select 1 from public.ads where product_id=p_product_id and meta->>'_matrixRequestId'=p_request_id::text
      and (deleted_at is not null or meta->>'_matrixRequestHash' is distinct from digest)) or exists(
        select 1 from jsonb_array_elements_text(prior) v where not exists(select 1 from public.ads where id=v and product_id=p_product_id and deleted_at is null)
      ) then raise exception 'Creation request was already used or deleted'; end if;
    return prior;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid source'; end if;
    idx:=idx+1; existing_id:=null; m:='{}'; d:='{}'; win:=null; link:='';
    if p_kind='tracker' then
      select * into src from public.ads where product_id=p_product_id and id=item->>'sourceId' and deleted_at is null for share;
      if not found or coalesce((src.meta->>'_productBoundaryQuarantined')::boolean,false)
        or coalesce(src.meta->>'taskType','')='production' or nullif(src.meta->>'trackerRefId','') is not null then raise exception 'Tracker source is unavailable'; end if;
      if src.updated_at is distinct from (item->>'version')::timestamptz then raise exception 'Tracker source changed. Refresh before creating.'; end if;
      select id into existing_id from public.ads where product_id=p_product_id and deleted_at is null and angle=ang.name and persona=per.name and meta->>'sourceFormatId'=src.id order by created_at limit 1;
      select jsonb_build_object('id',drive_file_id,'name',file_name,'url',web_view_url) into win from public.task_video_winners where ad_id=src.id order by marked_winner_at desc,id limit 1;
      d:=coalesce(src.meta,'{}'); label:=src.format_name||' - '||ang.name||' x '||per.name;
      link:=coalesce(nullif(win->>'url',''),nullif(src.ad_link,''),src.drive_link,''); adtype:=coalesce(src.ad_type,''); funnel:=coalesce(src.funnel_stage,''); origin:='Production';
      m:=jsonb_build_object('sourceFormatId',src.id,'_fromTrackerAdId',src.id,'_sourceFormatName',src.format_name,
        '_sourceClickupId',coalesce(src.clickup_task_id,d->>'_clickupId',''),'_sourceFormatDriveLink',coalesce(win->>'url',src.drive_link,''),
        '_sourceFormatAdLink',coalesce(src.ad_link,''),'_sourceWinnerFileId',win->>'id','_sourceWinnerFileName',win->>'name','_sourceWinnerFileUrl',win->>'url');
    elsif p_kind='inspiration' then
      select * into ins from public.inspirations where id=item->>'sourceId' and product_id=p_product_id for update;
      if not found or lower(ins.status) in ('pending','queued','processing','classifying','failed','error') then raise exception 'Inspiration is not ready'; end if;
      if ins.updated_at is distinct from (item->>'version')::timestamptz then raise exception 'Inspiration changed. Refresh before creating.'; end if;
      select id into existing_id from public.ads where product_id=p_product_id and deleted_at is null and angle=ang.name and persona=per.name and meta->>'_fromInspoId'=ins.id order by created_at limit 1;
      d:=coalesce(ins.data,'{}'); label:=coalesce(nullif(ins.title,''),nullif(d->>'formatName',''),ins.id)||' - '||ang.name||' x '||per.name;
      link:=coalesce(nullif(d->>'sourceUrl',''),ins.url,''); adtype:=coalesce(d->>'adType',''); funnel:=coalesce(d->>'funnelStage',''); origin:='From Inspo';
      m:=jsonb_build_object('_fromInspoId',ins.id,'_sourceInsId',ins.id,'_sourceInspoUrl',coalesce(nullif(d->>'_clickupDocPageUrl',''),link),
        '_sourceInspirationBriefUrl',coalesce(d->>'_clickupDocPageUrl',''),'_sourceInspoAdUrl',link);
    else
      label:=trim(item->>'name'); if nullif(label,'') is null then raise exception 'A brief name is required'; end if;
      adtype:=coalesce(item->>'adType',''); funnel:=coalesce(item->>'funnelStage',''); origin:='Manual';
      d:=jsonb_build_object('creativeHypothesis',coalesce(item->>'hypothesis',''),'notes',coalesce(item->>'notes',''));
    end if;
    if existing_id is not null then new_id:=existing_id;
    else
      if p_kind<>'blank' then
        serial:=serial+1;
        if p_kind='tracker' then
          suffix:=coalesce(src.format_name,'');
          if upper(left(suffix,length(prefix)+1))=prefix||'-' then
            suffix:=regexp_replace(substr(suffix,length(prefix)+2),'^[0-9]{1,4}-','');
            if suffix=substr(src.format_name,length(prefix)+2) then suffix:=src.format_name; end if;
          end if;
        else suffix:=coalesce('INS-'||substring(ins.id from '(?i)INS-([0-9]+)'),ins.id);
        end if;
        label:=prefix||'-'||lpad(serial::text,greatest(3,length(serial::text)),'0')||'-'||suffix;
      end if;
      new_id:='ad-'||gen_random_uuid()::text;
      m:=m||jsonb_build_object('taskType','production','creativeStructure',coalesce(d->>'creativeStructure',''),
        'hookType',coalesce(d->>'hookType',''),'productionStyle',coalesce(d->>'productionStyle',''),
        'creativeHypothesis',coalesce(d->>'creativeHypothesis',''),'creativeUSP',coalesce(d->>'creativeUSP',''),'notes',coalesce(d->>'notes',''),
        'assignees','[]'::jsonb,'dueDate','','_dueDateMs',null,'_matrixAngleId',ang.id,'_matrixPersonaId',per.id,
        '_matrixRequestId',p_request_id::text,'_matrixRequestHash',digest,'_matrixRequestIndex',idx);
      m:=m||jsonb_build_object('_customFieldsRaw',coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(d->'_customFieldsRaw','{}'))
        where lower(key) not in ('drive link','google drive','editor','reviewer','task assignees','approved date','due date','angle','angle tag','persona','persona tag')),'{}')
        ||jsonb_build_object('angle tag',ang.name,'persona tag',per.name),
        '_customFields',jsonb_build_object('angle tag',ang.name,'persona tag',per.name));
      insert into public.ads(id,product_id,format_name,ad_link,drive_link,ad_type,funnel_stage,status,angle,persona,ad_origin,meta)
        values(new_id,p_product_id,label,link,'',adtype,funnel,'Untested',ang.name,per.name,origin,m);
      if p_kind='inspiration' and lower(ins.status) in ('saved','pending','classified') then
        update public.inspirations set status='Testing' where id=ins.id and product_id=p_product_id;
      end if;
    end if;
    insert into public.matrix_cells(product_id,angle_id,persona_id,creative_assignments)
      values(p_product_id,ang.id,per.id,jsonb_build_array(new_id))
      on conflict(product_id,angle_id,persona_id) do update set
        creative_assignments=case when matrix_cells.creative_assignments ? new_id then matrix_cells.creative_assignments else matrix_cells.creative_assignments||excluded.creative_assignments end,
        meta=matrix_cells.meta||jsonb_build_object('_excludedCreativeIds',coalesce(matrix_cells.meta->'_excludedCreativeIds','[]')-new_id);
    if not ids ? new_id then ids:=ids||jsonb_build_array(new_id); end if;
  end loop;
  update public.ads set meta=meta||jsonb_build_object('_matrixResultIds',ids)
    where product_id=p_product_id and meta->>'_matrixRequestId'=p_request_id::text;
  if serial>saved_serial then
    update public.products set config=coalesce(config,'{}')||jsonb_build_object('_qaMatrixNameSerials',
      coalesce(config->'_qaMatrixNameSerials','{}')||jsonb_build_object(prefix,serial)) where id=p_product_id;
  end if;
  return ids;
end;
$$;

create or replace function public.qa_matrix_assignment(p_product_id text,p_angle_id text,p_persona_id text,
  p_ad_id text,p_assigned boolean,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c public.matrix_cells%rowtype; a public.ads%rowtype; ang text; per text; removed_ids jsonb; assignments jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  select name into ang from public.angles where id=p_angle_id and product_id=p_product_id and archived_at is null;
  select name into per from public.personas where id=p_persona_id and product_id=p_product_id and archived_at is null;
  if ang is null or per is null or p_assigned is null then raise exception 'Active cell is unavailable'; end if;
  select * into a from public.ads where id=p_ad_id and product_id=p_product_id and deleted_at is null;
  if not found then raise exception 'Creative is unavailable'; end if;
  select * into c from public.matrix_cells where product_id=p_product_id and angle_id=p_angle_id and persona_id=p_persona_id for update;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Cell changed. Refresh before changing its assignments.'; end if;
  if p_assigned and (a.angle is distinct from ang or a.persona is distinct from per) then raise exception 'Create a new production task to use this source in another cell'; end if;
  removed_ids:=coalesce(c.meta->'_excludedCreativeIds','[]')-a.id;
  assignments:=coalesce(c.creative_assignments,'[]')-a.id-coalesce(a.clickup_task_id,'');
  if p_assigned then assignments:=assignments||jsonb_build_array(a.id); else removed_ids:=removed_ids||jsonb_build_array(a.id); end if;
  insert into public.matrix_cells(product_id,angle_id,persona_id,creative_assignments,meta)
    values(p_product_id,p_angle_id,p_persona_id,assignments,coalesce(c.meta,'{}')||jsonb_build_object('_excludedCreativeIds',removed_ids))
    on conflict(product_id,angle_id,persona_id) do update set creative_assignments=excluded.creative_assignments,meta=excluded.meta
    returning * into c;
  return to_jsonb(c);
end;
$$;
revoke all on function public.qa_matrix_create(text,text,text,text,jsonb,uuid),public.qa_matrix_assignment(text,text,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.qa_matrix_create(text,text,text,text,jsonb,uuid),public.qa_matrix_assignment(text,text,text,text,boolean,timestamptz) to authenticated;
