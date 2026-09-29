-- All fixture data must be executed inside a rollback transaction.
insert into auth.users(id,email,raw_app_meta_data) values
 ('10000000-0000-4000-8000-000000000001','shared-admin@example.test','{"must_change_password":false}'),
 ('10000000-0000-4000-8000-000000000002','shared-member@example.test','{"must_change_password":false}'),
 ('10000000-0000-4000-8000-000000000003','shared-outsider@example.test','{"must_change_password":false}');
update public.profiles set is_active=true,must_change_password=false,role=case when id='10000000-0000-4000-8000-000000000001' then 'admin' else 'member' end
 where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
insert into public.products(id,name,config) values('qa-sample-astrorekha','QA fixture','{"clickup_list_id":"1301130000002447","qa_brief_doc_id":"8cq1r3y-44896","qa_brief_tracker_page_id":"8cq1r3y-118036","qa_brief_visibility":"PUBLIC"}') on conflict(id) do nothing;
insert into public.user_products(user_id,product_id) values('10000000-0000-4000-8000-000000000002','qa-sample-astrorekha');
insert into public.qa_private_workers(id,owner_id,name,token_hash,heartbeat_at,classifier_available,delivery_public_key)
 values('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','Private fixture',encode(sha256(convert_to(repeat('p',64),'UTF8')),'hex'),now(),true,'test');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.qa_shared_worker_enroll('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001',encode(sha256(convert_to(repeat('s',64),'UTF8')),'hex'),'-----BEGIN PUBLIC KEY-----fixture');
reset role;
update public.qa_private_workers set enabled=true,heartbeat_at=now(),classifier_available=true where id='10000000-0000-4000-8000-000000000011';
insert into public.inspirations(id,product_id,url,status,data)
 select 'qa-shared-fixture-'||n,'qa-sample-astrorekha','https://www.instagram.com/p/test/','Blocked','{"_qaCreatedBy":"10000000-0000-4000-8000-000000000002"}' from generate_series(1,3) n;

insert into public.inspirations(id,product_id,url,status,data) values('qa-shared-admin-priority','qa-sample-astrorekha','https://www.instagram.com/p/admin-fixture/','Blocked','{"_qaCreatedBy":"10000000-0000-4000-8000-000000000001"}');
insert into public.qa_private_inspiration_jobs(id,product_id,inspiration_id,requested_by,worker_id,source_url,source_version,context,sealed_clickup_token)
select '10000000-0000-4000-8000-000000000023',product_id,id,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',url,updated_at,
'{"libraryDocId":"8cq1r3y-44896","libraryTrackerPageId":"8cq1r3y-118036","listId":"1301130000002447"}',repeat('a',512) from public.inspirations where id='qa-shared-admin-priority';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare workers jsonb; a jsonb; b jsonb; begin
 workers:=public.qa_inspiration_workers_list('qa-sample-astrorekha');
 if not exists(select 1 from jsonb_array_elements(workers) w where w->>'id'='10000000-0000-4000-8000-000000000011') then raise exception 'Member cannot see shared worker';end if;
 if exists(select 1 from jsonb_array_elements(workers) w where w->>'id'='10000000-0000-4000-8000-000000000010') then raise exception 'Member sees another private worker';end if;
 if public.qa_private_workers_list()<>'[]'::jsonb or workers::text like '%token_hash%' then raise exception 'Private isolation or credential leak';end if;
 begin perform public.qa_private_worker_set_enabled('10000000-0000-4000-8000-000000000010',false);raise exception 'FAILED private pause';exception when insufficient_privilege then null;end;
 begin perform public.qa_private_worker_set_enabled('10000000-0000-4000-8000-000000000011',false);raise exception 'FAILED shared nonadmin pause';exception when insufficient_privilege then null;end;
 begin perform public.qa_private_inspiration_enqueue(gen_random_uuid(),'qa-sample-astrorekha','qa-shared-fixture-1','10000000-0000-4000-8000-000000000010',repeat('a',512));raise exception 'FAILED private dispatch';exception when others then if sqlerrm<>'Your private classifier is offline or unavailable' then raise;end if;end;
 a:=public.qa_private_inspiration_enqueue('10000000-0000-4000-8000-000000000021','qa-sample-astrorekha','qa-shared-fixture-1','10000000-0000-4000-8000-000000000011',repeat('a',512));
 b:=public.qa_private_inspiration_enqueue('10000000-0000-4000-8000-000000000021','qa-sample-astrorekha','qa-shared-fixture-1','10000000-0000-4000-8000-000000000011',repeat('a',512));
 if a<>b then raise exception 'Non-idempotent queue acknowledgement';end if;
 perform public.qa_private_inspiration_enqueue('10000000-0000-4000-8000-000000000022','qa-sample-astrorekha','qa-shared-fixture-2','10000000-0000-4000-8000-000000000011',repeat('a',512));
 perform public.qa_private_inspiration_move('10000000-0000-4000-8000-000000000022','top');
 begin perform * from public.qa_private_inspiration_jobs;raise exception 'FAILED job credential access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_inspiration_workers_list('qa-sample-astrorekha');raise exception 'FAILED unauthorized product';exception when others then if sqlerrm not in ('Active product access is required','Product access denied') then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','10000000-0000-4000-8000-000000000011','x-immuvi-worker-token',repeat('s',64))::text,true);
set local role anon;
do $$ declare j jsonb; begin
 j:=public.qa_private_inspiration_claim();
 if j->>'id' is distinct from '10000000-0000-4000-8000-000000000022' then raise exception 'Shared priority/claim failed';end if;
 if public.qa_private_inspiration_claim() is not null then raise exception 'Shared capacity exceeded';end if;
 if public.qa_private_image_claim() is not null then raise exception 'Shared worker claimed paid image work';end if;
 perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'heartbeat');
 if not public.qa_private_inspiration_delivery_lock((j->>'id')::uuid,(j->>'lease_id')::uuid) then raise exception 'Shared delivery lock failed';end if;
 begin perform public.qa_private_inspiration_checkpoint((j->>'id')::uuid,gen_random_uuid(),'heartbeat');raise exception 'FAILED forged lease';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Simulate saved generation/known receipt: recovery must retain the same identity.
update public.qa_private_inspiration_jobs set status='failed',result='{"saved":"fixture"}',doc_id='8cq1r3y-44896',page_id='known-page',delivery_started=true where id='10000000-0000-4000-8000-000000000022';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_private_inspiration_retry_delivery('10000000-0000-4000-8000-000000000022','qa-sample-astrorekha','qa-shared-fixture-2','10000000-0000-4000-8000-000000000011',repeat('b',512));
reset role;
do $$ begin
 if not exists(select 1 from public.qa_private_inspiration_jobs where id='10000000-0000-4000-8000-000000000022' and status='pending' and page_id='known-page' and result='{"saved":"fixture"}'::jsonb) then raise exception 'Retry discarded saved generation/receipt';end if;
 if (select count(*) from public.qa_private_inspiration_jobs where inspiration_id='qa-shared-fixture-2')<>1 then raise exception 'Retry duplicated job';end if;
end $$;
