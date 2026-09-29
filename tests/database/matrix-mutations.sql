insert into public.products(id,name) values('qa-matrix-smoke','Matrix transaction tests'),('qa-matrix-foreign','Foreign fixture');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000043','matrix-synthetic@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000043','qa-matrix-smoke');
insert into public.angles(id,product_id,name) values('qa-mx-a','qa-matrix-smoke','Target angle'),('qa-mx-foreign-a','qa-matrix-foreign','Foreign angle');
insert into public.personas(id,product_id,name) values('qa-mx-p','qa-matrix-smoke','Target persona'),('qa-mx-p2','qa-matrix-smoke','Second persona');
insert into public.ads(id,product_id,format_name,status,angle,persona,ad_type,funnel_stage,clickup_task_id,drive_link,meta) values
 ('qa-mx-source','qa-matrix-smoke','MT-008-Winning source','Winner','Original angle','Original persona','Video','TOF','synthetic-source-task','https://drive.google.com/drive/folders/source',
 '{"creativeHypothesis":"Source hypothesis","hookType":"Story","notes":"Keep brief","assignees":[{"id":12}],"dueDate":"2026-10-01","_customFieldsRaw":{"reviewer":[12],"editor":[12],"drive link":"old","angle":"Original angle","extra":"keep"}}');
insert into public.task_video_winners(ad_id,drive_file_id,file_name,web_view_url) values('qa-mx-source','winner-file','Winning output','https://drive.google.com/file/d/winner-file/view');
insert into public.inspirations(id,product_id,url,title,status,data) values
 ('qa-mx-inspo','qa-matrix-smoke','https://example.test/ad','Classified source','Classified','{"adType":"Photo","funnelStage":"MOF","creativeHypothesis":"Inspo idea","_clickupDocPageUrl":"https://example.test/brief"}'),
 ('qa-mx-pending','qa-matrix-smoke','https://example.test/pending','Pending source','Queued','{}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000043","role":"authenticated"}',true);
