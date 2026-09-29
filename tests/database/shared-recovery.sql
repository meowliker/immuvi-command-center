-- Continues shared-worker.sql fixtures, entirely inside its rollback transaction.
do $$ declare value jsonb; script jsonb; begin
 script:=jsonb_build_object('variation','Test','intent','Test','hook_text','Test','source_format_match','Test','voice_over_script','Test','cta','Test','what_to_change','Test','why_it_should_work','Test','script_breakdown',jsonb_build_array(jsonb_build_object('time','0:00-0:03')));
 value:=jsonb_build_object('metadata','{"page_name":"Test brand","body_text":"Actual caption","media_kind":"image","voice_over":"No voice over"}'::jsonb,
 'classification','{"hook_type":"Curiosity","creative_structure":"Demo","production_style":"Static Graphic","funnel_type":"TOF","persona":"Test persona","angle":"Test angle","creative_usp":"Test format","creative_hypothesis":"Test hypothesis","media_kind":"image","photo_video":"Photo","voice_over":"No voice over"}'::jsonb,
 'brief',jsonb_build_object('why_it_works','Test','replication_brief','Test','what_to_test','Test','competitor_intel','Test','our_next_ad','Test','inspiration_script_skeleton','Test','frame_by_frame',jsonb_build_array(jsonb_build_object('time','0:00-0:03')),'next_ad_scripts',jsonb_build_array(script,script,script)),
 'duration_seconds',0,'frames_extracted',1);
 perform set_config('fixture.recovery.result',value::text,true);
end $$;
update public.qa_private_inspiration_jobs set status='failed',sealed_clickup_token='' where worker_id='10000000-0000-4000-8000-000000000011';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.qa_shared_recovery_ready();
reset role;
update public.qa_private_workers set heartbeat_at=now()-interval '1 day',classifier_available=false where id='10000000-0000-4000-8000-000000000011';
insert into public.inspirations(id,product_id,url,status,data)
 select 'qa-recovery-'||n,'qa-sample-astrorekha','https://www.instagram.com/p/test/','Blocked','{"_qaCreatedBy":"10000000-0000-4000-8000-000000000002"}' from generate_series(1,10) n;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; begin
 a:=public.qa_private_inspiration_enqueue('20000000-0000-4000-8000-000000000001','qa-sample-astrorekha','qa-recovery-1','10000000-0000-4000-8000-000000000011',repeat('a',512));
 b:=public.qa_private_inspiration_enqueue('20000000-0000-4000-8000-000000000001','qa-sample-astrorekha','qa-recovery-1','10000000-0000-4000-8000-000000000011',repeat('a',512));
 if a<>b or a->>'status'<>'pending' then raise exception 'Offline enqueue is not idempotent'; end if;
 if public.qa_private_inspiration_status('qa-sample-astrorekha')::text like '%sealed_clickup_token%' then raise exception 'Credential leaked'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where id='20000000-0000-4000-8000-000000000001' and recovery_version=2 and credential_expires_at=now()+interval '7 days') then raise exception 'Missing bounded encrypted credential lifecycle'; end if;
end $$;
update public.qa_private_workers set heartbeat_at=now(),classifier_available=true where id='10000000-0000-4000-8000-000000000011';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb; begin
 if public.qa_private_inspiration_claim() is not null then raise exception 'Legacy binary claimed v2 job'; end if;
 j:=public.qa_shared_inspiration_claim();
 if j->>'id' is distinct from '20000000-0000-4000-8000-000000000001' or j->>'attempts'<>'1' then raise exception 'Recovery claim failed'; end if;
 if public.qa_shared_inspiration_claim() is not null then raise exception 'Capacity exceeded'; end if;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'retry','{"reason":"network"}');
 if public.qa_shared_inspiration_claim() is not null then raise exception 'Retry backoff ignored'; end if;
