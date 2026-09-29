insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000261','access-admin@example.test','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000262','access-member@example.test','{"must_change_password":false}');
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000263','access-untrusted@example.test','{"role":"admin","must_change_password":false}');
insert into public.products(id,name,config) values('qa-access-one','Access fixture one','{}'),('qa-access-two','Access fixture two','{}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000262','qa-access-one');
do $$ begin
  if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000263' and (role<>'member' or not must_change_password)) then raise exception 'Signup metadata escalated privileges'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000261","role":"authenticated"}',true);
set local role authenticated;
do $$
declare target uuid:='00000000-0000-4000-8000-000000000262'; request_id uuid:=gen_random_uuid(); before_row jsonb; saved jsonb; revision text;
begin
  select value into before_row from jsonb_array_elements(public.qa_admin_users_page()) where value->>'id'=target::text;
  revision:=before_row->>'access_revision';
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'products',revision,'{"productIds":["missing"]}'); raise exception 'FAILED missing';
  exception when others then if sqlerrm not like 'An assigned product is unavailable%' then raise; end if; end;
  if not exists(select 1 from public.user_products where user_id=target and product_id='qa-access-one') then raise exception 'Failed save erased access'; end if;
  saved:=public.qa_admin_access_mutate(request_id,target,'products',revision,'{"productIds":["qa-access-two"]}');
  if saved->'user'->'product_ids'<>'["qa-access-two"]' or saved->>'dispatchEnabled'<>'false' then raise exception 'Bad access result'; end if;
  if public.qa_admin_access_mutate(request_id,target,'products',revision,'{"productIds":["qa-access-two"]}')<>saved then raise exception 'Lost response replay failed'; end if;
  if (select count(*) from public.admin_audit_log where meta->>'requestId'=request_id::text)<>1 then raise exception 'Audit replay duplicated'; end if;
  begin perform public.qa_admin_access_mutate(request_id,target,'products',revision,'{"productIds":[]}'); raise exception 'FAILED request identity';
  exception when others then if sqlerrm<>'User request identity conflicts' then raise; end if; end;
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'products',revision,'{"productIds":[]}'); raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'User access changed%' then raise; end if; end;
  revision:=saved->'user'->>'access_revision';
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'products',revision,'{"productIds":["qa-access-one","qa-access-one"]}'); raise exception 'FAILED duplicates';
  exception when others then if sqlerrm<>'Duplicate product assignment' then raise; end if; end;
  saved:=public.qa_admin_access_mutate(gen_random_uuid(),target,'role',revision,'{"role":"admin"}');
  if saved->'user'->>'role'<>'admin' or saved->'user'->'product_ids'<>'["qa-access-two"]' then raise exception 'Promotion clobbered assignments'; end if;
  revision:=saved->'user'->>'access_revision';
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'products',revision,'{"productIds":[]}'); raise exception 'FAILED admin assignments';
  exception when others then if sqlerrm<>'Administrators already have all product access' then raise; end if; end;
  saved:=public.qa_admin_access_mutate(gen_random_uuid(),target,'role',revision,'{"role":"member"}');
  if saved->'user'->>'role'<>'member' then raise exception 'Demotion failed'; end if;
  select value into before_row from jsonb_array_elements(public.qa_admin_users_page()) where value->>'id'=auth.uid()::text;
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),auth.uid(),'role',before_row->>'access_revision','{"role":"member"}'); raise exception 'FAILED self';
  exception when others then if sqlerrm<>'You cannot change your own administrator role' then raise; end if; end;
  begin update public.profiles set role='member' where id=auth.uid(); raise exception 'FAILED direct role';
  exception when insufficient_privilege then null; end;
  begin delete from public.user_products where user_id=target; raise exception 'FAILED direct assignments';
  exception when insufficient_privilege then null; end;
  begin insert into public.admin_audit_log(actor_id,action) values(auth.uid(),'forged'); raise exception 'FAILED forged audit';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000262","role":"authenticated"}',true);
do $$ begin
  begin perform public.qa_admin_users_page(); raise exception 'FAILED member list';
  exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
  begin update public.profiles set role='admin' where id=auth.uid(); raise exception 'FAILED member role escalation';
  exception when insufficient_privilege then null; end;
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),auth.uid(),'role',repeat('a',32),'{"role":"admin"}'); raise exception 'FAILED member RPC';
  exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
  update public.profiles set ap_dismissed_ad_ids='["qa-access-visibility"]' where id=auth.uid();
end $$;
reset role;
create function public.qa_access_fixture_audit_failure() returns trigger language plpgsql as $$ begin
  if new.action='qa_user_products' and new.target_user='00000000-0000-4000-8000-000000000262' then raise exception 'Synthetic audit failure'; end if;
  return new;
end $$;
create trigger qa_access_fixture_audit_failure before insert on public.admin_audit_log for each row execute function public.qa_access_fixture_audit_failure();
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000261","role":"authenticated"}',true);
set local role authenticated;
do $$ declare before_row jsonb; request_id uuid:=gen_random_uuid(); begin
  select value into before_row from jsonb_array_elements(public.qa_admin_users_page()) where value->>'id'='00000000-0000-4000-8000-000000000262';
  begin perform public.qa_admin_access_mutate(request_id,'00000000-0000-4000-8000-000000000262','products',before_row->>'access_revision','{"productIds":[]}'); raise exception 'FAILED audit rollback';
  exception when others then if sqlerrm<>'Synthetic audit failure' then raise; end if; end;
  if not exists(select 1 from public.user_products where user_id='00000000-0000-4000-8000-000000000262' and product_id='qa-access-two') then raise exception 'Audit failure left partial mutation'; end if;
end $$;
reset role;
drop trigger qa_access_fixture_audit_failure on public.admin_audit_log;
drop function public.qa_access_fixture_audit_failure();

insert into auth.users(id,email,raw_app_meta_data)
  select ('00000000-0000-4000-9000-'||lpad(n::text,12,'0'))::uuid,'access-page-'||n||'@example.test','{}'::jsonb from generate_series(1,501) n;
set local role authenticated;
do $$ declare rows jsonb; next_rows jsonb; begin
  rows:=public.qa_admin_users_page();
  if jsonb_array_length(rows)<>500 then raise exception 'First user page was truncated'; end if;
  next_rows:=public.qa_admin_users_page((rows->499->>'id')::uuid);
  if jsonb_array_length(next_rows)<4 or exists(select 1 from jsonb_array_elements(next_rows) r where (r->>'id')::uuid<=(rows->499->>'id')::uuid) then raise exception 'User pagination failed'; end if;
end $$;
reset role;
update public.profiles set must_change_password=true where id='00000000-0000-4000-8000-000000000261';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000261","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.qa_admin_users_page(); raise exception 'FAILED password gate';
  exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('authenticated','public.qa_admin_access_receipts','SELECT')
    or has_table_privilege('authenticated','public.profiles_with_products','SELECT')
    or has_function_privilege('authenticated','public.qa_admin_user_snapshot(uuid)','EXECUTE')
    or has_function_privilege('anon','public.qa_admin_access_mutate(uuid,uuid,text,text,jsonb)','EXECUTE') then raise exception 'Permissions exposed'; end if;
end $$;
