insert into public.products(id,name,config) values('qa-import-source','Source fixture','{"ins_prefix":"XPS"}'),('qa-import-target','Target fixture','{"ins_prefix":"XPT"}'),('qa-import-denied','Denied fixture','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000231','cross-import-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000231','qa-import-source'),('00000000-0000-4000-8000-000000000231','qa-import-target');
insert into public.inspirations(id,product_id,url,title,status,data) values
 ('XPS-INS-001','qa-import-source','https://example.test/source','Source idea','Winner','{"formatName":"Source idea","creativeHypothesis":"Preserve","_clickupDocPageUrl":"https://example.test/brief","_classificationBrief":{"why_it_works":"Keep"},"_dupeType":"similar","reusedIn":["old"],"_sourceProductId":"old","_sourceInsId":"old-id","_qaImportedResultAt":"2020-01-01","assignees":[1],"dueDate":"2026-10-01"}'),
 ('XPS-INS-002','qa-import-source','https://example.test/second','Second idea','Saved','{}'),
 ('XPS-INS-BLOCK','qa-import-source','https://example.test/blocked','Blocked idea','Classified','{}');
insert into public.inspiration_queue(ins_id,product_id,url,status,worker_assignment) values('XPS-INS-BLOCK','qa-import-source','https://example.test/blocked','blocked','blocked:qa-isolation');
insert into public.ads(id,product_id,format_name,status,ad_link,ad_type,angle,persona,meta) values
 ('qa-import-winner','qa-import-source','Winning format','Winner','https://example.test/winner','Video','Source angle','Source persona','{"creativeHypothesis":"Winning idea","_sourceInspirationBriefUrl":"https://example.test/winner-brief","_trackerPending":{"status":"Winner"}}'),
 ('qa-import-removed','qa-import-source','Removed winner','Scale','https://example.test/removed','Photo','','','{}');
