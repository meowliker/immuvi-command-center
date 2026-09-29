reset role;
update public.qa_private_inspiration_jobs set status='failed' where worker_id='10000000-0000-4000-8000-000000000011';
update public.qa_private_workers set analysis_protocol=1,recovery_protocol=2,image_protocol=1,codex_active=true,classifier_available=true,heartbeat_at=now()-interval '1 hour' where id='10000000-0000-4000-8000-000000000011';
insert into public.ads(id,product_id,format_name,status) values('winner-fixture','qa-sample-astrorekha','QA Winner','Winner');
insert into public.task_video_winners(ad_id,drive_file_id,file_name) values('winner-fixture',repeat('f',30),'winner.mp4');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000001','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','variation',repeat('s',512),'winner-fixture','winner-fixture',repeat('f',30));
 if r->>'status'<>'pending' then raise exception 'Offline enqueue failed';end if;
 if r<>public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000001','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','variation',repeat('s',512),'winner-fixture','winner-fixture',repeat('f',30)) then raise exception 'Enqueue is not idempotent';end if;
 begin perform * from public.qa_shared_analysis_jobs;raise exception 'FAILED secret read';exception when insufficient_privilege then null;end;
 begin update public.strategist_memory set markdown='forged';raise exception 'FAILED output write';exception when insufficient_privilege then null;end;
 if public.qa_analysis_status('qa-sample-astrorekha')::text like '%sealed_token%' then raise exception 'Status leaks token';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','10000000-0000-4000-8000-000000000011','x-immuvi-worker-token',repeat('s',64))::text,true);
set local role anon;
select public.qa_private_worker_heartbeat(true);
select public.qa_shared_analysis_heartbeat(true,false,true,true);
do $$ declare j jsonb;id uuid;lease uuid;begin
 j:=public.qa_analysis_claim();id:=(j->>'id')::uuid;lease:=(j->>'lease_id')::uuid;
 if id is distinct from '40000000-0000-4000-8000-000000000001'::uuid then raise exception 'Analysis claim failed';end if;
 if public.qa_analysis_claim() is not null or public.qa_shared_image_claim() is not null or public.qa_shared_inspiration_claim() is not null then raise exception 'Shared slot overlap';end if;
 begin perform public.qa_analysis_checkpoint(id,gen_random_uuid(),'heartbeat');raise exception 'FAILED forged lease';exception when insufficient_privilege then null;end;
 perform public.qa_analysis_checkpoint(id,lease,'start',jsonb_build_object('key','brief','identity',repeat('a',64)));
 begin perform public.qa_analysis_checkpoint(id,lease,'start',jsonb_build_object('key','brief','identity',repeat('a',64)));raise exception 'FAILED duplicate start';exception when others then if sqlerrm<>'Generation already started; recover saved output' then raise;end if;end;
 perform public.qa_analysis_checkpoint(id,lease,'unit',jsonb_build_object('key','brief','identity',repeat('a',64),'value',jsonb_build_object('markdown','fixture markdown')));
 perform public.qa_analysis_checkpoint(id,lease,'retry');
 perform set_config('fixture.analysis.lease',lease::text,true);
end$$;
reset role;
update public.qa_shared_analysis_jobs set next_attempt_at=now() where worker_id='10000000-0000-4000-8000-000000000011';
set local role anon;
do $$ declare j jsonb;id uuid;lease uuid;begin
 j:=public.qa_analysis_claim();id:=(j->>'id')::uuid;lease:=(j->>'lease_id')::uuid;
 if j->>'lease_id'=current_setting('fixture.analysis.lease') or j#>>'{units,brief,value,markdown}'<>'fixture markdown' then raise exception 'Recovery lost state';end if;
 begin perform public.qa_analysis_checkpoint(id,lease,'complete','{"verified":true}');raise exception 'FAILED premature completion';exception when others then if sqlerrm<>'Brief delivery is incomplete' then raise;end if;end;
 perform public.qa_analysis_checkpoint(id,lease,'page-start');
 perform public.qa_analysis_checkpoint(id,lease,'page','{"id":"qa-page"}');
 perform public.qa_analysis_checkpoint(id,lease,'complete','{"verified":true}');
 if public.qa_analysis_checkpoint(id,lease,'complete','{"verified":true}')<>'done' then raise exception 'Completion not idempotent';end if;
