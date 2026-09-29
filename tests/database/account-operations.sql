insert into auth.users(id,email,encrypted_password,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000271','account-admin@example.test','fixture-before','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000272','account-member@example.test','fixture-before','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000273','account-other-admin@example.test','fixture-before','{"role":"admin","must_change_password":false}');
insert into public.products(id,name,config) values('qa-account-fixture','Account fixture','{}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000272','qa-account-fixture');
update auth.users set last_sign_in_at='2026-09-25T00:00:00Z' where id='00000000-0000-4000-8000-000000000272';
do $$ begin
  if (select last_login_at from public.profiles where id='00000000-0000-4000-8000-000000000272') is distinct from '2026-09-25T00:00:00Z'::timestamptz then raise exception 'Sign-in timestamp not recorded'; end if;
end $$;
do $$ declare actor uuid:='00000000-0000-4000-8000-000000000271'; target uuid:='00000000-0000-4000-8000-000000000272';
  req uuid:='00000000-0000-4000-8000-000000000281'; input jsonb; prepared jsonb; result jsonb;
begin
  input:=jsonb_build_object('operation','reset-password','userId',target,'revision',public.qa_admin_user_snapshot(target)->>'access_revision','confirmEmail','');
  begin perform public.qa_account_prepare(target,req,input,gen_random_uuid(),'cipher-fixture'); raise exception 'FAILED member';
  exception when insufficient_privilege then null; end;
  begin perform public.qa_account_prepare(actor,req,jsonb_set(input,'{userId}',to_jsonb(actor)),gen_random_uuid(),'cipher-fixture'); raise exception 'FAILED self';
  exception when others then if sqlerrm<>'You cannot perform this account operation on yourself' then raise; end if; end;
  prepared:=public.qa_account_prepare(actor,req,input,gen_random_uuid(),'cipher-fixture');
  if prepared->>'canSend'<>'true' or not (select must_change_password from public.profiles where id=target) then raise exception 'Reset reservation not fail-closed'; end if;
  if public.qa_account_prepare(actor,req,input,gen_random_uuid(),'different-cipher')->>'canSend'<>'false' then raise exception 'Replay can send twice'; end if;
  if (select secret_cipher from public.qa_account_operations where request_id=req)<>'cipher-fixture' then raise exception 'Replay replaced secret'; end if;
  begin perform public.qa_account_prepare(actor,req,input||'{"confirmEmail":"changed"}',gen_random_uuid(),'cipher-fixture'); raise exception 'FAILED identity';
  exception when others then if sqlerrm<>'Account request identity conflicts' then raise; end if; end;
  begin perform public.qa_account_prepare(actor,gen_random_uuid(),input,gen_random_uuid(),'cipher-fixture'); raise exception 'FAILED pending target';
  exception when others then if sqlerrm<>'Resolve the pending account operation first' then raise; end if; end;
  begin perform public.qa_account_prepare('00000000-0000-4000-8000-000000000273',gen_random_uuid(),
    jsonb_build_object('operation','deactivate','userId',actor,'revision',public.qa_admin_user_snapshot(actor)->>'access_revision','confirmEmail',''),gen_random_uuid(),null); raise exception 'FAILED pending actor';
  exception when others then if sqlerrm<>'Finish this administrator''s pending account requests first' then raise; end if; end;
  if public.qa_account_finish(actor,req)->>'state'<>'uncertain' then raise exception 'Missing Auth operation was accepted'; end if;
  update auth.users set encrypted_password='fixture-password-without-marker' where id=target;
  if public.qa_account_finish(actor,req)->>'state'<>'uncertain' then raise exception 'Unmarked password accepted'; end if;
  if not (select must_change_password from public.profiles where id=target) then raise exception 'Pending reset flag bypassed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000271","role":"authenticated"}',true);
