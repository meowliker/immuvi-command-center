insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000491','presence-first@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000492','presence-second@example.test','{"must_change_password":false}');
update public.profiles set username='Presence First' where id='00000000-0000-4000-8000-000000000491';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000491","role":"authenticated"}',true);
set local role authenticated;
select public.qa_presence('00000000-0000-4000-8000-000000000493');
do $$ declare roster jsonb; begin
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000494');
  if (select count(*) from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text)<>1 then raise exception 'Tabs must count as one user';end if;
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text and x->>'name'='Presence First') then raise exception 'Name must come from profile';end if;
  if exists(select 1 from jsonb_array_elements(roster) x where x ? 'email') then raise exception 'Emails must not be exposed';end if;
  begin select jsonb_agg(to_jsonb(p)) into roster from public.qa_user_presence p;raise exception 'FAILED direct read';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000492","role":"authenticated"}',true);
do $$ begin
  begin perform public.qa_presence('00000000-0000-4000-8000-000000000493');raise exception 'FAILED spoof';exception when others then if sqlerrm<>'Session identity conflict' then raise;end if;end;
  perform public.qa_presence('00000000-0000-4000-8000-000000000493',true);
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.qa_user_presence where session_id='00000000-0000-4000-8000-000000000493') then raise exception 'Other user removed session';end if;
end $$;
update public.qa_user_presence set seen_at=clock_timestamp()-interval '2 minutes' where user_id='00000000-0000-4000-8000-000000000491';
set local role authenticated;
do $$ declare roster jsonb;begin
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000495');
  if exists(select 1 from jsonb_array_elements(roster) x where x->>'id'='00000000-0000-4000-8000-000000000491') then raise exception 'Stale presence leaked';end if;
  perform public.qa_presence('00000000-0000-4000-8000-000000000495',true);
end $$;
reset role;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000492';
set local role authenticated;
do $$ begin
  begin perform public.qa_presence(gen_random_uuid());raise exception 'FAILED inactive';exception when others then if sqlerrm<>'Active account required' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
  begin perform public.qa_presence(gen_random_uuid());raise exception 'FAILED anon';exception when insufficient_privilege then null;end;
end $$;
reset role;
