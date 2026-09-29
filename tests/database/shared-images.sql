-- Executed locally with actual image/worker migrations, inside rollback.
reset role;
update public.qa_private_inspiration_jobs set status='failed' where worker_id='10000000-0000-4000-8000-000000000011';
update public.qa_private_workers set recovery_protocol=2,image_protocol=1,generation_available=true,heartbeat_at=now()-interval '1 hour' where id='10000000-0000-4000-8000-000000000011';
insert into public.ads(id,product_id,clickup_task_id) values('producer-fixture','qa-sample-astrorekha','qa-task');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare result jsonb;opts jsonb:='{"count":2,"instruction":"test","referenceUrl":"","offer":"","market":"","productName":"QA","forbiddenAliases":"","referenceIds":[]}';begin
 result:=public.qa_shared_image_enqueue('30000000-0000-4000-8000-000000000001','qa-sample-astrorekha','producer-fixture',opts,'10000000-0000-4000-8000-000000000011',repeat('s',512),'qa-task');
 if result->>'status'<>'pending' then raise exception 'Offline shared enqueue failed';end if;
 if result<>public.qa_shared_image_enqueue('30000000-0000-4000-8000-000000000001','qa-sample-astrorekha','producer-fixture',opts,'10000000-0000-4000-8000-000000000011',repeat('s',512),'qa-task') then raise exception 'Enqueue not idempotent';end if;
 if public.qa_private_workers_list()<>'[]'::jsonb then raise exception 'Private worker leak';end if;
 begin perform * from public.qa_shared_image_jobs;raise exception 'FAILED secrets readable';exception when insufficient_privilege then null;end;
 begin perform public.qa_generate_images(gen_random_uuid(),'qa-sample-astrorekha','producer-fixture',opts);raise exception 'FAILED unscoped routing';exception when others then if sqlerrm<>'Selected image worker is unavailable' then raise;end if;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','10000000-0000-4000-8000-000000000011','x-immuvi-worker-token',repeat('s',64))::text,true);
set local role anon;
select public.qa_private_worker_heartbeat(true);
select public.qa_shared_producer_heartbeat(true,false,true,true);
do $$ declare j jsonb;id uuid;lease uuid;begin
 if public.qa_private_image_claim() is not null then raise exception 'Old claim stole shared run';end if;
 j:=public.qa_shared_image_claim();id:=(j->>'id')::uuid;lease:=(j->>'lease_id')::uuid;
 if id is distinct from '30000000-0000-4000-8000-000000000001'::uuid then raise exception 'Shared image claim failed';end if;
 if public.qa_shared_image_claim() is not null then raise exception 'Image concurrency exceeded';end if;
 if public.qa_shared_inspiration_claim() is not null then raise exception 'Inspiration overlapped Producer';end if;
 begin perform public.qa_shared_image_checkpoint(id,gen_random_uuid(),'heartbeat');raise exception 'FAILED forged lease';exception when insufficient_privilege then null;end;
 perform public.qa_shared_image_checkpoint(id,lease,'generation-start','{"variation":1}');
 begin perform public.qa_shared_image_checkpoint(id,lease,'generation-start','{"variation":1}');raise exception 'FAILED repeated generation';exception when others then if sqlerrm<>'Generation already started; recover saved output' then raise;end if;end;
 begin perform public.qa_shared_image_checkpoint(id,lease,'generation-start','{"variation":2}');raise exception 'FAILED unordered generation';exception when others then if sqlerrm<>'Previous variation is not delivered' then raise;end if;end;
 perform set_config('fixture.image.lease',lease::text,true);
 perform set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','10000000-0000-4000-8000-000000000011','x-immuvi-worker-token',repeat('s',64),'x-immuvi-worker-lease',lease)::text,true);
 if not public.qa_shared_image_storage('qa-producer-images',id||'/1.png') then raise exception 'Shared upload denied';end if;
 if public.qa_shared_image_storage('qa-producer-images',id||'/3.png') then raise exception 'Out of count upload allowed';end if;
end$$;
reset role;
insert into storage.objects(bucket_id,name) values('qa-producer-images','30000000-0000-4000-8000-000000000001/1.png');
set local role anon;
do $$ declare id uuid:='30000000-0000-4000-8000-000000000001';lease uuid:=current_setting('fixture.image.lease')::uuid;o jsonb;begin
 o:=jsonb_build_object('variation',1,'filename','QA-1.png','path',id||'/1.png','bucket','qa-producer-images','sha256',repeat('a',64));
 perform public.qa_shared_image_checkpoint(id,lease,'output',o);
 perform public.qa_shared_image_checkpoint(id,lease,'output',o);
 begin perform public.qa_shared_image_checkpoint(id,lease,'output',o||'{"sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}');raise exception 'FAILED changed output';exception when others then if sqlerrm<>'Saved output changed' then raise;end if;end;
 perform public.qa_shared_image_checkpoint(id,lease,'attachment-start','{"variation":1,"before":[]}');
 perform public.qa_shared_image_checkpoint(id,lease,'attachment','{"variation":1,"id":"attachment-1","url":"https://example.test/1.png"}');
 perform public.qa_shared_image_checkpoint(id,lease,'attachment','{"variation":1,"id":"attachment-1","url":"https://example.test/1.png?renewed=yes"}');
 begin perform public.qa_shared_image_checkpoint(id,lease,'attachment','{"variation":1,"id":"other","url":"https://example.test/1.png"}');raise exception 'FAILED replaced attachment';exception when others then if sqlerrm<>'Attachment receipt changed' then raise;end if;end;
 perform public.qa_shared_image_checkpoint(id,lease,'retry');
 begin perform public.qa_shared_image_checkpoint(id,lease,'heartbeat');raise exception 'FAILED revoked retry lease';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.qa_shared_image_jobs set next_attempt_at=now() where id='30000000-0000-4000-8000-000000000001';
