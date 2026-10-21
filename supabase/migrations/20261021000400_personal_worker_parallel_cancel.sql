alter table personal_workers.jobs add column if not exists cancel_requested boolean not null default false;
alter table personal_workers.devices add column if not exists parallel_capacity integer not null default 1 check(parallel_capacity between 1 and 3);

create or replace function public.guard_personal_classification_queue() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id text; target_product text;
begin
  if tg_op='DELETE' then target_id:=old.ins_id; target_product:=old.product_id;
  else target_id:=new.ins_id; target_product:=new.product_id; end if;
  if coalesce(auth.role(),'')<>'service_role' and exists(select 1 from personal_workers.jobs
    where ins_id=target_id and product_id=target_product and not cancel_requested
      and state in ('pending','running','publishing','review')) then
    raise exception 'This inspiration has a personal assignment. Manage it from the paired browser.' using errcode='PT409';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create or replace function public.guard_personal_inspiration_delete() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from personal_workers.jobs where ins_id=old.id and product_id=old.product_id
    and not cancel_requested and state in ('pending','running','publishing','review')) then
    raise exception 'Cancel this personal assignment from its paired browser before deleting.' using errcode='PT409';
  end if;
  return old;
end $$;
drop trigger if exists guard_personal_inspiration_delete on public.inspirations;
create trigger guard_personal_inspiration_delete before delete on public.inspirations
for each row execute function public.guard_personal_inspiration_delete();

