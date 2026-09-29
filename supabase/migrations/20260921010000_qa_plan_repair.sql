-- Remote verification happens in the QA API. This transaction serializes the
-- local link change and durable replacement claim before any external POST.
create or replace function public.qa_plan_repair(
  p_product_id text, p_ad_id text, p_ad_updated_at timestamptz,
  p_action_id uuid, p_action_updated_at timestamptz, p_product_updated_at timestamptz,
  p_old_task_id text, p_new_task_id text, p_prior_job_id uuid,
  p_job_id uuid, p_token uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; product public.products%rowtype;
  job public.qa_clickup_creations%rowtype; previous_job jsonb; matches integer; staged jsonb;
  ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into product from public.products where id=p_product_id;
  if coalesce(product.config->>'clickup_list_id',product.config->>'clickupListId') is distinct from '901616718146' then raise exception 'Only the QA test list is permitted'; end if;
  if product.updated_at is distinct from p_product_updated_at then raise exception 'Product settings changed. Reopen repair.'; end if;
  if p_old_task_id is null or p_old_task_id !~ '^[a-zA-Z0-9_-]+$' or (p_new_task_id is not null and p_new_task_id !~ '^[a-zA-Z0-9_-]+$') then raise exception 'Invalid repair task identity'; end if;
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  if a.updated_at is distinct from p_ad_updated_at then raise exception 'Creative changed. Reopen repair.'; end if;
  if coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId','')) is distinct from p_old_task_id
    or exists(select 1 from unnest(array[a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId']) id where nullif(id,'') is not null and id<>p_old_task_id)
    then raise exception 'Creative task identity changed'; end if;
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=p_old_task_id or clickup_task_id=p_new_task_id)) then raise exception 'A deletion tombstone blocks repair'; end if;
  select * into job from public.qa_clickup_creations where product_id=p_product_id and ad_id=a.id for update;
  if job.id is distinct from p_prior_job_id then raise exception 'Creation generation changed. Reopen repair.'; end if;
  if job.id is not null and (job.state not in ('linked','rejected') or (job.state='linked' and job.remote_task_id is distinct from p_old_task_id)) then raise exception 'Recover unresolved creation before repair'; end if;
  previous_job:=case when job.id is null then null else to_jsonb(job) end;
  select count(*) into matches from public.manual_actions where product_id=p_product_id and
    (coalesce(payload->>'sourceAdId',payload->>'adId',payload->>'_sourceAdId')=a.id or payload->>'_clickupId'=p_old_task_id or payload->>'clickupTaskId'=p_old_task_id);
  if p_action_id is null then
    if matches<>0 then raise exception 'Action Plan changed. Reopen repair.'; end if;
    staged:=public.qa_plan_stage(p_product_id,a.id,a.updated_at);
    select * into act from public.manual_actions where id=(staged->>'id')::uuid;
  else
    select * into act from public.manual_actions where product_id=p_product_id and id=p_action_id for update;
    if not found or matches<>1 or act.updated_at is distinct from p_action_updated_at or coalesce((act.payload->>'_productBoundaryQuarantined')::boolean,false)
      then raise exception 'Action Plan changed. Reopen repair.'; end if;
  end if;
  if coalesce(act.payload->>'sourceAdId',act.payload->>'adId',act.payload->>'_sourceAdId') is distinct from a.id or
    exists(select 1 from unnest(array[act.payload->>'_clickupId',act.payload->>'clickupTaskId']) id where nullif(id,'') is not null and id<>p_old_task_id)
    then raise exception 'Action Plan source or task identity conflicts'; end if;
  if exists(select 1 from public.ads where product_id=p_product_id and id<>a.id and
    (clickup_task_id in (p_old_task_id,p_new_task_id) or meta->>'_clickupId' in (p_old_task_id,p_new_task_id) or meta->>'clickupTaskId' in (p_old_task_id,p_new_task_id))) or
    exists(select 1 from public.manual_actions where product_id=p_product_id and id<>act.id and
    (payload->>'_clickupId' in (p_old_task_id,p_new_task_id) or payload->>'clickupTaskId' in (p_old_task_id,p_new_task_id))) then raise exception 'Another record owns this task identity'; end if;
  if p_new_task_id is null then
    if p_job_id is null or p_token is null or p_job_id=p_prior_job_id or jsonb_typeof(p_payload) is distinct from 'object'
      or p_payload->>'name' is distinct from a.format_name or position('IMMUVI_QA_JOB:'||p_job_id::text in coalesce(p_payload->>'description',''))=0 then raise exception 'Invalid recreation claim'; end if;
    -- Archive the old generation in the event below; it can never be reused for a new POST.
    delete from public.qa_clickup_creations where id=job.id;
    update public.ads set clickup_task_id=null,meta=(coalesce(meta,'{}')-array['_clickupId','clickupTaskId','_clickupUrl','_qaCreationId'])||jsonb_build_object(
      '_clickupTaskDeleted',false,'_qaRecreateFromTaskId',p_old_task_id,'_qaRecreationJobId',p_job_id,
      '_sourceClickupId',coalesce(nullif(meta->>'_sourceClickupId',''),p_old_task_id)) where id=a.id returning * into a;
    update public.manual_actions set payload=(payload-array['_clickupId','clickupTaskId','_clickupUrl','_qaCreationId'])||jsonb_build_object('_clickupTaskDeleted',false)
      where id=act.id returning * into act;
    insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
      values(p_job_id,p_product_id,a.id,act.id,'901616718146','sending',p_payload,p_token,clock_timestamp()+interval '2 minutes') returning * into job;
  else
    update public.ads set clickup_task_id=p_new_task_id,meta=coalesce(meta,'{}')||jsonb_build_object('_clickupId',p_new_task_id,'clickupTaskId',p_new_task_id,
      '_clickupUrl','https://app.clickup.com/t/'||p_new_task_id,'_clickupTaskDeleted',false) where id=a.id returning * into a;
    update public.manual_actions set payload=payload||jsonb_build_object('_clickupId',p_new_task_id,'clickupTaskId',p_new_task_id,
      '_clickupUrl','https://app.clickup.com/t/'||p_new_task_id,'_clickupTaskDeleted',false,
      '_history',(case when jsonb_typeof(payload->'_history')='array' then payload->'_history' else '[]'::jsonb end)||jsonb_build_array(jsonb_build_object('type','relinked','ts',ms,'oldTaskId',p_old_task_id,'taskId',p_new_task_id))) where id=act.id returning * into act;
    if job.id is not null then update public.qa_clickup_creations set action_id=act.id,remote_task_id=p_new_task_id,state='linked',last_error=null,updated_at=clock_timestamp() where id=job.id returning * into job; end if;
  end if;
  if p_new_task_id is distinct from p_old_task_id then
    insert into public.deleted_ads(id,product_id,clickup_task_id,format_name,deleted_by,reason)
      values('qa-replaced-'||gen_random_uuid()::text,p_product_id,p_old_task_id,a.format_name,auth.uid()::text,'qa-remote-replaced');
  end if;
  insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,source,metadata)
    values(p_product_id,act.id,p_new_task_id,case when p_new_task_id is null then 'recreation_started' else 'relinked' end,'qa-next',
      jsonb_build_object('linked_ad_id',a.id,'ad_id',a.id,'old_task_id',p_old_task_id,'new_task_id',p_new_task_id,'creation_id',job.id,'previous_creation',previous_job));
  return jsonb_build_object('ad',to_jsonb(a),'action',to_jsonb(act),'job',case when job.id is null then null else to_jsonb(job) end);
end $$;
revoke all on function public.qa_plan_repair(text,text,timestamptz,uuid,timestamptz,timestamptz,text,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.qa_plan_repair(text,text,timestamptz,uuid,timestamptz,timestamptz,text,text,uuid,uuid,uuid,jsonb) to authenticated;
