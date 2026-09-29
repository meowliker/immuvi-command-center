create table if not exists public.qa_account_operations (
  request_id uuid primary key, actor_id uuid not null, target_id uuid not null,
  operation text not null check(operation in ('reset-password','deactivate','reactivate','delete-user')),
  request jsonb not null, before_profile jsonb not null,
  state text not null check(state in ('sending','completed','rejected')),
  send_token uuid not null, secret_cipher text,
  password_fingerprint text, response jsonb,
  created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index if not exists qa_account_one_pending_target on public.qa_account_operations(target_id) where state='sending';
alter table public.qa_account_operations enable row level security;
revoke all on public.qa_account_operations from public,anon,authenticated;

create or replace function public.qa_account_actor(p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.profiles where id=p_actor and role='admin' and is_active and not must_change_password for share;
  if not found then raise exception 'Active QA administrator access is required' using errcode='42501'; end if;
end $$;

create or replace function public.qa_account_prepare(p_actor uuid,p_request_id uuid,p_input jsonb,p_send_token uuid,p_secret_cipher text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_account_operations%rowtype; target uuid; profile jsonb; fingerprint text;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  if p_request_id is null or p_send_token is null or jsonb_typeof(p_input) is distinct from 'object'
    or coalesce(p_input->>'operation','') not in ('reset-password','deactivate','reactivate','delete-user')
    or coalesce(p_input->>'revision','') !~ '^[0-9a-f]{32}$'
    or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('operation','userId','revision','confirmEmail')) then raise exception 'Invalid account request'; end if;
  target:=(p_input->>'userId')::uuid;
  if target is null or target=p_actor then raise exception 'You cannot perform this account operation on yourself'; end if;
  select * into job from public.qa_account_operations where request_id=p_request_id;
  if found then
    if job.actor_id<>p_actor or job.request<>p_input then raise exception 'Account request identity conflicts'; end if;
    return to_jsonb(job)||jsonb_build_object('canSend',false);
  end if;
  if exists(select 1 from public.qa_account_operations where target_id=target and state='sending') then raise exception 'Resolve the pending account operation first'; end if;
  if exists(select 1 from public.qa_account_operations where actor_id=target and state='sending') then raise exception 'Finish this administrator''s pending account requests first'; end if;
  select md5(coalesce(encrypted_password,'')) into fingerprint from auth.users where id=target for update;
  if not found then raise exception 'Auth account is unavailable'; end if;
  perform 1 from public.profiles where id=target for update;
  if not found then raise exception 'User is unavailable. Refresh and review.'; end if;
  profile:=public.qa_admin_user_snapshot(target);
  if profile->>'access_revision' is distinct from p_input->>'revision' then raise exception 'User access changed. Refresh and review.'; end if;
  if p_input->>'operation'='delete-user' and p_input->>'confirmEmail' is distinct from profile->>'email' then raise exception 'Confirm the exact account email'; end if;
  if p_input->>'operation'='reset-password' and (p_secret_cipher is null or length(p_secret_cipher)>2000) then raise exception 'Missing encrypted reset credential'; end if;
  -- Restrict app access before the external Auth write; incomplete work stays fail-closed.
  if p_input->>'operation'='reset-password' then
    update public.profiles set must_change_password=true where id=target;
  else
    update public.profiles set is_active=false where id=target;
  end if;
  insert into public.qa_account_operations(request_id,actor_id,target_id,operation,request,before_profile,state,send_token,secret_cipher,password_fingerprint)
    values(p_request_id,p_actor,target,p_input->>'operation',p_input,profile,'sending',p_send_token,
      case when p_input->>'operation'='reset-password' then p_secret_cipher end,fingerprint) returning * into job;
  return to_jsonb(job)||jsonb_build_object('canSend',true);
end $$;

create or replace function public.qa_account_finish(p_actor uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.qa_account_operations%rowtype; account auth.users%rowtype; result jsonb; credentials boolean:=false;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  select * into job from public.qa_account_operations where request_id=p_request_id for update;
  if not found or job.actor_id<>p_actor then raise exception 'Account request is unavailable'; end if;
  if job.state='rejected' then return jsonb_build_object('state','rejected','requestId',job.request_id); end if;
  select * into account from auth.users where id=job.target_id for share;
  if job.state='sending' then
    if job.operation='delete-user' then
      if account.id is not null then return jsonb_build_object('state','uncertain','requestId',job.request_id); end if;
    else
      if account.id is null or account.raw_app_meta_data->>'qa_account_request' is distinct from job.request_id::text then
        return jsonb_build_object('state','uncertain','requestId',job.request_id);
      end if;
      if job.operation='reset-password' and md5(coalesce(account.encrypted_password,''))=job.password_fingerprint
        or job.operation='deactivate' and (account.banned_until is null or account.banned_until<=now())
        or job.operation='reactivate' and account.banned_until>now() then
        return jsonb_build_object('state','uncertain','requestId',job.request_id);
      end if;
    end if;
    -- Release the target guard within this same transaction; rollback restores it on any failure.
    update public.qa_account_operations set state='completed',finished_at=clock_timestamp(),
      password_fingerprint=md5(coalesce(account.encrypted_password,'')) where request_id=job.request_id;
    if job.operation='reset-password' then update public.profiles set must_change_password=true where id=job.target_id;
    elsif job.operation='reactivate' then update public.profiles set is_active=true where id=job.target_id;
    elsif job.operation='deactivate' then update public.profiles set is_active=false where id=job.target_id;
    elsif exists(select 1 from public.profiles where id=job.target_id) then raise exception 'Deleted account profile still exists'; end if;
    result:=jsonb_build_object('state','completed','requestId',job.request_id,'userId',job.target_id,'operation',job.operation,
      'user',public.qa_admin_user_snapshot(job.target_id),'dispatchEnabled',false);
    insert into public.admin_audit_log(actor_id,action,target_user,meta) values(p_actor,'qa_account_'||replace(job.operation,'-','_'),
      case when job.operation='delete-user' then null else job.target_id end,
      jsonb_build_object('requestId',job.request_id,'targetId',job.target_id,'email',job.before_profile->>'email',
        'before',jsonb_build_object('active',job.before_profile->'is_active','passwordChangeRequired',job.before_profile->'must_change_password')));
    update public.qa_account_operations set response=result where request_id=job.request_id returning * into job;
  end if;
  credentials:=job.operation='reset-password' and account.id is not null
    and account.raw_app_meta_data->>'qa_account_request'=job.request_id::text
    and md5(coalesce(account.encrypted_password,''))=job.password_fingerprint
    and exists(select 1 from public.profiles where id=job.target_id and must_change_password);
  return job.response||jsonb_build_object('credentialsAvailable',credentials);
end $$;

create or replace function public.qa_account_reject(p_actor uuid,p_request_id uuid,p_send_token uuid) returns void
language plpgsql security definer set search_path=public as $$
declare job public.qa_account_operations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('qa-admin-access',0));
  perform public.qa_account_actor(p_actor);
  select * into job from public.qa_account_operations where request_id=p_request_id for update;
  if not found or job.actor_id<>p_actor or job.send_token<>p_send_token then raise exception 'Account request is unavailable'; end if;
  if job.state<>'sending' then return; end if;
  if not exists(select 1 from auth.users where id=job.target_id)
    or exists(select 1 from auth.users where id=job.target_id and raw_app_meta_data->>'qa_account_request'=job.request_id::text) then
    raise exception 'Auth outcome requires reconciliation';
  end if;
  update public.qa_account_operations set state='rejected',secret_cipher=null,finished_at=clock_timestamp() where request_id=job.request_id;
  update public.profiles set is_active=(job.before_profile->>'is_active')::boolean,
    must_change_password=(job.before_profile->>'must_change_password')::boolean where id=job.target_id;
  insert into public.admin_audit_log(actor_id,action,target_user,meta) values(p_actor,'qa_account_rejected',job.target_id,
    jsonb_build_object('requestId',job.request_id,'operation',job.operation,'email',job.before_profile->>'email'));
end $$;

create or replace function public.qa_guard_profile_authority() returns trigger
language plpgsql set search_path=public as $$
begin
  if current_user in ('anon','authenticated') then
    if (new.id,new.email,new.role,new.is_active,new.created_at,new.created_by,new.must_change_password)
      is distinct from (old.id,old.email,old.role,old.is_active,old.created_at,old.created_by,old.must_change_password) then
      raise exception 'Use authorized user administration for access changes' using errcode='42501';
    end if;
  elsif (new.role,new.is_active,new.must_change_password) is distinct from (old.role,old.is_active,old.must_change_password)
    and exists(select 1 from public.qa_account_operations where (target_id=old.id or actor_id=old.id) and state='sending') then
    raise exception 'Resolve the pending account operation first';
  end if;
  return new;
end $$;

create or replace function public.qa_guard_account_assignments() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  -- FK cascades from Auth deletion must still complete; ordinary access RPCs cannot bypass a pending account change.
  if pg_trigger_depth()=1 and exists(select 1 from public.qa_account_operations where state='sending'
    and target_id=case when tg_op='DELETE' then old.user_id else new.user_id end) then raise exception 'Resolve the pending account operation first'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists qa_guard_account_assignments on public.user_products;
create trigger qa_guard_account_assignments before insert or update or delete on public.user_products for each row execute function public.qa_guard_account_assignments();

create or replace function public.qa_auth_password_completed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password and nullif(new.encrypted_password,'') is not null
    and not exists(select 1 from public.qa_account_operations where target_id=new.id and state='sending') then
    update public.profiles set must_change_password=false where id=new.id and must_change_password;
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
    update public.profiles set last_login_at=new.last_sign_in_at where id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists qa_auth_password_completed on auth.users;
create trigger qa_auth_password_completed after update of encrypted_password,last_sign_in_at on auth.users for each row execute function public.qa_auth_password_completed();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active and not must_change_password);
$$;
create or replace function public.has_product(p text) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists(select 1 from public.user_products u join public.profiles pr on pr.id=u.user_id
    where u.user_id=auth.uid() and u.product_id=p and pr.is_active and not pr.must_change_password);
$$;

create or replace function public.qa_account_audit_page(p_before bigint default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  perform public.qa_product_admin_access();
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'action',action,'createdAt',created_at,
    'actorId',actor_id,'targetId',coalesce(target_user::text,meta->>'targetId'),'email',meta->>'email') order by id desc),'[]')
    from (select * from public.admin_audit_log where (p_before is null or id<p_before)
      and (action like 'qa_account_%' or action like 'qa_user_%' or action in ('create_user','reset_password','deactivate','reactivate','delete_user','set_role','update_products'))
      order by id desc limit 50) a);
end $$;

revoke all on function public.qa_account_actor(uuid),public.qa_account_prepare(uuid,uuid,jsonb,uuid,text),
  public.qa_account_finish(uuid,uuid),public.qa_account_reject(uuid,uuid,uuid),public.qa_guard_account_assignments(),
  public.qa_auth_password_completed(),public.qa_account_audit_page(bigint) from public,anon,authenticated;
grant execute on function public.qa_account_prepare(uuid,uuid,jsonb,uuid,text),public.qa_account_finish(uuid,uuid),
  public.qa_account_reject(uuid,uuid,uuid) to service_role;
grant execute on function public.qa_account_audit_page(bigint) to authenticated;
