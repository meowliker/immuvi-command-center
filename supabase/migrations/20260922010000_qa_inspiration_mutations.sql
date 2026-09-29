-- QA-only entry point. Queue writes remain non-claimable until worker isolation is verified.
create table if not exists public.qa_inspiration_receipts (
  request_id uuid primary key, product_id text not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, request jsonb not null, response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.qa_inspiration_receipts enable row level security;
revoke all on public.qa_inspiration_receipts from public, anon, authenticated;

create or replace function public.qa_inspiration_import_data(r public.inspiration_results) returns jsonb
language plpgsql set search_path=public as $$
declare c jsonb:=coalesce(r.classification,'{}'); m jsonb:=coalesce(r.metadata,'{}'); b jsonb:=coalesce(r.brief,'{}');
  s jsonb; k text; voice text; kind text; result jsonb;
begin
  foreach k in array array['hook_type','creative_structure','production_style','funnel_type','persona','angle','creative_usp','creative_hypothesis'] loop
    if jsonb_typeof(c->k) is distinct from 'string' or nullif(trim(c->>k),'') is null then raise exception 'Classification is incomplete: %',k; end if;
  end loop;
  foreach k in array array['why_it_works','replication_brief','what_to_test','competitor_intel','our_next_ad','inspiration_script_skeleton'] loop
    if jsonb_typeof(b->k) is distinct from 'string' or nullif(trim(b->>k),'') is null then raise exception 'Eight-section brief is incomplete: %',k; end if;
  end loop;
  if jsonb_typeof(b->'frame_by_frame') is distinct from 'array' or jsonb_array_length(b->'frame_by_frame')<1
    or jsonb_typeof(b->'next_ad_scripts') is distinct from 'array' or jsonb_array_length(b->'next_ad_scripts')<>3
    then raise exception 'Brief requires a breakdown and three complete scripts'; end if;
  for s in select value from jsonb_array_elements(b->'next_ad_scripts') loop
    foreach k in array array['variation','intent','hook_text','source_format_match','voice_over_script','cta','what_to_change','why_it_should_work'] loop
      if jsonb_typeof(s->k) is distinct from 'string' or nullif(trim(s->>k),'') is null then raise exception 'Next-ad script is incomplete: %',k; end if;
    end loop;
    if jsonb_typeof(s->'script_breakdown') is distinct from 'array' or jsonb_array_length(s->'script_breakdown')<1 then raise exception 'Script breakdown is missing'; end if;
  end loop;
  voice:=coalesce(c->>'voice_over',m->>'voice_over',b->>'voice_over','');
  if voice ~* '^(voice ?over present - )?transcript unavailable$' then voice:=''; end if;
  kind:=coalesce(c->>'media_kind',m->>'media_kind','');
  result:=jsonb_build_object('brand',coalesce(m->>'page_name',m->>'brand',''),
    'formatName',split_part(c->>'creative_usp',' '||chr(8212)||' ',1),'creativeUSP',c->>'creative_usp',
    'hookType',c->>'hook_type','creativeStructure',c->>'creative_structure','productionStyle',c->>'production_style',
    'funnelStage',c->>'funnel_type','angle',c->>'angle','persona',c->>'persona','_angleScope','inspiration','_personaScope','inspiration',
    'mediaKind',kind,'adType',case kind when 'image' then 'Photo' when 'carousel' then 'Carousel' when 'video' then 'Video' else coalesce(c->>'photo_video',c->>'ad_type','') end,
    'creativeHypothesis',c->>'creative_hypothesis','notes',coalesce(c->>'notes',''),
    'bodyCopy',coalesce(m->>'body_copy_from_frames',m->>'body_text',''),'voiceOver',voice,
    'voiceOverTimeline',coalesce(c->'voice_over_timeline',m->'voice_over_timeline',b->'voice_over_timeline','[]'),
    'captionTranscript',coalesce(m->>'caption_transcript',b->>'caption_transcript',''),
    'captionTimeline',coalesce(m->'caption_timeline','[]'),'hookText',coalesce(m->>'hook_text',c->>'hook_text',''),
    'nextAdScripts',b->'next_ad_scripts','_classificationBrief',b,'_qaImportedResultId',r.id,
    '_qaImportedResultAt',r.classified_at,'classifiedAt',(extract(epoch from r.classified_at)*1000)::bigint);
  if coalesce(r.clickup_doc_page_url,'') ~ '^https://[^/@[:space:]]+(/|$)' then
    result:=result||jsonb_build_object('_clickupDocPageUrl',r.clickup_doc_page_url,'_clickupDocId',r.clickup_doc_id,'_inspoDocCreated',true);
  end if;
  return result;
end $$;
revoke all on function public.qa_inspiration_import_data(public.inspiration_results) from public,anon,authenticated;

create or replace function public.qa_inspiration_mutate(p_product_id text,p_request_id uuid,p_operation text,
  p_id text default null,p_expected_updated_at timestamptz default null,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare i public.inspirations%rowtype; q public.inspiration_queue%rowtype; r public.inspiration_results%rowtype;
  receipt public.qa_inspiration_receipts%rowtype; a public.ads%rowtype; req jsonb; result jsonb; values_data jsonb;
  key text; value jsonb; stamp timestamptz:=clock_timestamp(); children jsonb:='[]'; remote_ids jsonb:='[]';
  prefix text; owner_id text; owners int; target_id text; source_url text; queue_json jsonb; detail text; next_number numeric;
  blocked text:='Classifier dispatch is disabled in QA until an isolated test worker and destination are verified.';
begin
  perform public.qa_tracker_access(p_product_id);
  if p_request_id is null or p_operation is null or p_operation not in ('create','save','approve','requeue','delete','dismiss_duplicate','import') then raise exception 'Unsupported inspiration operation'; end if;
  if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid inspiration values'; end if;
  req:=jsonb_build_object('operation',p_operation,'id',p_id,'version',p_expected_updated_at,'values',p_values);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['fields','queue','children','mode','result_id','result_at'])) then raise exception 'Unsupported request values'; end if;
  values_data:=coalesce(p_values->'fields','{}');
  if jsonb_typeof(values_data) is distinct from 'object' then raise exception 'Invalid inspiration fields'; end if;
  for key,value in select * from jsonb_each(values_data) loop
    if key<>all(array['sourceUrl','formatName','brand','platform','addedBy','angle','persona','hookType','creativeStructure','productionStyle','funnelStage','adType','creativeHypothesis','notes','bodyCopy','voiceOver'])
      or jsonb_typeof(value)<>'string' or length(value#>>'{}')>20000 then raise exception 'Unsupported inspiration field: %',key; end if;
  end loop;
  if values_data ? 'formatName' and (nullif(trim(values_data->>'formatName'),'') is null or length(values_data->>'formatName')>200) then raise exception 'Format name must be 1-200 characters'; end if;
  if values_data ? 'sourceUrl' and (values_data->>'sourceUrl' !~ '^https?://[^/@[:space:]?#]+([/?#]|$)' or length(values_data->>'sourceUrl')>4000) then raise exception 'Enter a valid public source URL'; end if;
  if p_operation='create' then
    if p_id is not null or p_expected_updated_at is not null or coalesce(p_values->>'mode','') not in ('url','manual') then raise exception 'Invalid intake request'; end if;
    source_url:=trim(values_data->>'sourceUrl');
    if coalesce(source_url,'')='' then raise exception 'Source URL is required'; end if;
    if exists(select 1 from public.inspirations where product_id=p_product_id and regexp_replace(url,'[/#]+$','','g')=regexp_replace(source_url,'[/#]+$','','g'))
      or exists(select 1 from public.inspiration_queue where product_id=p_product_id and regexp_replace(url,'[/#]+$','','g')=regexp_replace(source_url,'[/#]+$','','g')) then raise exception 'This source URL already exists in this product. Open the existing inspiration.'; end if;
    select upper(coalesce(nullif(config->>'ins_prefix',''),left((select string_agg(left(w,1),'') from unnest(regexp_split_to_array(trim(name),'\s+')) w),3),'QA'))
      into prefix from public.products where id=p_product_id;
    prefix:=coalesce(nullif(regexp_replace(prefix,'[^A-Z0-9]','','g'),''),'QA');
    perform pg_advisory_xact_lock(hashtext('qa-inspiration-prefix:'||prefix));
    select coalesce(max(substring(source_id from '-INS-([0-9]+)$')::numeric),0)+1 into next_number from
      (select id source_id from public.inspirations union all select ins_id from public.inspiration_queue) ids
      where source_id ~ ('^'||prefix||'-INS-[0-9]+$');
    target_id:=prefix||'-INS-'||lpad(next_number::text,greatest(3,length(next_number::text)),'0');
    insert into public.inspirations(id,product_id,url,title,platform,added_by,status,data)
      values(target_id,p_product_id,source_url,coalesce(nullif(values_data->>'formatName',''),source_url),values_data->>'platform',values_data->>'addedBy',
        case when p_values->>'mode'='url' then 'Blocked' else 'Saved' end,values_data||jsonb_build_object('_qaCreatedBy',auth.uid())) returning * into i;
  else
    select * into i from public.inspirations where id=p_id and product_id=p_product_id for update;
    if not found or p_expected_updated_at is null or i.updated_at is distinct from p_expected_updated_at then raise exception 'Inspiration changed. Reopen it before saving; your draft has been kept.'; end if;
    prefix:=substring(i.id from '^([A-Za-z0-9]+)-INS-[0-9]+$');
    if prefix is not null then
      select count(*),min(id) into owners,owner_id from public.products where upper(coalesce(nullif(config->>'ins_prefix',''),left((select string_agg(left(w,1),'') from unnest(regexp_split_to_array(trim(name),'\s+')) w),3)))=upper(prefix);
      if owners=1 and owner_id<>p_product_id then raise exception 'Inspiration prefix belongs to another product'; end if;
    end if;
    select * into q from public.inspiration_queue where product_id=p_product_id and ins_id=p_id for update;
    queue_json:=case when found then to_jsonb(q) else 'null'::jsonb end;
    if queue_json is distinct from (case when p_values->'queue' is null or p_values->'queue'='null'::jsonb then 'null'::jsonb
      else to_jsonb(jsonb_populate_record(null::public.inspiration_queue,p_values->'queue')) end) then raise exception 'Queue changed. Reopen this inspiration.'; end if;
    if q.status in ('pending','processing','claimed','classifying') then raise exception 'Wait for the active classifier job to finish before editing this inspiration'; end if;
    if p_operation='import' then
      select * into r from public.inspiration_results where id=(p_values->>'result_id')::uuid and product_id=p_product_id and ins_id=i.id for update;
      if not found or r.classified_at is distinct from (p_values->>'result_at')::timestamptz or r.source_url is distinct from i.url then raise exception 'Classification result identity changed'; end if;
      if q.queued_at is not null and r.classified_at<q.queued_at then raise exception 'Classification result predates the latest retry'; end if;
      if i.data->>'_qaImportedResultAt' is not null and r.classified_at<=(i.data->>'_qaImportedResultAt')::timestamptz then raise exception 'This result has already been imported'; end if;
      values_data:=public.qa_inspiration_import_data(r);
    end if;
    if p_operation in ('save','import') then
      if values_data ? 'sourceUrl' and values_data->>'sourceUrl'<>i.url then raise exception 'Source identity cannot be changed; add a new inspiration instead'; end if;
      if values_data ? 'formatName' and values_data->>'formatName' is distinct from coalesce(i.data->>'formatName',i.title) then
        select coalesce(jsonb_agg(jsonb_build_object('id',ad.id,'version',ad.updated_at) order by ad.id),'[]') into children from public.ads ad
          where ad.product_id=p_product_id and coalesce(ad.meta->>'_fromInspoId',ad.meta->>'_sourceInsId')=i.id and ad.deleted_at is null and coalesce(ad.meta->>'_productBoundaryQuarantined','false')<>'true'
          and not exists(select 1 from public.deleted_ads d where d.product_id=p_product_id and (d.id=ad.id or d.clickup_task_id=coalesce(ad.clickup_task_id,ad.meta->>'_clickupId',ad.meta->>'clickupTaskId')));
        if children is distinct from (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'version',c.version) order by c.id),'[]')
          from jsonb_to_recordset(coalesce(p_values->'children','[]')) as c(id text,version timestamptz)) then raise exception 'Linked creatives changed. Reopen the rename editor.'; end if;
        for a in select ad.* from public.ads ad join jsonb_array_elements(children) c on c->>'id'=ad.id where ad.product_id=p_product_id order by ad.id for update of ad loop
          if not exists(select 1 from jsonb_array_elements(children) c where c->>'id'=a.id and (c->>'version')::timestamptz=a.updated_at) then raise exception 'Linked creative changed'; end if;
          perform public.qa_tracker_save(p_product_id,a.id,a.updated_at,jsonb_build_object('format_name',values_data->>'formatName'));
          if coalesce(a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId','')<>'' then remote_ids:=remote_ids||jsonb_build_array(a.id); end if;
        end loop;
        detail:=substring(coalesce(i.data->>'creativeUSP','') from position(' '||chr(8212)||' ' in coalesce(i.data->>'creativeUSP',''))+3);
        if p_operation='save' then
          values_data:=values_data||jsonb_build_object('creativeUSP',values_data->>'formatName'||case when position(' '||chr(8212)||' ' in coalesce(i.data->>'creativeUSP',''))>0 then ' '||chr(8212)||' '||detail else '' end);
        end if;
      end if;
    end if;
    if p_operation='save' then
      update public.inspirations set data=coalesce(data,'{}')||values_data,title=coalesce(values_data->>'formatName',title),
        platform=coalesce(values_data->>'platform',platform),added_by=coalesce(values_data->>'addedBy',added_by),updated_at=stamp where id=i.id and product_id=p_product_id returning * into i;
    elsif p_operation='approve' then
      if i.status not in ('Saved','saved','Classified','classified','Approved') then raise exception 'Only saved or classified inspirations can be approved'; end if;
      update public.inspirations set status='Approved',updated_at=stamp where id=i.id and product_id=p_product_id returning * into i;
    elsif p_operation='dismiss_duplicate' then
      update public.inspirations set data=coalesce(data,'{}')||jsonb_build_object('_dupeBannerDismissed',true,'_qaDupeReviewedBy',auth.uid()),updated_at=stamp where id=i.id and product_id=p_product_id returning * into i;
    elsif p_operation='import' then
      update public.inspirations set data=coalesce(data,'{}')||values_data,status='Classified',title=values_data->>'formatName',updated_at=stamp where id=i.id and product_id=p_product_id returning * into i;
      update public.inspiration_queue set status='classified',processed_at=stamp,claimed_by=null,claimed_at=null,error_message=null where product_id=p_product_id and ins_id=i.id;
    elsif p_operation='delete' then
      delete from public.inspiration_queue where product_id=p_product_id and ins_id=i.id;
      delete from public.inspiration_results where product_id=p_product_id and ins_id=i.id;
      delete from public.inspirations where product_id=p_product_id and id=i.id;
    end if;
  end if;
  if p_operation='requeue' or (p_operation='create' and p_values->>'mode'='url') then
    insert into public.inspiration_queue(ins_id,product_id,url,platform,status,attempts,claimed_by,claimed_at,processed_at,error_message,queued_at,worker_assignment)
      values(i.id,p_product_id,i.url,i.platform,'blocked',0,null,null,null,blocked,stamp,'blocked:qa-isolation')
      on conflict(ins_id,product_id) do update set status='blocked',url=excluded.url,platform=excluded.platform,attempts=0,claimed_by=null,claimed_at=null,processed_at=null,error_message=blocked,queued_at=stamp,worker_assignment='blocked:qa-isolation';
    update public.inspirations set status='Blocked',updated_at=stamp where id=i.id and product_id=p_product_id returning * into i;
  end if;
  select * into q from public.inspiration_queue where product_id=p_product_id and ins_id=i.id;
  result:=jsonb_build_object('requestId',p_request_id,'productId',p_product_id,'operation',p_operation,'id',i.id,
    'row',case when p_operation='delete' then null else to_jsonb(i) end,'deleted',p_operation='delete','remoteAdIds',remote_ids,
    'queue',case when found then to_jsonb(q) else 'null'::jsonb end,'dispatchEnabled',false);
  insert into public.qa_inspiration_receipts(request_id,product_id,user_id,request,response) values(p_request_id,p_product_id,auth.uid(),req,result);
  return result;
end $$;
revoke all on function public.qa_inspiration_mutate(text,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_mutate(text,uuid,text,text,timestamptz,jsonb) to authenticated;
