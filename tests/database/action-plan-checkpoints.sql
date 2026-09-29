insert into public.products(id,name,config) values('qa-review-smoke','Review fixture','{}'),('qa-review-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000091','review-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000091','qa-review-smoke');
insert into public.ads(id,product_id,format_name,status,created_at,updated_at,last_status_change_at,meta,clickup_task_id)
 values('qa-review-ad','qa-review-smoke','Testing fixture','Testing',now()-interval '40 days',now()-interval '8 days',(extract(epoch from now()-interval '8 days')*1000)::bigint,
 '{"notes":"Keep","_trackerPending":{"old":"keep"}}','synthetic-review-task');
insert into public.manual_actions(id,product_id,live_status,payload,updated_at)
 values('00000000-0000-4000-8000-000000000092','qa-review-smoke','Testing','{"adId":"qa-review-ad","_clickupId":"synthetic-review-task","description":"Keep brief"}',now()-interval '8 days');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
set local role authenticated;
do $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; result jsonb; decision text; old_ms bigint;
begin
 select * into a from public.ads where id='qa-review-ad';
 select * into act from public.manual_actions where id='00000000-0000-4000-8000-000000000092';
 begin
  perform public.qa_plan_checkpoint('qa-review-foreign',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED foreign access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,'2000-01-01',a.id,a.updated_at,'snooze'); raise exception 'FAILED stale action';
 exception when others then if sqlerrm not like 'Action Plan changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,'2000-01-01','snooze'); raise exception 'FAILED stale creative';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Untested'); raise exception 'FAILED unsupported decision';
 exception when others then if sqlerrm<>'Invalid testing decision' then raise; end if; end;
 old_ms:=a.last_status_change_at;
 result:=public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze');
 if result->'ad'->>'status'<>'Testing' or (result->'ad'->>'testing_defer_count')::int<>1
   or (result->'ad'->>'last_status_change_at')::bigint<>old_ms or result->'ad'->'meta'->>'notes'<>'Keep'
   or result->'ad'->'meta'->'_trackerPending'->>'old'<>'keep' or result->'action'->'payload'->>'description'<>'Keep brief'
   then raise exception 'Snooze modified unrelated fields'; end if;
 if (select count(*) from public.activity_events where product_id='qa-review-smoke' and event_type='testing_deferred')<>1 then raise exception 'Snooze history missing'; end if;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED stale retry';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 a:=jsonb_populate_record(a,result->'ad'); act:=jsonb_populate_record(act,result->'action');
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED second snooze';
 exception when others then if sqlerrm not like 'Testing review is not due.%' then raise; end if; end;
 reset role;
 update public.ads set status='testing',format_name='Same status edit' where id=a.id returning * into a;
 if a.testing_defer_count<>1 or a.testing_deferred_at is null then raise exception 'Same-status edit reset snooze'; end if;
 update public.ads set testing_deferred_at=(extract(epoch from now()-interval '8 days')*1000)::bigint where id=a.id returning * into a;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED final snooze';
 exception when others then if sqlerrm<>'Testing can only be snoozed once at the first review' then raise; end if; end;
 foreach decision in array array['Winner','Mild Winner','Scale','Loser'] loop
  result:=public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,decision);
  if result->'ad'->>'status'<>decision or result->'action'->>'live_status'<>decision
    or result->'ad'->'meta'->'_trackerPending'->>'status'<>decision
    or (result->'ad'->>'testing_defer_count')::int<>0 or result->'ad'->>'testing_deferred_at' is not null
    or result->'ad'->'meta'->>'testingDeferredAt' is not null then raise exception 'Decision/reset/mirror failed'; end if;
  a:=jsonb_populate_record(a,result->'ad'); act:=jsonb_populate_record(act,result->'action');
  begin
   perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED terminal decision';
  exception when others then if sqlerrm<>'Creative is no longer Testing' then raise; end if; end;
  result:=public.qa_plan_edit('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Testing',null);
  a:=jsonb_populate_record(a,result->'ad'); act:=jsonb_populate_record(act,result->'action');
  begin
   perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED early snooze';
  exception when others then if sqlerrm not like 'Testing review is not due.%' then raise; end if; end;
  reset role;
  update public.ads set last_status_change_at=(extract(epoch from now()-interval '15 days')*1000)::bigint where id=a.id returning * into a;
  set local role authenticated;
 end loop;
 reset role;
 update public.ads set last_status_change_at=(extract(epoch from now()-interval '8 days')*1000)::bigint,
   meta=meta||jsonb_build_object('_customFieldsRaw',jsonb_build_object('launch date',(extract(epoch from now()-interval '1 day')*1000)::bigint)) where id=a.id returning * into a;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED recent launch ignored';
 exception when others then if sqlerrm not like 'Testing review is not due.%' then raise; end if; end;
 reset role;
 update public.ads set meta=meta-'_customFieldsRaw' where id=a.id returning * into a;
 insert into public.ads(id,product_id,format_name,status,last_status_change_at) select 'qa-review-extra-'||n,'qa-review-smoke','Pollution fixture','Untested',a.last_status_change_at from generate_series(1,4) n;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'snooze'); raise exception 'FAILED polluted clock ignored';
 exception when others then if sqlerrm<>'Testing can only be snoozed once at the first review' then raise; end if; end;
 reset role;
 delete from public.ads where id like 'qa-review-extra-%';
 insert into public.manual_actions(id,product_id,live_status,payload) values('00000000-0000-4000-8000-000000000093','qa-review-smoke','Testing','{"adId":"qa-review-ad"}');
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED duplicate source';
 exception when others then if sqlerrm<>'Duplicate task links must be resolved before testing review' then raise; end if; end;
 reset role;
 delete from public.manual_actions where id='00000000-0000-4000-8000-000000000093';
 update public.ads set meta=meta||'{"_productBoundaryQuarantined":true}' where id=a.id returning * into a;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED quarantine';
 exception when others then if sqlerrm<>'Creative is unavailable' then raise; end if; end;
 reset role;
 update public.ads set meta=meta-'_productBoundaryQuarantined',deleted_at=now() where id=a.id returning * into a;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED deleted creative';
 exception when others then if sqlerrm<>'Creative is unavailable' then raise; end if; end;
 reset role;
 update public.ads set deleted_at=null where id=a.id returning * into a;
 insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
  values(gen_random_uuid(),'qa-review-smoke',a.id,act.id,'1301130000002447','uncertain','{}',gen_random_uuid(),now());
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED unresolved creation';
 exception when others then if sqlerrm not like 'Recover unresolved%' then raise; end if; end;
 reset role;
 delete from public.qa_clickup_creations where product_id='qa-review-smoke';
 update public.manual_actions set payload=payload||'{"adId":"wrong"}' where id=act.id returning * into act;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED source identity';
 exception when others then if sqlerrm<>'Action Plan source identity is unresolved' then raise; end if; end;
 reset role;
 update public.manual_actions set payload=payload||'{"adId":"qa-review-ad","_clickupId":"wrong"}' where id=act.id returning * into act;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED task identity';
 exception when others then if sqlerrm<>'Action Plan task identity conflicts with the creative' then raise; end if; end;
 reset role;
 update public.manual_actions set payload=payload||'{"_clickupId":"synthetic-review-task","_clickupTaskDeleted":true}' where id=act.id returning * into act;
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED deleted task';
 exception when others then if sqlerrm<>'Deleted creative cannot be reviewed' then raise; end if; end;
 reset role;
 update public.profiles set is_active=false where id=auth.uid();
 set local role authenticated;
 begin
  perform public.qa_plan_checkpoint('qa-review-smoke',act.id,act.updated_at,a.id,a.updated_at,'Winner'); raise exception 'FAILED inactive access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
end $$;
reset role;
