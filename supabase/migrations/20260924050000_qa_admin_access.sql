-- QA only. Access changes, receipts and audit entries share one transaction.
create table if not exists public.qa_admin_access_receipts (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  request jsonb not null, response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.qa_admin_access_receipts enable row level security;
revoke all on public.qa_admin_access_receipts from public,anon,authenticated;

create or replace function public.qa_admin_user_snapshot(p_user_id uuid) returns jsonb
language sql stable set search_path=public as $$
  select to_jsonb(p)||jsonb_build_object('product_ids',a.ids,'access_revision',
    md5(jsonb_build_array(p.id,p.role,p.is_active,p.must_change_password,a.assignments)::text))
  from public.profiles p cross join lateral (
    select coalesce(jsonb_agg(product_id order by product_id),'[]') ids,
      coalesce(jsonb_agg(jsonb_build_array(product_id,assigned_at,assigned_by) order by product_id),'[]') assignments
    from public.user_products where user_id=p.id
  ) a where p.id=p_user_id;
$$;

create or replace function public.qa_admin_users_page(p_after uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rows jsonb;
begin
  perform public.qa_product_admin_access();
  select coalesce(jsonb_agg(public.qa_admin_user_snapshot(id) order by id),'[]') into rows
    from (select id from public.profiles where p_after is null or id>p_after order by id limit 500) p;
  return rows;
end $$;

create or replace function public.qa_admin_access_mutate(p_request_id uuid,p_user_id uuid,p_operation text,p_revision text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req jsonb; receipt public.qa_admin_access_receipts%rowtype; before_row jsonb; after_row jsonb;
  response jsonb; ids text[]; locked_count integer;
begin
  -- Serialize administrators before locking their profiles, avoiding reciprocal-demotion deadlocks.
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_product_admin_access();
  if p_request_id is null or p_user_id is null or p_operation is null or p_operation not in ('products','role')
    or coalesce(p_revision,'') !~ '^[0-9a-f]{32}$' or jsonb_typeof(p_values) is distinct from 'object' then
    raise exception 'Invalid user access request';
  end if;
  req:=jsonb_build_object('userId',p_user_id,'operation',p_operation,'revision',p_revision,'values',p_values);
  select * into receipt from public.qa_admin_access_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id<>auth.uid() or receipt.request<>req then raise exception 'User request identity conflicts'; end if;
    return receipt.response;
  end if;
  if p_operation='products' then
    if jsonb_typeof(p_values->'productIds') is distinct from 'array'
      or exists(select 1 from jsonb_object_keys(p_values) k where k<>'productIds') then raise exception 'Invalid product assignments'; end if;
    if jsonb_array_length(p_values->'productIds')>1000 or exists(select 1 from jsonb_array_elements(p_values->'productIds') x
      where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 200 or trim(x#>>'{}')<>x#>>'{}') then raise exception 'Invalid product assignments'; end if;
    select coalesce(array_agg(value order by value),'{}') into ids from jsonb_array_elements_text(p_values->'productIds');
    if cardinality(ids)<>(select count(distinct value) from unnest(ids) value) then raise exception 'Duplicate product assignment'; end if;
    -- Match product deletion lock order. Deleted destinations cannot be reinserted by a late save.
    perform 1 from public.products where id=any(ids) order by id for key share;
    get diagnostics locked_count=row_count;
    if locked_count<>cardinality(ids) then raise exception 'An assigned product is unavailable. Refresh and review.'; end if;
  else
    if coalesce(p_values->>'role','') not in ('member','admin') or exists(select 1 from jsonb_object_keys(p_values) k where k<>'role') then raise exception 'Invalid role'; end if;
    if p_user_id=auth.uid() then raise exception 'You cannot change your own administrator role'; end if;
  end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User is unavailable. Refresh and review.'; end if;
  perform 1 from public.user_products where user_id=p_user_id order by product_id for update;
  before_row:=public.qa_admin_user_snapshot(p_user_id);
  if before_row->>'access_revision'<>p_revision then raise exception 'User access changed. Review the latest access before saving.'; end if;
  if p_operation='products' then
    if before_row->>'role'<>'member' then raise exception 'Administrators already have all product access'; end if;
    delete from public.user_products where user_id=p_user_id and not(product_id=any(ids));
    insert into public.user_products(user_id,product_id,assigned_by)
      select p_user_id,id,auth.uid() from unnest(ids) id on conflict do nothing;
  else
    -- The active, password-cleared caller is always a different surviving administrator.
    update public.profiles set role=p_values->>'role' where id=p_user_id;
  end if;
  after_row:=public.qa_admin_user_snapshot(p_user_id);
  insert into public.admin_audit_log(actor_id,action,target_user,meta)
    values(auth.uid(),'qa_user_'||p_operation,p_user_id,jsonb_build_object('requestId',p_request_id,
      'before',jsonb_build_object('role',before_row->'role','productIds',before_row->'product_ids'),
      'after',jsonb_build_object('role',after_row->'role','productIds',after_row->'product_ids')));
  response:=jsonb_build_object('requestId',p_request_id,'userId',p_user_id,'operation',p_operation,'user',after_row,'dispatchEnabled',false);
  insert into public.qa_admin_access_receipts(request_id,actor_id,request,response) values(p_request_id,auth.uid(),req,response);
  return response;
end $$;

-- Client-owned signup metadata cannot grant administrator privileges.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,username,role,must_change_password)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),
    case when new.raw_app_meta_data->>'role'='admin' then 'admin' else 'member' end,
    coalesce((new.raw_app_meta_data->>'must_change_password')::boolean,true)) on conflict(id) do nothing;
  return new;
end $$;

-- Retain the existing self-profile/preferences/password-completion flow, but
-- require privileged code for identity, role and activity fields.
create or replace function public.qa_guard_profile_authority() returns trigger
language plpgsql set search_path=public as $$
begin
  if current_user in ('anon','authenticated') and
    (new.id,new.email,new.role,new.is_active,new.created_at,new.created_by)
    is distinct from (old.id,old.email,old.role,old.is_active,old.created_at,old.created_by) then
    raise exception 'Use authorized user administration for access changes' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists qa_guard_profile_authority on public.profiles;
create trigger qa_guard_profile_authority before update on public.profiles for each row execute function public.qa_guard_profile_authority();
revoke insert,delete,truncate on public.profiles from public,anon,authenticated;
revoke insert,update,delete,truncate on public.user_products from public,anon,authenticated;
revoke insert,update,delete,truncate on public.admin_audit_log from public,anon,authenticated;
revoke all on public.profiles_with_products from public,anon,authenticated;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using(id=auth.uid() and is_active) with check(id=auth.uid() and is_active);

revoke all on function public.qa_admin_user_snapshot(uuid),public.qa_guard_profile_authority(),public.handle_new_user(),
  public.qa_admin_users_page(uuid),public.qa_admin_access_mutate(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.qa_admin_users_page(uuid),public.qa_admin_access_mutate(uuid,uuid,text,text,jsonb) to authenticated;
