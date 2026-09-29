insert into public.inspirations(id,product_id,url,status,data)
select 'qa-priority-'||n,'qa-insp-fixture','https://www.instagram.com/p/test/','Blocked','{"_qaCreatedBy":"00000000-0000-4000-8000-000000000091"}'::jsonb from generate_series(1,3) n;
insert into public.qa_private_inspiration_jobs(id,product_id,inspiration_id,requested_by,worker_id,source_url,source_version,context,sealed_clickup_token)
select gen_random_uuid(),product_id,id,'00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093',url,updated_at,'{"libraryDocId":"priority-test","listId":"1301130000002447"}',repeat('a',512)
from public.inspirations where id like 'qa-priority-%' order by id;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
set local role authenticated;
do $$ declare rows jsonb; target uuid; begin
 rows:=public.qa_private_inspiration_status('qa-insp-fixture');
 select (j->>'id')::uuid into target from jsonb_array_elements(rows) j where j->>'inspiration_id'='qa-priority-3';
 perform public.qa_private_inspiration_move(target,'top');
 perform public.qa_private_inspiration_move(target,'down');
 perform public.qa_private_inspiration_move(target,'up');
 begin perform public.qa_private_inspiration_move(target,'invalid'); raise exception 'FAILED invalid direction';
 exception when others then if sqlerrm<>'Invalid queue direction' then raise; end if; end;
end $$;
reset role;
do $$ declare names text[]; begin
 select array_agg(inspiration_id order by priority,created_at,id) into names from public.qa_private_inspiration_jobs where inspiration_id like 'qa-priority-%';
 if names<>array['qa-priority-3','qa-priority-1','qa-priority-2'] then raise exception 'Queue move order wrong: %',names; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
do $$ declare target uuid; begin
 select id into target from public.qa_private_inspiration_jobs where inspiration_id='qa-priority-3';
 begin perform public.qa_private_inspiration_move(target,'top'); raise exception 'FAILED foreign priority'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.headers',jsonb_build_object('x-immuvi-worker-id','00000000-0000-4000-8000-000000000093','x-immuvi-worker-token',repeat('a',64))::text,true);
set local role anon;
do $$ declare first jsonb; second jsonb; third jsonb; begin
 first:=public.qa_private_inspiration_claim();second:=public.qa_private_inspiration_claim();
 if first->>'inspiration_id' is distinct from 'qa-priority-3' or second->>'inspiration_id' is distinct from 'qa-priority-1' then raise exception 'Priority not respected by claims'; end if;
 if public.qa_private_inspiration_claim() is not null then raise exception 'Exceeded two parallel jobs'; end if;
 if public.qa_private_image_claim() is not null then raise exception 'Images must not overlap classification'; end if;
 perform public.qa_private_inspiration_checkpoint((first->>'id')::uuid,(first->>'lease_id')::uuid,'heartbeat');
 perform public.qa_private_inspiration_checkpoint((second->>'id')::uuid,(second->>'lease_id')::uuid,'heartbeat');
 if not public.qa_private_inspiration_delivery_lock((first->>'id')::uuid,(first->>'lease_id')::uuid) then raise exception 'First delivery lock failed'; end if;
 if public.qa_private_inspiration_delivery_lock((second->>'id')::uuid,(second->>'lease_id')::uuid) then raise exception 'Concurrent library delivery allowed'; end if;
 begin perform public.qa_private_inspiration_delivery_lock((first->>'id')::uuid,gen_random_uuid());raise exception 'FAILED forged delivery lease';
 exception when others then if sqlerrm<>'Worker job lease expired or denied' then raise; end if;end;
 perform public.qa_private_inspiration_checkpoint((first->>'id')::uuid,(first->>'lease_id')::uuid,'failed','{"error":"fixture"}');
 if not public.qa_private_inspiration_delivery_lock((second->>'id')::uuid,(second->>'lease_id')::uuid) then raise exception 'Delivery lock not released after failure'; end if;
 third:=public.qa_private_inspiration_claim();
 if third->>'inspiration_id' is distinct from 'qa-priority-2' then raise exception 'Available slot did not claim next'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
do $$ declare target uuid; begin
 select id into target from public.qa_private_inspiration_jobs where inspiration_id='qa-priority-1';
 begin perform public.qa_private_inspiration_move(target,'top'); raise exception 'FAILED running move';
 exception when others then if sqlerrm<>'Task has already started or is no longer queued. Refresh the queue.' then raise; end if;end;
end $$;
