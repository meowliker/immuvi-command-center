insert into public.products(id,name,config) values('qa-create-smoke','Creation fixture','{"clickup_list_id":"1301130000002447"}'),('qa-create-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000044','creation-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000044','qa-create-smoke');
insert into public.ads(id,product_id,format_name,status,angle,persona,ad_type,funnel_stage,meta) values
 ('qa-create-ad','qa-create-smoke','Current brief','Untested','Target angle','Target persona','Video','TOF',
 '{"notes":"Brief notes","creativeHypothesis":"Own hypothesis","dueDate":"2026-10-01","_sourceWinnerFileUrl":"https://example.test/winner","_fromInspoId":"INS-007"}'),
 ('qa-create-foreign-ad','qa-create-foreign','Foreign brief','Untested','','','Video','TOF','{}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000044","role":"authenticated"}',true);
set local role authenticated;
do $$
declare a public.ads%rowtype; act jsonb; again jsonb; job jsonb; payload jsonb;
  product_version timestamptz; request_id uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); recovery uuid:=gen_random_uuid();
begin
 select * into a from public.ads where id='qa-create-ad';
 select updated_at into product_version from public.products where id='qa-create-smoke';
 act:=public.qa_plan_stage('qa-create-smoke',a.id,a.updated_at);
 again:=public.qa_plan_stage('qa-create-smoke',a.id,a.updated_at);
 if act->>'id' is distinct from again->>'id' then raise exception 'Staging duplicated an action'; end if;
 if act->'payload'->>'sourceAdId'<>a.id or act->'payload'->>'sourceAngle'<>'Target angle' or act->'payload'->>'dueDate'<>'2026-10-01'
   or act->'payload'->>'description'<>'Brief notes' then raise exception 'Action Plan payload lost cell or brief'; end if;
 begin
  perform public.qa_plan_stage('qa-create-smoke',a.id,'2000-01-01'); raise exception 'FAILED stale staging accepted';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_stage('qa-create-foreign','qa-create-foreign-ad',a.updated_at); raise exception 'FAILED foreign product accepted';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 payload:=jsonb_build_object('name',a.format_name,'description','Full brief'||chr(10)||'IMMUVI_QA_JOB:'||request_id::text,'custom_fields','[]'::jsonb);
 begin
  perform public.qa_creation_claim('qa-create-smoke',a.id,request_id,token,a.updated_at,product_version,'2000-01-01',payload); raise exception 'FAILED stale action accepted';
 exception when others then if sqlerrm not like 'Action Plan changed.%' then raise; end if; end;
 job:=public.qa_creation_claim('qa-create-smoke',a.id,request_id,token,a.updated_at,product_version,(act->>'updated_at')::timestamptz,payload);
 if job->>'state'<>'sending' then raise exception 'Creation was not claimed'; end if;
 if not exists(select 1 from public.qa_clickup_creations where product_id='qa-create-smoke' and ad_id=a.id) then raise exception 'Authorized outbox read failed'; end if;
 begin
  update public.qa_clickup_creations set state='linked' where id=(job->>'id')::uuid; raise exception 'FAILED direct outbox update allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.qa_creation_claim('qa-create-smoke',a.id,request_id,recovery,a.updated_at,product_version,(act->>'updated_at')::timestamptz,payload); raise exception 'FAILED overlapping claim accepted';
 exception when others then if sqlerrm not like 'Creation is still in progress.%' then raise; end if; end;
 begin
  update public.ads set format_name='Changed during create' where id=a.id; raise exception 'FAILED source edit accepted';
 exception when others then if sqlerrm not like 'ClickUp creation is unresolved.%' then raise; end if; end;
 begin
  delete from public.manual_actions where id=(act->>'id')::uuid; raise exception 'FAILED source removal accepted';
 exception when others then if sqlerrm not like 'ClickUp creation is unresolved.%' then raise; end if; end;
 job:=public.qa_creation_record('qa-create-smoke',request_id,token,'uncertain',null,'Synthetic timeout');
 job:=public.qa_creation_claim('qa-create-smoke',a.id,request_id,recovery,a.updated_at,product_version,(act->>'updated_at')::timestamptz,null);
 if job->>'state'<>'uncertain' or job->'payload'<>payload then raise exception 'Uncertain request became a new create'; end if;
 begin
  perform public.qa_creation_record('qa-create-smoke',request_id,token,'created','stale-owner',null); raise exception 'FAILED stale lease accepted';
 exception when others then if sqlerrm not like 'Creation lease changed.%' then raise; end if; end;
 begin
  perform public.qa_creation_record('qa-create-smoke',request_id,recovery,'rejected',null,'Unsafe reset'); raise exception 'FAILED uncertain request reset';
 exception when others then if sqlerrm not like 'An uncertain create cannot%' then raise; end if; end;
 job:=public.qa_creation_record('qa-create-smoke',request_id,recovery,'created','synthetic-remote',null);
 insert into public.deleted_ads(id,product_id,clickup_task_id,format_name,reason) values('qa-create-tombstone','qa-create-smoke','synthetic-remote','Fixture','Test');
 begin
  perform public.qa_creation_finish('qa-create-smoke',request_id,recovery); raise exception 'FAILED tombstoned task linked';
 exception when others then if sqlerrm<>'A tombstone prevents linking this task' then raise; end if; end;
 if exists(select 1 from public.ads where id=a.id and clickup_task_id is not null) or exists(select 1 from public.qa_clickup_creations where id=(job->>'id')::uuid and state='linked') then raise exception 'Failed finalize partially committed'; end if;
 delete from public.deleted_ads where id='qa-create-tombstone';
 job:=public.qa_creation_finish('qa-create-smoke',request_id,recovery);
 again:=public.qa_creation_finish('qa-create-smoke',request_id,recovery);
 if job->>'state'<>'linked' or again->>'state'<>'linked' then raise exception 'Finalize not idempotent'; end if;
 if not exists(select 1 from public.ads where id=a.id and clickup_task_id='synthetic-remote' and meta->>'dueDate'='2026-10-01' and meta->>'notes'='Brief notes') then raise exception 'Creative link lost fields'; end if;
 if not exists(select 1 from public.manual_actions m where m.id=(act->>'id')::uuid and m.payload->>'_clickupId'='synthetic-remote' and m.payload->>'sourceAdId'=a.id) then raise exception 'Action was not linked atomically'; end if;
 if (select count(*) from public.activity_events where product_id='qa-create-smoke' and event_type='pushed_to_clickup')<>1 then raise exception 'Finalize duplicated activity'; end if;
 select * into a from public.ads where id='qa-create-ad';
 select to_jsonb(m) into act from public.manual_actions m where id=(act->>'id')::uuid;
 begin
  perform public.qa_plan_edit('qa-create-smoke',(act->>'id')::uuid,(act->>'updated_at')::timestamptz,a.id,'2000-01-01','Testing',null);
  raise exception 'FAILED stale linked edit accepted';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 if exists(select 1 from public.manual_actions where product_id='qa-create-smoke' and live_status='Testing') then raise exception 'Failed edit partially changed Action Plan'; end if;
 again:=public.qa_plan_edit('qa-create-smoke',(act->>'id')::uuid,(act->>'updated_at')::timestamptz,a.id,a.updated_at,'Testing',null);
 if again->'action'->>'live_status'<>'Testing' or again->'ad'->>'status'<>'Testing' or again->'ad'->'meta'->'_trackerPending'->>'status'<>'Testing'
   or again->'action'->>'launched_at' is null then raise exception 'Atomic status mirror or durable pending field failed'; end if;
 act:=again->'action';a:=jsonb_populate_record(a,again->'ad');
 again:=public.qa_plan_edit('qa-create-smoke',(act->>'id')::uuid,(act->>'updated_at')::timestamptz,a.id,a.updated_at,null,'');
 if again->'action'->'payload'->>'dueDate'<>'' or again->'ad'->'meta'->>'dueDate'<>'' or again->'ad'->'meta'->'_trackerPending'->>'dueDate'<>'' then raise exception 'Due date clear was not retained atomically'; end if;
 update public.ads set meta=meta||'{"notes":"Editing unlocked"}' where id=a.id;
end $$;
reset role;

-- A user without the product cannot read the new durable workflow table.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000045","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.qa_clickup_creations where product_id='qa-create-smoke') then raise exception 'Outbox RLS leaked another product'; end if;
end $$;
reset role;
