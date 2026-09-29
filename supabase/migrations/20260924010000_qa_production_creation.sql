create table if not exists public.qa_production_creations (
  product_id text not null references public.products(id) on delete cascade,
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_values jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(product_id,request_id)
);
alter table public.qa_production_creations enable row level security;
revoke all on public.qa_production_creations from public,anon,authenticated;

create or replace function public.qa_production_create(p_product_id text,p_request_id uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.qa_production_creations%rowtype; ad jsonb; act jsonb; result jsonb; due text;
begin
  perform public.qa_tracker_access(p_product_id);
  if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object' or octet_length(p_values::text)>100000 then raise exception 'Invalid production request'; end if;
  select * into prior from public.qa_production_creations where product_id=p_product_id and request_id=p_request_id;
  if found then
    if prior.user_id<>auth.uid() or prior.request_values<>p_values then raise exception 'Production request identity conflicts with a previous save'; end if;
    -- A receipt is historical evidence only; it must never recreate removed rows.
    return prior.result;
  end if;
  if exists(select 1 from jsonb_each(p_values) p where p.key<>all(array['format_name','angle','persona','ad_type','funnel_stage','ad_link','drive_link','meta'])
    or (p.key<>'meta' and jsonb_typeof(p.value)<>'string')) then raise exception 'Unsupported production field'; end if;
  if length(trim(coalesce(p_values->>'format_name',''))) not between 1 and 500 then raise exception 'Enter a task name of 1 to 500 characters'; end if;
  if jsonb_typeof(p_values->'meta') is distinct from 'object' or exists(select 1 from jsonb_each(p_values->'meta') p
    where p.key<>all(array['dueDate','_dueDateMs','notes','creativeHypothesis']) or (p.key<>'_dueDateMs' and jsonb_typeof(p.value)<>'string')) then raise exception 'Unsupported production metadata'; end if;
  due:=coalesce(p_values->'meta'->>'dueDate','');
  if due<>'' and (due !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(due::date,'YYYY-MM-DD')<>due) then raise exception 'Invalid due date'; end if;
  if due='' and coalesce(p_values->'meta'->'_dueDateMs','null')<>'null' then raise exception 'Invalid due timestamp'; end if;
  if due<>'' and (jsonb_typeof(p_values->'meta'->'_dueDateMs') is distinct from 'number'
    or abs((p_values->'meta'->>'_dueDateMs')::numeric-extract(epoch from due::date::timestamptz)*1000)>172800000) then raise exception 'Invalid due timestamp'; end if;
  if coalesce(p_values->>'ad_type','') not in ('','Video','Photo','Carousel','UGC','VSL','AI Style') or coalesce(p_values->>'funnel_stage','') not in ('','TOF','MOF','BOF') then raise exception 'Invalid production type'; end if;
  if nullif(p_values->>'angle','') is not null and not exists(select 1 from public.angles where product_id=p_product_id and name=p_values->>'angle' and archived_at is null) then raise exception 'Select an active product angle'; end if;
  if nullif(p_values->>'persona','') is not null and not exists(select 1 from public.personas where product_id=p_product_id and name=p_values->>'persona' and archived_at is null) then raise exception 'Select an active product persona'; end if;
  ad:=public.qa_tracker_save(p_product_id,null,null,p_values||'{"status":"Untested"}'::jsonb,'{}');
  update public.ads set meta=meta||jsonb_build_object('taskType','production','_productionRequestId',p_request_id)
    where product_id=p_product_id and id=ad->>'id' returning to_jsonb(ads.*) into ad;
  act:=public.qa_plan_stage(p_product_id,ad->>'id',(ad->>'updated_at')::timestamptz);
  update public.manual_actions set payload=payload||'{"reason":"Added from Production"}'::jsonb
    where product_id=p_product_id and id=(act->>'id')::uuid returning to_jsonb(manual_actions.*) into act;
  result:=jsonb_build_object('productId',p_product_id,'requestId',p_request_id,'ad',ad,'action',act);
  insert into public.qa_production_creations(product_id,request_id,user_id,request_values,result) values(p_product_id,p_request_id,auth.uid(),p_values,result);
  return result;
end $$;
revoke all on function public.qa_production_create(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.qa_production_create(text,uuid,jsonb) to authenticated;
