-- Copies content into the destination only. No source, queue or external-task writes.
create or replace function public.qa_inspiration_cross_import(p_product_id text,p_request_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; pid text; i public.inspirations%rowtype; a public.ads%rowtype;
  receipt public.qa_inspiration_receipts%rowtype; source_product public.products%rowtype;
  content jsonb; source_data jsonb; source_url text; source_title text; source_platform text; source_status text;
  existing_id text; new_id text; prefix text; serial numeric; author text; stamp timestamptz:=clock_timestamp();
  results jsonb:='[]'; result jsonb; req jsonb; imported integer:=0;
  content_keys text[]:=array['formatName','brand','platform','angle','persona','hookType','creativeStructure','productionStyle','funnelStage','adType',
    'creativeUSP','creativeHypothesis','notes','bodyCopy','headline','ctaText','landingUrl','duration','duration_seconds','mediaKind','media_kind',
    'voiceOver','voice_over','voiceOverTimeline','captionTranscript','captionTimeline','hookText','nextAdScripts','_classificationBrief',
    '_clickupDocPageUrl','_clickupDocId','_inspoDocCreated','_angleScope','_personaScope'];
begin
  if p_request_id is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Choose 1 to 50 sources'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'kind','') not in ('inspiration','winner')
      or nullif(item->>'sourceProductId','') is null or nullif(item->>'sourceId','') is null or nullif(item->>'version','') is null
      or item->>'sourceProductId'=p_product_id then raise exception 'Choose versioned sources from other products'; end if;
    if exists(select 1 from jsonb_each(item) v where v.key<>all(array['kind','sourceProductId','sourceId','version']) or jsonb_typeof(v.value)<>'string') then raise exception 'Unsupported source values'; end if;
  end loop;
  if (select count(distinct jsonb_build_array(v->>'kind',v->>'sourceProductId',v->>'sourceId')) from jsonb_array_elements(p_items) v)<>jsonb_array_length(p_items) then raise exception 'Duplicate selected sources'; end if;
  -- Canonical lock order prevents opposite-direction imports from deadlocking.
  for pid in select p_product_id union select value->>'sourceProductId' from jsonb_array_elements(p_items) order by 1 loop
    perform public.qa_tracker_access(pid);
  end loop;
  req:=jsonb_build_object('operation','cross_import','items',p_items);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  select coalesce(nullif(full_name,''),nullif(username,''),auth.uid()::text) into author from public.profiles where id=auth.uid();
  select upper(coalesce(nullif(config->>'ins_prefix',''),left((select string_agg(left(w,1),'') from unnest(regexp_split_to_array(trim(name),'\s+')) w),3),'QA'))
    into prefix from public.products where id=p_product_id;
  prefix:=coalesce(nullif(regexp_replace(prefix,'[^A-Z0-9]','','g'),''),'QA');
  perform pg_advisory_xact_lock(hashtext('qa-inspiration-prefix:'||prefix));
  select coalesce(max(substring(source_id from '-INS-([0-9]+)$')::numeric),0) into serial from
    (select id source_id from public.inspirations union all select ins_id from public.inspiration_queue) ids where source_id ~ ('^'||prefix||'-INS-[0-9]+$');
  for item in select value from jsonb_array_elements(p_items) loop
    select * into source_product from public.products where id=item->>'sourceProductId';
    if item->>'kind'='inspiration' then
      select * into i from public.inspirations where product_id=source_product.id and id=item->>'sourceId' for share;
      if not found or i.updated_at is distinct from (item->>'version')::timestamptz then raise exception 'Source changed. Refresh sources and select again.'; end if;
      if coalesce(lower(i.status),'') not in ('saved','classified','approved','testing','winner','mild winner','scale','loser','killed') then raise exception 'Source inspiration is not ready'; end if;
      perform 1 from public.inspiration_queue where product_id=source_product.id and ins_id=i.id for share;
      if exists(select 1 from public.inspiration_queue where product_id=source_product.id and ins_id=i.id and coalesce(lower(status),'') not in ('classified','done','completed')) then raise exception 'Source classifier queue is not ready'; end if;
      source_data:=coalesce(i.data,'{}');source_url:=coalesce(nullif(i.url,''),source_data->>'sourceUrl','');
      source_title:=coalesce(nullif(source_data->>'formatName',''),nullif(i.title,''),i.id);
      source_platform:=coalesce(nullif(i.platform,''),source_data->>'platform','Other');
      source_status:=case when lower(i.status)='saved' then 'Saved' else 'Classified' end;
    else
      select * into a from public.ads where product_id=source_product.id and id=item->>'sourceId' for share;
      if not found or a.updated_at is distinct from (item->>'version')::timestamptz then raise exception 'Source changed. Refresh sources and select again.'; end if;
      if a.deleted_at is not null or nullif(coalesce(nullif(a.parent_ad_id,''),a.meta->>'parentAdId'),'') is not null
        or coalesce(a.meta->>'_productBoundaryQuarantined','false')<>'false'
        or lower(coalesce(a.status,a.meta->>'status','')) not in ('winner','mild winner','scale')
        or exists(select 1 from public.deleted_ads t where t.product_id=source_product.id and (t.id=a.id or t.clickup_task_id=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'clickupTaskId',''),nullif(a.meta->>'_clickupId','')))) then raise exception 'Winning format is no longer eligible'; end if;
      source_data:=coalesce(a.meta,'{}')||jsonb_build_object('brand',source_product.name,'angle',coalesce(a.angle,a.meta->>'angle',''),
        'persona',coalesce(a.persona,a.meta->>'persona',''),'adType',coalesce(a.ad_type,a.meta->>'adType',''),'funnelStage',coalesce(nullif(a.funnel_stage,''),a.meta->>'funnelStage','TOF'));
      source_url:=coalesce(nullif(a.ad_link,''),a.meta->>'adLink','');source_title:=coalesce(nullif(a.format_name,''),a.meta->>'formatName',a.id);
      source_platform:=coalesce(nullif(a.meta->>'platform',''),'Other');source_status:='Classified';
      if nullif(source_data->>'_clickupDocPageUrl','') is null and nullif(source_data->>'_sourceInspirationBriefUrl','') is not null then
        source_data:=source_data||jsonb_build_object('_clickupDocPageUrl',source_data->>'_sourceInspirationBriefUrl');
      end if;
    end if;
    existing_id:=null;
    select id into existing_id from public.inspirations where product_id=p_product_id and (
      (data->>'_sourceProductId'=source_product.id and data->>(case when item->>'kind'='winner' then '_sourceAdId' else '_sourceInsId' end)=item->>'sourceId')
      or (source_url<>'' and regexp_replace(url,'[/#]+$','','g')=regexp_replace(source_url,'[/#]+$','','g'))
    ) order by created_at,id limit 1;
    if existing_id is null then
      select coalesce(jsonb_object_agg(key,value),'{}') into content from jsonb_each(source_data) where key=any(content_keys);
      content:=content||jsonb_build_object('formatName',source_title,'sourceUrl',source_url,'platform',source_platform,
        'status',source_status,'addedBy',author,'addedAt',(extract(epoch from stamp)*1000)::bigint,'classifiedAt',(extract(epoch from stamp)*1000)::bigint,
        '_sourceProductId',source_product.id,'_sourceProductName',source_product.name,'_sourceVersion',item->>'version','_qaImportedBy',auth.uid(),
        'reusedIn','[]'::jsonb,'importTags',jsonb_build_array(case when item->>'kind'='winner' then 'Winning Format' else 'Imported' end,'From: '||source_product.name),
        '_qaImportLineage',(case when jsonb_typeof(source_data->'_qaImportLineage')='array' then source_data->'_qaImportLineage' else '[]'::jsonb end)
          ||jsonb_build_array(jsonb_build_object('kind',item->>'kind','productId',source_product.id,'id',item->>'sourceId')));
      content:=content||case when item->>'kind'='winner' then jsonb_build_object('_sourceAdId',a.id,'_sourceClickupId',coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'clickupTaskId',''),nullif(a.meta->>'_clickupId',''),''))
        else jsonb_build_object('_sourceInsId',i.id) end;
      serial:=serial+1;new_id:=prefix||'-INS-'||lpad(serial::text,greatest(3,length(serial::text)),'0');
      insert into public.inspirations(id,product_id,url,title,platform,added_by,status,data,created_at,updated_at)
        values(new_id,p_product_id,source_url,source_title,source_platform,author,source_status,content,stamp,stamp);
      imported:=imported+1;
    else new_id:=existing_id; end if;
    results:=results||jsonb_build_array(jsonb_build_object('kind',item->>'kind','sourceProductId',source_product.id,'sourceId',item->>'sourceId',
      'id',new_id,'status',case when existing_id is null then 'imported' else 'existing' end));
  end loop;
  result:=jsonb_build_object('requestId',p_request_id,'productId',p_product_id,'operation','cross_import','items',results,
    'imported',imported,'existing',jsonb_array_length(p_items)-imported,'dispatchEnabled',false);
  insert into public.qa_inspiration_receipts(request_id,product_id,user_id,request,response) values(p_request_id,p_product_id,auth.uid(),req,result);
  return result;
end $$;
revoke all on function public.qa_inspiration_cross_import(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_cross_import(text,uuid,jsonb) to authenticated;
