-- QA only: apply the legacy initials rule to future creates, not existing rows or receipts.
create or replace function public.qa_product_initials(p_name text) returns text
language sql immutable set search_path=public as $$
  select coalesce(nullif(left(string_agg(upper(left(word,1)),'' order by position),3),''),'INS')
  from regexp_split_to_table(trim(coalesce(p_name,'')),E'\\s+') with ordinality as words(word,position)
  where word<>'';
$$;
revoke all on function public.qa_product_initials(text) from public,anon,authenticated;


create or replace function public.qa_product_mutate(p_request_id uuid,p_operation text,p_product_id text,p_expected_updated_at timestamptz,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req jsonb; receipt public.qa_product_admin_receipts%rowtype; p public.products%rowtype;
  result jsonb; manifest jsonb; fields jsonb; field text; option jsonb; names text[]; clean text;
begin
  perform public.qa_product_admin_access();
  if p_request_id is null or nullif(p_product_id,'') is null or p_operation is null or p_operation not in ('create','fields','unlink','delete')
    or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid product request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qa-product-administration',0));
  req:=jsonb_build_object('operation',p_operation,'productId',p_product_id,'version',p_expected_updated_at,'values',p_values);
  select * into receipt from public.qa_product_admin_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id<>auth.uid() or receipt.request<>req then raise exception 'Product request identity conflicts'; end if;
    return receipt.response;
  end if;
  if p_operation='create' then
    if p_product_id<>'qa-prod-'||p_request_id::text or p_expected_updated_at is not null
      or jsonb_typeof(p_values->'name') is distinct from 'string' or length(trim(p_values->>'name')) not between 1 and 200
      or p_values->>'name'<>trim(p_values->>'name') or coalesce(p_values->>'color','') !~ '^#[0-9A-Fa-f]{6}$'
      or exists(select 1 from jsonb_object_keys(p_values) k where k not in ('name','color')) then raise exception 'Invalid product name or color'; end if;
    if exists(select 1 from public.products where lower(trim(name))=lower(p_values->>'name')) then raise exception 'Product name already exists'; end if;
    insert into public.products(id,name,config) values(p_product_id,p_values->>'name',jsonb_build_object('color',p_values->>'color','ins_prefix',public.qa_product_initials(p_values->>'name'))) returning * into p;
  else
    select * into p from public.products where id=p_product_id for update;
    if not found or p.updated_at is distinct from p_expected_updated_at then raise exception 'Product changed or was deleted. Refresh and review before retrying.'; end if;
    if p_operation in ('delete','unlink') then
      if p_values->>'confirmName' is distinct from p.name then raise exception 'Confirm the exact product name'; end if;
      if coalesce(p.config->>'clickup_list_id',p.config->>'clickupListId','') not in ('','901616718146') then raise exception 'Non-test ClickUp destination is blocked'; end if;
      if exists(select 1 from public.qa_clickup_creations where product_id=p_product_id and state in ('sending','uncertain','created')) then raise exception 'Resolve pending ClickUp creation before disconnecting or deleting this product'; end if;
    end if;
    if p_operation='unlink' then
      if exists(select 1 from jsonb_object_keys(p_values) k where k<>'confirmName') then raise exception 'Unsupported unlink fields'; end if;
      update public.products set config=(coalesce(config,'{}')-array['clickup_list_id','clickup_list_name','clickupListId','clickupListName','clickup_sync','last_synced_at_ms','last_synced_count']) where id=p_product_id returning * into p;
    elsif p_operation='fields' then
      fields:=p_values->'catalog';
      if jsonb_typeof(fields) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>'catalog')
        or exists(select 1 from jsonb_object_keys(fields) k where k not in ('creativeStructure','hookType','productionStyle')) then raise exception 'Invalid field catalogs'; end if;
      foreach field in array array['creativeStructure','hookType','productionStyle'] loop
        if jsonb_typeof(fields->field) is distinct from 'array' or jsonb_array_length(fields->field)>100 then raise exception 'Invalid field catalog options'; end if;
        names:='{}';
        for option in select value from jsonb_array_elements(fields->field) loop
          clean:=trim(option->>'name');
          if jsonb_typeof(option) is distinct from 'object' or jsonb_typeof(option->'name') is distinct from 'string'
            or jsonb_typeof(option->'desc') is distinct from 'string' or length(clean) not between 1 and 200
            or clean<>option->>'name' or length(option->>'desc')>2000
            or exists(select 1 from jsonb_object_keys(option) k where k not in ('name','desc')) then raise exception 'Invalid field option'; end if;
          if lower(clean)=any(names) then raise exception 'Duplicate field option'; end if;
          names:=array_append(names,lower(clean));
        end loop;
      end loop;
      update public.products set config=coalesce(config,'{}')||jsonb_build_object('field_options',fields) where id=p_product_id returning * into p;
    else
      if exists(select 1 from jsonb_object_keys(p_values) k where k not in ('confirmName','revision')) then raise exception 'Unsupported deletion fields'; end if;
      manifest:=public.qa_product_manifest(p_product_id,true);
      if (manifest->>'blocked')::boolean then raise exception 'Product has queued or running work. Resolve it before deleting.'; end if;
      if p_values->>'revision' is distinct from manifest->>'revision' then raise exception 'Product data changed since preview. Review a new preview.'; end if;
      delete from public.products where id=p_product_id;
    end if;
  end if;
  result:=jsonb_build_object('requestId',p_request_id,'operation',p_operation,'productId',p_product_id,'product',case when p_operation='delete' then null else to_jsonb(p) end,'dispatchEnabled',false);
  insert into public.admin_audit_log(actor_id,action,target_product,meta) values(auth.uid(),'qa_product_'||p_operation,p_product_id,jsonb_build_object('requestId',p_request_id,'counts',manifest->'counts'));
  insert into public.qa_product_admin_receipts(request_id,actor_id,product_id,request,response) values(p_request_id,auth.uid(),p_product_id,req,result);
  return result;
end $$;
revoke all on function public.qa_product_admin_access(),public.qa_product_manifest(text,boolean),public.qa_product_delete_preview(text),public.qa_product_mutate(uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_product_delete_preview(text),public.qa_product_mutate(uuid,text,text,timestamptz,jsonb) to authenticated;
