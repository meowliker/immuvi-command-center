insert into public.products(id,name,config) values('qa-production-fixture','Production fixture','{}'),('qa-production-foreign','Foreign fixture','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000244','production-fixture@example.test','{"must_change_password":false}'),('00000000-0000-4000-8000-000000000245','production-other@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000244','qa-production-fixture'),('00000000-0000-4000-8000-000000000245','qa-production-fixture');
insert into public.angles(id,product_id,name) values('qa-production-angle','qa-production-fixture','Energy');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000244","role":"authenticated"}',true);
set local role authenticated;
do $$
declare req uuid:=gen_random_uuid(); saved jsonb; payload jsonb:='{"format_name":"Production test","angle":"Energy","persona":"","ad_type":"Video","funnel_stage":"TOF","ad_link":"https://example.test/source","drive_link":"","meta":{"dueDate":"","_dueDateMs":null,"notes":"Preserved notes","creativeHypothesis":"Literal brief"}}'; before_count integer;
begin
 begin perform public.qa_production_create('qa-production-foreign',req,payload);raise exception 'FAILED access';
 exception when others then if sqlerrm<>'Active product access is required' then raise;end if;end;
 begin perform public.qa_production_create('qa-production-fixture',req,jsonb_set(payload,'{angle}','"Foreign axis"'));raise exception 'FAILED taxonomy';
 exception when others then if sqlerrm<>'Select an active product angle' then raise;end if;end;
 begin perform public.qa_production_create('qa-production-fixture',req,payload||'{"clickup_task_id":"bad"}');raise exception 'FAILED protected';
 exception when others then if sqlerrm<>'Unsupported production field' then raise;end if;end;
 begin perform public.qa_production_create('qa-production-fixture',req,jsonb_set(payload,'{meta,dueDate}','"2026-02-30"'));raise exception 'FAILED date';
 exception when datetime_field_overflow then null;end;
 if exists(select 1 from public.ads where product_id='qa-production-fixture') then raise exception 'Invalid requests wrote a creative';end if;
 saved:=public.qa_production_create('qa-production-fixture',req,payload);
 if saved->>'requestId'<>req::text or saved->'action'->'payload'->>'sourceAdId'<>saved->'ad'->>'id'
   or saved->'ad'->>'status'<>'Untested' or saved->'ad'->'meta'->>'notes'<>'Preserved notes'
   or saved->'ad'->'meta'->>'taskType'<>'production' or saved->'ad'->>'clickup_task_id' is not null then raise exception 'Creation contract failed';end if;
 if public.qa_production_create('qa-production-fixture',req,payload)<>saved then raise exception 'Receipt replay failed';end if;
 if (select count(*) from public.ads where product_id='qa-production-fixture')<>1 or (select count(*) from public.manual_actions where product_id='qa-production-fixture')<>1 then raise exception 'Creation was not exactly once';end if;
 begin perform public.qa_production_create('qa-production-fixture',req,jsonb_set(payload,'{format_name}','"Changed"'));raise exception 'FAILED collision';
 exception when others then if sqlerrm<>'Production request identity conflicts with a previous save' then raise;end if;end;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000245","role":"authenticated"}',true);
 begin perform public.qa_production_create('qa-production-fixture',req,payload);raise exception 'FAILED owner';
 exception when others then if sqlerrm<>'Production request identity conflicts with a previous save' then raise;end if;end;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000244","role":"authenticated"}',true);
 perform public.qa_tracker_delete('qa-production-fixture',saved->'ad'->>'id',(saved->'ad'->>'updated_at')::timestamptz);
 if public.qa_production_create('qa-production-fixture',req,payload)<>saved or exists(select 1 from public.manual_actions where product_id='qa-production-fixture')
   or exists(select 1 from public.ads where product_id='qa-production-fixture' and deleted_at is null) then raise exception 'Receipt resurrected deleted rows';end if;
end $$;
reset role;
-- Force staging to fail after the creative insert; the wrapper must roll back both.
create function pg_temp.reject_production_stage() returns trigger language plpgsql as $$ begin raise exception 'Synthetic staging failure';end $$;
create trigger qa_production_rollback_test before insert on public.manual_actions for each row execute function pg_temp.reject_production_stage();
set local role authenticated;
do $$ declare before_count integer;begin
 select count(*) into before_count from public.ads where product_id='qa-production-fixture';
 begin perform public.qa_production_create('qa-production-fixture',gen_random_uuid(),'{"format_name":"Atomic","meta":{"dueDate":"","_dueDateMs":null}}');raise exception 'FAILED rollback';
 exception when others then if sqlerrm<>'Synthetic staging failure' then raise;end if;end;
 if (select count(*) from public.ads where product_id='qa-production-fixture')<>before_count then raise exception 'Partial creation survived';end if;
end $$;
reset role;
drop trigger qa_production_rollback_test on public.manual_actions;
do $$ begin
 if has_function_privilege('anon','public.qa_production_create(text,uuid,jsonb)','EXECUTE') then raise exception 'Anonymous access';end if;
 if has_table_privilege('authenticated','public.qa_production_creations','INSERT') or has_table_privilege('authenticated','public.qa_production_creations','UPDATE') then raise exception 'Receipt writes exposed';end if;
end $$;
