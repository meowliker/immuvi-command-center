-- Durable QA-only create/recovery workflow. External calls never run in a DB transaction.
create table if not exists public.qa_clickup_creations (
  id uuid primary key,
  product_id text not null references public.products(id) on delete cascade,
  ad_id text not null,
  action_id uuid not null,
  list_id text not null check(list_id='901616718146'),
  state text not null check(state in ('sending','uncertain','rejected','created','linked')),
  payload jsonb not null,
  remote_task_id text,
  lease_token uuid not null,
  lease_until timestamptz not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,ad_id)
);
alter table public.qa_clickup_creations enable row level security;
revoke all on public.qa_clickup_creations from public,anon,authenticated;
grant select on public.qa_clickup_creations to authenticated;
drop policy if exists qa_creation_read on public.qa_clickup_creations;
create policy qa_creation_read on public.qa_clickup_creations for select to authenticated using (
  public.has_product(product_id) and exists(select 1 from public.profiles where id=auth.uid() and is_active and not must_change_password)
);
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='qa_clickup_creations') then
    alter publication supabase_realtime add table public.qa_clickup_creations;
  end if;
end $$;

create or replace function public.qa_plan_stage(p_product_id text,p_ad_id text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; count_matches integer; task_id text;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  if a.updated_at is distinct from p_expected_updated_at then raise exception 'Creative changed. Refresh before adding to Action Plan.'; end if;
  task_id:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=task_id)) then raise exception 'Deleted creative cannot be scheduled'; end if;
  select count(*) into count_matches from public.manual_actions where product_id=p_product_id and
    (coalesce(payload->>'sourceAdId',payload->>'adId',payload->>'_sourceAdId')=a.id or (task_id is not null and coalesce(payload->>'_clickupId',payload->>'clickupTaskId')=task_id));
  if count_matches>1 then raise exception 'Duplicate Action Plan links must be resolved before pushing'; end if;
  if count_matches=1 then
    select * into act from public.manual_actions where product_id=p_product_id and
      (coalesce(payload->>'sourceAdId',payload->>'adId',payload->>'_sourceAdId')=a.id or (task_id is not null and coalesce(payload->>'_clickupId',payload->>'clickupTaskId')=task_id)) for update;
    if coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),task_id) is distinct from task_id then raise exception 'Action Plan task identity conflicts with the creative'; end if;
    if coalesce(act.payload->>'sourceAdId',act.payload->>'adId',act.payload->>'_sourceAdId') is distinct from a.id then raise exception 'Action Plan source identity conflicts with the creative'; end if;
    return to_jsonb(act);
  end if;
  insert into public.manual_actions(product_id,live_status,payload) values(p_product_id,a.status,
    jsonb_build_object('sourceAdId',a.id,'adId',a.id,'title',a.format_name,'taskName',a.format_name,
      'sourceAngle',a.angle,'sourcePersona',a.persona,'angle',a.angle,'persona',a.persona,'format',a.ad_type,'funnelStage',a.funnel_stage,
      'adLink',a.ad_link,'description',coalesce(a.meta->>'description',a.meta->>'notes',''),'dueDate',coalesce(a.meta->>'dueDate',''),
      '_dueDateMs',a.meta->'_dueDateMs','liveStatus',a.status,'_clickupId',task_id,'clickupTaskId',task_id,
      'tag','manual','priority','high','reason','Added from Matrix','productId',p_product_id,
      '_fromInspoId',a.meta->>'_fromInspoId','sourceFormatId',a.meta->>'sourceFormatId','_sourceWinnerFileUrl',a.meta->>'_sourceWinnerFileUrl',
      '_pushedAt',(extract(epoch from clock_timestamp())*1000)::bigint)) returning * into act;
  insert into public.activity_events(product_id,action_id,event_type,source,metadata)
    values(p_product_id,act.id,'added_to_plan','qa-next',jsonb_build_object('linked_ad_id',a.id));
  return to_jsonb(act);
end $$;

