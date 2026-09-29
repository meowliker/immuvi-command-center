insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000391','header-admin@example.test','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000392','header-member@example.test','{"must_change_password":false}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000391","role":"authenticated"}',true);
set local role authenticated;
do $$ declare response jsonb; begin
  response:=public.qa_request_reload('00000000-0000-4000-8000-000000000393');
  if response->>'actor_id'<>'00000000-0000-4000-8000-000000000391' then raise exception 'Wrong actor'; end if;
  if public.qa_request_reload('00000000-0000-4000-8000-000000000393')<>response then raise exception 'Replay changed'; end if;
  if (public.qa_reload_state()->'latest'->>'id')<>response->>'id' then raise exception 'Missing latest request'; end if;
  begin perform public.qa_request_reload(gen_random_uuid());raise exception 'FAILED rate limit';exception when others then if sqlerrm not like 'A team reload was recently%' then raise;end if;end;
  begin insert into public.qa_force_reloads(id,actor_id,triggered_by) values(gen_random_uuid(),auth.uid(),'Spoof');raise exception 'FAILED direct insert';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000392","role":"authenticated"}',true);
do $$ begin
  perform public.qa_reload_state();
  begin perform public.qa_request_reload(gen_random_uuid());raise exception 'FAILED member';exception when others then if sqlerrm<>'Active QA administrator access is required' then raise;end if;end;
end $$;
reset role;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000392';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.qa_force_reloads) then raise exception 'Inactive read leaked';end if;
  begin perform public.qa_reload_state();raise exception 'FAILED inactive';exception when others then if sqlerrm<>'Active account required' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
  begin perform public.qa_reload_state();raise exception 'FAILED anon read';exception when insufficient_privilege then null;end;
  begin perform public.qa_request_reload(gen_random_uuid());raise exception 'FAILED anon write';exception when insufficient_privilege then null;end;
end $$;
reset role;
