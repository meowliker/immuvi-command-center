insert into public.products(id,name,config) values('qa-plan-smoke','Plan fixture','{}'),('qa-plan-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000054','plan-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000054','qa-plan-smoke');
insert into public.ads(id,product_id,format_name,status,meta,clickup_task_id) values
 ('qa-plan-ad','qa-plan-smoke','Brief','Untested','{}','synthetic-plan-task');
insert into public.manual_actions(id,product_id,live_status,payload) values
 ('00000000-0000-4000-8000-000000000055','qa-plan-smoke','Untested','{"sourceAdId":"qa-plan-ad","title":"Brief","_clickupId":"synthetic-plan-task"}'),
 ('00000000-0000-4000-8000-000000000056','qa-plan-smoke','Untested','{"title":"Standalone"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000054","role":"authenticated"}',true);
set local role authenticated;
do $$
declare items jsonb; saved jsonb; ad public.ads%rowtype; act public.manual_actions%rowtype; token uuid:=gen_random_uuid();
begin
 select * into ad from public.ads where id='qa-plan-ad';
 select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'ad_id',payload->>'sourceAdId','ad_updated_at',ad.updated_at) order by id) into items from public.manual_actions where product_id='qa-plan-smoke';
 begin
  perform public.qa_plan_batch('qa-plan-smoke',jsonb_set(items,'{1,updated_at}','"2000-01-01"'),'status','Testing'); raise exception 'FAILED stale action accepted';
 exception when others then if sqlerrm not like 'Action Plan changed.%' then raise; end if; end;
 if exists(select 1 from public.ads where id=ad.id and status<>'Untested') then raise exception 'Partial write from stale batch'; end if;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',jsonb_set(items,'{0,ad_updated_at}','"2000-01-01"'),'status','Testing'); raise exception 'FAILED stale ad accepted';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_batch('qa-plan-foreign',items,'status','Testing'); raise exception 'FAILED foreign product accepted';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',items||items,'remove',null); raise exception 'FAILED duplicate accepted';
 exception when others then if sqlerrm not like 'Duplicate task links%' then raise; end if; end;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',items,'due','2026-02-30'); raise exception 'FAILED invalid date accepted';
 exception when datetime_field_overflow then null; end;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',items,'status','not-a-status'); raise exception 'FAILED invalid status accepted';
 exception when others then if sqlerrm<>'Invalid workflow status' then raise; end if; end;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',jsonb_set(items,'{0,ad_id}','"wrong-ad"'),'status','Testing'); raise exception 'FAILED fuzzy identity accepted';
 exception when others then if sqlerrm<>'Action Plan source identity is unresolved' then raise; end if; end;
 saved:=public.qa_plan_batch('qa-plan-smoke',items,'status','Testing');
 if jsonb_array_length(saved)<>2 then raise exception 'Incomplete batch'; end if;
 if (select count(*) from public.manual_actions where product_id='qa-plan-smoke' and live_status='Testing' and launched_at is not null)<>2 then raise exception 'Status or milestone mirror failed'; end if;
 if not exists(select 1 from public.ads where id=ad.id and status='Testing' and meta->'_trackerPending'->>'status'='Testing') then raise exception 'Pending remote edit lost'; end if;
 if (select count(*) from public.activity_events where product_id='qa-plan-smoke' and event_type='status_changed')<>2 then raise exception 'Missing atomic activity'; end if;
 select * into ad from public.ads where id='qa-plan-ad';
 select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'ad_id',payload->>'sourceAdId','ad_updated_at',ad.updated_at) order by id) into items from public.manual_actions where product_id='qa-plan-smoke';
 perform public.qa_plan_batch('qa-plan-smoke',items,'due','2026-10-10');
 if (select count(*) from public.manual_actions where product_id='qa-plan-smoke' and payload->>'dueDate'='2026-10-10')<>2 then raise exception 'Due mirror failed'; end if;
 select * into ad from public.ads where id='qa-plan-ad';
 select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'ad_id',payload->>'sourceAdId','ad_updated_at',ad.updated_at) order by id) into items from public.manual_actions where product_id='qa-plan-smoke';
 perform public.qa_plan_batch('qa-plan-smoke',items,'due','');
 if exists(select 1 from public.manual_actions where product_id='qa-plan-smoke' and payload->>'dueDate'<>'') then raise exception 'Due clear failed'; end if;
 select * into ad from public.ads where id='qa-plan-ad';
 select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at,'ad_id',payload->>'sourceAdId','ad_updated_at',ad.updated_at) order by id) into items from public.manual_actions where product_id='qa-plan-smoke';
 -- The guards also block removal of a source with an unresolved external request.
 reset role;
 insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
 values(gen_random_uuid(),'qa-plan-smoke',ad.id,'00000000-0000-4000-8000-000000000055','1301130000002447','uncertain','{}',token,now());
 set local role authenticated;
 begin
  perform public.qa_plan_batch('qa-plan-smoke',items,'remove',null); raise exception 'FAILED unresolved creation removed';
 exception when others then if sqlerrm not like 'Recover unresolved%' then raise; end if; end;
 if (select count(*) from public.manual_actions where product_id='qa-plan-smoke')<>2 then raise exception 'Partial removal'; end if;
 reset role;
 delete from public.qa_clickup_creations where product_id='qa-plan-smoke';
 set local role authenticated;
 perform public.qa_plan_batch('qa-plan-smoke',items,'remove',null);
 if exists(select 1 from public.manual_actions where product_id='qa-plan-smoke') then raise exception 'Removal incomplete'; end if;
 if not exists(select 1 from public.ads where id=ad.id and deleted_at is null and clickup_task_id='synthetic-plan-task') then raise exception 'Removal deleted creative or remote link'; end if;
 if exists(select 1 from public.deleted_ads where product_id='qa-plan-smoke') then raise exception 'Removal wrote destructive tombstone'; end if;
 if (select count(*) from public.activity_events where product_id='qa-plan-smoke' and event_type='removed_from_plan')<>2 then raise exception 'Removal activity missing'; end if;
end $$;
reset role;
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000054';
set local role authenticated;
do $$ begin
 begin
  perform public.qa_plan_batch('qa-plan-smoke','[]','remove',null); raise exception 'FAILED inactive access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
end $$;
reset role;
