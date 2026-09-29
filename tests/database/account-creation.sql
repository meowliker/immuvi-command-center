insert into auth.users(id,email,encrypted_password,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000291','creation-admin@example.test','fixture','{"role":"admin","must_change_password":false}');
insert into public.products(id,name,config) values('qa-creation-fixture','Creation fixture','{}');
do $$ declare actor uuid:='00000000-0000-4000-8000-000000000291'; target uuid:='00000000-0000-4000-8000-000000000292'; req uuid:='00000000-0000-4000-8000-000000000293'; input jsonb; job jsonb; begin
  input:='{"email":"creation-target@example.test","username":"fixture","fullName":"Creation test","role":"member","productIds":["qa-creation-fixture"],"passwordMode":"generated"}';
  begin perform public.qa_account_creation_prepare(target,req,input,target,gen_random_uuid(),'cipher',null); raise exception 'FAILED member'; exception when insufficient_privilege then null; end;
  begin perform public.qa_account_creation_prepare(actor,req,input||'{"productIds":["missing"]}',target,gen_random_uuid(),'cipher',null); raise exception 'FAILED missing product';
  exception when others then if sqlerrm<>'An assigned product is unavailable. Refresh and review.' then raise; end if; end;
  job:=public.qa_account_creation_prepare(actor,req,input,target,gen_random_uuid(),'cipher',null);
  if job->>'canSend'<>'true' then raise exception 'Initial send unavailable'; end if;
  if public.qa_account_creation_prepare(actor,req,input,gen_random_uuid(),gen_random_uuid(),'different',null)->>'canSend'<>'false' then raise exception 'Duplicate send'; end if;
  begin perform public.qa_account_creation_prepare(actor,req,input||'{"role":"admin"}',target,gen_random_uuid(),'cipher',null); raise exception 'FAILED conflicting role';
  exception when others then if sqlerrm not in ('Creation request identity conflicts','Invalid product assignments') then raise; end if; end;
  begin perform public.qa_account_creation_prepare(actor,gen_random_uuid(),input,gen_random_uuid(),gen_random_uuid(),'cipher',null); raise exception 'FAILED pending email';
  exception when others then if sqlerrm<>'This email has a pending creation request' then raise; end if; end;
  begin perform public.qa_account_creation_prepare(actor,gen_random_uuid(),input||'{"email":"different@example.test"}',gen_random_uuid(),gen_random_uuid(),'cipher',null); raise exception 'FAILED pending username';
  exception when others then if sqlerrm<>'This username is already in use or reserved. Choose another username.' then raise; end if; end;
  begin update public.profiles set username='fixture' where id=actor; raise exception 'FAILED username claim';
  exception when others then if sqlerrm<>'This username is reserved by a pending account creation' then raise; end if; end;
  begin delete from public.products where id='qa-creation-fixture'; raise exception 'FAILED product reservation';
  exception when others then if sqlerrm<>'Product is reserved by a pending account creation' then raise; end if; end;
  begin update public.profiles set role='member' where id=actor; raise exception 'FAILED actor guard';
  exception when others then if sqlerrm<>'Resolve the pending account creation first' then raise; end if; end;
  if public.qa_account_creation_finish(actor,req)->>'state'<>'uncertain' then raise exception 'Missing Auth accepted'; end if;
end $$;
insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data)
 values('00000000-0000-4000-8000-000000000292','creation-target@example.test','fixture-new',now(),'{"role":"admin","must_change_password":false}');
do $$ begin
  if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000292' and (is_active or role<>'member' or not must_change_password)) then raise exception 'Unfinished account has access'; end if;
  if public.qa_account_creation_finish('00000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293')->>'state'<>'uncertain' then raise exception 'Wrong marker accepted'; end if;
  begin update public.profiles set is_active=true where id='00000000-0000-4000-8000-000000000292'; raise exception 'FAILED pending access';
  exception when others then if sqlerrm<>'Resolve the pending account creation first' then raise; end if; end;
  begin insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000292','qa-creation-fixture'); raise exception 'FAILED pending assignments';
  exception when others then if sqlerrm<>'Resolve the pending account creation first' then raise; end if; end;
  begin delete from auth.users where id='00000000-0000-4000-8000-000000000292'; raise exception 'FAILED pending deletion';
  exception when others then if sqlerrm<>'Resolve the pending account creation first' then raise; end if; end;
