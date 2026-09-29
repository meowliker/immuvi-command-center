insert into public.products(id,name) values('qa-rename-fixture','Rename fixture'),('qa-rename-foreign','Foreign rename');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000293','rename-preview@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000293','qa-rename-fixture');
insert into public.angles(id,product_id,name) values('qa-rename-angle','qa-rename-fixture','Energy');
insert into public.personas(id,product_id,name) values('qa-rename-persona','qa-rename-fixture','Students');
insert into public.ads(id,product_id,format_name,angle,persona,meta) values
 ('qa-rename-ad','qa-rename-fixture','Main','Energy','Students','{"angle":"Energy"}'),
 ('qa-rename-child','qa-rename-fixture','Child','1. ENERGY','Students','{}'),
 ('qa-rename-mirror','qa-rename-fixture','Mirror','Other','Other','{"_customFieldsRaw":{"angle tag":"Energy"}}'),
 ('qa-rename-quarantine','qa-rename-fixture','Quarantine','Energy','Other','{"_productBoundaryQuarantined":true}'),
 ('qa-rename-deleted','qa-rename-fixture','Deleted','Energy','Other','{"deletedAt":"now"}'),
 ('qa-rename-foreign-ad','qa-rename-foreign','Foreign','Energy','Other','{}');
update public.ads set parent_ad_id='qa-rename-ad' where id='qa-rename-child';
insert into public.inspirations(id,product_id,url,title,data) values('qa-rename-ins','qa-rename-fixture','https://example.test','Rename','{"sourceAngle":"Energy","persona":"Students"}');
insert into public.manual_actions(id,product_id,payload) values('00000000-0000-4000-8000-000000000294','qa-rename-fixture','{"_sourceAngle":"Energy","persona":"Students"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000293","role":"authenticated"}',true);
set local role authenticated;
do $$
declare src jsonb; preview jsonb; fresh jsonb; vals jsonb; saved jsonb; req uuid:=gen_random_uuid();
begin
  select jsonb_build_object('id',id,'version',updated_at) into src from public.angles where id='qa-rename-angle';
  preview:=public.qa_taxonomy_rename_preview('qa-rename-fixture','angle',src,'Focus');
  if preview->'counts'<>'{"ads":3,"inspirations":1,"actions":1}' or preview ? 'affectedIds' or preview->>'beforeName'<>'Energy' then raise exception 'Wrong preview counts'; end if;
  if (select name from public.angles where id='qa-rename-angle')<>'Energy' then raise exception 'Preview wrote taxonomy'; end if;
  vals:=jsonb_build_object('sources',jsonb_build_array(src),'fields','{"name":"Focus","source_link":"","notes":"Saved"}'::jsonb);
  begin perform public.qa_taxonomy_mutate('qa-rename-fixture',req,'angle','save',vals); raise exception 'FAILED missing preview';
  exception when others then if sqlerrm not like 'Rename impact changed%' then raise; end if; end;
  vals:=vals||jsonb_build_object('renameRevision',preview->>'revision');
  update public.ads set meta=meta||'{"otherEditor":"changed"}' where id='qa-rename-ad';
  fresh:=public.qa_taxonomy_rename_preview('qa-rename-fixture','angle',src,'Focus');
  if fresh->'counts'<>preview->'counts' or fresh->>'revision'=preview->>'revision' then raise exception 'Same-count edit was not fingerprinted'; end if;
  begin perform public.qa_taxonomy_mutate('qa-rename-fixture',req,'angle','save',vals); raise exception 'FAILED same-count stale impact';
  exception when others then if sqlerrm not like 'Rename impact changed%' then raise; end if; end;
  -- Dependent changes must invalidate the confirmation, without touching the catalog version.
  update public.ads set angle='Other',meta='{}' where id='qa-rename-ad';
  update public.ads set angle='Energy',meta='{}' where id='qa-rename-mirror';
  begin perform public.qa_taxonomy_mutate('qa-rename-fixture',req,'angle','save',vals); raise exception 'FAILED stale impact';
  exception when others then if sqlerrm not like 'Rename impact changed%' then raise; end if; end;
  fresh:=public.qa_taxonomy_rename_preview('qa-rename-fixture','angle',src,'Focus');
  if fresh->>'revision'=preview->>'revision' then raise exception 'Snapshot failed to change'; end if;
  vals:=vals||jsonb_build_object('renameRevision',fresh->>'revision');
  saved:=public.qa_taxonomy_mutate('qa-rename-fixture',req,'angle','save',vals);
  if saved->'rename'->>'beforeName'<>'Energy' or saved->'rename'->>'afterName'<>'Focus'
    or saved->'rename'->>'revision'<>fresh->>'revision' or saved->'rename' ? 'affectedIds'
    or saved->'counts'->'ads'<>fresh->'counts'->'ads' then raise exception 'Rename provenance missing'; end if;
  if public.qa_taxonomy_mutate('qa-rename-fixture',req,'angle','save',vals)<>saved then raise exception 'Rename replay changed'; end if;
  if exists(select 1 from public.ads where id in ('qa-rename-quarantine','qa-rename-deleted') and angle<>'Energy') then raise exception 'Protected record retagged'; end if;
  -- A successful historical receipt is replayed without demanding a new preview.
  perform set_config('qa.rename_request',req::text,true);
  begin perform public.qa_taxonomy_rename_preview('qa-rename-foreign','angle',src,'Foreign'); raise exception 'FAILED foreign preview';
  exception when others then if sqlerrm not like 'Active product access%' then raise; end if; end;
  begin perform public.qa_taxonomy_rename_preview('qa-rename-fixture','angle',jsonb_set(src,'{version}',to_jsonb(now()-interval '1 day')),'Stale'); raise exception 'FAILED stale source';
  exception when others then if sqlerrm not like 'Taxonomy changed%' then raise; end if; end;