set local role anon;
do $$ declare j jsonb;begin
 j:=public.qa_shared_image_claim();
 if j#>>'{delivery,receipts,1,id}' is distinct from 'attachment-1' or jsonb_array_length(j#>'{delivery,outputs}')<>1 then raise exception 'Partial batch lost on recovery';end if;
 if j->>'lease_id'=current_setting('fixture.image.lease') then raise exception 'Lease not rotated';end if;
 perform public.qa_shared_image_checkpoint((j->>'id')::uuid,(j->>'lease_id')::uuid,'generation-start','{"variation":2}');
 perform set_config('fixture.image.lease',j->>'lease_id',true);
end$$;
reset role;
update public.products set config=jsonb_set(config,'{clickup_list_id}','"wrong"') where id='qa-sample-astrorekha';
set local role anon;
do $$ begin
 begin perform public.qa_shared_image_checkpoint('30000000-0000-4000-8000-000000000001',current_setting('fixture.image.lease')::uuid,'heartbeat');raise exception 'FAILED destination drift';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.products set config=jsonb_set(config,'{clickup_list_id}','"1301130000002447"') where id='qa-sample-astrorekha';
-- A complete batch publishes both UI status and ordered attachment receipts.
savepoint complete_batch;
insert into storage.objects(bucket_id,name) values('qa-producer-images','30000000-0000-4000-8000-000000000001/2.png');
set local role anon;
do $$ declare id uuid:='30000000-0000-4000-8000-000000000001';lease uuid:=current_setting('fixture.image.lease')::uuid;begin
 perform public.qa_shared_image_checkpoint(id,lease,'output',jsonb_build_object('variation',2,'filename','QA-2.png','path',id||'/2.png','bucket','qa-producer-images','sha256',repeat('b',64)));
 perform public.qa_shared_image_checkpoint(id,lease,'attachment-start','{"variation":2,"before":[]}');
 perform public.qa_shared_image_checkpoint(id,lease,'attachment','{"variation":2,"id":"attachment-2","url":"https://example.test/2.png"}');
 begin perform public.qa_shared_image_checkpoint(id,lease,'complete','{"status":"Ready to Launch"}');raise exception 'FAILED premature completion';exception when others then if sqlerrm<>'Delivery incomplete' then raise;end if;end;
 perform public.qa_shared_image_checkpoint(id,lease,'comment-start');
 perform public.qa_shared_image_checkpoint(id,lease,'comment','{"id":"comment-1"}');
 if public.qa_shared_image_checkpoint(id,lease,'complete','{"status":"Ready to Launch"}')<>'done' then raise exception 'Completion failed';end if;
 if public.qa_shared_image_checkpoint(id,lease,'complete','{"status":"Ready to Launch"}')<>'done' then raise exception 'Lost final acknowledgment not idempotent';end if;
end$$;
reset role;
do $$ begin
 if not exists(select 1 from public.qa_image_runs where id='30000000-0000-4000-8000-000000000001' and status='done' and outputs#>>'{0,id}'='attachment-1' and outputs#>>'{1,id}'='attachment-2') then raise exception 'Final receipts missing';end if;
 if not exists(select 1 from public.ads where id='producer-fixture' and status='Ready to Launch' and last_status_change_at>1000000000000) then raise exception 'UI status not published';end if;
 if exists(select 1 from public.qa_shared_image_jobs where id='30000000-0000-4000-8000-000000000001' and sealed_token<>'') then raise exception 'Completed credential retained';end if;
end$$;
rollback to savepoint complete_batch;
update public.qa_image_runs set lease_until=now()-interval '1 second' where id='30000000-0000-4000-8000-000000000001';
set local role anon;
select public.qa_shared_image_claim();
reset role;
do $$ begin
 if not exists(select 1 from public.qa_image_runs where id='30000000-0000-4000-8000-000000000001' and status='pending') then raise exception 'Expired run not recoverable';end if;
end$$;
update public.qa_shared_image_jobs set expires_at=now()-interval '1 second' where id='30000000-0000-4000-8000-000000000001';
set local role anon;
select public.qa_shared_image_claim();
reset role;
do $$ begin
 if not exists(select 1 from public.qa_shared_image_jobs where id='30000000-0000-4000-8000-000000000001' and sealed_token='') then raise exception 'Expired credential retained';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.qa_shared_image_retry('30000000-0000-4000-8000-000000000001','qa-sample-astrorekha','producer-fixture','10000000-0000-4000-8000-000000000011',repeat('r',512));raise exception 'FAILED nonrequester resume';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.qa_shared_image_retry('30000000-0000-4000-8000-000000000001','qa-sample-astrorekha','producer-fixture','10000000-0000-4000-8000-000000000011',repeat('r',512));
reset role;
do $$ begin
 if not exists(select 1 from public.qa_shared_image_jobs where id='30000000-0000-4000-8000-000000000001' and jsonb_array_length(outputs)=1 and started='[1,2]'::jsonb and receipts->'1'->>'id'='attachment-1' and sealed_token=repeat('r',512)) then raise exception 'Resume lost accepted work';end if;
end$$;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.qa_private_runtime_heartbeat(true,false,true);
reset role;
do $$ begin
 if exists(select 1 from public.qa_private_workers where id='10000000-0000-4000-8000-000000000011' and image_protocol<>0) then raise exception 'Rollback still advertises Producer';end if;
end$$;