end $$;
update auth.users set raw_app_meta_data=raw_app_meta_data||'{"qa_creation_request":"00000000-0000-4000-8000-000000000293"}' where id='00000000-0000-4000-8000-000000000292';
create function public.qa_creation_fixture_audit_fail() returns trigger language plpgsql as $$ begin
  if new.action='qa_account_create_user' then raise exception 'Synthetic creation audit failure'; end if; return new; end $$;
create trigger qa_creation_fixture_audit_fail before insert on public.admin_audit_log for each row execute function public.qa_creation_fixture_audit_fail();
do $$ begin
  begin perform public.qa_account_creation_finish('00000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293'); raise exception 'FAILED audit rollback';
  exception when others then if sqlerrm<>'Synthetic creation audit failure' then raise; end if; end;
  if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000292' and is_active)
    or exists(select 1 from public.user_products where user_id='00000000-0000-4000-8000-000000000292') then raise exception 'Partial provisioning committed'; end if;
end $$;
drop trigger qa_creation_fixture_audit_fail on public.admin_audit_log;
drop function public.qa_creation_fixture_audit_fail();
do $$ declare result jsonb; actor uuid:='00000000-0000-4000-8000-000000000291'; req uuid:='00000000-0000-4000-8000-000000000293'; begin
  result:=public.qa_account_creation_finish(actor,req);
  if result->>'state'<>'completed' or result->>'credentialsAvailable'<>'true' or result->'user'->>'is_active'<>'true'
    or result->'user'->>'role'<>'member' or result->'user'->>'username'<>'fixture' or result->'user'->'product_ids'<>'["qa-creation-fixture"]' then raise exception 'Provisioning failed'; end if;
  if public.qa_account_creation_finish(actor,req)<>result then raise exception 'Replay changed provisioning'; end if;
  if (select count(*) from public.admin_audit_log where meta->>'requestId'=req::text)<>1 then raise exception 'Duplicate audit'; end if;
end $$;
update auth.users set encrypted_password='fixture-personal-password' where id='00000000-0000-4000-8000-000000000292';
do $$ declare req uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); input jsonb; actor uuid:='00000000-0000-4000-8000-000000000291'; begin
  if public.qa_account_creation_finish(actor,'00000000-0000-4000-8000-000000000293')->>'credentialsAvailable'<>'false' then raise exception 'Old credential exposed'; end if;
  input:='{"email":"creation-reject@example.test","username":"fixture-reject","fullName":"","role":"admin","productIds":[],"passwordMode":"custom"}';
  begin perform public.qa_account_creation_prepare(actor,req,input||'{"username":"fixture"}',gen_random_uuid(),token,'cipher',repeat('a',64)); raise exception 'FAILED existing username';
  exception when others then if sqlerrm<>'This username is already in use or reserved. Choose another username.' then raise; end if; end;
  begin perform public.qa_account_creation_prepare(actor,req,input,gen_random_uuid(),token,null,null); raise exception 'FAILED missing custom password';
  exception when others then if sqlerrm<>'Creation password is required before the first request' then raise; end if; end;
  perform public.qa_account_creation_prepare(actor,req,input,gen_random_uuid(),token,'cipher',repeat('a',64));
  begin perform public.qa_account_creation_prepare(actor,req,input,gen_random_uuid(),token,'cipher',repeat('b',64)); raise exception 'FAILED password identity';
  exception when others then if sqlerrm<>'Creation request identity conflicts' then raise; end if; end;
  perform public.qa_account_creation_reject(actor,req,token);
  if (select secret_cipher from public.qa_account_creations where request_id=req) is not null then raise exception 'Rejected secret retained'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000291","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.qa_account_creation_finish(auth.uid(),'00000000-0000-4000-8000-000000000293'); raise exception 'FAILED client RPC'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.qa_account_creations; raise exception 'FAILED journal read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000292';
do $$ declare result jsonb; begin
  result:=public.qa_account_creation_finish('00000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293');
  if result->'user'<>'null' or result->>'credentialsAvailable'<>'false' then raise exception 'Deleted user replay resurrected'; end if;
end $$;
