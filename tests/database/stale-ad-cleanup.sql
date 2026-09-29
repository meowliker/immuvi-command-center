insert into auth.users(id,email,encrypted_password,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000301','stale-admin@example.test','fixture','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000302','stale-member@example.test','fixture','{"must_change_password":false}');
insert into public.products(id,name,config) values('qa-stale-fixture','Cleanup QA','{"clickup_list_id":"1301130000002447","last_synced_count":2}');
insert into public.ads(id,product_id,format_name,ad_origin,clickup_task_id,meta,created_at,updated_at)
 select 'qa-stale-'||x,'qa-stale-fixture',x,'ClickUp',x,jsonb_build_object('_clickupListId','1301130000002447'),now()-interval '2 days',now()-interval '1 day'
 from unnest(array['remove','current','local','action','cell','recent','variation','parent','winner','brief','quarantine','pending','ambiguous']) x;
-- Fixture patches reset timestamps by inserting desired records initially or testing protections before recency.
update public.ads set ad_origin='New Find' where id='qa-stale-local';
update public.ads set parent_ad_id='qa-stale-parent',ad_origin='Winner Variation' where id='qa-stale-variation';
update public.ads set meta=meta||'{"_productBoundaryQuarantined":true}' where id='qa-stale-quarantine';
update public.ads set meta=meta||'{"_trackerPending":{"status":"Winner"}}' where id='qa-stale-pending';
update public.ads set meta=meta||'{"_clickupId":"different"}' where id='qa-stale-ambiguous';
update public.ads set format_name='Recently edited' where id='qa-stale-recent';
insert into public.manual_actions(product_id,payload) values('qa-stale-fixture','{"sourceAdId":"qa-stale-action"}');
insert into public.angles(id,product_id,name) values('qa-stale-angle','qa-stale-fixture','Preserved angle');
insert into public.personas(id,product_id,name) values('qa-stale-persona','qa-stale-fixture','Preserved persona');
insert into public.matrix_cells(product_id,angle_id,persona_id,creative_assignments,meta) values('qa-stale-fixture','qa-stale-angle','qa-stale-persona','[]','{"qa-stale-cell||variant":{"kept":true}}');
insert into public.task_video_winners(ad_id,drive_file_id,file_name) values('qa-stale-winner','qa-stale-file','Keep');
insert into public.variation_briefs(ad_id,drive_file_id,brief_markdown) values('qa-stale-brief','qa-stale-brief-file','Keep');
create temporary table stale_context(preview jsonb,request jsonb);
do $$ declare actor uuid:='00000000-0000-4000-8000-000000000301'; version timestamptz; preview jsonb; req jsonb; begin
  select updated_at into version from public.products where id='qa-stale-fixture';
  begin perform public.qa_stale_cleanup_preview('00000000-0000-4000-8000-000000000302','qa-stale-fixture','["current"]',version); raise exception 'FAILED member'; exception when insufficient_privilege then null; end;
  begin perform public.qa_stale_cleanup_preview(actor,'qa-stale-fixture','[]',version); raise exception 'FAILED empty'; exception when others then if sqlerrm<>'A complete nonempty ClickUp snapshot is required' then raise; end if; end;
  preview:=public.qa_stale_cleanup_preview(actor,'qa-stale-fixture','["current"]',version);
  if preview->'candidates'<>'[{"id":"qa-stale-remove","name":"remove","taskId":"remove"}]' then raise exception 'Protected creatives were selected: %',preview->'candidates'; end if;
  req:=jsonb_build_object('operation','commit','productId','qa-stale-fixture','requestId',gen_random_uuid(),'previewId',preview->>'previewId','confirmName','Cleanup QA');
  insert into stale_context values(preview,req);
  begin
    update public.manual_actions set payload=payload||'{"sourceAdId":"qa-stale-remove"}' where product_id='qa-stale-fixture';
    perform public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current"]',version,req); raise exception 'FAILED local reference race';
  exception when others then if sqlerrm<>'Product work changed since preview. Review a new preview.' then raise; end if; end;
  begin
    insert into public.task_video_winners(ad_id,drive_file_id,file_name) values('qa-stale-remove','qa-late-winner','Keep');
    perform public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current"]',version,req); raise exception 'FAILED new winner';
  exception when others then if sqlerrm<>'Creative protections changed. Review a new preview.' then raise; end if; end;
  begin
    update public.products set config=config||'{"last_synced_count":100}' where id='qa-stale-fixture';
    perform public.qa_stale_cleanup_preview(actor,'qa-stale-fixture','["current"]',(select updated_at from public.products where id='qa-stale-fixture')); raise exception 'FAILED low count';
  exception when others then if sqlerrm<>'ClickUp count is below half the last sync. Cleanup is blocked.' then raise; end if; end;
  begin
    update public.products set config=config||'{"clickup_list_id":"production"}' where id='qa-stale-fixture';
    perform public.qa_stale_cleanup_preview(actor,'qa-stale-fixture','["current"]',(select updated_at from public.products where id='qa-stale-fixture')); raise exception 'FAILED foreign list';
  exception when others then if sqlerrm<>'Only the linked QA test list can be cleaned' then raise; end if; end;
  begin perform public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current"]',version,req||'{"confirmName":"wrong"}'); raise exception 'FAILED typed confirmation'; exception when others then if sqlerrm<>'Product confirmation changed. Review a new preview.' then raise; end if; end;
  begin perform public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current","remove"]',version,req); raise exception 'FAILED remote change'; exception when others then if sqlerrm<>'ClickUp changed since preview. Review a new preview.' then raise; end if; end;
  update public.qa_stale_cleanup_previews set created_at=now()-interval '11 minutes' where id=(preview->>'previewId')::uuid;
  begin perform public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current"]',version,req); raise exception 'FAILED expiry'; exception when others then if sqlerrm<>'Cleanup preview expired. Review a new preview.' then raise; end if; end;
  update public.qa_stale_cleanup_previews set created_at=now() where id=(preview->>'previewId')::uuid;
end $$;
create function public.qa_stale_fixture_audit_fail() returns trigger language plpgsql as $$ begin if new.action='qa_stale_ad_cleanup' then raise exception 'Synthetic cleanup audit failure'; end if; return new; end $$;
create trigger qa_stale_fixture_audit_fail before insert on public.admin_audit_log for each row execute function public.qa_stale_fixture_audit_fail();
do $$ begin
  begin perform public.qa_stale_cleanup_commit('00000000-0000-4000-8000-000000000301','qa-stale-fixture','["current"]',(select updated_at from public.products where id='qa-stale-fixture'),(select request from stale_context)); raise exception 'FAILED audit rollback';
  exception when others then if sqlerrm<>'Synthetic cleanup audit failure' then raise; end if; end;
  if exists(select 1 from public.deleted_ads where id='qa-stale-remove') or exists(select 1 from public.ads where id='qa-stale-remove' and deleted_at is not null) then raise exception 'Partial cleanup committed'; end if;
end $$;
drop trigger qa_stale_fixture_audit_fail on public.admin_audit_log;
drop function public.qa_stale_fixture_audit_fail();
do $$ declare result jsonb; req jsonb; version timestamptz; actor uuid:='00000000-0000-4000-8000-000000000301'; begin
  select request into req from stale_context; select updated_at into version from public.products where id='qa-stale-fixture';
  result:=public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','["current"]',version,req);
  if result->'deletedIds'<>'["qa-stale-remove"]' then raise exception 'Wrong deletion receipt'; end if;
  if public.qa_stale_cleanup_receipt(actor,req)<>result then raise exception 'Replay changed'; end if;
  if public.qa_stale_cleanup_commit(actor,'qa-stale-fixture','[]',null,req)<>result then raise exception 'Completed recovery required remote data'; end if;
  if (select count(*) from public.admin_audit_log where meta->>'requestId'=req->>'requestId')<>1 then raise exception 'Duplicate audit'; end if;
  if not exists(select 1 from public.deleted_ads where id='qa-stale-remove') or (select count(*) from public.ads where product_id='qa-stale-fixture' and deleted_at is not null)<>1 then raise exception 'Deletion/tombstone mismatch'; end if;
  if not exists(select 1 from public.angles where id='qa-stale-angle') or not exists(select 1 from public.manual_actions where product_id='qa-stale-fixture') then raise exception 'Referenced work removed'; end if;
  begin perform public.qa_stale_cleanup_receipt(actor,req||'{"confirmName":"different"}'); raise exception 'FAILED replay identity'; exception when others then if sqlerrm<>'Cleanup request identity conflicts' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.qa_stale_cleanup_preview(auth.uid(),'qa-stale-fixture','["current"]',now()); raise exception 'FAILED client forgery'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.qa_stale_cleanup_previews; raise exception 'FAILED private preview'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.products(id,name,config) values('qa-stale-risk','Risk QA','{"clickup_list_id":"1301130000002447"}');
insert into public.ads(id,product_id,format_name,ad_origin,clickup_task_id,meta,created_at,updated_at)
 values('qa-stale-risk-ad','qa-stale-risk','Risk','ClickUp','risk','{"_clickupListId":"1301130000002447"}',now()-interval '2 days',now()-interval '1 day');
do $$ begin
  begin perform public.qa_stale_cleanup_preview('00000000-0000-4000-8000-000000000301','qa-stale-risk','["other"]',(select updated_at from public.products where id='qa-stale-risk')); raise exception 'FAILED high proportion';
  exception when others then if sqlerrm<>'Cleanup would remove over 80 percent of active creatives. Review the link and sync first.' then raise; end if; end;
end $$;