insert into public.deleted_ads(id,product_id) values('qa-import-removed','qa-import-source');
insert into public.ads(id,product_id,format_name,status,parent_ad_id,meta) values('qa-import-child','qa-import-source','Child winner','Winner','','{"parentAdId":"qa-import-winner"}');
insert into public.ads(id,product_id,format_name,status,meta) values('qa-import-linked-removed','qa-import-source','Removed linked winner','Winner','{"clickupTaskId":"deleted-source-task","_clickupId":"obsolete-alias"}');
insert into public.deleted_ads(id,product_id,clickup_task_id) values('qa-import-remote-tombstone','qa-import-source','deleted-source-task');
insert into public.inspirations(id,product_id,url,title,status,data) values('XPS-INS-DUPE','qa-import-source','https://example.test/source/#','Same URL','Classified','{}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000231","role":"authenticated"}',true);
set local role authenticated;
do $$
declare items jsonb; source_stamp timestamptz; ad_stamp timestamptz; req uuid:=gen_random_uuid(); result jsonb; replay jsonb; copied public.inspirations%rowtype; before_source jsonb;
begin
 select to_jsonb(i),i.updated_at into before_source,source_stamp from public.inspirations i where id='XPS-INS-001';
 select updated_at into ad_stamp from public.ads where id='qa-import-winner';
 items:=jsonb_build_array(jsonb_build_object('kind','inspiration','sourceProductId','qa-import-source','sourceId','XPS-INS-001','version',source_stamp),jsonb_build_object('kind','winner','sourceProductId','qa-import-source','sourceId','qa-import-winner','version',ad_stamp));
 begin
   perform public.qa_inspiration_cross_import('qa-import-denied',req,items);raise exception 'FAILED denied destination';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',req,jsonb_build_array((items->0)||'{"sourceProductId":"qa-import-denied"}'));raise exception 'FAILED denied source';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
   perform public.qa_inspiration_cross_import('qa-import-source',req,items);raise exception 'FAILED same product';
 exception when others then if sqlerrm<>'Choose versioned sources from other products' then raise; end if; end;
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',req,jsonb_build_array(items->0,(items->1)||'{"version":"2000-01-01"}'));raise exception 'FAILED stale batch';
 exception when others then if sqlerrm not like 'Source changed.%' then raise; end if; end;
 if exists(select 1 from public.inspirations where product_id='qa-import-target') then raise exception 'Partial batch committed'; end if;
 result:=public.qa_inspiration_cross_import('qa-import-target',req,items);
 if result->>'imported'<>'2' or result->>'dispatchEnabled'<>'false' then raise exception 'Import result incorrect'; end if;
 replay:=public.qa_inspiration_cross_import('qa-import-target',req,items);
 if replay<>result or (select count(*) from public.inspirations where product_id='qa-import-target')<>2 then raise exception 'Lost reply repeated import'; end if;
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',req,jsonb_build_array(items->0));raise exception 'FAILED receipt collision';
 exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
 replay:=public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),items);
 if replay->>'imported'<>'0' or replay->>'existing'<>'2' then raise exception 'Duplicate source not skipped'; end if;
 select * into copied from public.inspirations where id=result->'items'->0->>'id';
 if copied.id<>'XPT-INS-001' or copied.status<>'Classified' or copied.data->>'_sourceProductId'<>'qa-import-source' or copied.data->>'_sourceInsId'<>'XPS-INS-001'
   or copied.data->>'_clickupDocPageUrl'<>'https://example.test/brief' or copied.data->'_classificationBrief'<>before_source->'data'->'_classificationBrief'
   or copied.data->'reusedIn'<>'[]'::jsonb or copied.data ?| array['_dupeType','assignees','dueDate','_qaImportedResultAt'] then raise exception 'Copied content/provenance/reset contract failed'; end if;
 select * into copied from public.inspirations where id=result->'items'->1->>'id';
 if copied.data->>'_sourceAdId'<>'qa-import-winner' or copied.data->>'_clickupDocPageUrl'<>'https://example.test/winner-brief' or copied.data ? '_trackerPending' then raise exception 'Winner brief or isolation failed'; end if;
 if before_source<>(select to_jsonb(i) from public.inspirations i where id='XPS-INS-001') then raise exception 'Source was modified'; end if;
 select updated_at into source_stamp from public.inspirations where id='XPS-INS-DUPE';
 replay:=public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),jsonb_build_array(jsonb_build_object('kind','inspiration','sourceProductId','qa-import-source','sourceId','XPS-INS-DUPE','version',source_stamp)));
 if replay->>'imported'<>'0' or replay->>'existing'<>'1' then raise exception 'Duplicate URL was copied'; end if;
 select updated_at into source_stamp from public.inspirations where id='XPS-INS-BLOCK';
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),jsonb_build_array(jsonb_build_object('kind','inspiration','sourceProductId','qa-import-source','sourceId','XPS-INS-BLOCK','version',source_stamp)));raise exception 'FAILED blocked queue';
 exception when others then if sqlerrm<>'Source classifier queue is not ready' then raise; end if; end;
 select updated_at into ad_stamp from public.ads where id='qa-import-removed';
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),jsonb_build_array(jsonb_build_object('kind','winner','sourceProductId','qa-import-source','sourceId','qa-import-removed','version',ad_stamp)));raise exception 'FAILED tombstone';
 exception when others then if sqlerrm<>'Winning format is no longer eligible' then raise; end if; end;
 select updated_at into ad_stamp from public.ads where id='qa-import-child';
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),jsonb_build_array(jsonb_build_object('kind','winner','sourceProductId','qa-import-source','sourceId','qa-import-child','version',ad_stamp)));raise exception 'FAILED child winner';
 exception when others then if sqlerrm<>'Winning format is no longer eligible' then raise; end if; end;
 if exists(select 1 from public.inspiration_queue where product_id='qa-import-target') or exists(select 1 from public.ads where product_id='qa-import-target') or exists(select 1 from public.manual_actions where product_id='qa-import-target') then raise exception 'Import dispatched downstream work'; end if;
 select updated_at into ad_stamp from public.ads where id='qa-import-linked-removed';
 begin
   perform public.qa_inspiration_cross_import('qa-import-target',gen_random_uuid(),jsonb_build_array(jsonb_build_object('kind','winner','sourceProductId','qa-import-source','sourceId','qa-import-linked-removed','version',ad_stamp)));raise exception 'FAILED linked tombstone';
 exception when others then if sqlerrm<>'Winning format is no longer eligible' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.qa_inspiration_cross_import(text,uuid,jsonb)','EXECUTE') then raise exception 'Anonymous import access'; end if;
end $$;