set local role authenticated;
do $$ declare target uuid:='00000000-0000-4000-8000-000000000272'; row jsonb; begin
  select value into row from jsonb_array_elements(public.qa_admin_users_page()) where value->>'id'=target::text;
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'role',row->>'access_revision','{"role":"admin"}'); raise exception 'FAILED pending role';
  exception when others then if sqlerrm<>'Resolve the pending account operation first' then raise; end if; end;
  begin perform public.qa_admin_access_mutate(gen_random_uuid(),target,'products',row->>'access_revision','{"productIds":[]}'); raise exception 'FAILED pending assignments';
  exception when others then if sqlerrm<>'Resolve the pending account operation first' then raise; end if; end;
  begin perform public.qa_account_prepare(auth.uid(),gen_random_uuid(),'{}',gen_random_uuid(),null); raise exception 'FAILED client service RPC';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000272","role":"authenticated"}',true);
do $$ begin
  if public.has_product('qa-account-fixture') or public.is_admin() then raise exception 'Password-pending account retained policy access'; end if;
  begin update public.profiles set must_change_password=false where id=auth.uid(); raise exception 'FAILED password flag bypass';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.admin_audit_log(actor_id,action,meta) select '00000000-0000-4000-8000-000000000271','qa_user_role',jsonb_build_object('email','account-audit-fixture-'||n) from generate_series(1,51) n;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000271","role":"authenticated"}',true);
set local role authenticated;
do $$ declare rows jsonb; older jsonb; begin
  rows:=public.qa_account_audit_page();
  if jsonb_array_length(rows)<>50 then raise exception 'Audit page truncated'; end if;
  older:=public.qa_account_audit_page((rows->49->>'id')::bigint);
  if jsonb_array_length(older)<1 or exists(select 1 from jsonb_array_elements(older) r where (r->>'id')::bigint>=(rows->49->>'id')::bigint) then raise exception 'Audit pagination failed'; end if;
end $$;
reset role;
update auth.users set encrypted_password='fixture-auth-reset',raw_app_meta_data=raw_app_meta_data||'{"qa_account_request":"00000000-0000-4000-8000-000000000281"}' where id='00000000-0000-4000-8000-000000000272';
do $$ declare result jsonb; actor uuid:='00000000-0000-4000-8000-000000000271'; req uuid:='00000000-0000-4000-8000-000000000281'; begin
  result:=public.qa_account_finish(actor,req);
  if result->>'state'<>'completed' or result->>'credentialsAvailable'<>'true' or result->'user'->>'must_change_password'<>'true' then raise exception 'Reset finish failed'; end if;
  if public.qa_account_finish(actor,req)<>result then raise exception 'Reset replay changed'; end if;
  if (select count(*) from public.admin_audit_log where meta->>'requestId'=req::text)<>1 then raise exception 'Duplicate reset audit'; end if;
end $$;
update auth.users set encrypted_password='fixture-user-changed-password' where id='00000000-0000-4000-8000-000000000272';
do $$ begin
  if (select must_change_password from public.profiles where id='00000000-0000-4000-8000-000000000272') then raise exception 'Verified password change did not complete'; end if;
  if public.qa_account_finish('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000281')->>'credentialsAvailable'<>'false' then raise exception 'Obsolete password remains available'; end if;
end $$;

do $$ declare actor uuid:='00000000-0000-4000-8000-000000000271'; target uuid:='00000000-0000-4000-8000-000000000272'; req uuid:='00000000-0000-4000-8000-000000000282'; token uuid:=gen_random_uuid(); input jsonb; begin
  input:=jsonb_build_object('operation','deactivate','userId',target,'revision',public.qa_admin_user_snapshot(target)->>'access_revision','confirmEmail','');
  perform public.qa_account_prepare(actor,req,input,token,null);
  if (select is_active from public.profiles where id=target) then raise exception 'Deactivation not fail-closed'; end if;
  perform public.qa_account_reject(actor,req,token);
  if not (select is_active from public.profiles where id=target) then raise exception 'Definite rejection did not restore profile'; end if;
  if public.qa_account_prepare(actor,req,input,token,null)->>'state'<>'rejected' then raise exception 'Rejected request silently resent'; end if;
  perform public.qa_account_prepare(actor,'00000000-0000-4000-8000-000000000283',input,gen_random_uuid(),null);
