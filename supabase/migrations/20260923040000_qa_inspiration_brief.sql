-- Saves only an explicit document link on a versioned destination inspiration.
create or replace function public.qa_inspiration_brief(p_product_id text,p_request_id uuid,p_id text,p_expected_updated_at timestamptz,p_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.inspirations%rowtype; receipt public.qa_inspiration_receipts%rowtype; req jsonb; result jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  if p_request_id is null or p_expected_updated_at is null or p_url is null or length(p_url)>4000
    or p_url ~ '[[:space:]<>"]' or p_url !~ '^https://app[.]clickup[.]com/([0-9]+/v/dc/|[^/?#]+/docs/)[^[:space:]<>"@]+$' then raise exception 'Invalid brief link or source version'; end if;
  req:=jsonb_build_object('operation','brief','id',p_id,'version',p_expected_updated_at,'url',p_url);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  select * into i from public.inspirations where product_id=p_product_id and id=p_id for update;
  if not found or i.updated_at is distinct from p_expected_updated_at then raise exception 'Inspiration changed. Reopen it before saving the brief.'; end if;
  if coalesce(nullif(i.data->>'_clickupDocPageUrl',''),nullif(i.data->>'briefUrl','')) is not null then raise exception 'A brief link is already saved. Refresh the inspiration.'; end if;
  update public.inspirations set data=coalesce(data,'{}')||jsonb_build_object('_clickupDocPageUrl',p_url,'_qaBriefLinkedBy',auth.uid()),updated_at=clock_timestamp()
    where product_id=p_product_id and id=p_id returning * into i;
  result:=jsonb_build_object('requestId',p_request_id,'productId',p_product_id,'row',to_jsonb(i),'dispatchEnabled',false);
  insert into public.qa_inspiration_receipts(request_id,product_id,user_id,request,response) values(p_request_id,p_product_id,auth.uid(),req,result);
  return result;
end $$;
revoke all on function public.qa_inspiration_brief(text,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.qa_inspiration_brief(text,uuid,text,timestamptz,text) to authenticated;