set local role authenticated;
do $$
declare src_stamp timestamptz; insp_stamp timestamptz; items jsonb; ids jsonb; again jsonb; a public.ads%rowtype; c jsonb; req uuid:=gen_random_uuid(); blank_req uuid:=gen_random_uuid();
begin
 select updated_at into src_stamp from public.ads where id='qa-mx-source';
 items:=jsonb_build_array(jsonb_build_object('sourceId','qa-mx-source','version',src_stamp));
 ids:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker',items,req);
 select * into a from public.ads where id=ids->>0;
 if a.format_name<>'MT-009-Winning source' then raise exception 'Legacy Tracker naming failed: %',a.format_name; end if;
 if a.angle<>'Target angle' or a.persona<>'Target persona' or a.clickup_task_id is not null or a.drive_link<>'' or a.ad_link<>'https://drive.google.com/file/d/winner-file/view' then raise exception 'Clone cell identity/output isolation failed'; end if;
 if a.meta->>'sourceFormatId'<>'qa-mx-source' or a.meta->>'creativeHypothesis'<>'Source hypothesis' or a.meta->>'hookType'<>'Story' or a.meta->>'notes'<>'Keep brief' then raise exception 'Source fields lost'; end if;
 if a.meta->'assignees'<>'[]'::jsonb or a.meta->>'dueDate'<>'' or a.meta->'_customFieldsRaw' ? 'reviewer' or a.meta->'_customFieldsRaw'->>'extra'<>'keep' then raise exception 'Clone inherited workflow state'; end if;
 if not exists(select 1 from public.matrix_cells where product_id='qa-matrix-smoke' and creative_assignments ? a.id) then raise exception 'Assignment missing'; end if;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker',items,req);
 if again<>ids then raise exception 'Retry duplicated creation'; end if;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker',items,gen_random_uuid());
 if again<>ids then raise exception 'Same source duplicated in one cell'; end if;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p2','tracker',items,gen_random_uuid());
 if again=ids then raise exception 'Different cell reused production identity'; end if;
 if not exists(select 1 from public.ads where id=again->>0 and format_name='MT-010-Winning source') then raise exception 'Retry consumed serial or names chained'; end if;
 begin
   perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','blank','[{"name":"First partial"},{"name":""}]',gen_random_uuid());
   raise exception 'FAILED partial batch accepted';
 exception when others then if sqlerrm<>'A brief name is required' then raise; end if; end;
 if exists(select 1 from public.ads where product_id='qa-matrix-smoke' and format_name='First partial') then raise exception 'Partial batch committed'; end if;
 select updated_at into insp_stamp from public.inspirations where id='qa-mx-inspo';
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration',jsonb_build_array(jsonb_build_object('sourceId','qa-mx-inspo','version',insp_stamp)),gen_random_uuid());
 if not exists(select 1 from public.ads where id=again->>0 and meta->>'_fromInspoId'='qa-mx-inspo' and meta->>'_sourceInspirationBriefUrl'='https://example.test/brief' and angle='Target angle') then raise exception 'Inspiration provenance failed'; end if;
 if not exists(select 1 from public.ads where id=again->>0 and format_name='MT-011-qa-mx-inspo') then raise exception 'Legacy Inspiration naming failed'; end if;
 if not exists(select 1 from public.inspirations where id='qa-mx-inspo' and status='Testing') then raise exception 'Inspiration status not advanced'; end if;
 begin
   perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','inspiration','[{"sourceId":"qa-mx-pending"}]',gen_random_uuid());
   raise exception 'FAILED pending source accepted';
 exception when others then if sqlerrm<>'Inspiration is not ready' then raise; end if; end;
 begin
   perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-foreign-a','qa-mx-p','tracker',items,gen_random_uuid());
   raise exception 'FAILED foreign axis accepted';
 exception when others then if sqlerrm<>'Active angle is unavailable' then raise; end if; end;
 begin
   perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker','[{"sourceId":"qa-mx-source","version":"2000-01-01"}]',gen_random_uuid());
   raise exception 'FAILED stale source accepted';
 exception when others then if sqlerrm not like 'Tracker source changed.%' then raise; end if; end;
 select to_jsonb(matrix_cells) into c from public.matrix_cells where product_id='qa-matrix-smoke' and angle_id='qa-mx-a' and persona_id='qa-mx-p';
 c:=public.qa_matrix_assignment('qa-matrix-smoke','qa-mx-a','qa-mx-p',a.id,false,(c->>'updated_at')::timestamptz);
 if c->'creative_assignments' ? a.id or not (c->'meta'->'_excludedCreativeIds') ? a.id then raise exception 'Removal can be resurrected by fallback'; end if;
 if not exists(select 1 from public.ads where id=a.id and deleted_at is null) then raise exception 'Unlink deleted creative'; end if;
 c:=public.qa_matrix_assignment('qa-matrix-smoke','qa-mx-a','qa-mx-p',a.id,true,(c->>'updated_at')::timestamptz);
 if not (c->'creative_assignments') ? a.id or (c->'meta'->'_excludedCreativeIds') ? a.id then raise exception 'Restore failed'; end if;
 begin
   perform public.qa_matrix_assignment('qa-matrix-smoke','qa-mx-a','qa-mx-p',a.id,false,'2000-01-01');
   raise exception 'FAILED stale cell accepted';
 exception when others then if sqlerrm not like 'Cell changed.%' then raise; end if; end;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','blank','[{"name":"Blank brief","hypothesis":"New test","adType":"UGC","funnelStage":"BOF"}]',blank_req);
 if not exists(select 1 from public.ads where id=again->>0 and ad_type='UGC' and funnel_stage='BOF' and meta->>'creativeHypothesis'='New test') then raise exception 'Blank fields lost'; end if;
 begin
   perform public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','blank','[{"name":"Different"}]',blank_req);
   raise exception 'FAILED idempotency mismatch accepted';
 exception when others then if sqlerrm<>'Creation request was already used or deleted' then raise; end if; end;
 if exists(select 1 from public.manual_actions where product_id='qa-matrix-smoke') then raise exception 'Step 5 must not auto-create Action Plan entries'; end if;
 -- Fixture-only high-water setup requires the owner; members cannot edit settings.
 execute 'reset role';
 update public.products set config=config||'{"_qaMatrixNameSerials":{"MT":999},"keep":"setting"}' where id='qa-matrix-smoke';
 execute 'set local role authenticated';
 update public.ads set deleted_at=now() where id=a.id;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker',items,gen_random_uuid());
 if not exists(select 1 from public.ads where id=again->>0 and format_name='MT-1000-Winning source') then raise exception 'Serial repeated at legacy 999 cap'; end if;
 delete from public.ads where id=again->>0;
 again:=public.qa_matrix_create('qa-matrix-smoke','qa-mx-a','qa-mx-p','tracker',items,gen_random_uuid());
 if not exists(select 1 from public.ads where id=again->>0 and format_name='MT-1001-Winning source') then raise exception 'Deleted serial reused'; end if;
 if not exists(select 1 from public.products where id='qa-matrix-smoke' and config->>'keep'='setting') then raise exception 'Naming counter replaced product settings'; end if;
 begin
   perform public.qa_matrix_create('qa-matrix-foreign','qa-mx-foreign-a','qa-mx-p','blank','[{"name":"Foreign"}]',gen_random_uuid());
   raise exception 'FAILED unassigned product accepted';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
end;
$$;
reset role;
