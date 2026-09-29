-- Always execute within a transaction that is rolled back.
insert into public.products(id,name) values ('qa-tracker-smoke','Tracker transaction test');
insert into auth.users(id,email,raw_app_meta_data) values ('00000000-0000-4000-8000-000000000042','tracker-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000042','qa-tracker-smoke');
select set_config('request.jwt.claims', json_build_object('sub', (
  select id from public.profiles where role='admin' and is_active and not must_change_password limit 1
), 'role','authenticated')::text,true);
set local role authenticated;
do $$
declare a jsonb; b jsonb; children jsonb; stamp timestamptz; ad_id text; child_id text; cell_id text;
begin
  insert into public.angles(id,product_id,name) values('qa-track-angle','qa-tracker-smoke','Energy');
  insert into public.personas(id,product_id,name) values('qa-track-persona','qa-tracker-smoke','Busy people');
  a := public.qa_tracker_save('qa-tracker-smoke',null,null,'{"format_name":"QA winner","angle":"Energy","persona":"Busy people","status":"Winner","meta":{"notes":"keep","creativeHypothesis":"original"}}');
  ad_id := a->>'id';
  if a->>'created_at' is null or a->>'updated_at' is null or a->>'ad_type'<>'Video' then raise exception 'Insert lost defaults'; end if;
  update public.ads set clickup_task_id='synthetic-task', meta=meta||'{"_fromInspoId":"synthetic-source","_unrelated":"keep"}' where id=ad_id returning updated_at into stamp;
  insert into public.manual_actions(id,product_id,payload,live_status) values
    ('10000000-0000-4000-8000-000000000001','qa-tracker-smoke',jsonb_build_object('sourceAdId',ad_id,'title','Old','notes','keep'),'Untested'),
    ('10000000-0000-4000-8000-000000000002','qa-tracker-smoke',jsonb_build_object('sourceAdId',ad_id,'_clickupId','different-task'),'Testing');
  a := public.qa_tracker_save('qa-tracker-smoke',ad_id,stamp,'{"format_name":"Edited","meta":{"creativeHypothesis":""}}','{"check":{"name":"Check","type":"checkbox","value":false,"display":"false"}}');
  if a->'meta'->>'notes'<>'keep' or a->'meta'->>'_unrelated'<>'keep' or a->'meta'->>'creativeHypothesis'<>'' then raise exception 'Metadata merge/clear failed'; end if;
  if a->'meta'->'_trackerPending'->>'format_name'<>'Edited' or a->'meta'->'_customFieldsRaw'->'check'<>'false'::jsonb then raise exception 'Pending/custom values lost'; end if;
  if not exists(select 1 from public.manual_actions where id='10000000-0000-4000-8000-000000000001' and payload->>'title'='Edited' and payload->>'notes'='keep' and live_status='Untested') then raise exception 'AP propagation damaged fields'; end if;
  begin
    perform public.qa_tracker_save('qa-tracker-smoke',ad_id,'2000-01-01','{"format_name":"Stale"}');
    raise exception 'FAILED stale edit accepted';
  exception when others then if sqlerrm not like 'Creative changed.%' then raise; end if; end;
  begin
    perform public.qa_tracker_save('other-product',ad_id,(a->>'updated_at')::timestamptz,'{"format_name":"Wrong product"}');
    raise exception 'FAILED wrong product accepted';
  exception when others then if sqlerrm not in ('Active product access is required','Product is unavailable','Creative is no longer available') then raise; end if; end;

  perform public.qa_tracker_ack_push('qa-tracker-smoke',ad_id,'{"format_name":"Old","custom:check":false}');
  if not exists(select 1 from public.ads where id=ad_id and meta->'_trackerPending'->>'format_name'='Edited' and not (meta->'_trackerPending') ? 'custom:check') then raise exception 'Push acknowledgement erased newer edits'; end if;
  select updated_at into stamp from public.ads where id=ad_id;
  a := public.qa_tracker_save('qa-tracker-smoke',ad_id,stamp,'{}','{"__task_assignees":{"name":"Task assignees","type":"users","value":[12,13]}}');
  if a->'meta'->'assignees' <> '[{"id":12},{"id":13}]'::jsonb then raise exception 'Task assignees lost'; end if;
  a := public.qa_tracker_winner('qa-tracker-smoke',ad_id,'synthetic-file','Winner output');
  if jsonb_array_length(a->'meta'->'_winningArtifacts')<>1 or not exists(select 1 from public.task_video_winners where task_video_winners.ad_id=a->>'id' and drive_file_id='synthetic-file') then raise exception 'Winner persistence failed'; end if;
  insert into public.deleted_ads(id,product_id) values(ad_id||'-V1','qa-tracker-smoke');
  children := public.qa_tracker_spawn('qa-tracker-smoke',ad_id,(a->>'updated_at')::timestamptz,'variation','[{"axis":"Hook","from":"old","to":"new","hypothesis":"why","brief":"brief","editorIds":["12"],"reviewerIds":["13"],"dueDate":"2026-10-01"}]','synthetic-file');
  child_id := children->>0;
  if child_id<>ad_id||'-V2' then raise exception 'Tombstoned variation ID reused'; end if;
  select to_jsonb(ads) into b from public.ads where id=child_id;
  if b->>'status'<>'Untested' or coalesce(b->>'drive_link','')<>'' or b->>'clickup_task_id' is not null or b->'meta' ? '_clickupId'
     or b->'meta'->'_sourceWinningArtifact'->>'id'<>'synthetic-file' or b->'meta'->>'variationHypothesis'<>'why' then raise exception 'Child inherited output/identity or lost provenance'; end if;
  if b->'meta'->'assignees'->0->>'id'<>'12' or b->'meta'->'_customFieldsRaw'->'reviewer'->0->>'id'<>'13' or b->'meta'->>'dueDate'<>'2026-10-01' then raise exception 'Variation assignments/due date lost'; end if;
  if not exists(select 1 from public.matrix_cells where product_id='qa-tracker-smoke' and creative_assignments ? child_id) then raise exception 'Child matrix assignment missing'; end if;
  children := public.qa_tracker_spawn('qa-tracker-smoke',ad_id,(a->>'updated_at')::timestamptz,'funnel','[{"stage":"TOF"},{"stage":"MOF"},{"stage":"BOF"}]');
  if jsonb_array_length(children)<>2 then raise exception 'Existing funnel duplicated'; end if;
  begin
    perform public.qa_tracker_spawn('qa-tracker-smoke',ad_id,(a->>'updated_at')::timestamptz,'funnel','[{"stage":"TOF"},{"stage":"invalid"}]');
    raise exception 'FAILED invalid stage accepted';
  exception when others then if sqlerrm<>'Invalid funnel stage' then raise; end if; end;
  a := public.qa_tracker_winner('qa-tracker-smoke',ad_id,'synthetic-file','Winner output',true);
  if jsonb_array_length(a->'meta'->'_winningArtifacts')<>0 then raise exception 'Winner removal not mirrored'; end if;
  update public.matrix_cells set meta=jsonb_build_object(ad_id||'||format','remove','unrelated','keep') where product_id='qa-tracker-smoke';
  a := public.qa_tracker_delete('qa-tracker-smoke',ad_id,(a->>'updated_at')::timestamptz);
  if a->>'deleted_at' is null or not exists(select 1 from public.deleted_ads where id=ad_id) then raise exception 'Delete tombstone missing'; end if;
  if not exists(select 1 from public.ads where id=child_id and deleted_at is null) then raise exception 'Independent child deleted'; end if;
  if exists(select 1 from public.manual_actions where id='10000000-0000-4000-8000-000000000001') or not exists(select 1 from public.manual_actions where id='10000000-0000-4000-8000-000000000002') then raise exception 'AP delete ownership wrong'; end if;
  if exists(select 1 from public.matrix_cells where product_id='qa-tracker-smoke' and (meta ? (ad_id||'||format') or not creative_assignments ? child_id)) then raise exception 'Matrix cleanup damaged child or retained metadata'; end if;
  perform public.qa_tracker_delete('qa-tracker-smoke',ad_id,null);
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000042","role":"authenticated"}',true);
  b := public.qa_tracker_save('qa-tracker-smoke',null,null,'{"format_name":"Assigned member creative"}');
  if b->>'id' is null then raise exception 'Assigned member could not save'; end if;
  begin
    perform public.qa_tracker_save('other-product',null,null,'{"format_name":"Forbidden"}');
    raise exception 'FAILED unassigned member accepted';
  exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  begin
    perform public.qa_tracker_save('qa-tracker-smoke',null,null,'{"format_name":"Unauthorized"}');
    raise exception 'FAILED unknown user accepted';
  exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
end;
$$;
reset role;
