create or replace function public.qa_inspiration_taxonomy_key(value text) returns text
language plpgsql immutable set search_path=public as $$
declare clean text:=trim(regexp_replace(translate(coalesce(value,''),chr(8208)||chr(8209)||chr(8210)||chr(8211)||chr(8212)||chr(8213),'------'),'\s+',' ','g'));
  marker text:='^\s*(([-*]+|['||chr(8226)||chr(8227)||chr(9702)||'])\s+|(\(?[0-9]+\)?[.)]|[A-Za-z][.)])\s+|\[[ xX]\]\s+)';
begin
  while clean ~ marker loop clean:=trim(regexp_replace(clean,marker,'')); end loop;
  return lower(trim(regexp_replace(regexp_replace(clean,'\s*([/-])\s*',' \1 ','g'),'\s+',' ','g')));
end;
$$;
revoke all on function public.qa_inspiration_taxonomy_key(text) from public,anon,authenticated;

create or replace function public.qa_inspiration_mapping(p_product_id text,p_request_id uuid,p_operation text,
  p_id text default null,p_expected_updated_at timestamptz default null,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare req jsonb; receipt public.qa_inspiration_receipts%rowtype; result jsonb; i public.inspirations%rowtype;
  mapping jsonb; fields jsonb; kind text; mode text; tab text; chosen text; target record; target_id text; flags jsonb;
begin
  perform public.qa_tracker_access(p_product_id);
  mapping:=p_values->'mapping';fields:=p_values->'fields';kind:=mapping->>'kind';mode:=mapping->>'mode';
  if p_operation is distinct from 'save' or p_request_id is null or jsonb_typeof(mapping) is distinct from 'object'
    or kind is null or kind not in ('angle','persona') or mode is null or mode not in ('existing','custom','new')
    or jsonb_typeof(fields) is distinct from 'object' then raise exception 'Invalid mapping request'; end if;
  if exists(select 1 from jsonb_object_keys(mapping) k where k<>all(array['kind','mode','targetId','targetVersion']))
    or exists(select 1 from jsonb_object_keys(fields) k where k<>kind)
    or jsonb_typeof(fields->kind) is distinct from 'string' then raise exception 'Unsupported mapping fields'; end if;
  chosen:=trim(fields->>kind);
  if chosen='' or length(chosen)>200 then raise exception 'Mapping name must be 1-200 characters'; end if;
  req:=jsonb_build_object('operation',p_operation,'id',p_id,'version',p_expected_updated_at,'values',p_values);
  select * into receipt from public.qa_inspiration_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Request identity conflicts with a previous operation'; end if;
    return receipt.response;
  end if;
  tab:=case kind when 'angle' then 'angles' else 'personas' end;
  if mode='existing' then
    execute format('select * from public.%I where id=$1 and product_id=$2 for update',tab) into target using mapping->>'targetId',p_product_id;
    if target.id is null or target.archived_at is not null or target.updated_at is distinct from (mapping->>'targetVersion')::timestamptz
      or target.name is distinct from chosen then raise exception 'Taxonomy entry changed or is unavailable. Reopen mapping.'; end if;
    target_id:=target.id;
  elsif mode='new' then
    execute format('select id from public.%I where product_id=$1 and public.qa_inspiration_taxonomy_key(name)=public.qa_inspiration_taxonomy_key($2) limit 1',tab) into target using p_product_id,chosen;
    if target.id is not null then raise exception 'This taxonomy name already exists, possibly archived. Refresh and select the existing entry.'; end if;
  end if;
  -- Existing inspiration mutation owns row/queue/version validation and receipt locking.
  result:=public.qa_inspiration_mutate(p_product_id,p_request_id,p_operation,p_id,p_expected_updated_at,p_values-'mapping');
  if mode='new' then
    target_id:=case kind when 'angle' then 'ang-' else 'per-' end||gen_random_uuid()::text;
    execute format('insert into public.%I(id,product_id,name,status,source_link,notes) values($1,$2,$3,''Untested'',$4,$5)',tab)
      using target_id,p_product_id,chosen,result->'row'->>'url','Added from inspiration '||p_id;
  end if;
  flags:=jsonb_build_object('_'||kind||'Scope',case when mode='custom' then 'inspiration' else 'product' end,
    '_'||kind||'Locked',true,'_'||kind||'PromptDone',true,'_needs'||initcap(kind)||'Review',false,
    '_'||kind||'Suggestions','[]'::jsonb,'_suggested'||initcap(kind),'','_qaMappingReviewedBy',auth.uid());
  update public.inspirations set data=data||flags where product_id=p_product_id and id=p_id returning * into i;
  result:=jsonb_set(result,'{row}',to_jsonb(i))||jsonb_build_object('mapping',jsonb_build_object('kind',kind,'mode',mode,'targetId',target_id,'name',chosen));
  update public.qa_inspiration_receipts set request=req,response=result where request_id=p_request_id;
  return result;
end $$;
revoke all on function public.qa_inspiration_mapping(text,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.qa_inspiration_mapping(text,uuid,text,text,timestamptz,jsonb) to authenticated;