create or replace function public.qa_creation_claim(p_product_id text,p_ad_id text,p_job_id uuid,p_token uuid,
  p_expected_updated_at timestamptz,p_product_updated_at timestamptz,p_action_updated_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.ads%rowtype; product public.products%rowtype; job public.qa_clickup_creations%rowtype; act jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into product from public.products where id=p_product_id;
  if coalesce(product.config->>'clickup_list_id',product.config->>'clickupListId') is distinct from '901616718146' then raise exception 'Only the QA test list is permitted'; end if;
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  select * into job from public.qa_clickup_creations where product_id=p_product_id and ad_id=p_ad_id for update;
  if job.id is not null and job.id<>p_job_id then raise exception 'Creation identity changed. Refresh before retrying.'; end if;
  if p_token is null or p_job_id is null then raise exception 'Creation identity is required'; end if;
  if job.state='linked' then return to_jsonb(job); end if;
  if job.state in ('sending','created','uncertain') and job.lease_until>clock_timestamp() then raise exception 'Creation is still in progress. Wait two minutes before recovery.'; end if;
  if job.state in ('sending','created','uncertain') then
    update public.qa_clickup_creations set state=case when remote_task_id is null then 'uncertain' else 'created' end,
      lease_token=p_token,lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp() where id=job.id returning * into job;
    return to_jsonb(job);
  end if;
  if a.updated_at is distinct from p_expected_updated_at or product.updated_at is distinct from p_product_updated_at then raise exception 'Creative or product settings changed. Refresh before pushing.'; end if;
  if nullif(coalesce(a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId'),'') is not null then raise exception 'Creative already has a ClickUp task'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'name' is distinct from a.format_name or
    position('IMMUVI_QA_JOB:'||p_job_id::text in coalesce(p_payload->>'description',''))=0 then raise exception 'Invalid creation payload'; end if;
  act:=public.qa_plan_stage(p_product_id,p_ad_id,p_expected_updated_at);
  if (act->>'updated_at')::timestamptz is distinct from p_action_updated_at then raise exception 'Action Plan changed. Refresh before pushing.'; end if;
  insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
    values(p_job_id,p_product_id,p_ad_id,(act->>'id')::uuid,'901616718146','sending',p_payload,p_token,clock_timestamp()+interval '2 minutes')
    on conflict(product_id,ad_id) do update set action_id=excluded.action_id,state='sending',payload=excluded.payload,
      lease_token=p_token,lease_until=excluded.lease_until,last_error=null,updated_at=clock_timestamp() returning * into job;
  return to_jsonb(job);
end $$;

create or replace function public.qa_creation_record(p_product_id text,p_job_id uuid,p_token uuid,p_state text,p_remote_task_id text,p_error text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_clickup_creations%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into job from public.qa_clickup_creations where product_id=p_product_id and id=p_job_id for update;
  if not found or job.lease_token is distinct from p_token or job.state='linked' then raise exception 'Creation lease changed. Recover with the latest state.'; end if;
  if p_state is null or p_state not in ('created','uncertain','rejected') then raise exception 'Invalid creation result'; end if;
  if p_state='rejected' and job.state<>'sending' then raise exception 'An uncertain create cannot be retried as a new task'; end if;
  if job.remote_task_id is not null and job.remote_task_id is distinct from p_remote_task_id then raise exception 'Remote task identity cannot change'; end if;
  if p_state='created' and coalesce(p_remote_task_id,'') !~ '^[a-zA-Z0-9_-]+$' then raise exception 'Invalid remote task ID'; end if;
  update public.qa_clickup_creations set state=p_state,remote_task_id=p_remote_task_id,last_error=left(p_error,500),updated_at=clock_timestamp(),
    lease_until=case when p_state='created' and p_error is null then lease_until else clock_timestamp() end where id=p_job_id returning * into job;
  return to_jsonb(job);
end $$;

create or replace function public.qa_creation_finish(p_product_id text,p_job_id uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_clickup_creations%rowtype; a public.ads%rowtype; act public.manual_actions%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into job from public.qa_clickup_creations where product_id=p_product_id and id=p_job_id;
  if not found then raise exception 'Creation is unavailable'; end if;
  select * into a from public.ads where product_id=p_product_id and id=job.ad_id for update;
  if not found or a.deleted_at is not null then raise exception 'Creative was deleted. Remote task was retained for manual review.'; end if;
  select * into job from public.qa_clickup_creations where id=p_job_id for update;
  if job.state='linked' then return to_jsonb(job); end if;
  if job.lease_token is distinct from p_token or job.state<>'created' or job.remote_task_id is null then raise exception 'Recover the remote task before linking'; end if;
  select * into act from public.manual_actions where product_id=p_product_id and id=job.action_id for update;
  if not found or coalesce(act.payload->>'sourceAdId',act.payload->>'adId') is distinct from a.id then raise exception 'Action Plan source changed. Remote task was retained for manual review.'; end if;
  if exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=job.remote_task_id)) then raise exception 'A tombstone prevents linking this task'; end if;
  if coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),job.remote_task_id)<>job.remote_task_id or
    coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),job.remote_task_id)<>job.remote_task_id or
    exists(select 1 from public.ads where product_id=p_product_id and id<>a.id and (clickup_task_id=job.remote_task_id or meta->>'_clickupId'=job.remote_task_id)) or
    exists(select 1 from public.manual_actions where product_id=p_product_id and id<>act.id and coalesce(payload->>'_clickupId',payload->>'clickupTaskId')=job.remote_task_id)
    then raise exception 'Remote task is already linked to a different creative or action'; end if;
  -- Release the edit guard and link both rows in the same commit.
  update public.qa_clickup_creations set state='linked',last_error=null,lease_until=clock_timestamp(),updated_at=clock_timestamp() where id=p_job_id returning * into job;
  update public.ads set clickup_task_id=job.remote_task_id,meta=coalesce(meta,'{}')||jsonb_build_object(
    '_clickupId',job.remote_task_id,'_clickupUrl','https://app.clickup.com/t/'||job.remote_task_id,'_clickupListId',job.list_id,
    '_qaCreationId',job.id,'taskType','production','_clickupDescription',job.payload->>'description') where id=a.id;
  update public.manual_actions set payload=payload||jsonb_build_object('_clickupId',job.remote_task_id,'clickupTaskId',job.remote_task_id,
    '_clickupUrl','https://app.clickup.com/t/'||job.remote_task_id,'_qaCreationId',job.id) where id=act.id;
  insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,source,metadata)
    values(p_product_id,act.id,job.remote_task_id,'pushed_to_clickup','qa-next',jsonb_build_object('creation_id',job.id,'linked_ad_id',a.id));
  return to_jsonb(job);
