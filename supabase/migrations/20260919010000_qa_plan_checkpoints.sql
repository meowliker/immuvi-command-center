-- These helpers and the migration runner are restricted to the QA project.
create or replace function public.qa_plan_timestamp(value text) returns bigint
language plpgsql stable set search_path=public as $$
declare parsed timestamptz;
begin
  if value is null or value='' then return null; end if;
  if value ~ '^[0-9]+$' then return value::bigint; end if;
  parsed:=value::timestamptz;
  if not isfinite(parsed) then return null; end if;
  return (extract(epoch from parsed)*1000)::bigint;
exception when others then return null;
end $$;

create or replace function public.qa_reset_testing_cycle() returns trigger
language plpgsql set search_path=public as $$
begin
  if lower(trim(new.status)) is distinct from lower(trim(old.status))
    and (lower(trim(new.status))='testing' or lower(trim(old.status))='testing') then
    new.testing_deferred_at:=null; new.testing_defer_count:=0;
    new.last_status_change_at:=(extract(epoch from clock_timestamp())*1000)::bigint;
    new.meta:=coalesce(new.meta,'{}')||jsonb_build_object('testingDeferredAt',null,'testingDeferCount',0,'lastStatusChangeAt',new.last_status_change_at);
  end if;
  return new;
end $$;
drop trigger if exists qa_reset_testing_cycle on public.ads;
create trigger qa_reset_testing_cycle before update of status on public.ads
  for each row execute function public.qa_reset_testing_cycle();

create or replace function public.qa_plan_checkpoint(p_product_id text,p_action_id uuid,p_expected_updated_at timestamptz,
  p_ad_id text,p_ad_updated_at timestamptz,p_decision text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; task_id text; source_id text;
  entered bigint; derived bigint; deferred bigint; ms bigint; stamp timestamptz; phase text; saved jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  if p_decision is null or p_decision not in ('snooze','Winner','Mild Winner','Scale','Loser') then raise exception 'Invalid testing decision'; end if;
  select * into a from public.ads where product_id=p_product_id and id=p_ad_id for update;
  if not found or a.deleted_at is not null or coalesce((a.meta->>'_productBoundaryQuarantined')::boolean,false) then raise exception 'Creative is unavailable'; end if;
  if a.updated_at is distinct from p_ad_updated_at then raise exception 'Creative changed. Close and reopen the testing review.'; end if;
  select * into act from public.manual_actions where product_id=p_product_id and id=p_action_id for update;
  if not found or act.updated_at is distinct from p_expected_updated_at then raise exception 'Action Plan changed. Close and reopen the testing review.'; end if;
  source_id:=coalesce(nullif(act.payload->>'sourceAdId',''),nullif(act.payload->>'adId',''),nullif(act.payload->>'_sourceAdId',''));
  if source_id is distinct from a.id then raise exception 'Action Plan source identity is unresolved'; end if;
  task_id:=coalesce(nullif(a.clickup_task_id,''),nullif(a.meta->>'_clickupId',''),nullif(a.meta->>'clickupTaskId',''));
  if coalesce(nullif(act.payload->>'_clickupId',''),nullif(act.payload->>'clickupTaskId',''),task_id) is distinct from task_id then raise exception 'Action Plan task identity conflicts with the creative'; end if;
  if coalesce((act.payload->>'_clickupTaskDeleted')::boolean,false)
    or exists(select 1 from public.deleted_ads where product_id=p_product_id and (id=a.id or clickup_task_id=task_id)) then raise exception 'Deleted creative cannot be reviewed'; end if;
  if exists(select 1 from public.qa_clickup_creations where product_id=p_product_id and (ad_id=a.id or action_id=act.id) and state in ('sending','uncertain','created')) then raise exception 'Recover unresolved ClickUp creation before testing review'; end if;
  if exists(select 1 from public.manual_actions m where m.product_id=p_product_id and m.id<>act.id and
    coalesce(nullif(m.payload->>'sourceAdId',''),nullif(m.payload->>'adId',''),nullif(m.payload->>'_sourceAdId',''))=a.id) then raise exception 'Duplicate task links must be resolved before testing review'; end if;
  if lower(trim(a.status))<>'testing' then raise exception 'Creative is no longer Testing'; end if;
  stamp:=clock_timestamp(); ms:=(extract(epoch from stamp)*1000)::bigint;
  entered:=coalesce(a.last_status_change_at,public.qa_plan_timestamp(a.meta->>'lastStatusChangeAt'));
  derived:=coalesce(public.qa_plan_timestamp(a.meta->'_customFieldsRaw'->>'launch date'),public.qa_plan_timestamp(a.meta->'_customFields'->>'launch date'),
    public.qa_plan_timestamp(a.meta->'_customFieldsRaw'->>'approved date'),public.qa_plan_timestamp(a.meta->'_customFields'->>'approved date'),
    public.qa_plan_timestamp(a.created_at::text),public.qa_plan_timestamp(a.meta->>'createdAt'));
  if entered is not null and (select count(*) from public.ads where product_id=p_product_id and deleted_at is null
    and coalesce(last_status_change_at,public.qa_plan_timestamp(meta->>'lastStatusChangeAt'))=entered)>=5 then entered:=null; end if;
  entered:=least(ms,coalesce(greatest(entered,derived),public.qa_plan_timestamp(act.payload->>'_statusChangedAt'),public.qa_plan_timestamp(act.payload->>'_pushedAt')));
  deferred:=coalesce(a.testing_deferred_at,public.qa_plan_timestamp(a.meta->>'testingDeferredAt'));
  phase:=case when entered is null then 'none'
    when deferred is not null then case when ms>=deferred+604800000 then 'final' else 'snoozed' end
    when ms>=entered+1209600000 then 'final' when ms>=entered+604800000 then 'first' else 'none' end;
  if phase not in ('first','final') then raise exception 'Testing review is not due. Refresh the Action Plan.'; end if;
  if p_decision='snooze' then
    if phase<>'first' or coalesce(a.testing_defer_count,0)<>0 or deferred is not null then raise exception 'Testing can only be snoozed once at the first review'; end if;
    update public.ads set testing_deferred_at=ms,testing_defer_count=1,
      meta=coalesce(meta,'{}')||jsonb_build_object('testingDeferredAt',ms,'testingDeferCount',1),updated_at=stamp
      where product_id=p_product_id and id=a.id returning * into a;
    update public.manual_actions set updated_at=stamp where product_id=p_product_id and id=act.id returning * into act;
    insert into public.activity_events(product_id,action_id,clickup_task_id,event_type,field_name,new_value,actor,source,metadata)
      values(p_product_id,act.id,task_id,'testing_deferred','testing_deferred_at',ms::text,auth.uid()::text,'qa-next',
        jsonb_build_object('linked_ad_id',a.id,'entered_at',entered,'due_at',ms+604800000,'testing_defer_count',1));
    return jsonb_build_object('ad',to_jsonb(a),'action',to_jsonb(act));
  end if;
  saved:=public.qa_plan_edit(p_product_id,act.id,act.updated_at,a.id,a.updated_at,p_decision,null);
  return saved;
end $$;
revoke all on function public.qa_plan_timestamp(text),public.qa_reset_testing_cycle(),public.qa_plan_checkpoint(text,uuid,timestamptz,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.qa_plan_checkpoint(text,uuid,timestamptz,text,timestamptz,text) to authenticated;
