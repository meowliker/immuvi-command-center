insert into public.products(id,name,config) values('qa-edit-smoke','Edit fixture','{}'),('qa-edit-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000084','edit-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000084','qa-edit-smoke');
insert into public.angles(id,product_id,name) values('qa-edit-angle','qa-edit-smoke','New angle');
insert into public.personas(id,product_id,name) values('qa-edit-persona','qa-edit-smoke','New persona');
insert into public.ads(id,product_id,format_name,status,meta,clickup_task_id) values
 ('qa-edit-ad','qa-edit-smoke','Brief','Testing','{"notes":"Retain notes","_customFieldsRaw":{"other":0},"_trackerPending":{"old":"keep"}}','synthetic-edit-task');
insert into public.manual_actions(id,product_id,live_status,payload) values
 ('00000000-0000-4000-8000-000000000085','qa-edit-smoke','Testing','{"sourceAdId":"qa-edit-ad","title":"Brief","_clickupId":"synthetic-edit-task","description":"Retain brief"}'),
 ('00000000-0000-4000-8000-000000000086','qa-edit-smoke','Untested','{"title":"Standalone","description":"Keep"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000084","role":"authenticated"}',true);
set local role authenticated;
do $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; solo public.manual_actions%rowtype; saved jsonb; n integer;
  changes jsonb:='{"format_name":"Renamed","angle":"New angle","persona":"New persona","ad_type":"Photo","funnel_stage":"BOF","drive_link":"https://example.test/drive","meta":{"hookType":"Question","creativeHypothesis":"New hypothesis"}}';
begin
 select * into a from public.ads where id='qa-edit-ad';
 select * into act from public.manual_actions where id='00000000-0000-4000-8000-000000000085';
 select * into solo from public.manual_actions where id='00000000-0000-4000-8000-000000000086';
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,'2000-01-01',a.id,a.updated_at,changes); raise exception 'FAILED stale action accepted';
 exception when others then if sqlerrm not like 'Action Plan changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,'2000-01-01',changes); raise exception 'FAILED stale ad accepted';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-foreign',act.id,act.updated_at,a.id,a.updated_at,changes); raise exception 'FAILED foreign access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"status":"Winner"}'); raise exception 'FAILED workflow bypass';
 exception when others then if sqlerrm<>'Unsupported creative detail' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"meta":{"_clickupId":"another"}}'); raise exception 'FAILED metadata bypass';
 exception when others then if sqlerrm<>'Unsupported creative metadata' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"angle":"Foreign angle"}'); raise exception 'FAILED unknown taxonomy';
 exception when others then if sqlerrm<>'Select an existing product angle' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"drive_link":"javascript:alert(1)"}'); raise exception 'FAILED invalid link';
 exception when others then if sqlerrm<>'Invalid creative link' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,null,null,'{"format_name":"Wrong"}'); raise exception 'FAILED source bypass';
 exception when others then if sqlerrm<>'Link this action to its creative before editing' then raise; end if; end;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',solo.id,solo.updated_at,a.id,a.updated_at,changes); raise exception 'FAILED unresolved source';
 exception when others then if sqlerrm<>'Action Plan source identity is unresolved' then raise; end if; end;
 if exists(select 1 from public.activity_events where product_id='qa-edit-smoke') then raise exception 'Rejected edits left events'; end if;
 saved:=public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,changes);
 if saved->'ad'->>'format_name'<>'Renamed' or saved->'action'->'payload'->>'title'<>'Renamed' or saved->'action'->'payload'->>'sourceAngle'<>'New angle' or saved->'action'->'payload'->>'sourcePersona'<>'New persona' or saved->'action'->'payload'->>'adType'<>'Photo' then raise exception 'Creative mirrors failed'; end if;
 if saved->'ad'->'meta'->>'notes'<>'Retain notes' or saved->'action'->'payload'->>'description'<>'Retain brief' or saved->'ad'->'meta'->'_customFieldsRaw'->>'other'<>'0' then raise exception 'Unrelated fields lost'; end if;
 if saved->'ad'->'meta'->'_trackerPending'->>'old'<>'keep' or saved->'ad'->'meta'->'_trackerPending'->>'format_name'<>'Renamed' or saved->'ad'->'meta'->'_trackerPending'->>'hookType'<>'Question' then raise exception 'Pending edits lost'; end if;
 if saved->'ad'->>'status'<>'Testing' then raise exception 'Status changed'; end if;
 select count(*) into n from public.activity_events where product_id='qa-edit-smoke';
 if n<>8 then raise exception 'Incomplete history: %',n; end if;
 a:=jsonb_populate_record(a,saved->'ad'); act:=jsonb_populate_record(act,saved->'action');
 saved:=public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,changes);
 if (select count(*) from public.activity_events where product_id='qa-edit-smoke')<>n then raise exception 'No-op duplicated history'; end if;
 saved:=public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"angle":"","drive_link":"","meta":{"hookType":""}}');
 if saved->'ad'->'meta'->>'angle'<>'' or saved->'action'->'payload'->>'sourceAngle'<>'' or saved->'ad'->'meta'->>'driveLink'<>'' then raise exception 'Clear lost'; end if;
 a:=jsonb_populate_record(a,saved->'ad'); act:=jsonb_populate_record(act,saved->'action');
 saved:=public.qa_plan_creative('qa-edit-smoke',solo.id,solo.updated_at,null,null,'{"format_name":"Solo renamed"}');
 if saved->'action'->'payload'->>'title'<>'Solo renamed' or saved->'action'->'payload'->>'description'<>'Keep' then raise exception 'Standalone rename failed'; end if;
 reset role;
 insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
 values(gen_random_uuid(),'qa-edit-smoke',a.id,act.id,'1301130000002447','uncertain','{}',gen_random_uuid(),now());
 set local role authenticated;
 begin
  perform public.qa_plan_creative('qa-edit-smoke',act.id,act.updated_at,a.id,a.updated_at,changes); raise exception 'FAILED unresolved creation edited';
 exception when others then if sqlerrm not like 'Recover unresolved%' then raise; end if; end;
end $$;
reset role;