end $$;

create or replace function public.qa_plan_edit(p_product_id text,p_action_id uuid,p_expected_updated_at timestamptz,
  p_ad_id text,p_ad_updated_at timestamptz,p_status text,p_due_date text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare act public.manual_actions%rowtype; a public.ads%rowtype; saved jsonb; patch jsonb; task_id text; ms bigint;
begin
  perform public.qa_tracker_access(p_product_id);
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null then raise exception 'Creative is unavailable'; end if;
  select * into act from public.manual_actions where product_id=p_product_id and id=p_action_id for update;
  if not found or act.updated_at is distinct from p_expected_updated_at then raise exception 'Action Plan changed. Refresh before editing.'; end if;
  if coalesce(act.payload->>'sourceAdId',act.payload->>'adId',act.payload->>'_sourceAdId') is distinct from a.id then raise exception 'Action Plan source identity is unresolved'; end if;
  task_id:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
  if coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),task_id) is distinct from task_id then raise exception 'Action Plan task identity conflicts with the creative'; end if;
  if (p_status is null)=(p_due_date is null) then raise exception 'Change one workflow field at a time'; end if;
  if p_status is not null then patch:=jsonb_build_object('status',p_status);
  else
    if p_due_date<>'' and (p_due_date !~ '^\d{4}-\d{2}-\d{2}$' or (p_due_date::date)::text<>p_due_date) then raise exception 'Invalid due date'; end if;
    ms:=case when p_due_date='' then null else (extract(epoch from (p_due_date||'T23:59:59Z')::timestamptz)*1000)::bigint end;
    patch:=jsonb_build_object('meta',jsonb_build_object('dueDate',p_due_date,'_dueDateMs',ms));
  end if;
  saved:=public.qa_tracker_save(p_product_id,p_ad_id,p_ad_updated_at,patch,'{}');
  if p_status is not null then
    update public.manual_actions set approved_at=case when p_status='In Production' then clock_timestamp() else approved_at end,
      delivered_at=case when p_status='Ready to Launch' then clock_timestamp() else delivered_at end,
      launched_at=case when p_status='Testing' then clock_timestamp() else launched_at end,
      killed_at=case when p_status in ('Loser','Killed') then clock_timestamp() else killed_at end,
      scaled_at=case when p_status in ('Winner','Mild Winner','Scale') then clock_timestamp() else scaled_at end where id=p_action_id;
  end if;
  select * into act from public.manual_actions where id=p_action_id;
  insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,field_name,old_value,new_value,source)
    values(p_product_id,p_action_id,task_id,case when p_status is not null then 'status_changed' else 'due_changed' end,
      case when p_status is not null then 'status' else 'due_date' end,
      case when p_status is not null then a.status else a.meta->>'dueDate' end,coalesce(p_status,p_due_date),'qa-next');
  return jsonb_build_object('ad',saved,'action',to_jsonb(act));
end $$;

-- Freeze the source during uncertain external writes, including direct legacy
-- table writes. This prevents old create snapshots from overwriting newer edits.
create or replace function public.qa_guard_creation_source() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_clickup_creations where product_id=old.product_id and state in ('sending','uncertain','created')
    and (case when tg_table_name='ads' then ad_id=old.id::text else action_id::text=old.id::text end)) then
    raise exception 'ClickUp creation is unresolved. Recover its link before editing or deleting this source.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists qa_guard_creation on public.ads;
create trigger qa_guard_creation before update or delete on public.ads for each row execute function public.qa_guard_creation_source();
drop trigger if exists qa_guard_creation on public.manual_actions;
create trigger qa_guard_creation before update or delete on public.manual_actions for each row execute function public.qa_guard_creation_source();

revoke all on function public.qa_guard_creation_source(),public.qa_plan_stage(text,text,timestamptz),public.qa_plan_edit(text,uuid,timestamptz,text,timestamptz,text,text),
  public.qa_creation_claim(text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,jsonb),public.qa_creation_record(text,uuid,uuid,text,text,text),
  public.qa_creation_finish(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.qa_plan_stage(text,text,timestamptz),public.qa_plan_edit(text,uuid,timestamptz,text,timestamptz,text,text),
  public.qa_creation_claim(text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,jsonb),public.qa_creation_record(text,uuid,uuid,text,text,text),
  public.qa_creation_finish(text,uuid,uuid) to authenticated;
