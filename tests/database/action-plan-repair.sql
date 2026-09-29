insert into public.products(id,name,config) values('qa-repair-smoke','Repair fixture','{"clickup_list_id":"1301130000002447"}'),('qa-repair-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000101','repair-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000101','qa-repair-smoke');
insert into public.ads(id,product_id,format_name,status,clickup_task_id,meta)
 values('qa-repair-ad','qa-repair-smoke','Repair creative','Testing','old-task','{"_clickupId":"old-task","clickupTaskId":"old-task","_clickupTaskDeleted":true,"notes":"Keep notes"}');
insert into public.manual_actions(id,product_id,live_status,payload)
 values('00000000-0000-4000-8000-000000000102','qa-repair-smoke','Testing','{"sourceAdId":"qa-repair-ad","_clickupId":"old-task","clickupTaskId":"old-task","_clickupTaskDeleted":true,"description":"Keep brief"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',true);
set local role authenticated;
do $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; p public.products%rowtype; r jsonb; jid uuid:=gen_random_uuid(); token uuid:=gen_random_uuid();
begin
 select * into a from public.ads where id='qa-repair-ad';
 select * into act from public.manual_actions where id='00000000-0000-4000-8000-000000000102';
 select * into p from public.products where id='qa-repair-smoke';
 begin
  perform public.qa_plan_repair('qa-repair-foreign',a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task','old-task',null,null,null,null); raise exception 'FAILED foreign';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_plan_repair(p.id,a.id,'2000-01-01',act.id,act.updated_at,p.updated_at,'old-task','old-task',null,null,null,null); raise exception 'FAILED stale ad';
 exception when others then if sqlerrm not in ('Creative changed. Reopen repair.','Creative task identity changed') then raise; end if; end;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,'2000-01-01',p.updated_at,'old-task','old-task',null,null,null,null); raise exception 'FAILED stale action';
 exception when others then if sqlerrm<>'Action Plan changed. Reopen repair.' then raise; end if; end;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,'2000-01-01','old-task','old-task',null,null,null,null); raise exception 'FAILED stale product';
 exception when others then if sqlerrm<>'Product settings changed. Reopen repair.' then raise; end if; end;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,null,null,p.updated_at,'old-task','old-task',null,null,null,null); raise exception 'FAILED virtual conflict';
 exception when others then if sqlerrm<>'Action Plan changed. Reopen repair.' then raise; end if; end;
 r:=public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task','old-task',null,null,null,null);
 a:=jsonb_populate_record(a,r->'ad'); act:=jsonb_populate_record(act,r->'action');
 if a.meta->>'_clickupTaskDeleted'<>'false' or act.payload->>'_clickupTaskDeleted'<>'false' or a.meta->>'notes'<>'Keep notes'
   or act.payload->>'description'<>'Keep brief' or act.payload->'_history'->0->>'type'<>'relinked'
   or a.status<>'Testing' or exists(select 1 from public.deleted_ads where product_id=p.id) then raise exception 'Restore changed unrelated state'; end if;
 reset role;
 insert into public.ads(id,product_id,format_name,clickup_task_id) values('qa-repair-conflict',p.id,'Other','new-task');
 set local role authenticated;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task','new-task',null,null,null,null); raise exception 'FAILED duplicate';
 exception when others then if sqlerrm<>'Another record owns this task identity' then raise; end if; end;
 reset role;
 delete from public.ads where id='qa-repair-conflict';
 insert into public.deleted_ads(id,product_id,clickup_task_id) values('qa-repair-tomb',p.id,'new-task');
 set local role authenticated;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task','new-task',null,null,null,null); raise exception 'FAILED tombstone';
 exception when others then if sqlerrm<>'A deletion tombstone blocks repair' then raise; end if; end;
 reset role;
 delete from public.deleted_ads where id='qa-repair-tomb';
 set local role authenticated;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task',null,null,jid,token,'{}'); raise exception 'FAILED invalid payload';
 exception when others then if sqlerrm<>'Invalid recreation claim' then raise; end if; end;
 r:=public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task',null,null,jid,token,
   jsonb_build_object('name',a.format_name,'description','IMMUVI_QA_JOB:'||jid::text));
 if r->'job'->>'state'<>'sending' or r->'ad'->>'clickup_task_id' is not null or r->'action'->'payload'->>'_clickupId' is not null
   or r->'ad'->'meta'->>'clickupTaskId' is not null or r->'ad'->'meta'->>'_qaRecreationJobId'<>jid::text then raise exception 'Prepare was not atomic'; end if;
 if not exists(select 1 from public.deleted_ads where product_id=p.id and clickup_task_id='old-task' and id<>a.id) then raise exception 'Retired task can reimport'; end if;
 begin
  perform public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'old-task',null,null,gen_random_uuid(),gen_random_uuid(),r->'job'->'payload'); raise exception 'FAILED concurrent replacement';
 exception when others then if sqlerrm not in ('Creative changed. Reopen repair.','Creative task identity changed') then raise; end if; end;
 a:=jsonb_populate_record(a,r->'ad'); act:=jsonb_populate_record(act,r->'action');
 begin
  perform public.qa_tracker_delete(p.id,a.id,a.updated_at); raise exception 'FAILED unresolved guard';
 exception when others then if sqlerrm not like 'ClickUp creation is unresolved.%' then raise; end if; end;
 perform public.qa_creation_record(p.id,jid,token,'created','new-task',null);
 perform public.qa_creation_finish(p.id,jid,token);
 select * into a from public.ads where id=a.id;
 select * into act from public.manual_actions where id=act.id;
 if a.clickup_task_id<>'new-task' or act.payload->>'_clickupId'<>'new-task' or a.meta->>'notes'<>'Keep notes' or act.payload->>'description'<>'Keep brief' then raise exception 'Replacement lost fields'; end if;
 -- The next generation preserves the prior job in audit history.
 begin
  r:=public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'new-task',null,jid,gen_random_uuid(),gen_random_uuid(),
    jsonb_build_object('name',a.format_name,'description','invalid marker'));
  raise exception 'FAILED marker validation';
 exception when others then if sqlerrm<>'Invalid recreation claim' then raise; end if; end;
 token:=gen_random_uuid();
 r:=public.qa_plan_repair(p.id,a.id,a.updated_at,act.id,act.updated_at,p.updated_at,'new-task',null,jid,token,gen_random_uuid(),
   jsonb_build_object('name',a.format_name,'description','IMMUVI_QA_JOB:'||token::text));
 if r->'job'->>'id'=jid::text or not exists(select 1 from public.activity_events where product_id=p.id and metadata->'previous_creation'->>'id'=jid::text)
   then raise exception 'Previous generation was not archived'; end if;
end $$;
reset role;
-- A virtual task stages only on explicit repair, not on inspection.
insert into public.ads(id,product_id,format_name,clickup_task_id) values('qa-repair-virtual','qa-repair-smoke','Virtual repair','virtual-task');
set local role authenticated;
do $$
declare a public.ads%rowtype; p public.products%rowtype; r jsonb;
begin
 select * into a from public.ads where id='qa-repair-virtual'; select * into p from public.products where id='qa-repair-smoke';
 r:=public.qa_plan_repair(p.id,a.id,a.updated_at,null,null,p.updated_at,'virtual-task','virtual-task',null,null,null,null);
 if r->'action'->'payload'->>'sourceAdId'<>a.id or r->'action'->>'id' is null then raise exception 'Virtual repair failed'; end if;
end $$;
reset role;
