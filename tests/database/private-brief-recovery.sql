-- Reuse rollback-only fixtures from private-inspiration.sql.
update public.qa_private_inspiration_jobs set result=(select result from public.qa_private_inspiration_jobs where id='00000000-0000-4000-8000-000000000096') where id='00000000-0000-4000-8000-000000000095';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED ambiguous retry';
 exception when others then if sqlerrm<>'Delivery receipt requires review' then raise;end if;end;
end $$;
reset role;
update public.qa_private_inspiration_jobs set status='running',lease_until=now()+interval '2 minutes' where id='00000000-0000-4000-8000-000000000095';
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000093','x-immuvi-worker-token',repeat('a',64))::text,true);
-- A worker lease must be read by the test harness, never by the anonymous role.
select set_config('test.lease',(select lease_id::text from public.qa_private_inspiration_jobs where id='00000000-0000-4000-8000-000000000095'),true);
set local role anon;
do $$ begin
 begin perform public.qa_private_inspiration_delivery_rejected('00000000-0000-4000-8000-000000000095',gen_random_uuid(),403,'');raise exception 'FAILED forged receipt';exception when insufficient_privilege then null;end;
 begin perform public.qa_private_inspiration_delivery_rejected('00000000-0000-4000-8000-000000000095',current_setting('test.lease')::uuid,503,'');raise exception 'FAILED uncertain rejection';
 exception when others then if sqlerrm<>'Delivery receipt requires review' then raise;end if;end;
 perform public.qa_private_inspiration_delivery_rejected('00000000-0000-4000-8000-000000000095',current_setting('test.lease')::uuid,403,'PERMISSION_DENIED');
 perform public.qa_private_inspiration_checkpoint('00000000-0000-4000-8000-000000000095',current_setting('test.lease')::uuid,'failed','{"error":"ClickUp create Doc failed (403)."}');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED foreign retry';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
update public.products set config=jsonb_set(config,'{clickup_list_id}','"production"') where id='qa-insp-fixture';
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED production retry';
 exception when others then if sqlerrm<>'Only the approved ClickUp test list is allowed' then raise;end if;end;
end $$;
reset role;
update public.products set config='{"clickup_list_id":"1301130000002447","qa_brief_visibility":"PUBLIC"}' where id='qa-insp-fixture';
update public.qa_private_inspiration_jobs set source_version=source_version-interval '1 second' where id='00000000-0000-4000-8000-000000000095';
set local role authenticated;
do $$ begin
 begin perform public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));raise exception 'FAILED changed source';
 exception when others then if sqlerrm<>'Inspiration changed; review the saved brief before delivery' then raise;end if;end;
end $$;
reset role;
update public.qa_private_inspiration_jobs set source_version=(select updated_at from public.inspirations where id='qa-insp-a') where id='00000000-0000-4000-8000-000000000095';
select set_config('test.brief_number',(select brief_number::text from public.qa_private_inspiration_jobs where id='00000000-0000-4000-8000-000000000095'),true);
set local role authenticated;
select public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));
select public.qa_private_inspiration_retry_delivery('00000000-0000-4000-8000-000000000095','qa-insp-fixture','qa-insp-a','00000000-0000-4000-8000-000000000093',repeat('a',512));
reset role;
do $$ declare j public.qa_private_inspiration_jobs;begin
 select * into j from public.qa_private_inspiration_jobs where id='00000000-0000-4000-8000-000000000095';
 if j.result is null or j.brief_number::text<>current_setting('test.brief_number') or j.status<>'pending' or j.context->>'docVisibility'<>'PUBLIC' or j.delivery_started or j.lease_id is not null then raise exception 'Recovery lost result, number, policy or fencing';end if;
 if j.delivery_rejection->>'status'<>'403' then raise exception 'Rejection receipt lost';end if;
end $$;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ declare j jsonb;begin
 j:=public.qa_private_inspiration_claim();
 if j->'result' is null or j->>'id'<>'00000000-0000-4000-8000-000000000095' then raise exception 'Recovery did not reuse the saved result';end if;
end $$;
reset role;
