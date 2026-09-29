insert into public.products(id,name,config) values('qa-recovery-fixture','Recovery fixture','{"ins_prefix":"QRC"}'),('qa-recovery-foreign','Foreign fixture','{"ins_prefix":"FRN"}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000241','recovery-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000241','qa-recovery-fixture');
insert into public.inspirations(id,product_id,url,title,status,data) values
 ('QRC-INS-900','qa-recovery-fixture','https://example.test/duplicate','Existing','Saved','{}'),
 ('FOREIGN-RECORD','qa-recovery-foreign','https://example.test/foreign','Foreign','Saved','{}');
insert into public.inspiration_queue(ins_id,product_id,url,status,attempts,queued_at,processed_at,claimed_by,claimed_at,error_message) values
 ('QRC-INS-001','qa-recovery-fixture','https://example.test/recover','failed',4,'2026-09-01','2026-09-02','old-worker','2026-09-01','Historical failure'),
 ('QRC-INS-002','qa-recovery-fixture','https://example.test/active','classifying',1,'2026-09-01',null,'worker','2026-09-01',null),
 ('QRC-INS-003','qa-recovery-fixture','https://example.test/duplicate/#','failed',1,'2026-09-01',null,null,null,null),
 ('QRC-INS-004','qa-recovery-fixture','https://example.test/deleted','failed',1,'2026-09-01',null,null,null,null),
 ('FRN-INS-007','qa-recovery-fixture','https://example.test/wrong-prefix','failed',1,'2026-09-01',null,null,null,null),
 ('FOREIGN-RECORD','qa-recovery-fixture','https://example.test/id-collision','failed',1,'2026-09-01',null,null,null,null),
 ('AMBIGUOUS','qa-recovery-fixture','https://example.test/ambiguous','failed',1,'2026-09-01',null,null,null,null),
 ('AMBIGUOUS','qa-recovery-foreign','https://example.test/other','failed',1,'2026-09-01',null,null,null,null),
 ('QRC-INS-005','qa-recovery-fixture','javascript:alert(1)','failed',1,'2026-09-01',null,null,null,null);
