insert into public.products(id,name,config) values('qa-fields-smoke','Fields fixture','{"clickup_sync":{"mappings":{"angle":"mapped-angle"}}}'),('qa-fields-foreign','Foreign','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000064','fields-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000064','qa-fields-smoke');
insert into public.ads(id,product_id,format_name,status,meta,clickup_task_id) values
 ('qa-fields-ad','qa-fields-smoke','Brief','Untested','{"notes":"Retain brief","assignees":[{"id":7}],"_customFieldsRaw":{"other":"Keep"}}','synthetic-fields-task');
insert into public.manual_actions(id,product_id,live_status,payload) values
 ('00000000-0000-4000-8000-000000000065','qa-fields-smoke','Untested','{"sourceAdId":"qa-fields-ad","title":"Brief","_clickupId":"synthetic-fields-task"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000064","role":"authenticated"}',true);
set local role authenticated;
do $$
declare a public.ads%rowtype; act public.manual_actions%rowtype; saved jsonb;
  changes jsonb:='{"__task_assignees":{"name":"Task assignees","type":"users","value":[8,9],"display":"Editor A, Editor B"},"review":{"name":"Reviewer","type":"users","value":[10],"display":"Reviewer A"},"score":{"name":"Score","type":"number","value":0},"check":{"name":"Checked","type":"checkbox","value":false}}';
begin
 select * into a from public.ads where id='qa-fields-ad';
 select * into act from public.manual_actions where id='00000000-0000-4000-8000-000000000065';
 begin
  perform public.qa_plan_fields('qa-fields-smoke',act.id,'2000-01-01',a.id,a.updated_at,changes); raise exception 'FAILED stale action accepted';
 exception when others then if sqlerrm not like 'Action Plan changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,'2000-01-01',changes); raise exception 'FAILED stale ad accepted';
 exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
 begin
  perform public.qa_plan_fields('qa-fields-foreign',act.id,act.updated_at,a.id,a.updated_at,changes); raise exception 'FAILED foreign access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"review":{"name":"Reviewer","type":"users","value":["invalid"]}}'); raise exception 'FAILED invalid assignment';
 exception when others then if sqlerrm<>'Invalid people assignment' then raise; end if; end;
 begin
  perform public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"mapped-angle":{"name":"Alias","type":"text","value":"Wrong cell"}}'); raise exception 'FAILED canonical edit';
 exception when others then if sqlerrm<>'Edit canonical fields through the creative editor' then raise; end if; end;
 if exists(select 1 from public.activity_events where product_id='qa-fields-smoke') then raise exception 'Rejected edits left events'; end if;
 saved:=public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,changes);
 if saved->'ad'->'meta'->'assignees'<>'[{"id":8},{"id":9}]'::jsonb then raise exception 'Native assignees lost'; end if;
 if saved->'ad'->'meta'->'_customFieldsRaw'->'reviewer'<>'[10]'::jsonb or saved->'ad'->'meta'->'_customFieldsRaw'->'score'<>'0'::jsonb or saved->'ad'->'meta'->'_customFieldsRaw'->'checked'<>'false'::jsonb then raise exception 'Typed fields lost'; end if;
 if saved->'ad'->'meta'->'_customFieldsRaw'->>'other'<>'Keep' or saved->'ad'->'meta'->>'notes'<>'Retain brief' then raise exception 'Unrelated metadata lost'; end if;
 if saved->'ad'->'meta'->'_trackerPending'->'custom:__task_assignees'<>'[8,9]'::jsonb or saved->'ad'->'meta'->'_trackerPending'->'custom:review'<>'[10]'::jsonb then raise exception 'Pending fields lost'; end if;
 if saved->'action'->'payload'->'assignees'<>saved->'ad'->'meta'->'assignees' or saved->'action'->'payload'->'_customFields'->>'reviewer'<>'Reviewer A' then raise exception 'Action mirror failed'; end if;
 if (select count(*) from public.activity_events where product_id='qa-fields-smoke')<>4 then raise exception 'Field history incomplete'; end if;
 a:=jsonb_populate_record(a,saved->'ad'); act:=jsonb_populate_record(act,saved->'action');
 perform public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,'{}');
 if (select count(*) from public.activity_events where product_id='qa-fields-smoke')<>4 then raise exception 'No-op duplicated history'; end if;
 saved:=public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,'{"__task_assignees":{"name":"Task assignees","type":"users","value":[],"display":""},"review":{"name":"Reviewer","type":"users","value":[],"display":""}}');
 if saved->'ad'->'meta'->'assignees'<>'[]'::jsonb or saved->'ad'->'meta'->'_trackerPending'->'custom:review'<>'[]'::jsonb then raise exception 'Assignment clear lost'; end if;
 a:=jsonb_populate_record(a,saved->'ad'); act:=jsonb_populate_record(act,saved->'action');
 reset role;
 insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
 values(gen_random_uuid(),'qa-fields-smoke',a.id,act.id,'1301130000002447','uncertain','{}',gen_random_uuid(),now());
 set local role authenticated;
 begin
  perform public.qa_plan_fields('qa-fields-smoke',act.id,act.updated_at,a.id,a.updated_at,changes); raise exception 'FAILED unresolved creation edited';
 exception when others then if sqlerrm not like 'Recover unresolved%' then raise; end if; end;
end $$;
reset role;
