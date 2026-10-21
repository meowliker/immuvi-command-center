alter table personal_workers.jobs add column if not exists created_page jsonb;
alter table personal_workers.jobs add column if not exists publishing_doc_id text;
alter table personal_workers.jobs add column if not exists verified_page_hash text;

-- Keep the original fenced queue/commit implementation intact behind a
-- service-only wrapper. Existing business rows are not rewritten by this migration.
do $$ begin
  if to_regprocedure('personal_workers.dispatch_v1(text,jsonb)') is null then
    alter function public.personal_worker_dispatch(text,jsonb) rename to dispatch_v1;
    alter function public.dispatch_v1(text,jsonb) set schema personal_workers;
  end if;
end $$;
revoke all on function personal_workers.dispatch_v1(text,jsonb) from public,anon,authenticated;

create or replace function public.personal_worker_dispatch(p_op text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j personal_workers.jobs; d personal_workers.devices; i public.inspirations;
  out jsonb; receipt jsonb; doc text; code text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Private worker access denied' using errcode='42501'; end if;

  if p_op='list' then
    out:=personal_workers.dispatch_v1(p_op,p_args);
    select coalesce(jsonb_agg(device||jsonb_build_object('attention',(device->'attention')||
      (select coalesce(jsonb_agg(jsonb_build_object('id',pj.id,'insId',pj.ins_id,'state','review',
        'code','BRIEF_COMMIT_PENDING')),'[]') from personal_workers.jobs pj
       where pj.device_id=(device->>'id')::uuid and pj.state='publishing' and pj.lease_until<now()
       and (exists(select 1 from profiles where id=(p_args->>'owner_id')::uuid and role='admin' and is_active)
         or exists(select 1 from user_products where user_id=(p_args->>'owner_id')::uuid and product_id=pj.product_id))))),'[]')
      into receipt from jsonb_array_elements(out->'devices') device;
    return jsonb_build_object('devices',receipt);
  end if;

  if p_op in ('review_context','resume_review') then
    select * into d from personal_workers.devices where id=(p_args->>'device_id')::uuid
      and owner_id=(p_args->>'owner_id')::uuid and clickup_user_id=p_args->>'clickup_user_id'
      and revoked_at is null and paired_at is not null for update;
    if not found or not exists(select 1 from profiles where id=d.owner_id and is_active) then
      raise exception 'Personal worker not available' using errcode='42501'; end if;
    select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid and device_id=d.id for update;
    if not found or not (exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
      or exists(select 1 from user_products where user_id=d.owner_id and product_id=j.product_id)) then
      raise exception 'Product access denied' using errcode='42501'; end if;
    if j.state='done' then return jsonb_build_object('done',true); end if;
    if j.state<>'review' and not(j.state='publishing' and j.lease_until<now()) then
      raise exception 'Publishing is still running or this job is not under review' using errcode='PT409'; end if;
    if j.no_brief or j.artifact is null or j.artifact_hash is null or j.created_page is null then
      raise exception 'No recorded brief receipt. Review the existing page; never create another automatically.' using errcode='PT409'; end if;
    select * into i from inspirations where id=j.ins_id and product_id=j.product_id for update;
    if not found or i.url is distinct from j.source_url or coalesce(i.data,'{}')<>coalesce(j.snapshot->'data','{}') then
      raise exception 'Inspiration changed; retained analysis needs review' using errcode='PT409'; end if;
    if p_op='review_context' then
      return jsonb_build_object('artifact',j.artifact,'artifactHash',j.artifact_hash,'page',j.created_page);
    end if;
    if p_args->>'artifact_hash' is distinct from j.artifact_hash or p_args->'page' is distinct from j.created_page then
      raise exception 'Publishing receipt or analysis changed' using errcode='PT409'; end if;
    update personal_workers.jobs set state='publishing',lease=gen_random_uuid(),lease_until=now()+interval '10 minutes',
      error_code=null where id=j.id returning * into j;
    update inspiration_queue set status='private_publishing',error_message=null
      where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    return jsonb_build_object('token_hash',d.token_hash,'job_id',j.id,'lease',j.lease,'contract','personal-artifact-v1');
  end if;

  if p_op not in ('prepare','receipt','page','commit','review','fail') then
    return personal_workers.dispatch_v1(p_op,p_args);
  end if;
  if p_op='prepare' then
    out:=personal_workers.dispatch_v1(p_op,p_args);
    if coalesce((out->>'done')::boolean,false) then return out; end if;
    select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid for update;
    if j.publishing_doc_id is null and not j.no_brief then
      select config->>'doc_id' into doc from products where id=j.product_id;
      update personal_workers.jobs set publishing_doc_id=doc where id=j.id returning * into j;
    end if;
    return out||jsonb_build_object('createdPage',j.created_page,'docId',j.publishing_doc_id,'noBrief',j.no_brief);
  end if;

  -- Reuse the original device, lease and product-access checks before receipts
  -- or verified-page state can be written. No arbitrary browser input reaches here.
  out:=personal_workers.dispatch_v1('inspect',p_args);
  if coalesce((out->>'done')::boolean,false) then return out; end if;
  select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid for update;
  if p_op='fail' then
    if j.state='publishing' then return jsonb_build_object('ok',true,'publishing',true); end if;
    return personal_workers.dispatch_v1('fail',p_args);
  end if;
  if p_op in ('receipt','page') then
    receipt:=p_args->'page'; doc:=j.publishing_doc_id;
    if j.no_brief or j.state<>'publishing' or doc is null
      or coalesce(receipt->>'id','')!~'^[A-Za-z0-9_-]{1,100}$'
      or receipt->>'docId' is distinct from doc
      or receipt->>'url' is distinct from 'https://app.clickup.com/9016762494/docs/'||doc||'/'||(receipt->>'id')
      or (j.created_page is not null and j.created_page<>receipt) then
      raise exception 'Brief receipt does not match this job' using errcode='PT409'; end if;
    if p_op='receipt' then
      update personal_workers.jobs set created_page=receipt where id=j.id and created_page is null;
      return jsonb_build_object('ok',true);
    end if;
    if j.page is null then out:=personal_workers.dispatch_v1('page',p_args);
    elsif j.page<>receipt then raise exception 'A different brief is already recorded' using errcode='PT409'; end if;
    update personal_workers.jobs set created_page=receipt,verified_page_hash=artifact_hash where id=j.id;
    return jsonb_build_object('ok',true);
  elsif p_op='commit' then
    if not j.no_brief and (j.verified_page_hash is distinct from j.artifact_hash or j.page is distinct from j.created_page) then
      raise exception 'Brief readback has not been verified' using errcode='PT409'; end if;
    return personal_workers.dispatch_v1('commit',p_args);
  elsif p_op='review' then
    out:=personal_workers.dispatch_v1('review',p_args);
    code:=p_args->>'code';
    if code not in ('BRIEF_READBACK_MISMATCH','BRIEF_READBACK_UNAVAILABLE','BRIEF_CREATE_UNCONFIRMED',
      'BRIEF_RECEIPT_UNCONFIRMED','BRIEF_COMMIT_PENDING','BRIEF_LIBRARY_UNCONFIGURED') or code is null then
      code:='PUBLISHING_REVIEW'; end if;
    update personal_workers.jobs set error_code=code where id=j.id;
    update inspiration_queue set error_message='Brief verification needs review ['||code||']. Analysis is preserved; no duplicate brief will be created.'
      where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    return out;
  end if;
  raise exception 'Unknown publishing operation' using errcode='22023';
end $$;
revoke all on function public.personal_worker_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.personal_worker_dispatch(text,jsonb) to service_role;