end $$;
reset role;
do $$ declare audit jsonb; begin
  select meta into audit from public.admin_audit_log where action='qa_taxonomy_rename' and target_product='qa-rename-fixture';
  if audit->>'beforeName'<>'Energy' or audit->>'afterName'<>'Focus' or audit->'affectedIds'->'ads'<>'["qa-rename-child","qa-rename-mirror"]'
    or (select count(*) from public.admin_audit_log where action='qa_taxonomy_rename' and target_product='qa-rename-fixture')<>1 then raise exception 'Audit evidence/replay mismatch'; end if;
  if (select angle from public.ads where id='qa-rename-foreign-ad')<>'Energy' then raise exception 'Foreign row changed'; end if;
  if has_function_privilege('anon','public.qa_taxonomy_rename_preview(text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_taxonomy_rename_snapshot(text,text,jsonb,text,boolean)','EXECUTE') then raise exception 'Private preview exposed'; end if;
end $$;
-- Audit failure must roll back the catalog, cascades and receipt together.
create function public.qa_rename_fixture_fail() returns trigger language plpgsql as $$ begin
  if new.action='qa_taxonomy_rename' then raise exception 'Synthetic rename audit failure'; end if; return new;
end $$;
create trigger qa_rename_fixture_fail before insert on public.admin_audit_log for each row execute function public.qa_rename_fixture_fail();
set local role authenticated;
do $$ declare src jsonb; preview jsonb; req uuid:=gen_random_uuid(); begin
  select jsonb_build_object('id',id,'version',updated_at) into src from public.personas where id='qa-rename-persona';
  preview:=public.qa_taxonomy_rename_preview('qa-rename-fixture','persona',src,'Graduates');
  if preview->'counts'<>'{"ads":2,"inspirations":1,"actions":1}' then raise exception 'Persona impact wrong'; end if;
  begin perform public.qa_taxonomy_mutate('qa-rename-fixture',req,'persona','save',jsonb_build_object('sources',jsonb_build_array(src),'renameRevision',preview->>'revision','fields','{"name":"Graduates","source_link":"","notes":""}'::jsonb)); raise exception 'FAILED audit rollback';
  exception when others then if sqlerrm<>'Synthetic rename audit failure' then raise; end if; end;
  if (select name from public.personas where id='qa-rename-persona')<>'Students' or (select persona from public.ads where id='qa-rename-ad')<>'Students' then raise exception 'Partial rename persisted'; end if;
  perform set_config('qa.rename_failed_request',req::text,true);
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.qa_taxonomy_receipts where request_id=current_setting('qa.rename_failed_request')::uuid) then raise exception 'Failed audit left receipt'; end if;
end $$;
drop trigger qa_rename_fixture_fail on public.admin_audit_log;
drop function public.qa_rename_fixture_fail();
update public.profiles set must_change_password=true where id='00000000-0000-4000-8000-000000000293';
set local role authenticated;
do $$ begin
  begin perform public.qa_taxonomy_rename_preview('qa-rename-fixture','angle','{"id":"qa-rename-angle","version":null}','Blocked'); raise exception 'FAILED password gate';
  exception when others then if sqlerrm not like 'Active product access%' then raise; end if; end;
end $$;
reset role;