create or replace function personal_workers.cancel_missing_sources(target uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update personal_workers.jobs j set cancel_requested=true,
    state=case when state in ('pending','running') then 'cancelled' else state end,
    error_code='ORPHANED_SOURCE'
    where device_id=target and not cancel_requested and state in ('pending','running','publishing','review')
      and not exists(select 1 from inspirations i where i.id=j.ins_id and i.product_id=j.product_id);
  delete from inspiration_queue q where worker_assignment='private'
    and not exists(select 1 from inspirations i where i.id=q.ins_id and i.product_id=q.product_id)
    and exists(select 1 from personal_workers.jobs j where j.device_id=target and j.cancel_requested
      and j.ins_id=q.ins_id and j.product_id=q.product_id);
end $$;
revoke all on function personal_workers.cancel_missing_sources(uuid) from public,anon,authenticated;

do $$ begin
  if to_regprocedure('personal_workers.dispatch_runtime_v1(text,jsonb)') is null then
    alter function public.personal_worker_dispatch(text,jsonb) rename to dispatch_runtime_v1;
    alter function public.dispatch_runtime_v1(text,jsonb) set schema personal_workers;
  end if;
end $$;
revoke all on function personal_workers.dispatch_runtime_v1(text,jsonb) from public,anon,authenticated;

create or replace function public.personal_worker_dispatch(p_op text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare d personal_workers.devices; j personal_workers.jobs; i public.inspirations; pr public.products;
  out jsonb; receipt jsonb; item jsonb; capacity integer:=1; owner uuid; cu text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Private worker access denied' using errcode='42501'; end if;
  if p_op='cancel' then
    owner:=(p_args->>'owner_id')::uuid; cu:=p_args->>'clickup_user_id';
    if coalesce(cu,'')='' or not exists(select 1 from profiles where id=owner and is_active)
      or not(exists(select 1 from profiles where id=owner and role='admin' and is_active)
        or exists(select 1 from user_products where user_id=owner and product_id=p_args->>'product_id')) then
      raise exception 'Product access denied' using errcode='42501'; end if;
    if exists(select 1 from personal_workers.jobs pj join personal_workers.devices pd on pd.id=pj.device_id
      where pj.ins_id=p_args->>'ins_id' and pj.product_id=p_args->>'product_id' and not pj.cancel_requested
        and pj.state in ('pending','running','publishing','review')
        and (pd.owner_id<>owner or pd.clickup_user_id<>cu)) then
      raise exception 'This personal assignment belongs to another ClickUp user' using errcode='42501'; end if;
    -- Serialize cancellation with claims and retain every artifact/receipt.
    perform 1 from personal_workers.devices pd where pd.owner_id=owner and pd.clickup_user_id=cu
      and exists(select 1 from personal_workers.jobs pj where pj.device_id=pd.id
        and pj.ins_id=p_args->>'ins_id' and pj.product_id=p_args->>'product_id') order by pd.id for update;
    update personal_workers.jobs pj set cancel_requested=true,error_code='USER_CANCELLED',
      state=case when state in ('pending','running') then 'cancelled' else state end
      where pj.ins_id=p_args->>'ins_id' and pj.product_id=p_args->>'product_id'
        and pj.state in ('pending','running','publishing','review') and exists(select 1 from personal_workers.devices pd
          where pd.id=pj.device_id and pd.owner_id=owner and pd.clickup_user_id=cu);
    update inspiration_queue q set status='blocked',error_message='Personal assignment cancelled; existing work is preserved.'
      where q.ins_id=p_args->>'ins_id' and q.product_id=p_args->>'product_id' and worker_assignment='private'
      and exists(select 1 from personal_workers.jobs pj join personal_workers.devices pd on pd.id=pj.device_id
        where pj.ins_id=q.ins_id and pj.product_id=q.product_id and pj.cancel_requested
          and pd.owner_id=owner and pd.clickup_user_id=cu);
    return jsonb_build_object('ok',true);
  end if;
  if p_op in ('claim','leases','heartbeat') then
    out:=personal_workers.dispatch_runtime_v1('heartbeat',p_args);
    select * into d from personal_workers.devices where token_hash=p_args->>'token_hash' for update;
    if p_args->>'worker_version'='personal-parallel-v1' then
      capacity:=(p_args->>'capacity')::integer;
      if capacity is null or capacity not between 1 and 3 then
        raise exception 'Invalid personal capacity' using errcode='22023'; end if;
      update personal_workers.devices set parallel_capacity=capacity where id=d.id and parallel_capacity<>capacity;
    end if;
    if p_op='heartbeat' then return out; end if;
    perform personal_workers.cancel_missing_sources(d.id);
    if p_op='leases' then
      if jsonb_typeof(p_args->'jobs') is distinct from 'array' or jsonb_array_length(p_args->'jobs')>3 then
        raise exception 'Invalid lease check' using errcode='22023'; end if;
      out:='[]'::jsonb;
      for item in select value from jsonb_array_elements(p_args->'jobs') loop
        out:=out||jsonb_build_array(jsonb_build_object('id',item->>'id','active',exists(
          select 1 from personal_workers.jobs pj where pj.id=(item->>'id')::uuid and pj.device_id=d.id
            and pj.lease=(item->>'lease')::uuid and pj.lease_until>now() and not pj.cancel_requested
            and pj.state in ('running','publishing') and (exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
              or exists(select 1 from user_products where user_id=d.owner_id and product_id=pj.product_id)))));
      end loop;
      return jsonb_build_object('jobs',out);
    end if;
    if d.runtime_health->>'ready'='false' then return 'null'::jsonb; end if;
    if p_args->>'contract' is distinct from 'personal-artifact-v1' then
      raise exception 'Update the personal worker' using errcode='PT409'; end if;
    with abandoned as(update personal_workers.jobs set state=case when cancel_requested then 'cancelled' else 'review' end,
      error_code=case when cancel_requested then error_code else 'BRIEF_COMMIT_PENDING' end
      where device_id=d.id and state='publishing' and lease_until<now() returning ins_id,product_id,cancel_requested)
    update inspiration_queue set status='blocked',error_message='Brief publishing needs review. Analysis and existing pages are preserved.'
      where worker_assignment='private' and (ins_id,product_id) in(select ins_id,product_id from abandoned where not cancel_requested);
    with exhausted as(update personal_workers.jobs set state='blocked',error_code='LEASE_EXHAUSTED'
      where device_id=d.id and state='running' and not cancel_requested and lease_until<now() and attempts>=3 returning ins_id,product_id)
    update inspiration_queue set status='blocked',error_message='Personal worker lease expired; retry from the paired browser.'
      where worker_assignment='private' and (ins_id,product_id) in(select ins_id,product_id from exhausted);
    if(select count(*) from personal_workers.jobs where device_id=d.id and not cancel_requested
      and state in ('running','publishing') and lease_until>now())>=capacity then return 'null'::jsonb; end if;
    select * into j from personal_workers.jobs where device_id=d.id and not cancel_requested and attempts<3
      and (state='pending' or(state='running' and lease_until<now())) order by created_at for update skip locked limit 1;
    if not found then return 'null'::jsonb; end if;
    if not(exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
      or exists(select 1 from user_products where user_id=d.owner_id and product_id=j.product_id)) then
      raise exception 'Product access revoked' using errcode='42501'; end if;
    select * into i from inspirations where id=j.ins_id and product_id=j.product_id;
    if not found or i.url is distinct from j.source_url or coalesce(i.data,'{}')<>coalesce(j.snapshot->'data','{}') then
      update personal_workers.jobs set state='blocked',error_code='SOURCE_CHANGED' where id=j.id;
      update inspiration_queue set status='blocked',error_message='Inspiration changed; refresh before retrying.'
        where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
      return 'null'::jsonb;
    end if;
    update personal_workers.jobs set state='running',lease=gen_random_uuid(),lease_until=now()+interval '35 minutes',
      attempts=attempts+1 where id=j.id returning * into j;
    update inspiration_queue set status='private_running' where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    select * into pr from products where id=j.product_id;
    return jsonb_build_object('id',j.id,'lease',j.lease,'ins_id',j.ins_id,'product_id',j.product_id,
      'source_url',j.source_url,'platform',i.platform,'no_brief',j.no_brief,
      'selection',to_jsonb(i)->'drive_media_selection','audioReview',i.data->'sourceAudioReview',
      'product',jsonb_build_object('name',pr.name,'offer',pr.config->'production'->'offer'),
      'angles',(select coalesce(jsonb_agg(name),'[]') from angles where product_id=j.product_id and archived_at is null),
      'personas',(select coalesce(jsonb_agg(name),'[]') from personas where product_id=j.product_id and archived_at is null));
  end if;
  if p_op in ('inspect','prepare','receipt','page','commit','fail','review') then
    perform personal_workers.dispatch_runtime_v1('heartbeat',p_args);
    select * into d from personal_workers.devices where token_hash=p_args->>'token_hash' for update;
    select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid and device_id=d.id for update;
    if found and j.cancel_requested then
      if j.lease is distinct from (p_args->>'lease')::uuid then
        raise exception 'Job lease no longer belongs to this device' using errcode='PT409'; end if;
      if not(exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
        or exists(select 1 from user_products where user_id=d.owner_id and product_id=j.product_id)) then
        raise exception 'Product access revoked' using errcode='42501'; end if;
      if p_op='receipt' then
        receipt:=p_args->'page';
        if j.artifact is null or j.publishing_doc_id is null or coalesce(receipt->>'id','')!~'^[A-Za-z0-9_-]{1,100}$'
          or receipt->>'docId' is distinct from j.publishing_doc_id
          or receipt->>'url' is distinct from 'https://app.clickup.com/9016762494/docs/'||j.publishing_doc_id||'/'||(receipt->>'id')
          or(j.created_page is not null and j.created_page<>receipt) then
          raise exception 'Brief receipt does not match this job' using errcode='PT409'; end if;
        update personal_workers.jobs set created_page=receipt where id=j.id and created_page is null;
      elsif p_op in ('commit','review','fail') then
        update personal_workers.jobs set state='cancelled' where id=j.id;
      end if;
      return jsonb_build_object('done',true,'cancelled',true);
    end if;
  end if;
  out:=personal_workers.dispatch_runtime_v1(p_op,p_args);
  if p_op='list' then
    select jsonb_build_object('devices',coalesce(jsonb_agg(device||jsonb_build_object('capacity',pd.parallel_capacity,
      'attention',coalesce((select jsonb_agg(issue) from jsonb_array_elements(device->'attention') issue
        join personal_workers.jobs pj on pj.id=(issue->>'id')::uuid where not pj.cancel_requested),'[]'::jsonb)) order by ordinal),'[]'::jsonb)) into out
      from jsonb_array_elements(out->'devices') with ordinality as entries(device,ordinal)
      join personal_workers.devices pd on pd.id=(device->>'id')::uuid;
  end if;
  return out;
end $$;
revoke all on function public.personal_worker_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.personal_worker_dispatch(text,jsonb) to service_role;
