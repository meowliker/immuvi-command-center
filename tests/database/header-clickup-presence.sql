insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000491','presence-first@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000492','presence-second@example.test','{"must_change_password":false}');
update public.profiles set username='App Login' where id='00000000-0000-4000-8000-000000000491';
set local role service_role;
insert into public.qa_clickup_identities values
 ('00000000-0000-4000-8000-000000000491','42','Verified ClickUp Name'),
 ('00000000-0000-4000-8000-000000000491','43','Replacement Key Name');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000491","role":"authenticated"}',true);
set local role authenticated;
do $$ declare roster jsonb; begin
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000493',false,'42');
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text and x->>'name'='Verified ClickUp Name') then raise exception 'Missing ClickUp name';end if;
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000494');
  if (select count(*) from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text)<>1 then raise exception 'Duplicate users';end if;
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'name'='Verified ClickUp Name') then raise exception 'Old tab overwrote name';end if;
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000493',false,'43');
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'name'='Replacement Key Name') then raise exception 'Key replacement not reflected';end if;
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000493',false,null);
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text and x->>'name'='App Login') then raise exception 'Key removal must clear ClickUp name';end if;
  begin insert into public.qa_clickup_identities values(auth.uid(),'spoof','Spoof');raise exception 'FAILED direct write';exception when insufficient_privilege then null;end;
  begin perform * from public.qa_clickup_identities;raise exception 'FAILED direct read';exception when insufficient_privilege then null;end;
  perform public.qa_presence('00000000-0000-4000-8000-000000000493',false,'42');
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000492","role":"authenticated"}',true);
do $$ declare roster jsonb; begin
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000495',false,'42');
  if exists(select 1 from jsonb_array_elements(roster) x where x->>'id'=auth.uid()::text and x->>'name'='Verified ClickUp Name') then raise exception 'Unverified account borrowed identity';end if;
  if not exists(select 1 from jsonb_array_elements(roster) x where x->>'id'='00000000-0000-4000-8000-000000000491' and x->>'name'='Verified ClickUp Name') then raise exception 'Other users cannot see ClickUp name';end if;
  if exists(select 1 from jsonb_array_elements(roster) x where x ? 'email' or x ? 'token') then raise exception 'Sensitive data exposed';end if;
  begin perform public.qa_presence('00000000-0000-4000-8000-000000000493',false,null);raise exception 'FAILED session spoof';exception when others then if sqlerrm<>'Session identity conflict' then raise;end if;end;
end $$;
reset role;
update public.qa_user_presence set seen_at=clock_timestamp()-interval '2 minutes' where user_id='00000000-0000-4000-8000-000000000491';
set local role authenticated;
do $$ declare roster jsonb; begin
  roster:=public.qa_presence('00000000-0000-4000-8000-000000000495',false,null);
  if exists(select 1 from jsonb_array_elements(roster) x where x->>'id'='00000000-0000-4000-8000-000000000491') then raise exception 'Stale session leaked';end if;
end $$;
reset role;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000492';
set local role authenticated;
do $$ begin
  begin perform public.qa_presence(gen_random_uuid(),false,null);raise exception 'FAILED inactive';exception when others then if sqlerrm<>'Active account required' then raise;end if;end;
end $$;
set local role anon;
do $$ begin
  begin perform public.qa_presence(gen_random_uuid(),false,null);raise exception 'FAILED anonymous';exception when insufficient_privilege then null;end;
end $$;
reset role;