end $$;
reset role;
update public.qa_private_inspiration_jobs set next_attempt_at=now() where id='20000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_shared_inspiration_claim();
 if j->>'attempts'<>'2' or j->>'recovery_stage'<>'recovering' then raise exception 'Retry attempt lost'; end if;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'generation-start');
 begin
  perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'generation-start');
  raise exception 'FAILED repeated generation';
 exception when others then if sqlerrm not like 'Generation already started%' then raise; end if; end;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'result',current_setting('fixture.recovery.result')::jsonb);
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'result',current_setting('fixture.recovery.result')::jsonb);
 begin
  perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'result','{"saved":"other"}');
  raise exception 'FAILED result overwrite';
 exception when others then if sqlerrm<>'Saved generation cannot be replaced' then raise; end if; end;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'delivery-start');
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'doc','{"id":"8cq1r3y-44896"}');
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'page','{"id":"existing-page"}');
end $$;
reset role;
update public.qa_private_inspiration_jobs set lease_until=now()-interval '1 minute' where id='20000000-0000-4000-8000-000000000001';
set local role anon;
select public.qa_shared_inspiration_claim();
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where id='20000000-0000-4000-8000-000000000001' and status='pending' and recovery_stage='recovering'
 and result=current_setting('fixture.recovery.result')::jsonb and page_id='existing-page' and length(sealed_clickup_token)=512 and lease_id is null) then raise exception 'Interrupted delivery discarded checkpoints'; end if;
end $$;
update public.qa_private_inspiration_jobs set next_attempt_at=now() where id='20000000-0000-4000-8000-000000000001';
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_shared_inspiration_claim();
 if j->>'page_id'<>'existing-page' or j->>'attempts'<>'3' then raise exception 'Did not recover same receipt'; end if;
end $$;
reset role;
-- Cancellation is requester-only, and revokes the running lease without deleting evidence.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_cancel('20000000-0000-4000-8000-000000000001');raise exception 'FAILED nonrequester cancel';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_private_inspiration_cancel('20000000-0000-4000-8000-000000000001');
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where id='20000000-0000-4000-8000-000000000001' and recovery_stage='cancelled' and sealed_clickup_token='' and lease_id is null and page_id='existing-page') then raise exception 'Cancellation lost receipt or retained authorization'; end if;
end $$;
-- New jobs exercise expiry, source changes, permissions and retry exhaustion.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 for n in 2..6 loop
  perform public.qa_private_inspiration_enqueue(('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'qa-sample-astrorekha','qa-recovery-'||n,'10000000-0000-4000-8000-000000000011',repeat('a',512));
 end loop;
end $$;
reset role;
update public.qa_private_inspiration_jobs set credential_expires_at=now()-interval '1 second' where inspiration_id='qa-recovery-2';
update public.inspirations set url='https://www.instagram.com/p/changed/' where id='qa-recovery-3';
update public.qa_private_inspiration_jobs set attempts=5 where inspiration_id='qa-recovery-4';
update public.qa_private_inspiration_jobs set context=jsonb_set(context,'{libraryDocId}','"wrong-doc"') where inspiration_id='qa-recovery-5';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_shared_inspiration_claim();
 if j->>'inspiration_id' is distinct from 'qa-recovery-6' then raise exception 'Unsafe recovery job claimed'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.qa_private_inspiration_jobs where inspiration_id in ('qa-recovery-2','qa-recovery-3','qa-recovery-4','qa-recovery-5') and status='failed' and recovery_stage='needs_attention' and sealed_clickup_token='')<>4 then raise exception 'Expiry/source/destination/retry limit not enforced'; end if;
end $$;
update public.profiles set is_active=false where id='10000000-0000-4000-8000-000000000002';
do $$ declare j public.qa_private_inspiration_jobs; begin
 select * into j from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-6';
 begin perform public.qa_private_inspiration_checkpoint(j.id,j.lease_id,'heartbeat');raise exception 'FAILED revoked valid lease';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ declare j public.qa_private_inspiration_jobs; begin
 -- An arbitrary stale/forged lease cannot bypass the checkpoint authorization.
 begin perform public.qa_private_inspiration_checkpoint('20000000-0000-4000-8000-000000000006',gen_random_uuid(),'heartbeat');raise exception 'FAILED stale lease';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.qa_private_inspiration_jobs set lease_until=now()-interval '1 minute' where inspiration_id='qa-recovery-6';
set local role anon;
do $$ begin if public.qa_shared_inspiration_claim() is not null then raise exception 'Revoked requester reclaimed';end if;end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-6' and status='failed' and sealed_clickup_token='') then raise exception 'Revoked access kept credentials';end if;
end $$;
update public.profiles set is_active=true where id='10000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.qa_private_inspiration_retry_delivery('20000000-0000-4000-8000-000000000001','qa-sample-astrorekha','qa-recovery-1','10000000-0000-4000-8000-000000000011',repeat('b',512));
  raise exception 'FAILED cancellation fence';
 exception when others then if sqlerrm not like 'Cancellation is settling%' then raise;end if;end;
 -- An expired pre-generation job renews authorization without a new job identity.
 perform public.qa_private_inspiration_retry_delivery('20000000-0000-4000-8000-000000000002','qa-sample-astrorekha','qa-recovery-2','10000000-0000-4000-8000-000000000011',repeat('b',512));
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-2' and status='pending'
 and credential_expires_at=now()+interval '7 days' and sealed_clickup_token=repeat('b',512) and attempts=0) then raise exception 'Credential renewal lost identity or retry state';end if;
