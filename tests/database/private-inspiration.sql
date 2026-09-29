insert into public.products(id,name,config) values('qa-insp-fixture','Private inspiration fixture','{"clickup_list_id":"1301130000002447"}');
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000091','insp-a@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000092','insp-b@example.test','{"must_change_password":false}');
update public.profiles set role='admin' where id in ('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092');
insert into public.inspirations(id,product_id,url,status,data) values
 ('qa-insp-a','qa-insp-fixture','https://www.facebook.com/ads/library/?id=2199245117340297','Blocked','{"_qaCreatedBy":"00000000-0000-4000-8000-000000000091"}');
insert into public.qa_private_workers(id,owner_id,name,token_hash,heartbeat_at,classifier_available,generation_available,delivery_public_key) values
 ('00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000091','A',encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex'),now(),true,true,'test'),
 ('00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000092','B',encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex'),now(),true,true,'test');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_enqueue(gen_random_uuid(),'qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED foreign worker enqueue';
 exception when others then if sqlerrm<>'Your private classifier is offline or unavailable' then raise; end if;end;
 begin perform public.qa_private_inspiration_enqueue(gen_random_uuid(),'qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000094',repeat('a',512));raise exception 'FAILED foreign inspiration enqueue';
 exception when others then if sqlerrm<>'Only your own QA inspirations can use your private worker' then raise; end if;end;
 begin perform * from public.qa_private_inspiration_jobs;raise exception 'FAILED secret access';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Successful publication uses the legacy projection and preserves unrelated
-- fields. The worker cannot finalize without both durable document receipts.
insert into public.inspirations(id,product_id,url,status,data) values
 ('qa-insp-complete','qa-insp-fixture','https://www.facebook.com/ads/library/?id=2199245117340297','Blocked','{"_qaCreatedBy":"00000000-0000-4000-8000-000000000091","keepMe":"unchanged"}');
insert into public.qa_private_inspiration_jobs(id,product_id,inspiration_id,requested_by,worker_id,status,source_url,source_version,context,sealed_clickup_token,lease_id,lease_until)
 select '00000000-0000-4000-8000-000000000096',product_id,id,'00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093','running',url,updated_at,'{"platform":"Facebook","listId":"1301130000002447"}',repeat('a',512),'00000000-0000-4000-8000-000000000097',now()+interval '2 minutes'
 from public.inspirations where id='qa-insp-complete';
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000093','x-immuvi-worker-token',repeat('a',64))::text,true);
set local role anon;
do $$ declare value jsonb;script jsonb;begin
 script:=jsonb_build_object('variation','Test','intent','Test','hook_text','Test','source_format_match','Test','voice_over_script','Test','cta','Test','what_to_change','Test','why_it_should_work','Test','script_breakdown',jsonb_build_array(jsonb_build_object('time','0:00-0:03')));
 value:=jsonb_build_object('metadata','{"page_name":"Test brand","body_text":"Actual caption","media_kind":"image","voice_over":"No voice over","headline":"Headline","cta_text":"Shop now","caption_timeline":[]}'::jsonb,
 'classification','{"hook_type":"Curiosity","creative_structure":"Demo","production_style":"Static Graphic","funnel_type":"TOF","persona":"Test persona","angle":"Test angle","creative_usp":"Test format","creative_hypothesis":"Test hypothesis","media_kind":"image","photo_video":"Photo","voice_over":"No voice over"}'::jsonb,
 'brief',jsonb_build_object('why_it_works','Test','replication_brief','Test','what_to_test','Test','competitor_intel','Test','our_next_ad','Test','inspiration_script_skeleton','Test','frame_by_frame',jsonb_build_array(jsonb_build_object('time','0:00-0:03')),'next_ad_scripts',jsonb_build_array(script,script,script)),
 'duration_seconds',0,'frames_extracted',1);
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','result',value);
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','delivery-start');
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','doc','{"id":"test-doc"}');
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','page','{"id":"test-page"}');
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','complete');
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000096','00000000-0000-4000-8000-000000000097','complete');
end $$;
reset role;
do $$ declare i public.inspirations;r public.inspiration_results;projected jsonb;begin
 select * into i from public.inspirations where id='qa-insp-complete';
 if i.status<>'Classified' or i.data->>'keepMe'<>'unchanged' or i.data->>'bodyCopy'<>'Actual caption' or i.data->>'adType'<>'Photo'
 or i.data->>'_clickupDocPageUrl'<>'https://app.clickup.com/9016762494/docs/test-doc/test-page' then raise exception 'Legacy projection incomplete';end if;
 if (select count(*) from public.inspiration_results where ins_id=i.id)<>1 then raise exception 'Duplicate result';end if;
 if (select sealed_clickup_token from public.qa_private_inspiration_jobs where inspiration_id=i.id)<>'' then raise exception 'Completed job retained token';end if;
 select * into r from public.inspiration_results where ins_id=i.id;
 r.metadata:=r.metadata||'{"voice_over":"","voice_over_timeline":[],"audio_verification":{"status":"unverified"}}'::jsonb;
 r.classification:=r.classification||'{"voice_over":"","notes":"Narration uncertain; brief uses verified visible captions."}'::jsonb;
 r.brief:=r.brief||'{"voice_over":"","voice_over_timeline":[]}'::jsonb;
 projected:=public.qa_inspiration_import_data(r);
 if projected->>'voiceOver' is distinct from '' or jsonb_array_length(projected->'voiceOverTimeline')<>0 then
   raise exception 'Uncertain narration must remain blank, not guessed or rejected';
 end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
set local role authenticated;
select public.qa_private_inspiration_enqueue('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));
select public.qa_private_inspiration_enqueue('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));
do $$ begin
 if (select count(*) from jsonb_array_elements(public.qa_private_inspiration_status('qa-insp-fixture')) j where j->>'inspiration_id'='qa-insp-a')<>1 then raise exception 'Duplicate queue entry';end if;
 if public.qa_private_inspiration_status('qa-insp-fixture')::text like '%sealed_clickup_token%' then raise exception 'Secret leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000094','x-immuvi-worker-token',repeat('b',64))::text,true);
set local role anon;
do $$ begin if public.qa_private_inspiration_claim() is not null then raise exception 'Foreign claim';end if;end $$;
reset role;
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000093','x-immuvi-worker-token',repeat('a',64))::text,true);
set local role anon;
do $$ declare j jsonb;begin
 j:=public.qa_private_inspiration_claim();
 if j->>'id' is distinct from '00000000-0000-4000-8000-000000000095' then raise exception 'Own claim failed';end if;
 if public.qa_private_inspiration_claim() is not null then raise exception 'Duplicate claim';end if;
 if public.qa_private_image_claim() is not null then raise exception 'Cross-kind concurrency';end if;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'heartbeat');
 begin perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'complete');raise exception 'FAILED incomplete publication';
 exception when others then if sqlerrm<>'Missing verified result or document receipt' then raise;end if;end;
 begin perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,gen_random_uuid(),'heartbeat');raise exception 'FAILED forged lease';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.qa_private_inspiration_jobs set lease_until=now()-interval '1 minute',delivery_started=true where id='00000000-0000-4000-8000-000000000095';
set local role anon;
do $$ begin if public.qa_private_inspiration_claim() is not null then raise exception 'Interrupted generation replayed';end if;end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_enqueue(gen_random_uuid(),'qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED duplicate document risk';
 exception when others then if sqlerrm<>'Saved generation or delivery requires recovery, not a new generation' then raise;end if;end;
end $$;
reset role;
