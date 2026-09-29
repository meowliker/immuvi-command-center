create or replace function public.qa_inspiration_duplicate_review(p_product_id text,p_request_id uuid,p_operation text,
  p_id text default null,p_expected_updated_at timestamptz default null,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare signature text; evidence jsonb; req jsonb; receipt public.qa_inspiration_receipts%rowtype;
  result jsonb; i public.inspirations%rowtype;
begin
  perform public.qa_tracker_access(p_product_id);
  signature:=p_values->>'duplicateSignature';
  if p_operation is distinct from 'dismiss_duplicate' or p_request_id is null
    or jsonb_typeof(p_values->'duplicateSignature') is distinct from 'string'
    or coalesce(length(signature),0) not between 1 and 1000000 then raise exception 'Invalid duplicate review'; end if;
  evidence:=signature::jsonb;
  if evidence->>'v' is distinct from '1' or evidence->>'productId' is distinct from p_product_id or evidence->>'id' is distinct from p_id
    or jsonb_typeof(evidence->'source') is distinct from 'array' or jsonb_typeof(evidence->'matches') is distinct from 'array'
    then raise exception 'Invalid duplicate evidence identity'; end if;
  if jsonb_array_length(evidence->'source')<>5 or jsonb_array_length(evidence->'matches')=0 then raise exception 'Empty duplicate evidence'; end if;
  req:=jsonb_build_object('operation',p_operation,'id',p_id,'version',p_expected_updated_at,'values',p_values);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  -- A review acknowledges the displayed snapshot, not future matches. Reads compare
  -- this exact evidence with current matches, so concurrent changes stay unreviewed.
  result:=public.qa_inspiration_mutate(p_product_id,p_request_id,p_operation,p_id,p_expected_updated_at,p_values-'duplicateSignature');
  update public.inspirations set data=coalesce(data,'{}')||jsonb_build_object('_qaDupeReviewSignature',signature)
    where product_id=p_product_id and id=p_id returning * into i;
  result:=jsonb_set(result,'{row}',to_jsonb(i));
  update public.qa_inspiration_receipts set request=req,response=result where request_id=p_request_id;
  return result;
end $$;
revoke all on function public.qa_inspiration_duplicate_review(text,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_duplicate_review(text,uuid,text,text,timestamptz,jsonb) to authenticated;
