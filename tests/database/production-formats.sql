insert into public.products(id,name,config) values('qa-production-format-fixture','Production formats','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000246','production-format@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000246','qa-production-format-fixture');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000246","role":"authenticated"}',true);
set local role authenticated;
do $$
declare req uuid:=gen_random_uuid(); old_req uuid:=gen_random_uuid(); saved jsonb; changed jsonb; old_saved jsonb;
  payload jsonb:='{"format_name":"Format test","format":"Teacher Angle","ad_type":"Video","meta":{"dueDate":"","_dueDateMs":null}}';
begin
  saved:=public.qa_production_intake('qa-production-format-fixture',req,payload);
  if saved->'action'->'payload'->>'format'<>'Teacher Angle' or saved->'ad'->>'ad_type'<>'Video' then raise exception 'Format confused with ad type';end if;
  if public.qa_production_intake('qa-production-format-fixture',req,payload)<>saved then raise exception 'Replay differs';end if;
  begin perform public.qa_production_intake('qa-production-format-fixture',req,payload||'{"format":"UGC Format"}');raise exception 'FAILED conflict';
  exception when others then if sqlerrm<>'Production request identity conflicts with a previous save' then raise;end if;end;
  old_saved:=public.qa_production_create('qa-production-format-fixture',old_req,payload-'format');
  if public.qa_production_intake('qa-production-format-fixture',old_req,payload-'format')<>old_saved then raise exception 'Older receipt lost';end if;
  changed:=public.qa_production_format('qa-production-format-fixture',(saved->'action'->>'id')::uuid,(saved->'action'->>'updated_at')::timestamptz,
    saved->'ad'->>'id',(saved->'ad'->>'updated_at')::timestamptz,'UGC Format');
  if changed->'action'->'payload'->>'format'<>'UGC Format' or changed->'ad'<>saved->'ad' then raise exception 'Format mutated creative';end if;
  -- The shared updated_at trigger uses transaction time; simulate an older transaction explicitly.
  begin perform public.qa_production_format('qa-production-format-fixture',(saved->'action'->>'id')::uuid,(saved->'action'->>'updated_at')::timestamptz-interval '1 second',
    saved->'ad'->>'id',(saved->'ad'->>'updated_at')::timestamptz,'Stale');raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'Action Plan changed.%' then raise;end if;end;
  changed:=public.qa_production_format('qa-production-format-fixture',(changed->'action'->>'id')::uuid,(changed->'action'->>'updated_at')::timestamptz,
    saved->'ad'->>'id',(saved->'ad'->>'updated_at')::timestamptz,'');
  if changed->'action'->'payload'->>'format'<>'' then raise exception 'Clear failed';end if;
  if public.qa_production_intake('qa-production-format-fixture',req,payload)<>saved then raise exception 'Historical receipt changed';end if;
  if (select m.payload->>'format' from public.manual_actions m where id=(saved->'action'->>'id')::uuid)<>'' then raise exception 'Replay overwrote current format';end if;
  perform public.qa_tracker_delete('qa-production-format-fixture',saved->'ad'->>'id',(saved->'ad'->>'updated_at')::timestamptz);
  if public.qa_production_intake('qa-production-format-fixture',req,payload)<>saved or exists(select 1 from public.manual_actions where id=(saved->'action'->>'id')::uuid) then raise exception 'Replay resurrected';end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.qa_production_intake(text,uuid,jsonb)','EXECUTE') or has_function_privilege('anon','public.qa_production_format(text,uuid,timestamptz,text,timestamptz,text)','EXECUTE') then raise exception 'Anonymous access';end if;
end $$;