end $$;
update auth.users set banned_until=now()+interval '10 years',raw_app_meta_data=raw_app_meta_data||'{"qa_account_request":"00000000-0000-4000-8000-000000000283"}' where id='00000000-0000-4000-8000-000000000272';
create function public.qa_account_fixture_audit_fail() returns trigger language plpgsql as $$ begin
  if new.meta->>'requestId'='00000000-0000-4000-8000-000000000283' then raise exception 'Synthetic account audit failure'; end if;
  return new;
end $$;
create trigger qa_account_fixture_audit_fail before insert on public.admin_audit_log for each row execute function public.qa_account_fixture_audit_fail();
do $$ begin
  begin perform public.qa_account_finish('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000283'); raise exception 'FAILED audit rollback';
  exception when others then if sqlerrm<>'Synthetic account audit failure' then raise; end if; end;
  if (select state from public.qa_account_operations where request_id='00000000-0000-4000-8000-000000000283')<>'sending' then raise exception 'Failed audit completed job'; end if;
end $$;
drop trigger qa_account_fixture_audit_fail on public.admin_audit_log;
drop function public.qa_account_fixture_audit_fail();
do $$ declare actor uuid:='00000000-0000-4000-8000-000000000271'; target uuid:='00000000-0000-4000-8000-000000000272'; input jsonb; result jsonb; begin
  result:=public.qa_account_finish(actor,'00000000-0000-4000-8000-000000000283');
  if result->'user'->>'is_active'<>'false' then raise exception 'Deactivation finish failed'; end if;
  input:=jsonb_build_object('operation','reactivate','userId',target,'revision',public.qa_admin_user_snapshot(target)->>'access_revision','confirmEmail','');
  perform public.qa_account_prepare(actor,'00000000-0000-4000-8000-000000000284',input,gen_random_uuid(),null);
  if public.qa_account_finish(actor,'00000000-0000-4000-8000-000000000284')->>'state'<>'uncertain' then raise exception 'Still-banned account activated'; end if;
end $$;
update auth.users set banned_until=null,raw_app_meta_data=raw_app_meta_data||'{"qa_account_request":"00000000-0000-4000-8000-000000000284"}' where id='00000000-0000-4000-8000-000000000272';
do $$ declare actor uuid:='00000000-0000-4000-8000-000000000271'; target uuid:='00000000-0000-4000-8000-000000000272'; input jsonb; begin
  if public.qa_account_finish(actor,'00000000-0000-4000-8000-000000000284')->'user'->>'is_active'<>'true' then raise exception 'Reactivation failed'; end if;
  input:=jsonb_build_object('operation','delete-user','userId',target,'revision',public.qa_admin_user_snapshot(target)->>'access_revision','confirmEmail','wrong');
  begin perform public.qa_account_prepare(actor,gen_random_uuid(),input,gen_random_uuid(),null); raise exception 'FAILED delete confirmation';
  exception when others then if sqlerrm<>'Confirm the exact account email' then raise; end if; end;
  perform public.qa_account_prepare(actor,'00000000-0000-4000-8000-000000000285',input||'{"confirmEmail":"account-member@example.test"}',gen_random_uuid(),null);
end $$;
delete from auth.users where id='00000000-0000-4000-8000-000000000272';
do $$ declare result jsonb; begin
  result:=public.qa_account_finish('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000285');
  if result->'user'<>'null' or result->>'state'<>'completed' then raise exception 'Deletion failed'; end if;
  if not exists(select 1 from public.admin_audit_log where target_user is null and meta->>'targetId'='00000000-0000-4000-8000-000000000272') then raise exception 'Deleted user audit lost'; end if;
  if not exists(select 1 from public.products where id='qa-account-fixture') then raise exception 'Account deletion removed product'; end if;
  if public.qa_account_finish('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000285')<>result then raise exception 'Delete replay failed'; end if;
  if has_table_privilege('authenticated','public.qa_account_operations','SELECT') or has_function_privilege('authenticated','public.qa_account_finish(uuid,uuid)','EXECUTE') then raise exception 'Journal exposed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000271","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if jsonb_array_length(public.qa_account_audit_page())<5 then raise exception 'Activity history missing'; end if;
end $$;
reset role;
