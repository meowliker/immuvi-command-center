-- QA-only provisioning journal. No existing accounts or products are rewritten.
create table if not exists public.qa_account_creations (
  request_id uuid primary key, actor_id uuid not null, target_id uuid not null unique,
  request jsonb not null, email text not null, state text not null check(state in ('sending','completed','rejected')),
  send_token uuid not null, secret_cipher text, password_tag text, password_fingerprint text,
  response jsonb, created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index if not exists qa_creation_pending_email on public.qa_account_creations(email) where state='sending';
create unique index if not exists qa_creation_pending_username on public.qa_account_creations((request->>'username')) where state='sending';
alter table public.qa_account_creations enable row level security;
revoke all on public.qa_account_creations from public,anon,authenticated;

create or replace function public.qa_account_creation_prepare(p_actor uuid,p_request_id uuid,p_input jsonb,p_target uuid,p_send_token uuid,p_secret_cipher text,p_password_tag text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_account_creations%rowtype; ids text[]; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  if p_request_id is null or p_target is null or p_target=p_actor or p_send_token is null or jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input->'email') is distinct from 'string' or jsonb_typeof(p_input->'username') is distinct from 'string'
    or coalesce(p_input->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(p_input->>'email')>320 or p_input->>'email'<>lower(trim(p_input->>'email'))
    or length(coalesce(p_input->>'username','')) not between 1 and 100 or p_input->>'username'<>trim(p_input->>'username')
    or jsonb_typeof(p_input->'fullName') is distinct from 'string' or length(p_input->>'fullName')>200 or p_input->>'fullName'<>trim(p_input->>'fullName')
    or coalesce(p_input->>'role','') not in ('admin','member') or coalesce(p_input->>'passwordMode','') not in ('generated','custom')
    or jsonb_typeof(p_input->'productIds') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('email','username','fullName','role','passwordMode','productIds')) then raise exception 'Invalid account creation request'; end if;
  if jsonb_array_length(p_input->'productIds')>1000 or (p_input->>'role'='admin' and jsonb_array_length(p_input->'productIds')>0)
    or exists(select 1 from jsonb_array_elements(p_input->'productIds') x where jsonb_typeof(x)<>'string'
      or length(x#>>'{}') not between 1 and 200 or x#>>'{}'<>trim(x#>>'{}')) then raise exception 'Invalid product assignments'; end if;
  select coalesce(array_agg(value order by value),'{}') into ids from jsonb_array_elements_text(p_input->'productIds');
  if cardinality(ids)<>(select count(distinct v) from unnest(ids) v) then raise exception 'Duplicate product assignments'; end if;
  select * into job from public.qa_account_creations where request_id=p_request_id;
  if found then
    if job.actor_id<>p_actor or job.request<>p_input or (p_password_tag is not null and p_password_tag is distinct from job.password_tag) then raise exception 'Creation request identity conflicts'; end if;
    return to_jsonb(job)||jsonb_build_object('canSend',false);
  end if;
  if exists(select 1 from auth.users where lower(email)=p_input->>'email' or id=p_target)
    or exists(select 1 from public.profiles where lower(email)=p_input->>'email' or id=p_target) then raise exception 'An account with this email already exists'; end if;
  if exists(select 1 from public.qa_account_creations where email=p_input->>'email' and state='sending') then raise exception 'This email has a pending creation request'; end if;
  if exists(select 1 from public.profiles where username=p_input->>'username')
    or exists(select 1 from public.qa_account_creations where state='sending' and request->>'username'=p_input->>'username') then
    raise exception 'This username is already in use or reserved. Choose another username.'; end if;
  if p_secret_cipher is null or length(p_secret_cipher) not between 1 and 2000
    or (p_input->>'passwordMode'='custom' and coalesce(p_password_tag,'') !~ '^[0-9a-f]{64}$') then raise exception 'Creation password is required before the first request'; end if;
  perform 1 from public.products where id=any(ids) order by id for key share;
  get diagnostics n=row_count;
  if n<>cardinality(ids) then raise exception 'An assigned product is unavailable. Refresh and review.'; end if;
  insert into public.qa_account_creations(request_id,actor_id,target_id,request,email,state,send_token,secret_cipher,password_tag)
    values(p_request_id,p_actor,p_target,p_input,p_input->>'email','sending',p_send_token,p_secret_cipher,p_password_tag) returning * into job;
  return to_jsonb(job)||jsonb_build_object('canSend',true);
end $$;

create or replace function public.qa_account_creation_finish(p_actor uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_account_creations%rowtype; account auth.users%rowtype; ids text[]; n integer; result jsonb; snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  select * into job from public.qa_account_creations where request_id=p_request_id for update;
  if not found or job.actor_id<>p_actor then raise exception 'Creation request is unavailable'; end if;
  if job.state='rejected' then return jsonb_build_object('state','rejected'); end if;
  select coalesce(array_agg(value order by value),'{}') into ids from jsonb_array_elements_text(job.request->'productIds');
  if job.state='sending' then
    perform 1 from public.products where id=any(ids) order by id for key share;
    get diagnostics n=row_count;
    if n<>cardinality(ids) then raise exception 'A reserved product is unavailable'; end if;
  end if;
  select * into account from auth.users where id=job.target_id for share;
  if job.state='sending' then
    if account.id is null or account.raw_app_meta_data->>'qa_creation_request' is distinct from job.request_id::text
      or lower(account.email) is distinct from job.email or nullif(account.encrypted_password,'') is null
      or account.email_confirmed_at is null or account.banned_until>now() then return jsonb_build_object('state','uncertain'); end if;
    perform 1 from public.profiles where id=job.target_id for update;
    if not found then raise exception 'Created profile is unavailable'; end if;
    update public.qa_account_creations set state='completed',finished_at=clock_timestamp(),password_fingerprint=md5(account.encrypted_password)
      where request_id=job.request_id;
    update public.profiles set username=job.request->>'username',full_name=job.request->>'fullName',role=job.request->>'role',
      is_active=true,must_change_password=true,created_by=p_actor where id=job.target_id;
    insert into public.user_products(user_id,product_id,assigned_by) select job.target_id,id,p_actor from unnest(ids) id;
    insert into public.admin_audit_log(actor_id,action,target_user,meta) values(p_actor,'qa_account_create_user',job.target_id,
      jsonb_build_object('requestId',job.request_id,'email',job.email,'role',job.request->>'role','products',job.request->'productIds'));
    result:=jsonb_build_object('state','completed','requestId',job.request_id,'userId',job.target_id,'operation','create-user','email',job.email,'dispatchEnabled',false);
    update public.qa_account_creations set response=result where request_id=job.request_id returning * into job;
  end if;
  snapshot:=public.qa_admin_user_snapshot(job.target_id);
  return job.response||jsonb_build_object('user',snapshot,'credentialsAvailable',coalesce(account.id is not null
    and account.raw_app_meta_data->>'qa_creation_request'=job.request_id::text and md5(account.encrypted_password)=job.password_fingerprint
    and lower(account.email)=job.email and snapshot->>'email'=job.email
    and (snapshot->>'must_change_password')::boolean and (snapshot->>'is_active')::boolean,false));
end $$;

create or replace function public.qa_account_creation_reject(p_actor uuid,p_request_id uuid,p_send_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare job public.qa_account_creations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  select * into job from public.qa_account_creations where request_id=p_request_id for update;
  if not found or job.actor_id<>p_actor or job.send_token<>p_send_token then raise exception 'Creation request is unavailable'; end if;
  if job.state<>'sending' then return; end if;
  if exists(select 1 from auth.users where id=job.target_id) then raise exception 'Created account requires reconciliation'; end if;
  update public.qa_account_creations set state='rejected',secret_cipher=null,finished_at=clock_timestamp() where request_id=job.request_id;
  insert into public.admin_audit_log(actor_id,action,meta) values(p_actor,'qa_account_create_rejected',jsonb_build_object('requestId',job.request_id,'email',job.email));
end $$;

-- Initial Auth insertion precedes app_metadata updates on hosted Auth. The reserved
-- UUID, not caller-owned metadata, keeps this new profile restricted until finish.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare pending boolean;
begin
  pending:=exists(select 1 from public.qa_account_creations where target_id=new.id and state='sending');
  insert into public.profiles(id,email,full_name,username,role,must_change_password,is_active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),
    case when not pending and new.raw_app_meta_data->>'role'='admin' then 'admin' else 'member' end,
    case when pending then true else coalesce((new.raw_app_meta_data->>'must_change_password')::boolean,true) end,not pending) on conflict(id) do nothing;
  return new;
end $$;

create or replace function public.qa_guard_creation_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_account_creations where state='sending' and (target_id=old.id or actor_id=old.id)) then
    raise exception 'Resolve the pending account creation first'; end if;
  return new;
end $$;
drop trigger if exists qa_guard_creation_profile on public.profiles;
create trigger qa_guard_creation_profile before update of role,is_active,must_change_password on public.profiles for each row execute function public.qa_guard_creation_profile();

create or replace function public.qa_guard_creation_delete() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_account_creations where state='sending' and (target_id=old.id or actor_id=old.id)) then
    raise exception 'Resolve the pending account creation first'; end if;
  return old;
end $$;
drop trigger if exists qa_guard_creation_delete on auth.users;
create trigger qa_guard_creation_delete before delete on auth.users for each row execute function public.qa_guard_creation_delete();

create or replace function public.qa_guard_creation_product() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_account_creations where state='sending' and request->'productIds' ? old.id) then
    raise exception 'Product is reserved by a pending account creation'; end if;
  return old;
end $$;
drop trigger if exists qa_guard_creation_product on public.products;
create trigger qa_guard_creation_product before delete on public.products for each row execute function public.qa_guard_creation_product();

create or replace function public.qa_guard_creation_assignments() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_account_creations where state='sending' and target_id=case when tg_op='DELETE' then old.user_id else new.user_id end) then
    raise exception 'Resolve the pending account creation first'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists qa_guard_creation_assignments on public.user_products;
create trigger qa_guard_creation_assignments before insert or update or delete on public.user_products for each row execute function public.qa_guard_creation_assignments();

create or replace function public.qa_guard_creation_username() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.qa_account_creations where state='sending' and target_id<>new.id and request->>'username'=new.username) then
    raise exception 'This username is reserved by a pending account creation'; end if;
  return new;
end $$;
drop trigger if exists qa_guard_creation_username on public.profiles;
create trigger qa_guard_creation_username before insert or update of username on public.profiles for each row execute function public.qa_guard_creation_username();

revoke all on function public.qa_account_creation_prepare(uuid,uuid,jsonb,uuid,uuid,text,text),public.qa_account_creation_finish(uuid,uuid),
  public.qa_account_creation_reject(uuid,uuid,uuid),public.qa_guard_creation_profile(),public.qa_guard_creation_delete(),
  public.qa_guard_creation_product(),public.qa_guard_creation_assignments(),public.qa_guard_creation_username() from public,anon,authenticated;
grant execute on function public.qa_account_creation_prepare(uuid,uuid,jsonb,uuid,uuid,text,text),public.qa_account_creation_finish(uuid,uuid),
  public.qa_account_creation_reject(uuid,uuid,uuid) to service_role;
