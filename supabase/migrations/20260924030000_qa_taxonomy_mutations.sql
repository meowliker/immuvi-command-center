create table if not exists public.qa_taxonomy_receipts (
  request_id uuid primary key, product_id text not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, request jsonb not null, response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.qa_taxonomy_receipts enable row level security;
revoke all on public.qa_taxonomy_receipts from public,anon,authenticated;

-- Never silently discard incompatible cell/per-creative metadata during a merge.
create or replace function public.qa_taxonomy_merge_json(a jsonb,b jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare result jsonb:=coalesce(a,'{}'); pair record;
begin
  if a is null then return b; end if;
  if b is null or a=b then return a; end if;
  if jsonb_typeof(a)='object' and jsonb_typeof(b)='object' then
    for pair in select * from jsonb_each(b) loop
      result:=jsonb_set(result,array[pair.key],public.qa_taxonomy_merge_json(a->pair.key,pair.value));
    end loop;
    return result;
  elsif jsonb_typeof(a)='array' and jsonb_typeof(b)='array' then
    return (select coalesce(jsonb_agg(value order by first_seen),'[]') from
      (select value,min(ord) first_seen from jsonb_array_elements(a||b) with ordinality x(value,ord) group by value) u);
  end if;
  raise exception 'Matrix metadata conflicts. Resolve the conflicting cells before merging.';
end $$;

create or replace function public.qa_taxonomy_retag(value jsonb,kind text,old_keys text[],new_name text) returns jsonb
language plpgsql immutable set search_path=public as $$
declare result jsonb:=coalesce(value,'{}'); k text; nested text;
begin
  if jsonb_typeof(result)<>'object' then raise exception 'Invalid taxonomy metadata'; end if;
  foreach k in array array[kind,'source'||initcap(kind),'_source'||initcap(kind),'selected'||initcap(kind)] loop
    if public.qa_inspiration_taxonomy_key(result->>k)=any(old_keys) then result:=result||jsonb_build_object(k,new_name); end if;
  end loop;
  foreach nested in array array['_customFields','_customFieldsRaw','_trackerPending'] loop
    foreach k in array array[kind,kind||' tag'] loop
      if jsonb_typeof(result->nested)='object' and public.qa_inspiration_taxonomy_key(result->nested->>k)=any(old_keys) then
        result:=jsonb_set(result,array[nested,k],to_jsonb(new_name));
      end if;
    end loop;
  end loop;
  return result;
end $$;

create or replace function public.qa_taxonomy_axis_id(product text,kind text,value text) returns text
language plpgsql stable set search_path=public as $$
declare tab text:=case kind when 'angle' then 'angles' else 'personas' end; ids text[]; found_id text;
begin
  execute format('select id from public.%I where product_id=$1 and id=$2',tab) into found_id using product,value;
  if found_id is not null then return found_id; end if;
  execute format('select array_agg(id) from public.%I where product_id=$1 and public.qa_inspiration_taxonomy_key(name)=public.qa_inspiration_taxonomy_key($2)',tab)
    into ids using product,value;
  if coalesce(array_length(ids,1),0)<>1 then raise exception 'Matrix axis is missing or ambiguous. Resolve its catalog entry first.'; end if;
  return ids[1];
end $$;

create or replace function public.qa_taxonomy_mutate(p_product_id text,p_request_id uuid,p_kind text,p_operation text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tab text; col text; req jsonb; receipt public.qa_taxonomy_receipts%rowtype; result jsonb;
  sources jsonb; source jsonb; source_rows jsonb:='[]'; target jsonb; saved jsonb; fields jsonb;
  source_ids text[]:='{}'; old_keys text[]:='{}'; old_names text[]:='{}'; new_name text; target_id text; renamed boolean:=false;
  item record; c public.matrix_cells%rowtype; dest public.matrix_cells%rowtype; a public.ads%rowtype;
  next_meta jsonb; next_data jsonb; assignments jsonb; next_a text; next_p text; angle_name text; persona_name text;
  counts jsonb:='{"ads":0,"inspirations":0,"actions":0,"cells":0,"links":0}'; n int:=0; remote_count int:=0;
  new_notes text; new_source text;
begin
  perform public.qa_tracker_access(p_product_id);
  if p_request_id is null or p_kind is null or p_kind not in ('angle','persona') or p_operation is null
    or p_operation not in ('create','save','archive','restore','delete','merge') or jsonb_typeof(p_values) is distinct from 'object'
    then raise exception 'Invalid taxonomy request'; end if;
  req:=jsonb_build_object('kind',p_kind,'operation',p_operation,'values',p_values);
  select * into receipt from public.qa_taxonomy_receipts where request_id=p_request_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.product_id<>p_product_id or receipt.request<>req then raise exception 'Taxonomy request identity conflicts with a previous save'; end if;
    return receipt.response;
  end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['sources','target','fields'])) then raise exception 'Unsupported taxonomy values'; end if;
  tab:=case p_kind when 'angle' then 'angles' else 'personas' end;
  col:=p_kind||'_id'; sources:=coalesce(p_values->'sources','[]'); fields:=coalesce(p_values->'fields','{}');
  if jsonb_typeof(sources)<>'array' or jsonb_typeof(fields)<>'object' or jsonb_array_length(sources)>50
    or (p_operation='create' and jsonb_array_length(sources)<>0)
    or (p_operation='merge' and jsonb_array_length(sources)<1)
    or (p_operation not in ('create','merge') and jsonb_array_length(sources)<>1) then raise exception 'Invalid taxonomy selection'; end if;
  if (p_operation<>'merge' and p_values ? 'target') or (p_operation not in ('create','save') and fields<>'{}') then raise exception 'Unsupported taxonomy fields'; end if;
  for source in select value from jsonb_array_elements(sources) order by value->>'id' loop
    if jsonb_typeof(source)<>'object' or nullif(source->>'id','') is null or not source ? 'version'
      or exists(select 1 from jsonb_object_keys(source) k where k<>all(array['id','version'])) then raise exception 'Invalid taxonomy source'; end if;
    execute format('select to_jsonb(t) from public.%I t where product_id=$1 and id=$2 for update',tab) into saved using p_product_id,source->>'id';
    if saved is null or (saved->>'updated_at')::timestamptz is distinct from (source->>'version')::timestamptz then
      raise exception 'Taxonomy changed or was deleted. Refresh and review your draft.'; end if;
    if source->>'id'=any(source_ids) then raise exception 'Duplicate taxonomy selection'; end if;
    source_ids:=array_append(source_ids,source->>'id'); old_names:=array_append(old_names,saved->>'name');
    old_keys:=array_append(old_keys,public.qa_inspiration_taxonomy_key(saved->>'name')); source_rows:=source_rows||jsonb_build_array(saved);
  end loop;
  select coalesce(array_agg(distinct k),'{}') into old_keys from unnest(old_keys) k where k<>'';
  if p_operation='merge' then
    if jsonb_typeof(p_values->'target') is distinct from 'object' or not (p_values->'target') ? 'version'
      or exists(select 1 from jsonb_object_keys(p_values->'target') k where k<>all(array['id','version'])) then raise exception 'Choose a merge target'; end if;
    execute format('select to_jsonb(t) from public.%I t where product_id=$1 and id=$2 for update',tab) into target using p_product_id,p_values->'target'->>'id';
    if target is null or target->>'archived_at' is not null or target->>'id'=any(source_ids)
      or (target->>'updated_at')::timestamptz is distinct from (p_values->'target'->>'version')::timestamptz then raise exception 'Merge target changed or is unavailable'; end if;
    target_id:=target->>'id'; new_name:=target->>'name'; renamed:=true;
  elsif p_operation in ('create','save') then
    if exists(select 1 from jsonb_object_keys(fields) k where k<>all(array['name','source_link','notes']))
      or jsonb_typeof(fields->'name') is distinct from 'string' or jsonb_typeof(fields->'source_link') is distinct from 'string'
      or jsonb_typeof(fields->'notes') is distinct from 'string' then raise exception 'Name, source and notes are required'; end if;
    new_name:=trim(fields->>'name');
    if new_name='' or length(new_name)>200 or length(fields->>'notes')>20000 or length(fields->>'source_link')>2000
      or (fields->>'source_link') !~ '^(https?://[^[:space:]]+)?$' then raise exception 'Invalid taxonomy name, notes or source URL'; end if;
    target_id:=case when p_operation='create' then case p_kind when 'angle' then 'ang-' else 'per-' end||p_request_id::text else source_ids[1] end;
    execute format('select to_jsonb(t) from public.%I t where product_id=$1 and id<>$2 and public.qa_inspiration_taxonomy_key(name)=public.qa_inspiration_taxonomy_key($3) limit 1',tab)
      into target using p_product_id,target_id,new_name;
    if target is not null then raise exception 'This taxonomy name already exists, possibly archived. Merge or restore it instead.'; end if;
    renamed:=p_operation='save' and (source_rows->0->>'name') is distinct from new_name;
  elsif p_operation='delete' then new_name:=''; renamed:=true;
  end if;
  if renamed then
    -- Canonical aliases cannot be split reliably by their name-only dependent tags.
    execute format('select to_jsonb(t) from public.%I t where product_id=$1 and not(id=any($2)) and id is distinct from $3 and public.qa_inspiration_taxonomy_key(name)=any($4) limit 1',tab)
      into saved using p_product_id,source_ids,target_id,old_keys;
    if saved is not null then raise exception 'Other catalog rows share this name. Include all aliases in the merge first.'; end if;
    for a in select * from public.ads where product_id=p_product_id and deleted_at is null for update loop
      if coalesce(a.meta->>'_productBoundaryQuarantined','false')='true' or nullif(a.meta->>'deletedAt','') is not null or nullif(a.meta->>'deleted_at','') is not null
        or exists(select 1 from public.deleted_ads d where d.product_id=p_product_id and (d.id=a.id or d.clickup_task_id=coalesce(a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId'))) then continue; end if;
      next_meta:=public.qa_taxonomy_retag(a.meta,p_kind,old_keys,new_name);
      if public.qa_inspiration_taxonomy_key(coalesce(nullif(to_jsonb(a)->>p_kind,''),a.meta->>p_kind))=any(old_keys) then
        next_meta:=next_meta||jsonb_build_object(p_kind,new_name);
        if nullif(coalesce(a.clickup_task_id,a.meta->>'_clickupId',a.meta->>'clickupTaskId'),'') is not null then
          next_meta:=next_meta||jsonb_build_object('_trackerPending',coalesce(next_meta->'_trackerPending','{}')||jsonb_build_object(p_kind,new_name)); remote_count:=remote_count+1;
        end if;
        execute format('update public.ads set %I=$1,meta=$2 where product_id=$3 and id=$4',p_kind) using new_name,next_meta,p_product_id,a.id;
        n:=n+1;
      elsif next_meta is distinct from a.meta then update public.ads set meta=next_meta where product_id=p_product_id and id=a.id; n:=n+1; end if;
    end loop;
    counts:=jsonb_set(counts,'{ads}',to_jsonb(n)); n:=0;
    for item in select id,data from public.inspirations where product_id=p_product_id for update loop
      next_data:=public.qa_taxonomy_retag(item.data,p_kind,old_keys,new_name);
      if next_data is distinct from item.data then update public.inspirations set data=next_data where product_id=p_product_id and id=item.id; n:=n+1; end if;
    end loop;
    counts:=jsonb_set(counts,'{inspirations}',to_jsonb(n)); n:=0;
    for item in select id,payload from public.manual_actions where product_id=p_product_id for update loop
      next_data:=public.qa_taxonomy_retag(item.payload,p_kind,old_keys,new_name);
      if next_data is distinct from item.payload then update public.manual_actions set payload=next_data where product_id=p_product_id and id=item.id; n:=n+1; end if;
    end loop;
    counts:=jsonb_set(counts,'{actions}',to_jsonb(n)); n:=0;
    for item in select id from public.matrix_cells where product_id=p_product_id and
      ((to_jsonb(matrix_cells)->>col)=any(source_ids) or (to_jsonb(matrix_cells)->>col)=target_id
       or ((public.qa_inspiration_taxonomy_key(to_jsonb(matrix_cells)->>col)=any(old_keys)
         or (target_id is not null and public.qa_inspiration_taxonomy_key(to_jsonb(matrix_cells)->>col)=public.qa_inspiration_taxonomy_key(new_name)))
         and not exists(select 1 from public.angles ax where p_kind='angle' and ax.product_id=p_product_id and ax.id=matrix_cells.angle_id)
         and not exists(select 1 from public.personas px where p_kind='persona' and px.product_id=p_product_id and px.id=matrix_cells.persona_id))) order by id loop
      select * into c from public.matrix_cells where product_id=p_product_id and id=item.id for update;
      if not found then continue; end if;
      if p_operation='delete' then delete from public.matrix_cells where id=c.id; n:=n+1; continue; end if;
      next_a:=case p_kind when 'angle' then target_id else public.qa_taxonomy_axis_id(p_product_id,'angle',c.angle_id) end;
      next_p:=case p_kind when 'persona' then target_id else public.qa_taxonomy_axis_id(p_product_id,'persona',c.persona_id) end;
      select name into angle_name from public.angles where product_id=p_product_id and id=next_a;
      select name into persona_name from public.personas where product_id=p_product_id and id=next_p;
      if p_kind='angle' then angle_name:=new_name; else persona_name:=new_name; end if;
      next_meta:=coalesce(c.meta,'{}');
      if next_meta ? 'cell_key' then next_meta:=next_meta||jsonb_build_object('cell_key',angle_name||'||'||persona_name); end if;
      if jsonb_typeof(c.creative_assignments)<>'array' or jsonb_typeof(next_meta)<>'object' then raise exception 'Invalid Matrix data'; end if;
      select * into dest from public.matrix_cells where product_id=p_product_id and angle_id=next_a and persona_id=next_p and id<>c.id for update;
      if found then
        if nullif(dest.action_status,'') is not null and nullif(c.action_status,'') is not null and dest.action_status<>c.action_status then raise exception 'Matrix action statuses conflict. Resolve them before merging.'; end if;
        -- Both legacy cell_key values describe the same destination after retagging.
        if dest.meta ? 'cell_key' then dest.meta:=dest.meta||jsonb_build_object('cell_key',angle_name||'||'||persona_name); end if;
        next_meta:=public.qa_taxonomy_merge_json(dest.meta,next_meta);
        assignments:=public.qa_taxonomy_merge_json(dest.creative_assignments,c.creative_assignments);
        if exists(select 1 from jsonb_array_elements_text(assignments) x where coalesce(next_meta->'_excludedCreativeIds','[]') ? x) then raise exception 'Matrix assignments conflict with exclusions. Resolve them before merging.'; end if;
        update public.matrix_cells set creative_assignments=assignments,meta=next_meta,action_status=coalesce(nullif(dest.action_status,''),c.action_status) where id=dest.id;
        delete from public.matrix_cells where id=c.id;
      else update public.matrix_cells set angle_id=next_a,persona_id=next_p,meta=next_meta where id=c.id; end if;
      n:=n+1;
    end loop;
    counts:=jsonb_set(counts,'{cells}',to_jsonb(n)); n:=0;
    if p_operation in ('merge','delete') then
      for item in select * from public.angle_personas where product_id=p_product_id and (to_jsonb(angle_personas)->>col)=any(source_ids) for update loop
        if p_operation='merge' then
          insert into public.angle_personas(product_id,angle_id,persona_id,linked)
            values(p_product_id,case p_kind when 'angle' then target_id else item.angle_id end,case p_kind when 'persona' then target_id else item.persona_id end,item.linked)
            on conflict(product_id,angle_id,persona_id) do update set linked=angle_personas.linked or excluded.linked;
        end if;
        delete from public.angle_personas where id=item.id; n:=n+1;
      end loop;
    end if;
    counts:=jsonb_set(counts,'{links}',to_jsonb(n));
  end if;
  if p_operation='create' then
    execute format('insert into public.%I(id,product_id,name,status,source_link,notes) values($1,$2,$3,''Untested'',$4,$5) returning to_jsonb(%I)',tab,tab)
      into saved using target_id,p_product_id,new_name,fields->>'source_link',fields->>'notes';
  elsif p_operation='save' then
    execute format('update public.%I set name=$1,source_link=$2,notes=$3 where id=$4 and product_id=$5 returning to_jsonb(%I)',tab,tab)
      into saved using new_name,fields->>'source_link',fields->>'notes',target_id,p_product_id;
  elsif p_operation in ('archive','restore') then
    execute format('update public.%I set archived_at=$1 where id=$2 and product_id=$3 returning to_jsonb(%I)',tab,tab)
      into saved using case p_operation when 'archive' then clock_timestamp() else null end,source_ids[1],p_product_id;
  else
    if p_operation='merge' then
      new_notes:=coalesce(target->>'notes',''); new_source:=coalesce(target->>'source_link','');
      for source in select value from jsonb_array_elements(source_rows) loop
        if coalesce(source->>'notes','')<>'' or coalesce(source->>'source_link','')<>'' then
          new_notes:=new_notes||case when new_notes<>'' then E'\n\n' else '' end||'Merged from '||(source->>'name')||E'\n'||coalesce(source->>'notes','')
            ||case when coalesce(source->>'source_link','')<>'' then E'\nSource: '||(source->>'source_link') else '' end;
        end if;
        if new_source='' then new_source:=coalesce(source->>'source_link',''); end if;
      end loop;
      if length(new_notes)>20000 then raise exception 'Combined notes exceed 20000 characters. Shorten them before merging.'; end if;
      execute format('update public.%I set notes=$1,source_link=$2 where product_id=$3 and id=$4 returning to_jsonb(%I)',tab,tab)
        into saved using new_notes,new_source,p_product_id,target_id;
    else saved:=null; end if;
    execute format('delete from public.%I where product_id=$1 and id=any($2)',tab) using p_product_id,source_ids;
  end if;
  result:=jsonb_build_object('requestId',p_request_id,'productId',p_product_id,'kind',p_kind,'operation',p_operation,
    'row',saved,'removedIds',case when p_operation in ('merge','delete') then to_jsonb(source_ids) else '[]'::jsonb end,
    'counts',counts,'remotePending',remote_count,'dispatchEnabled',false);
  insert into public.qa_taxonomy_receipts(request_id,product_id,user_id,request,response) values(p_request_id,p_product_id,auth.uid(),req,result);
  return result;
end $$;
revoke all on function public.qa_taxonomy_merge_json(jsonb,jsonb),public.qa_taxonomy_retag(jsonb,text,text[],text),
  public.qa_taxonomy_axis_id(text,text,text),public.qa_taxonomy_mutate(text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.qa_taxonomy_mutate(text,uuid,text,text,jsonb) to authenticated;