insert into public.qa_inspiration_receipts(request_id,product_id,user_id,request,response) values(gen_random_uuid(),'qa-recovery-fixture','00000000-0000-4000-8000-000000000241','{"operation":"delete","id":"QRC-INS-004"}','{}');
insert into public.inspiration_results(ins_id,product_id,source_url,classified_at,brief) values('QRC-INS-001','qa-recovery-fixture','https://example.test/recover','2026-09-03','{"why_it_works":"Preserve saved result"}');
insert into public.ads(id,product_id,format_name,status,meta) values('qa-recovered-child','qa-recovery-fixture','Existing child','Winner','{"_fromInspoId":"QRC-INS-001"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000241","role":"authenticated"}',true);
set local role authenticated;
do $$
declare q public.inspiration_queue%rowtype; snapshot jsonb; req uuid:=gen_random_uuid(); result jsonb; replay jsonb; original_result jsonb; original_ad jsonb; check_id text; message text; script jsonb; full_brief jsonb;
begin
 select * into q from public.inspiration_queue where ins_id='QRC-INS-001';snapshot:=to_jsonb(q);
 select to_jsonb(r) into original_result from public.inspiration_results r where ins_id=q.ins_id;
 select to_jsonb(a) into original_ad from public.ads a where id='qa-recovered-child';
 begin perform public.qa_inspiration_recover('qa-recovery-foreign',req,q.id,snapshot);raise exception 'FAILED access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin perform public.qa_inspiration_recover('qa-recovery-fixture',req,q.id,snapshot||'{"attempts":0}');raise exception 'FAILED stale';
 exception when others then if sqlerrm not like 'Queue changed.%' then raise; end if; end;
 if exists(select 1 from public.inspirations where id=q.ins_id) then raise exception 'Rejected request created source'; end if;
 result:=public.qa_inspiration_recover('qa-recovery-fixture',req,q.id,snapshot);
 if result->>'dispatchEnabled'<>'false' or result->'row'->>'id'<>q.ins_id or result->'row'->>'status'<>'Blocked' or result->'row'->'data'->'_qaRecoveredQueue'<>snapshot
   or (result->'row'->>'created_at')::timestamptz<>q.queued_at or result->'queue'->>'worker_assignment'<>'blocked:qa-isolation' or result->'queue'->>'status'<>'blocked'
   or result->'queue'->>'attempts'<>'4' or (result->'queue'->>'queued_at')::timestamptz<>q.queued_at or (result->'queue'->>'processed_at')::timestamptz<>q.processed_at
   or result->'queue'->>'claimed_by' is not null then raise exception 'Recovery changed history or became claimable'; end if;
 replay:=public.qa_inspiration_recover('qa-recovery-fixture',req,q.id,snapshot);
 if replay<>result then raise exception 'Lost response was not replayed'; end if;
 begin perform public.qa_inspiration_recover('qa-recovery-fixture',req,q.id,snapshot||'{"attempts":2}');raise exception 'FAILED receipt conflict';
 exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
 begin perform public.qa_inspiration_recover('qa-recovery-fixture',gen_random_uuid(),q.id,result->'queue');raise exception 'FAILED duplicate recovery';
 exception when others then if sqlerrm not like 'Source identity already exists.%' then raise; end if; end;
 if original_result<>(select to_jsonb(r) from public.inspiration_results r where ins_id=q.ins_id) or original_ad<>(select to_jsonb(a) from public.ads a where id='qa-recovered-child') then raise exception 'Downstream data changed'; end if;
 for check_id,message in select * from (values
   ('QRC-INS-002','Only terminal or blocked queue entries can be recovered'),
   ('QRC-INS-003','This source URL already has a library record. Recovery cannot merge identities.'),
   ('QRC-INS-004','This inspiration was explicitly deleted. Recovery cannot restore it.'),
   ('FRN-INS-007','Source prefix is ambiguous or belongs to another product'),
   ('FOREIGN-RECORD','Source identity already exists. Refresh the library.'),
   ('AMBIGUOUS','Source identity is ambiguous across products'),
   ('QRC-INS-005','Queue source URL is invalid')) checks(id,message) loop
   select * into q from public.inspiration_queue where product_id='qa-recovery-fixture' and ins_id=check_id;
   begin perform public.qa_inspiration_recover('qa-recovery-fixture',gen_random_uuid(),q.id,to_jsonb(q));raise exception 'FAILED guard: %',check_id;
   exception when others then if sqlerrm<>message then raise; end if; end;
 end loop;
 -- Recovery makes existing guarded mutations available without implicitly running them.
 select * into q from public.inspiration_queue where ins_id='QRC-INS-001';
 begin perform public.qa_inspiration_mutate('qa-recovery-fixture',gen_random_uuid(),'import',q.ins_id,(result->'row'->>'updated_at')::timestamptz,jsonb_build_object('queue',to_jsonb(q),'result_id',original_result->>'id','result_at',original_result->>'classified_at'));raise exception 'FAILED incomplete result';
 exception when others then if sqlerrm not like 'Classification is incomplete:%' then raise; end if; end;
 script:='{"variation":"Test","intent":"Test","hook_text":"Test","source_format_match":"Test","voice_over_script":"Test","cta":"Test","what_to_change":"Test","why_it_should_work":"Test","script_breakdown":[{"time":"0:00"}]}';
 full_brief:=jsonb_build_object('frame_by_frame',jsonb_build_array(jsonb_build_object('time','0:00')),'why_it_works','Keep','replication_brief','Keep','what_to_test','Keep','competitor_intel','Keep','our_next_ad','Keep','inspiration_script_skeleton','Keep','next_ad_scripts',jsonb_build_array(script,script,script));
 reset role;
 update public.inspiration_results set classification='{"hook_type":"Question","creative_structure":"Demo","production_style":"UGC","funnel_type":"TOF","persona":"Source persona","angle":"Source angle","creative_usp":"Recovered classification","creative_hypothesis":"Keep"}',brief=full_brief where ins_id=q.ins_id;
 set local role authenticated;
 result:=public.qa_inspiration_mutate('qa-recovery-fixture',gen_random_uuid(),'import',q.ins_id,(result->'row'->>'updated_at')::timestamptz,
   jsonb_build_object('queue',to_jsonb(q),'result_id',original_result->>'id','result_at',original_result->>'classified_at',
     'children',jsonb_build_array(jsonb_build_object('id',original_ad->>'id','version',original_ad->>'updated_at'))));
 if result->'row'->>'status'<>'Classified' or result->'row'->'data'->'_qaRecoveredQueue'<>snapshot then raise exception 'Recovery prevented explicit result import or lost audit history'; end if;
 select * into q from public.inspiration_queue where ins_id='QRC-INS-001';
 replay:=public.qa_inspiration_mutate('qa-recovery-fixture',gen_random_uuid(),'requeue',q.ins_id,(result->'row'->>'updated_at')::timestamptz,jsonb_build_object('queue',to_jsonb(q)));
 if replay->'queue'->>'attempts'<>'0' or replay->'queue'->>'status'<>'blocked' then raise exception 'Recovered record cannot use guarded retry'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.qa_inspiration_recover(text,uuid,uuid,jsonb)','EXECUTE') then raise exception 'Anonymous recovery allowed'; end if;
end $$;
