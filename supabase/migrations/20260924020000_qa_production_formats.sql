create or replace function public.qa_production_intake(p_product_id text,p_request_id uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.qa_production_creations%rowtype; saved jsonb; act public.manual_actions%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  if jsonb_typeof(p_values) is distinct from 'object' or octet_length(p_values::text)>100000 then raise exception 'Invalid production request'; end if;
  if p_values ? 'format' and (jsonb_typeof(p_values->'format')<>'string' or length(p_values->>'format')>500) then raise exception 'Invalid production format'; end if;
  select * into prior from public.qa_production_creations where product_id=p_product_id and request_id=p_request_id;
  if found then
    if prior.user_id<>auth.uid() or prior.request_values<>p_values then raise exception 'Production request identity conflicts with a previous save'; end if;
    return prior.result;
  end if;
  -- Keep the original guarded transaction and receipt contract for pending older requests.
  saved:=public.qa_production_create(p_product_id,p_request_id,p_values-'format');
  if p_values ? 'format' then
    update public.manual_actions set payload=payload||jsonb_build_object('format',p_values->>'format'),updated_at=clock_timestamp()
      where product_id=p_product_id and id=(saved->'action'->>'id')::uuid returning * into act;
    saved:=jsonb_set(saved,'{action}',to_jsonb(act));
    update public.qa_production_creations set request_values=p_values,result=saved where product_id=p_product_id and request_id=p_request_id;
  end if;
  return saved;
end $$;

create or replace function public.qa_production_format(p_product_id text,p_action_id uuid,p_expected_updated_at timestamptz,
  p_ad_id text,p_ad_updated_at timestamptz,p_format text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved jsonb; act public.manual_actions%rowtype;
begin
  if p_format is null or length(p_format)>500 then raise exception 'Invalid production format'; end if;
  -- A no-op creative edit acquires the existing locks and validates versions, lifecycle and links.
  saved:=public.qa_plan_creative(p_product_id,p_action_id,p_expected_updated_at,p_ad_id,p_ad_updated_at,'{}');
  if saved->'action'->'payload'->>'format' is distinct from p_format then
    insert into public.activity_events(product_id,action_id,event_type,field_name,old_value,new_value,source)
      values(p_product_id,p_action_id,'creative_field_changed','format',saved->'action'->'payload'->>'format',p_format,'qa-next');
    update public.manual_actions set payload=payload||jsonb_build_object('format',p_format),updated_at=clock_timestamp()
      where product_id=p_product_id and id=p_action_id returning * into act;
    saved:=jsonb_set(saved,'{action}',to_jsonb(act));
  end if;
  return saved;
end $$;
revoke all on function public.qa_production_intake(text,uuid,jsonb), public.qa_production_format(text,uuid,timestamptz,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.qa_production_intake(text,uuid,jsonb), public.qa_production_format(text,uuid,timestamptz,text,timestamptz,text) to authenticated;