end $$;
update public.qa_private_inspiration_jobs set delivery_slot=true where inspiration_id='qa-recovery-1';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_shared_inspiration_claim();
 if j->>'inspiration_id'<>'qa-recovery-2' then raise exception 'Renewed job not claimable';end if;
 if public.qa_private_inspiration_delivery_lock((j->>'id')::uuid,(j->>'lease_id')::uuid) then raise exception 'Cancelled in-flight delivery lost fence';end if;
end $$;
reset role;
update public.qa_private_inspiration_jobs set lease_until=now()-interval '1 second' where inspiration_id='qa-recovery-1';
-- Claiming a restarted job rotates its lease; old checkpoints are rejected.
create temporary table recovery_old_lease as select id,lease_id from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-2';
update public.qa_private_inspiration_jobs set lease_until=now()-interval '1 second' where inspiration_id='qa-recovery-2';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare rows jsonb; begin
 rows:=public.qa_private_inspiration_status('qa-sample-astrorekha');
 if not exists(select 1 from jsonb_array_elements(rows) row where row->>'inspiration_id'='qa-recovery-2' and row->>'status'='pending' and row->>'recovery_stage'='recovering') then raise exception 'Offline expired job appears running';end if;
 if not exists(select 1 from jsonb_array_elements(rows) row where row->>'inspiration_id'='qa-recovery-1' and row->>'status'='cancelled') then raise exception 'Cancelled job appears failed';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin if public.qa_private_inspiration_claim() is not null then raise exception 'Old worker claimed recovery job';end if;end $$;
reset role;
do $$ begin if (select status from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-2')<>'running' then raise exception 'Old worker failed expired v2 lease';end if;end $$;
set local role anon;
select public.qa_shared_inspiration_claim();
reset role;
update public.qa_private_inspiration_jobs set next_attempt_at=now() where inspiration_id='qa-recovery-2';
set local role anon;
select public.qa_shared_inspiration_claim();
reset role;
do $$ declare j record; begin
 select * into j from recovery_old_lease;
 begin perform public.qa_private_inspiration_checkpoint(j.id,j.lease_id,'heartbeat');raise exception 'FAILED old lease accepted';exception when insufficient_privilege then null;end;
end $$;
update public.qa_private_inspiration_jobs set status='failed',sealed_clickup_token='',delivery_slot=false where inspiration_id='qa-recovery-2';
-- Delivery-only recovery completes exactly once even if the final acknowledgement is lost.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_private_inspiration_retry_delivery('20000000-0000-4000-8000-000000000001','qa-sample-astrorekha','qa-recovery-1','10000000-0000-4000-8000-000000000011',repeat('b',512));
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_shared_inspiration_claim();
 if j->>'inspiration_id'<>'qa-recovery-1' or j->>'page_id'<>'existing-page' then raise exception 'Saved delivery identity lost';end if;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'complete');
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'complete');
end $$;
reset role;
do $$ begin
 if (select count(*) from public.inspiration_results where ins_id='qa-recovery-1')<>1 then raise exception 'Duplicate publication';end if;
 if not exists(select 1 from public.qa_private_inspiration_jobs where inspiration_id='qa-recovery-1' and status='done' and sealed_clickup_token='') then raise exception 'Completion retained authorization';end if;
end $$;
set local role anon;
select public.qa_private_runtime_heartbeat(true,false,true);
reset role;
do $$ begin
 if (select recovery_protocol from public.qa_private_workers where id='10000000-0000-4000-8000-000000000011')<>1 then raise exception 'Rollback retained a stale recovery capability';end if;
end $$;
set local role anon;
do $$ begin if public.qa_shared_runtime_heartbeat(true,false,true)<>2 then raise exception 'New runtime capability not restored';end if;end $$;
reset role;
