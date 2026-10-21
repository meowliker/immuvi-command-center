alter table personal_workers.devices add column if not exists runtime_health jsonb;
alter table personal_workers.jobs add column if not exists diagnostic_code text;

do $$ begin
  if to_regprocedure('personal_workers.dispatch_publishing_v1(text,jsonb)') is null then
    alter function public.personal_worker_dispatch(text,jsonb) rename to dispatch_publishing_v1;
    alter function public.dispatch_publishing_v1(text,jsonb) set schema personal_workers;
  end if;
end $$;
revoke all on function personal_workers.dispatch_publishing_v1(text,jsonb) from public,anon,authenticated;

create or replace function public.personal_worker_dispatch(p_op text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare out jsonb; health jsonb:=p_args->'runtime'; detail text:=p_args->>'detail';
  stored_health jsonb;
  codes text[]:=array['FFMPEG_UNAVAILABLE','FFPROBE_UNAVAILABLE','PYTHON_UNAVAILABLE',
    'REQUESTS_UNAVAILABLE','YTDLP_UNAVAILABLE','PLAYWRIGHT_UNAVAILABLE','WHISPER_UNAVAILABLE',
    'TRANSFORMERS_UNAVAILABLE','TORCH_UNAVAILABLE','SOUNDFILE_UNAVAILABLE','AGENT_UNAVAILABLE','LOCAL_TOOL_UNIDENTIFIED'];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Private worker access denied' using errcode='42501';
  end if;
  if p_op in ('heartbeat','claim') and health is not null then
    if health->>'version' is distinct from 'personal-runtime-v1'
      or jsonb_typeof(health->'ready') is distinct from 'boolean'
      or jsonb_typeof(health->'codes') is distinct from 'array' then
      raise exception 'Invalid worker diagnostic' using errcode='22023';
    end if;
    if jsonb_array_length(health->'codes')>12 or exists(select 1 from jsonb_array_elements(health->'codes') c
      where jsonb_typeof(c) is distinct from 'string' or not(c#>>'{}'=any(codes))) then
      raise exception 'Invalid worker diagnostic' using errcode='22023';
    end if;
    -- The original dispatcher verifies the device token and active account.
    perform personal_workers.dispatch_publishing_v1('heartbeat',p_args);
    update personal_workers.devices set runtime_health=jsonb_build_object(
      'version','personal-runtime-v1','ready',health->'ready','codes',health->'codes')
      where token_hash=p_args->>'token_hash' and revoked_at is null and
        runtime_health is distinct from jsonb_build_object('version','personal-runtime-v1',
          'ready',health->'ready','codes',health->'codes');
    if p_op='heartbeat' then return jsonb_build_object('ok',true); end if;
    if health->>'ready'='false' then return 'null'::jsonb; end if;
  end if;
  if p_op='claim' and health is null then
    perform personal_workers.dispatch_publishing_v1('heartbeat',p_args);
    select runtime_health into stored_health from personal_workers.devices
      where token_hash=p_args->>'token_hash' and revoked_at is null;
    if stored_health->>'ready'='false' then return 'null'::jsonb; end if;
  end if;
  if p_op='fail' and detail is not null and
    (p_args->>'code' is distinct from 'LOCAL_TOOL_UNAVAILABLE' or not(detail=any(codes))) then
    raise exception 'Invalid worker diagnostic' using errcode='22023';
  end if;
  out:=personal_workers.dispatch_publishing_v1(p_op,p_args);
  if p_op='fail' and detail is not null then
    -- This runs only after the existing lease, ownership and product checks pass.
    update personal_workers.jobs set diagnostic_code=detail where id=(p_args->>'job_id')::uuid
      and state='blocked' and error_code='LOCAL_TOOL_UNAVAILABLE';
  elsif p_op='list' then
    select jsonb_build_object('devices',coalesce(jsonb_agg(device||jsonb_build_object(
      'runtime',pd.runtime_health,'attention',coalesce((select jsonb_agg(issue||
        jsonb_build_object('diagnostic',pj.diagnostic_code)) from jsonb_array_elements(device->'attention') issue
        join personal_workers.jobs pj on pj.id=(issue->>'id')::uuid and pj.device_id=pd.id),'[]'::jsonb))
      order by ordinal),'[]'::jsonb)) into out
      from jsonb_array_elements(out->'devices') with ordinality as rows(device,ordinal)
      join personal_workers.devices pd on pd.id=(device->>'id')::uuid;
  end if;
  return out;
end $$;
revoke all on function public.personal_worker_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.personal_worker_dispatch(text,jsonb) to service_role;
