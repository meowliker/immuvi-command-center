-- Extend detail editing without duplicating the existing queue/rename guards.
create or replace function public.qa_inspiration_detail(p_product_id text,p_request_id uuid,p_operation text,
  p_id text default null,p_expected_updated_at timestamptz default null,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare req jsonb; receipt public.qa_inspiration_receipts%rowtype; result jsonb;
  fields jsonb; detail text; i public.inspirations%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  fields:=p_values->'fields';
  if p_operation is distinct from 'save' or p_request_id is null or jsonb_typeof(fields) is distinct from 'object'
    or jsonb_typeof(fields->'formatDetail') is distinct from 'string' or length(fields->>'formatDetail')>20000
    then raise exception 'Invalid format detail request'; end if;
  req:=jsonb_build_object('operation',p_operation,'id',p_id,'version',p_expected_updated_at,'values',p_values);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  result:=public.qa_inspiration_mutate(p_product_id,p_request_id,p_operation,p_id,p_expected_updated_at,
    jsonb_set(p_values,'{fields}',fields-'formatDetail'));
  detail:=trim(fields->>'formatDetail');
  update public.inspirations set data=data||jsonb_build_object('creativeUSP',
    coalesce(nullif(data->>'formatName',''),title,'')||case when detail='' then '' else ' '||chr(8212)||' '||detail end)
    where product_id=p_product_id and id=p_id returning * into i;
  result:=jsonb_set(result,'{row}',to_jsonb(i));
  update public.qa_inspiration_receipts set request=req,response=result where request_id=p_request_id;
  return result;
end $$;
revoke all on function public.qa_inspiration_detail(text,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_detail(text,uuid,text,text,timestamptz,jsonb) to authenticated;
