insert into public.products(id,name) values('qa-private-fixture','Private worker fixture');
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000081','private-a@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000082','private-b@example.test','{"must_change_password":false}');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000082';
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000081','qa-private-fixture');
insert into public.ads(id,product_id,format_name,meta) values('qa-private-ad','qa-private-fixture','Fixture','{}');
insert into public.qa_private_workers(id,owner_id,name,token_hash,heartbeat_at,generation_available) values
 ('00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000081','Private A',encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex'),now(),true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.qa_private_workers_list()<>'[]'::jsonb then raise exception 'Another admin can see private worker'; end if;
 begin perform public.qa_private_worker_set_enabled('00000000-0000-4000-8000-000000000083',false); raise exception 'FAILED foreign pause';
 exception when insufficient_privilege then null; end;
 begin perform public.qa_generate_images(gen_random_uuid(),'qa-private-fixture','qa-private-ad','{}'); raise exception 'FAILED foreign enqueue';
 exception when others then if sqlerrm<>'Your private image worker is offline or paused' then raise; end if; end;
 begin perform * from public.qa_private_workers; raise exception 'FAILED credential read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
set local role authenticated;
do $$ declare opts jsonb:='{"count":1,"instruction":"test","referenceUrl":"","referenceIds":[],"productName":"Fixture","offer":"","market":"","forbiddenAliases":""}'; r public.qa_image_runs; begin
 if jsonb_array_length(public.qa_private_workers_list())<>1 or public.qa_private_workers_list()::text like '%token_hash%' then raise exception 'Owner listing failed'; end if;
 r:=public.qa_generate_images('00000000-0000-4000-8000-000000000085','qa-private-fixture','qa-private-ad',opts);
 if r.private_worker_id<>'00000000-0000-4000-8000-000000000083' or r.requested_by<>auth.uid() then raise exception 'Owner binding failed'; end if;
 perform public.qa_generate_images(r.id,'qa-private-fixture','qa-private-ad',opts);
 if (select count(*) from public.qa_image_runs where id=r.id)<>1 then raise exception 'Duplicate request'; end if;
 perform public.qa_private_worker_set_enabled(r.private_worker_id,false);
 begin perform public.qa_generate_images(gen_random_uuid(),'qa-private-fixture','qa-private-ad',opts); raise exception 'FAILED paused enqueue';
 exception when others then if sqlerrm<>'Your private image worker is offline or paused' then raise; end if; end;
 perform public.qa_private_worker_set_enabled(r.private_worker_id,true);
end $$;
reset role;
insert into public.qa_private_workers(id,owner_id,name,token_hash,heartbeat_at,generation_available) values
 ('00000000-0000-4000-8000-000000000084','00000000-0000-4000-8000-000000000082','Private B',encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex'),now(),true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000083','x-immuvi-worker-token',repeat('b',64))::text,true);
set local role anon;
do $$ begin
 begin perform public.qa_private_image_claim(); raise exception 'FAILED forged token'; exception when insufficient_privilege then null; end;
 begin perform * from public.qa_image_runs; raise exception 'FAILED device table access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000084','x-immuvi-worker-token',repeat('b',64))::text,true);
set local role anon;
do $$ begin
 if public.qa_private_image_claim() is not null then raise exception 'Foreign worker claimed owner A job'; end if;
end $$;
reset role;
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000083','x-immuvi-worker-token',repeat('a',64))::text,true);
set local role anon;
do $$ declare r jsonb; h jsonb; begin
 perform public.qa_private_worker_heartbeat(true);
 r:=public.qa_private_image_claim();
 if r->>'id' is distinct from '00000000-0000-4000-8000-000000000085' then raise exception 'Own job was not claimed'; end if;
 if public.qa_private_image_claim() is not null then raise exception 'Duplicate claim'; end if;
 if public.qa_private_image_renew((r->>'id')::uuid,gen_random_uuid()) then raise exception 'Wrong lease renewed'; end if;
 if not public.qa_private_image_renew((r->>'id')::uuid,(r->>'lease_id')::uuid) then raise exception 'Lease renewal failed'; end if;
 h:=current_setting('request.headers')::jsonb||jsonb_build_object('x-immuvi-worker-lease',r->>'lease_id');
 perform set_config('request.headers',h::text,true);
 if public.qa_private_image_upload('qa-producer-images',r->>'id'||'/2.png') or public.qa_private_image_upload('other',r->>'id'||'/1.png')
   or public.qa_private_image_upload('qa-producer-images','00000000-0000-4000-8000-000000000086/1.png') then raise exception 'Upload scope escaped'; end if;
 begin insert into storage.objects(bucket_id,name) values('qa-producer-images',r->>'id'||'/2.png'); raise exception 'FAILED out-of-scope storage write';
 exception when insufficient_privilege then null; end;
 begin perform public.qa_private_image_finish((r->>'id')::uuid,(r->>'lease_id')::uuid,'[]'); raise exception 'FAILED partial batch';
 exception when others then if sqlerrm<>'Invalid image outputs' then raise; end if; end;
 insert into storage.objects(bucket_id,name) values('qa-producer-images',r->>'id'||'/1.png');
 if public.qa_private_image_finish((r->>'id')::uuid,(r->>'lease_id')::uuid,jsonb_build_array(jsonb_build_object('path',r->>'id'||'/1.png','bucket','qa-producer-images')))<>'done' then raise exception 'Finalization failed'; end if;
 if public.qa_private_image_finish((r->>'id')::uuid,(r->>'lease_id')::uuid,'[]','Response lost')<>'done' then raise exception 'Retry overwrote success'; end if;
 if public.qa_private_image_upload('qa-producer-images',r->>'id'||'/1.png') then raise exception 'Finished job still has upload access'; end if;
end $$;
reset role;
-- Defense in depth: even a malformed server-side assignment cannot make this Mac
-- consume another user's job. Old/unassigned Auto jobs are also excluded.
insert into public.ads(id,product_id,format_name,meta) values('qa-private-ad-2','qa-private-fixture','Fixture 2','{}'),('qa-private-ad-3','qa-private-fixture','Fixture 3','{}');
insert into public.qa_image_runs(id,product_id,ad_id,requested_by,private_worker_id,request) values
 ('00000000-0000-4000-8000-000000000086','qa-private-fixture','qa-private-ad-2','00000000-0000-4000-8000-000000000082','00000000-0000-4000-8000-000000000083','{}'),
 ('00000000-0000-4000-8000-000000000087','qa-private-fixture','qa-private-ad-3','00000000-0000-4000-8000-000000000081',null,'{}');
set local role anon;
do $$ begin
 if public.qa_private_image_claim() is not null then raise exception 'Worker accepted another owner or unassigned job'; end if;
end $$;
reset role;
update public.qa_image_runs set requested_by='00000000-0000-4000-8000-000000000081',status='running',lease_id=gen_random_uuid(),lease_until=now()-interval '1 minute'
 where id='00000000-0000-4000-8000-000000000086';
set local role anon;
do $$ begin if public.qa_private_image_claim() is not null then raise exception 'Interrupted generation replayed'; end if; end $$;
reset role;
do $$ begin if (select status from public.qa_image_runs where id='00000000-0000-4000-8000-000000000086')<>'failed' then raise exception 'Interrupted run not failed'; end if; end $$;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000081';
set local role anon;
do $$ begin
 begin perform public.qa_private_worker_heartbeat(true); raise exception 'FAILED inactive owner'; exception when insufficient_privilege then null; end;
end $$;
reset role;