end$$;
reset role;
do $$begin
 if not exists(select 1 from public.variation_briefs where drive_file_id=repeat('f',30) and clickup_doc_page_url='https://app.clickup.com/9016762494/docs/8cq1r3y-44896/qa-page') then raise exception 'Winner brief not persisted';end if;
 if exists(select 1 from public.qa_shared_analysis_jobs where worker_id='10000000-0000-4000-8000-000000000011' and status='done' and sealed_token<>'') then raise exception 'Completed secret retained';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000002','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','strategist',repeat('s',512));
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb;id uuid;lease uuid;v jsonb;begin
 j:=public.qa_analysis_claim();id:=(j->>'id')::uuid;lease:=(j->>'lease_id')::uuid;
 if id is distinct from '40000000-0000-4000-8000-000000000002'::uuid then raise exception 'Strategist claim failed';end if;
 perform public.qa_analysis_checkpoint(id,lease,'start',jsonb_build_object('key','memory','identity',repeat('b',64)));
 v:=jsonb_build_object('json',jsonb_build_object('product_id','qa-sample-astrorekha'),'markdown','# Memory','rows','[]'::jsonb,'processed',0,'skipped',0);
 perform public.qa_analysis_checkpoint(id,lease,'unit',jsonb_build_object('key','memory','identity',repeat('b',64),'value',v));
 perform public.qa_analysis_checkpoint(id,lease,'complete');
end$$;
reset role;
do $$begin
 if not exists(select 1 from public.strategist_runs where status='done') or not exists(select 1 from public.strategist_memory where product_id='qa-sample-astrorekha' and markdown='# Memory') then raise exception 'Strategist persistence failed';end if;
end$$;
set local role anon;
select public.qa_private_runtime_heartbeat(true,false,true);
reset role;
do $$begin if exists(select 1 from public.qa_private_workers where id='10000000-0000-4000-8000-000000000011' and analysis_protocol<>0) then raise exception 'Rollback capability retained';end if;end$$;
-- Renewed authorization preserves the same run; only its original requester may
-- resume it. Expired credentials cannot authorize another external write.
set local role anon;
select public.qa_shared_analysis_heartbeat(true,false,true,true);
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000003','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','strategist',repeat('s',512));
reset role;
update public.qa_shared_analysis_jobs set expires_at=now()-interval '1 second' where id='40000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.qa_analysis_claim();
reset role;
do $$begin if not exists(select 1 from public.qa_shared_analysis_jobs where id='40000000-0000-4000-8000-000000000003' and status='failed' and sealed_token='') then raise exception 'Expired credential retained';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 begin perform public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000003','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','strategist',repeat('r',512));raise exception 'FAILED requester boundary';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_analysis_enqueue('40000000-0000-4000-8000-000000000003','qa-sample-astrorekha','10000000-0000-4000-8000-000000000011','strategist',repeat('r',512));
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$declare j jsonb;begin
 j:=public.qa_analysis_claim();perform set_config('fixture.analysis.lease',j->>'lease_id',true);
 if j->>'sealed_token'<>repeat('r',512) then raise exception 'Credential not renewed';end if;
end$$;
reset role;
update public.products set config=jsonb_set(config,'{clickup_list_id}','"production"') where id='qa-sample-astrorekha';
set local role anon;
do $$begin
 begin perform public.qa_analysis_checkpoint('40000000-0000-4000-8000-000000000003',current_setting('fixture.analysis.lease')::uuid,'heartbeat');raise exception 'FAILED destination drift';exception when insufficient_privilege then null;end;
end$$;
