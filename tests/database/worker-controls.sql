insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000281','worker-controls-admin@example.test','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000282','worker-controls-member@example.test','{"must_change_password":false}');
-- Emulate already-registered enabled workers; all of this is rollback-only.
alter table public.worker_registry disable trigger qa_guard_worker_control;
insert into public.worker_registry(worker_id,enabled,status,current_job_id) values
 ('qa-controls-fixture-busy',true,'busy','00000000-0000-4000-8000-000000000289'),
 ('qa-controls-fixture-stale',true,'offline',null),('qa-controls-fixture-rollback',true,'idle',null);
alter table public.worker_registry enable trigger qa_guard_worker_control;
insert into public.worker_registry(worker_id) select 'qa-controls-fixture-page-'||lpad(i::text,3,'0') from generate_series(1,201) i;
do $$ declare rev uuid; begin
  select control_revision into rev from public.worker_registry where worker_id='qa-controls-fixture-busy';
  update public.worker_registry set last_heartbeat=now(),control_revision=gen_random_uuid() where worker_id='qa-controls-fixture-busy';
  if (select control_revision<>rev from public.worker_registry where worker_id='qa-controls-fixture-busy') then raise exception 'Heartbeat changed control revision'; end if;
  begin insert into public.worker_registry(worker_id,enabled) values('qa-controls-fixture-forbidden',true); raise exception 'FAILED enable insert';
  exception when others then if sqlerrm not like 'Worker enabling is blocked%' then raise; end if; end;
  begin update public.worker_registry set enabled=true where worker_id='qa-controls-fixture-page-001'; raise exception 'FAILED resume';
  exception when others then if sqlerrm not like 'Worker enabling is blocked%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000281","role":"authenticated"}',true);
set local role authenticated;
do $$ declare rev uuid; req uuid:=gen_random_uuid(); result jsonb; page jsonb; cursor text; total integer:=0; begin
  loop
    page:=public.qa_workers_page(cursor); total:=total+jsonb_array_length(page);
    exit when jsonb_array_length(page)<200;
    cursor:=page->199->>'worker_id';
  end loop;
  if total<204 then raise exception 'Pagination incomplete'; end if;
  select control_revision into rev from public.worker_registry where worker_id='qa-controls-fixture-busy';
  result:=public.qa_worker_pause(req,'qa-controls-fixture-busy',rev);
  perform set_config('qa.worker_fixture_request',req::text,true);
  perform set_config('qa.worker_fixture_revision',rev::text,true);
  perform set_config('qa.worker_fixture_receipt',result::text,true);
  if result->>'enabled'<>'false' or result->>'dispatchEnabled'<>'false' then raise exception 'Bad receipt'; end if;
  if not exists(select 1 from public.worker_registry where worker_id='qa-controls-fixture-busy' and not enabled and status='busy' and current_job_id='00000000-0000-4000-8000-000000000289') then raise exception 'Pause cancelled in-flight work'; end if;
  if public.qa_worker_pause(req,'qa-controls-fixture-busy',rev)<>result then raise exception 'Replay changed receipt'; end if;
  if (select count(*) from public.admin_audit_log where action='qa_worker_pause' and meta->>'requestId'=req::text)<>1 then raise exception 'Duplicate audit'; end if;
  begin perform public.qa_worker_pause(req,'qa-controls-fixture-stale',rev); raise exception 'FAILED identity';
  exception when others then if sqlerrm<>'Worker request identity conflicts' then raise; end if; end;
  begin perform public.qa_worker_pause(gen_random_uuid(),'qa-controls-fixture-busy',rev); raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'Worker control changed%' then raise; end if; end;
  begin perform public.qa_worker_pause(gen_random_uuid(),'qa-controls-fixture-missing',rev); raise exception 'FAILED deleted';
  exception when others then if sqlerrm not like 'Worker is unavailable%' then raise; end if; end;
  begin update public.worker_registry set enabled=false where worker_id='qa-controls-fixture-stale'; raise exception 'FAILED direct'; exception when insufficient_privilege then null; end;
  begin select response into result from public.qa_worker_control_receipts; raise exception 'FAILED private receipts'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.worker_registry where worker_id='qa-controls-fixture-busy';
insert into public.worker_registry(worker_id) values('qa-controls-fixture-busy');
set local role authenticated;
do $$ declare result jsonb; rev uuid; begin
  select control_revision into rev from public.worker_registry where worker_id='qa-controls-fixture-busy';
  result:=public.qa_worker_pause(current_setting('qa.worker_fixture_request')::uuid,'qa-controls-fixture-busy',current_setting('qa.worker_fixture_revision')::uuid);
  if result<>current_setting('qa.worker_fixture_receipt')::jsonb then raise exception 'Replacement worker broke replay'; end if;
  if (select control_revision<>rev from public.worker_registry where worker_id='qa-controls-fixture-busy') then raise exception 'Replay changed replacement'; end if;
  begin perform public.qa_worker_pause(gen_random_uuid(),'qa-controls-fixture-busy',current_setting('qa.worker_fixture_revision')::uuid); raise exception 'FAILED replacement version';
  exception when others then if sqlerrm not like 'Worker control changed%' then raise; end if; end;
end $$;
reset role;
create function public.qa_worker_fixture_fail() returns trigger language plpgsql as $$ begin
  if new.action='qa_worker_pause' and new.meta->>'workerId'='qa-controls-fixture-rollback' then raise exception 'Synthetic audit failure'; end if; return new;
end $$;
create trigger qa_worker_fixture_fail before insert on public.admin_audit_log for each row execute function public.qa_worker_fixture_fail();
set local role authenticated;
do $$ declare rev uuid; begin
  select control_revision into rev from public.worker_registry where worker_id='qa-controls-fixture-rollback';
  begin perform public.qa_worker_pause(gen_random_uuid(),'qa-controls-fixture-rollback',rev); raise exception 'FAILED audit';
  exception when others then if sqlerrm<>'Synthetic audit failure' then raise; end if; end;
  if not exists(select 1 from public.worker_registry where worker_id='qa-controls-fixture-rollback' and enabled and control_revision=rev) then raise exception 'Failed audit changed worker'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000282","role":"authenticated"}',true);
do $$ begin
  begin perform public.qa_workers_page(); raise exception 'FAILED member read'; exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
  begin perform public.qa_worker_pause(gen_random_uuid(),'qa-controls-fixture-stale',gen_random_uuid()); raise exception 'FAILED member pause'; exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
reset role;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000281';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000281","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.qa_workers_page(); raise exception 'FAILED inactive'; exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
reset role;
update public.profiles set is_active=true,must_change_password=true where id='00000000-0000-4000-8000-000000000281';
set local role authenticated;
do $$ begin
  begin perform public.qa_workers_page(); raise exception 'FAILED password gate'; exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.qa_workers_page(); raise exception 'FAILED anon'; exception when insufficient_privilege then null; end;
end $$;
reset role;
