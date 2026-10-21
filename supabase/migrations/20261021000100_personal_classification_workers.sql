-- Personal devices are deliberately NOT members of the shared worker registry.
create schema if not exists personal_workers;
revoke all on schema personal_workers from public, anon, authenticated;

create table if not exists personal_workers.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  clickup_user_id text not null,
  name text not null check (length(name) between 1 and 80),
  pair_hash text,
  pair_expires_at timestamptz,
  token_hash text unique,
  created_at timestamptz not null default now(),
  paired_at timestamptz,
  heartbeat_at timestamptz,
  revoked_at timestamptz,
  contract text
);
create table if not exists personal_workers.jobs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references personal_workers.devices(id),
  ins_id text not null,
  product_id text not null references public.products(id),
  source_url text not null,
  no_brief boolean not null,
  snapshot jsonb not null,
  state text not null default 'pending' check (state in
    ('pending','running','publishing','done','blocked','cancelled','review')),
  created_at timestamptz not null default now(),
  lease uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  artifact jsonb,
  artifact_hash text,
  page jsonb,
  error_code text
);
create unique index if not exists personal_jobs_active_source on personal_workers.jobs(ins_id,product_id)
  where state in ('pending','running','publishing','review');
create index if not exists personal_jobs_device on personal_workers.jobs(device_id,state,created_at);
alter table personal_workers.devices enable row level security;
alter table personal_workers.jobs enable row level security;
revoke all on all tables in schema personal_workers from public, anon, authenticated;

-- An old browser must not steal a private assignment or delete its queue marker.
create or replace function public.guard_personal_classification_queue() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id text; target_product text;
begin
  if tg_op='DELETE' then target_id:=old.ins_id; target_product:=old.product_id;
  else target_id:=new.ins_id; target_product:=new.product_id; end if;
  if coalesce(auth.role(),'')<>'service_role' and exists (
    select 1 from personal_workers.jobs where ins_id=target_id and product_id=target_product
      and state in ('pending','running','publishing','review')) then
    raise exception 'This inspiration has a personal assignment. Manage it from the paired browser.' using errcode='PT409';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists guard_personal_classification_queue on public.inspiration_queue;
create trigger guard_personal_classification_queue before insert or update or delete
on public.inspiration_queue for each row execute function public.guard_personal_classification_queue();

-- This dispatcher is service-role-only. HTTP verifies the app JWT and ClickUp
-- identity for browser operations; device operations require a hashed secret.
create or replace function public.personal_worker_dispatch(p_op text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare d personal_workers.devices; j personal_workers.jobs; i public.inspirations;
  q public.inspiration_queue; pr public.products; a jsonb; patch jsonb; out jsonb;
  owner uuid; cu text; ids jsonb; item jsonb; n integer:=0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Private worker access denied' using errcode='42501';
  end if;
  if p_op in ('create','list','revoke','enqueue','retry') then
    owner:=(p_args->>'owner_id')::uuid; cu:=p_args->>'clickup_user_id';
    if not exists(select 1 from profiles where id=owner and is_active) or coalesce(cu,'')='' then
      raise exception 'Sign in again' using errcode='42501';
    end if;
    if p_op='create' then
      if (select count(*) from personal_workers.devices where owner_id=owner
        and clickup_user_id=cu and created_at>now()-interval '1 hour')>=10 then
        raise exception 'Too many pairing requests. Try later.' using errcode='PT429';
      end if;
      insert into personal_workers.devices(owner_id,clickup_user_id,name,pair_hash,pair_expires_at)
      values(owner,cu,p_args->>'name',p_args->>'pair_hash',now()+interval '10 minutes') returning * into d;
      return jsonb_build_object('id',d.id,'expiresAt',d.pair_expires_at);
    elsif p_op='list' then
      select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'paired',paired_at is not null,
        'lastSeen',heartbeat_at,'revoked',revoked_at is not null,'contract',contract,
        'attention',(select coalesce(jsonb_agg(jsonb_build_object('id',pj.id,'insId',pj.ins_id,'state',pj.state,
          'code',pj.error_code)),'[]') from personal_workers.jobs pj where pj.device_id=devices.id
          and pj.state in ('blocked','review') and not exists(select 1 from personal_workers.jobs newer
            where newer.ins_id=pj.ins_id and newer.product_id=pj.product_id and newer.created_at>pj.created_at)
          and (exists(select 1 from profiles where id=owner and role='admin' and is_active)
            or exists(select 1 from user_products where user_id=owner and product_id=pj.product_id)))) order by created_at),'[]') into out
      from personal_workers.devices where owner_id=owner and clickup_user_id=cu
        and (paired_at is not null or pair_expires_at>now()) and revoked_at is null;
      return jsonb_build_object('devices',out);
    end if;
    select * into d from personal_workers.devices where id=(p_args->>'device_id')::uuid
      and owner_id=owner and clickup_user_id=cu and revoked_at is null for update;
    if not found then raise exception 'Personal worker not available' using errcode='42501'; end if;
    if p_op='retry' then
      select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid and device_id=d.id and state='blocked';
      if not found then raise exception 'Only a blocked job can be retried. Brief publishing exceptions require review.' using errcode='PT409'; end if;
      return public.personal_worker_dispatch('enqueue',jsonb_build_object('owner_id',owner,'clickup_user_id',cu,
        'device_id',d.id,'product_id',j.product_id,'items',jsonb_build_array(jsonb_build_object(
          'id',j.ins_id,'url',j.source_url,'no_brief',j.no_brief))));
    end if;
    if p_op='revoke' then
      update personal_workers.devices set revoked_at=now(),token_hash=null,pair_hash=null where id=d.id;
      with cancelled as (update personal_workers.jobs set state='cancelled',lease=null,lease_until=null where device_id=d.id
        and state in ('pending','running') returning ins_id,product_id)
      update inspiration_queue set status='blocked',error_message='Personal assignment revoked; select a worker to retry.'
        where (ins_id,product_id) in(select ins_id,product_id from cancelled)
        and worker_assignment='private';
      with interrupted as (update personal_workers.jobs set state='review',error_code='PUBLISHING_REVIEW'
        where device_id=d.id and state='publishing' returning ins_id,product_id)
      update inspiration_queue set status='blocked',error_message='Personal device revoked during publishing. Analysis and existing pages are preserved for review.'
        where worker_assignment='private' and (ins_id,product_id) in(select ins_id,product_id from interrupted);
      return jsonb_build_object('ok',true);
    end if;
    if d.paired_at is null then raise exception 'Finish pairing this Mac first' using errcode='PT409'; end if;
    ids:=p_args->'items';
    if jsonb_array_length(ids)<1 or jsonb_array_length(ids)>20 then
      raise exception 'Queue between 1 and 20 inspirations' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(ids) loop
      select * into pr from products where id=p_args->>'product_id';
      if not found or not (exists(select 1 from profiles where id=owner and role='admin' and is_active)
        or exists(select 1 from user_products where user_id=owner and product_id=pr.id)) then
        raise exception 'Product access denied' using errcode='42501'; end if;
      select * into i from inspirations where id=item->>'id' and product_id=pr.id for update;
      if not found or i.url is distinct from item->>'url' then
        raise exception 'Inspiration source changed. Refresh before queueing.' using errcode='PT409'; end if;
      select * into q from inspiration_queue where ins_id=i.id and product_id=i.product_id for update;
      if found and q.worker_assignment is distinct from 'private' then
        raise exception 'This inspiration is assigned to the shared queue. Personal Macs do not take shared assignments.' using errcode='PT409'; end if;
      select * into j from personal_workers.jobs where ins_id=i.id and product_id=i.product_id
        and state in ('pending','running','publishing','review') for update;
      if found then
        if j.device_id=d.id and j.source_url=i.url and j.no_brief=coalesce((item->>'no_brief')::boolean,false) then
          n:=n+1; continue;
        end if;
        raise exception 'This inspiration already has a personal assignment' using errcode='PT409';
      end if;
      if q.id is not null and not exists(select 1 from personal_workers.jobs pj
        join personal_workers.devices pd on pd.id=pj.device_id where pj.ins_id=i.id
        and pj.product_id=i.product_id and pd.owner_id=owner and pd.clickup_user_id=cu) then
        raise exception 'This personal assignment belongs to another ClickUp user' using errcode='42501'; end if;
      if q.id is not null and (q.status in ('claimed','classifying','processing','private_running','private_publishing')
        or q.claimed_by is not null) then
        raise exception 'This inspiration is already being processed' using errcode='PT409'; end if;
      if exists(select 1 from inspiration_results where ins_id=i.id and product_id=i.product_id) then
        raise exception 'A saved classification already exists. Import it before retrying.' using errcode='PT409'; end if;
      if exists(select 1 from personal_workers.jobs where ins_id=i.id and product_id=i.product_id
        and state in ('pending','running','publishing','review')) then
        raise exception 'This inspiration already has a personal assignment' using errcode='PT409'; end if;
      insert into personal_workers.jobs(device_id,ins_id,product_id,source_url,no_brief,snapshot)
      values(d.id,i.id,i.product_id,i.url,coalesce((item->>'no_brief')::boolean,false),to_jsonb(i));
      insert into inspiration_queue(ins_id,product_id,url,platform,status,no_brief,worker_assignment,
        claimed_by,claimed_at,attempts,error_message,processed_at,queued_at)
      values(i.id,i.product_id,i.url,i.platform,'private_pending',coalesce((item->>'no_brief')::boolean,false),
        'private',null,null,0,null,null,now())
      on conflict(ins_id,product_id) do update set status=excluded.status,no_brief=excluded.no_brief,
        worker_assignment='private',claimed_by=null,claimed_at=null,error_message=null,processed_at=null,queued_at=now();
      n:=n+1;
    end loop;
    return jsonb_build_object('ok',true,'count',n);
  elsif p_op='pair' then
    select * into d from personal_workers.devices where id=(p_args->>'device_id')::uuid
      and pair_hash=p_args->>'pair_hash' and clickup_user_id=p_args->>'clickup_user_id'
      and pair_expires_at>now() and revoked_at is null
      and paired_at is null for update;
    if not found then raise exception 'Pairing code expired or already used' using errcode='42501'; end if;
    update personal_workers.devices set paired_at=now(),pair_hash=null,pair_expires_at=null,
      token_hash=p_args->>'token_hash' where id=d.id;
    return jsonb_build_object('ok',true);
  end if;
  select * into d from personal_workers.devices where token_hash=p_args->>'token_hash'
    and revoked_at is null and paired_at is not null for update;
  if not found or not exists(select 1 from profiles where id=d.owner_id and is_active) then
    raise exception 'Device revoked or not paired' using errcode='42501'; end if;
  update personal_workers.devices set heartbeat_at=now(),contract=p_args->>'contract' where id=d.id
    and (heartbeat_at is null or heartbeat_at<now()-interval '55 seconds' or contract is distinct from p_args->>'contract');
  if p_op='heartbeat' then return jsonb_build_object('ok',true); end if;
  if p_op='claim' then
    if p_args->>'contract'<>'personal-artifact-v1' then
      raise exception 'Update the personal worker' using errcode='PT409'; end if;
    -- One live lease per device. Expired analysis can be safely reclaimed because
    -- the agent cannot publish or mutate either service.
    select * into j from personal_workers.jobs where device_id=d.id and
      (state='pending' or (state='running' and lease_until<now())) and attempts<3
      order by created_at for update skip locked limit 1;
    if not found or exists(select 1 from personal_workers.jobs where device_id=d.id
      and state in ('running','publishing') and lease_until>now()) then return 'null'; end if;
    if not (exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
      or exists(select 1 from user_products where user_id=d.owner_id and product_id=j.product_id)) then
      raise exception 'Product access revoked' using errcode='42501'; end if;
    select * into i from inspirations where id=j.ins_id and product_id=j.product_id;
    if not found or i.url<>j.source_url or coalesce(i.data,'{}')<>coalesce(j.snapshot->'data','{}') then
      update personal_workers.jobs set state='blocked',error_code='SOURCE_CHANGED' where id=j.id;
      update inspiration_queue set status='blocked',error_message='Inspiration changed; refresh before retrying.'
        where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
      return 'null';
    end if;
    with exhausted as (update personal_workers.jobs set state='blocked',error_code='LEASE_EXHAUSTED'
      where device_id=d.id and state='running' and lease_until<now() and attempts>=3 returning ins_id,product_id)
    update inspiration_queue set status='blocked',error_message='Personal worker lease expired; retry from the paired browser.'
      where worker_assignment='private' and (ins_id,product_id) in
        (select ins_id,product_id from exhausted);
    with abandoned as (update personal_workers.jobs set state='review',error_code='PUBLISHING_REVIEW'
      where device_id=d.id and state='publishing' and lease_until<now() returning ins_id,product_id)
    update inspiration_queue set status='blocked',error_message='Brief publishing needs review. Analysis and existing pages are preserved.'
      where worker_assignment='private' and (ins_id,product_id) in
        (select ins_id,product_id from abandoned);
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
  select * into j from personal_workers.jobs where id=(p_args->>'job_id')::uuid and device_id=d.id for update;
  if not found or j.lease is distinct from (p_args->>'lease')::uuid then
    raise exception 'Job lease no longer belongs to this device' using errcode='PT409'; end if;
  if not (exists(select 1 from profiles where id=d.owner_id and role='admin' and is_active)
    or exists(select 1 from user_products where user_id=d.owner_id and product_id=j.product_id)) then
    raise exception 'Product access revoked' using errcode='42501'; end if;
  if j.state='done' and p_op in ('inspect','prepare','commit') then return jsonb_build_object('done',true); end if;
  if j.lease_until<now() or j.state not in ('running','publishing') then
    raise exception 'Job lease expired; saved work is preserved' using errcode='PT409'; end if;
  if p_op='fail' then
    update personal_workers.jobs set state='blocked',error_code=p_args->>'code',
      attempts=case when p_args->>'code' in ('LOCAL_TOOL_UNAVAILABLE','PROVIDER_UNAVAILABLE') then greatest(attempts-1,0) else attempts end where id=j.id;
    update inspiration_queue set status='blocked',error_message='Personal worker could not finish: '||(p_args->>'code')||'. Open My Mac for retry.'
      where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    return jsonb_build_object('ok',true);
  end if;
  if p_op='review' then
    update personal_workers.jobs set state='review',error_code='PUBLISHING_REVIEW' where id=j.id;
    update inspiration_queue set status='blocked',error_message='Brief publishing needs review. Analysis and existing pages are preserved.'
      where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    return jsonb_build_object('ok',true);
  end if;
  if p_op='inspect' then
    return jsonb_build_object('ins_id',j.ins_id,'product_id',j.product_id,'source_url',j.source_url,
      'no_brief',j.no_brief,'selection',j.snapshot->'drive_media_selection','created_at',j.created_at,
      'angles',(select coalesce(jsonb_agg(name),'[]') from angles where product_id=j.product_id and archived_at is null),
      'personas',(select coalesce(jsonb_agg(name),'[]') from personas where product_id=j.product_id and archived_at is null),
      'clickup_user_id',d.clickup_user_id);
  end if;
  select * into i from inspirations where id=j.ins_id and product_id=j.product_id for update;
  if not found or i.url<>j.source_url or coalesce(i.data,'{}')<>coalesce(j.snapshot->'data','{}') then
    raise exception 'Inspiration changed during analysis. Result retained for review.' using errcode='PT409'; end if;
  if p_op='prepare' then
    if j.state='publishing' then
      return jsonb_build_object('publishing',true,'page',j.page,'artifactHash',j.artifact_hash);
    end if;
    update personal_workers.jobs set artifact=p_args->'artifact',artifact_hash=p_args->>'artifact_hash',
      state='publishing' where id=j.id returning * into j;
    select * into pr from products where id=j.product_id;
    update inspiration_queue set status='private_publishing' where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    return jsonb_build_object('reserved',true,'docId',pr.config->>'doc_id','noBrief',j.no_brief,
      'insId',j.ins_id,'sourceUrl',j.source_url,'productId',j.product_id);
  elsif p_op='page' then
    if j.state<>'publishing' or j.page is not null then raise exception 'Page already reserved' using errcode='PT409'; end if;
    update personal_workers.jobs set page=p_args->'page' where id=j.id;
    return jsonb_build_object('ok',true);
  elsif p_op='commit' then
    if j.state<>'publishing' or j.artifact_hash<>p_args->>'artifact_hash'
      or (not j.no_brief and j.page is null) then raise exception 'Result not verified' using errcode='PT409'; end if;
    a:=j.artifact;
    patch:=(a->'patch')||jsonb_build_object('classifiedAt',now());
    if coalesce(i.data->>'notes','')<>'' then patch:=patch-'notes'; end if;
    if coalesce((i.data->>'_angleLocked')::boolean,false) then
      patch:=patch-'angle'-'_angleScope'-'_angleLocked'-'_needsAngleReview'-'_anglePromptDone'; end if;
    if coalesce((i.data->>'_personaLocked')::boolean,false) then
      patch:=patch-'persona'-'_personaScope'-'_personaLocked'-'_needsPersonaReview'-'_personaPromptDone'; end if;
    if j.no_brief then patch:=patch-'nextAdScripts'-'_clickupDocPageUrl'-'_clickupDocId';
    else patch:=patch||jsonb_build_object('_clickupDocPageUrl',j.page->>'url','_clickupDocId',j.page->>'docId'); end if;
    insert into inspiration_results(ins_id,product_id,source_url,platform,metadata,classification,brief,
      clickup_doc_page_url,clickup_doc_id,duration_seconds,frames_extracted)
    values(j.ins_id,j.product_id,j.source_url,i.platform,a->'metadata',a->'classification',
      case when j.no_brief then '{}'::jsonb else a->'brief' end,j.page->>'url',j.page->>'docId',
      (a->>'duration_seconds')::numeric,(a->>'frames_extracted')::int);
    update inspirations set title=patch->>'formatName',data=coalesce(data,'{}')||patch,
      status=case when lower(status) in ('queued','classifying','blocked','failed','saved') then 'Classified' else status end
      where id=j.ins_id and product_id=j.product_id;
    update inspiration_queue set status='classified',processed_at=now(),error_message=null
      where ins_id=j.ins_id and product_id=j.product_id and worker_assignment='private';
    update personal_workers.jobs set state='done' where id=j.id;
    return jsonb_build_object('done',true);
  end if;
  raise exception 'Unknown personal worker operation' using errcode='22023';
end $$;
revoke all on function public.personal_worker_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.personal_worker_dispatch(text,jsonb) to service_role;
