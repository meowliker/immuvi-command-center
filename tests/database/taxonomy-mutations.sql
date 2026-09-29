insert into public.products(id,name,config) values('qa-taxonomy-fixture','Taxonomy fixtures','{}'),('qa-taxonomy-foreign','Foreign fixtures','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000247','taxonomy@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000247','qa-taxonomy-fixture');
insert into public.angles(id,product_id,name,notes) values('qa-tax-a','qa-taxonomy-fixture','Energy','Keep notes'),('qa-tax-b','qa-taxonomy-fixture','Focus','Merge notes'),('qa-tax-c','qa-taxonomy-fixture','Conflict','');
insert into public.personas(id,product_id,name) values('qa-tax-p','qa-taxonomy-fixture','Busy people'),('qa-tax-p2','qa-taxonomy-fixture','Students');
insert into public.ads(id,product_id,format_name,angle,persona,clickup_task_id,meta) values
 ('qa-tax-ad','qa-taxonomy-fixture','Creative','Focus','Busy people','remote-qa','{"angle":"Focus","_customFields":{"angle tag":"Focus"},"untouched":7}'),
 ('qa-tax-child','qa-taxonomy-fixture','Child','Focus','Busy people',null,'{}'),
 ('qa-tax-conflict','qa-taxonomy-fixture','Conflict creative','Conflict','Busy people',null,'{}'),
 ('qa-tax-foreign','qa-taxonomy-foreign','Foreign','Focus','Busy people',null,'{}'),
 ('qa-tax-deleted','qa-taxonomy-fixture','Deleted','Focus','Busy people',null,'{"deletedAt":"now"}');
update public.ads set parent_ad_id='qa-tax-ad' where id='qa-tax-child';
insert into public.inspirations(id,product_id,url,title,data) values('qa-tax-ins','qa-taxonomy-fixture','https://example.test','Fixture','{"angle":"Focus","persona":"Busy people","notes":"Preserve brief"}');
insert into public.manual_actions(id,product_id,payload) values('00000000-0000-4000-8000-000000000248','qa-taxonomy-fixture','{"angle":"Focus","sourceAngle":"Focus","_sourceAngle":"Focus","selectedAngle":"Focus","title":"Untouched","_customFieldsRaw":{"angle tag":"Focus"}}');
insert into public.matrix_cells(product_id,angle_id,persona_id,meta,creative_assignments) values
 ('qa-taxonomy-fixture','qa-tax-a','qa-tax-p','{"meta":{"keep":1},"per_ad":{"qa-tax-ad":{"note":"retain"}}}','["qa-tax-ad"]'),
 ('qa-taxonomy-fixture','Focus','Busy people','{"cell_key":"Focus||Busy people","meta":{"incoming":2},"per_ad":{"qa-tax-child":{"note":"child"}}}','["qa-tax-ad","qa-tax-child"]'),
 ('qa-taxonomy-fixture','qa-tax-c','qa-tax-p','{"meta":{"keep":99}}','[]');
insert into public.angle_personas(product_id,angle_id,persona_id) values('qa-taxonomy-fixture','qa-tax-b','qa-tax-p');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000247","role":"authenticated"}',true);
set local role authenticated;
do $$
declare req uuid:=gen_random_uuid(); create_req uuid:=gen_random_uuid(); saved jsonb; replay jsonb; values_data jsonb; prior jsonb; row_a jsonb; row_b jsonb; row_c jsonb; m jsonb;
begin
  select to_jsonb(a) into row_a from public.angles a where id='qa-tax-a';
  select to_jsonb(a) into row_b from public.angles a where id='qa-tax-b';
  select to_jsonb(a) into row_c from public.angles a where id='qa-tax-c';
  values_data:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id','qa-tax-b','version',row_b->'updated_at')),'target',jsonb_build_object('id','qa-tax-a','version',row_a->'updated_at'));
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',req,'angle','merge',values_data);
  if saved->'row'->>'id'<>'qa-tax-a' or saved->'removedIds'<>'["qa-tax-b"]' or saved->>'remotePending'<>'1' then raise exception 'Bad merge receipt'; end if;
  if saved->'row'->>'notes' not like '%Merge notes%' then raise exception 'Losing notes were discarded'; end if;
  if exists(select 1 from public.ads where id in ('qa-tax-ad','qa-tax-child') and angle<>'Energy') then raise exception 'Creative cascade failed'; end if;
  if (select meta->'_trackerPending'->>'angle' from public.ads where id='qa-tax-ad')<>'Energy'
    or (select meta->'_customFields'->>'angle tag' from public.ads where id='qa-tax-ad')<>'Energy' then raise exception 'Pending or mirror missing'; end if;
  if (select angle from public.ads where id='qa-tax-deleted')<>'Focus' then raise exception 'Deleted creative changed'; end if;
  if (select data->>'angle' from public.inspirations where id='qa-tax-ins')<>'Energy'
    or (select payload->>'selectedAngle' from public.manual_actions where id='00000000-0000-4000-8000-000000000248')<>'Energy' then raise exception 'Dependent JSON cascade failed'; end if;
  select to_jsonb(c) into m from public.matrix_cells c where product_id='qa-taxonomy-fixture' and angle_id='qa-tax-a' and persona_id='qa-tax-p';
  if jsonb_array_length(m->'creative_assignments')<>2 or m->'meta'->'meta'<>'{"keep":1,"incoming":2}' or m->'meta'->'per_ad'->'qa-tax-child' is null then raise exception 'Matrix merge lost data'; end if;
  if exists(select 1 from public.matrix_cells where product_id='qa-taxonomy-fixture' and angle_id='Focus') then raise exception 'Legacy cell not converted'; end if;
  if not exists(select 1 from public.angle_personas where product_id='qa-taxonomy-fixture' and angle_id='qa-tax-a' and persona_id='qa-tax-p') then raise exception 'Relationship link not merged'; end if;
  replay:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',req,'angle','merge',values_data);
  if replay<>saved then raise exception 'Replay differs'; end if;
  begin perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',req,'angle','delete',values_data); raise exception 'FAILED identity';
  exception when others then if sqlerrm<>'Taxonomy request identity conflicts with a previous save' then raise; end if; end;
  row_a:=saved->'row';
  -- Conflict must roll back cascades made earlier in the transaction/function.
  begin
    perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','merge',jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id','qa-tax-c','version',row_c->'updated_at')),'target',jsonb_build_object('id','qa-tax-a','version',row_a->'updated_at')));
    raise exception 'FAILED conflict';
  exception when others then if sqlerrm not like 'Matrix metadata conflicts.%' then raise; end if; end;
  if not exists(select 1 from public.angles where id='qa-tax-c') then raise exception 'Conflict deleted source'; end if;
  if (select angle from public.ads where id='qa-tax-conflict')<>'Conflict' then raise exception 'Conflict left a partial creative retag'; end if;
  values_data:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id','qa-tax-a','version',row_a->'updated_at')),'fields','{"name":"Renewed","source_link":"https://example.test/source","notes":"Changed"}'::jsonb);
  values_data:=values_data||jsonb_build_object('renameRevision',public.qa_taxonomy_rename_preview('qa-taxonomy-fixture','angle',values_data->'sources'->0,'Renewed')->>'revision');
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','save',values_data);
  if (select angle from public.ads where id='qa-tax-ad')<>'Renewed' or saved->'row'->>'name'<>'Renewed' then raise exception 'Rename failed'; end if;
  begin perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','save',jsonb_set(values_data,'{sources,0,version}',to_jsonb(now()-interval '1 day'))); raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'Taxonomy changed%' then raise; end if; end;
  row_a:=saved->'row';
  values_data:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id','qa-tax-a','version',row_a->'updated_at')));
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','archive',values_data);
  if saved->'row'->>'archived_at' is null or (select angle from public.ads where id='qa-tax-ad')<>'Renewed' then raise exception 'Archive retagged'; end if;
  values_data:=jsonb_set(values_data,'{sources,0,version}',saved->'row'->'updated_at');
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','restore',values_data);
  if saved->'row'->>'archived_at' is not null then raise exception 'Restore failed'; end if;
  values_data:=jsonb_set(values_data,'{sources,0,version}',saved->'row'->'updated_at');
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','delete',values_data);
  if saved->'row'<>'null' or (select angle from public.ads where id='qa-tax-ad')<>'' or exists(select 1 from public.matrix_cells where product_id='qa-taxonomy-fixture' and angle_id='qa-tax-a') then raise exception 'Delete cascade failed'; end if;
  -- Creation replay and canonical duplicate protection work for the opposite axis too.
  values_data:='{"sources":[],"fields":{"name":"New persona","source_link":"","notes":""}}';
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',create_req,'persona','create',values_data);
  if public.qa_taxonomy_mutate('qa-taxonomy-fixture',create_req,'persona','create',values_data)<>saved then raise exception 'Create replay differs'; end if;
  begin perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'persona','create',jsonb_set(values_data,'{fields,name}','"1. NEW PERSONA"')); raise exception 'FAILED duplicate';
  exception when others then if sqlerrm not like 'This taxonomy name already exists%' then raise; end if; end;
  begin perform public.qa_taxonomy_mutate('qa-taxonomy-foreign',gen_random_uuid(),'persona','create',values_data); raise exception 'FAILED access';
  exception when others then if sqlerrm not like 'Active product access%' then raise; end if; end;
  update public.ads set persona='Students' where id='qa-tax-ad';
  select to_jsonb(p) into row_a from public.personas p where id='qa-tax-p';
  select to_jsonb(p) into row_b from public.personas p where id='qa-tax-p2';
  saved:=public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'persona','merge',jsonb_build_object(
    'sources',jsonb_build_array(jsonb_build_object('id','qa-tax-p2','version',row_b->'updated_at')),'target',jsonb_build_object('id','qa-tax-p','version',row_a->'updated_at')));
  if (select persona from public.ads where id='qa-tax-ad')<>'Busy people' or saved->'row'->>'id'<>'qa-tax-p' then raise exception 'Persona direction failed'; end if;
  insert into public.angles(id,product_id,name) values('qa-tax-token','qa-taxonomy-fixture','Token'),('Token','qa-taxonomy-fixture','Other real ID'),('qa-tax-empty','qa-taxonomy-fixture','');
  insert into public.matrix_cells(product_id,angle_id,persona_id) values('qa-taxonomy-fixture','Token','qa-tax-p');
  select to_jsonb(a) into row_a from public.angles a where id='qa-tax-token';
  values_data:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id',row_a->>'id','version',row_a->'updated_at')),'fields','{"name":"Renamed token","source_link":"","notes":""}'::jsonb);
  values_data:=values_data||jsonb_build_object('renameRevision',public.qa_taxonomy_rename_preview('qa-taxonomy-fixture','angle',values_data->'sources'->0,'Renamed token')->>'revision');
  perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','save',values_data);
  if not exists(select 1 from public.matrix_cells where product_id='qa-taxonomy-fixture' and angle_id='Token') then raise exception 'Real Matrix ID misread as legacy name'; end if;
  select to_jsonb(a) into row_a from public.angles a where id='qa-tax-empty';
  values_data:=jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id',row_a->>'id','version',row_a->'updated_at')),'fields','{"name":"Previously blank","source_link":"","notes":""}'::jsonb);
  values_data:=values_data||jsonb_build_object('renameRevision',public.qa_taxonomy_rename_preview('qa-taxonomy-fixture','angle',values_data->'sources'->0,'Previously blank')->>'revision');
  perform public.qa_taxonomy_mutate('qa-taxonomy-fixture',gen_random_uuid(),'angle','save',values_data);
  if (select angle from public.ads where id='qa-tax-ad')<>'' then raise exception 'Blank taxonomy captured untagged creatives'; end if;
end $$;
reset role;
do $$ begin
  if (select angle from public.ads where id='qa-tax-foreign')<>'Focus' then raise exception 'Foreign row changed'; end if;
  if has_function_privilege('anon','public.qa_taxonomy_mutate(text,uuid,text,text,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_taxonomy_receipts','SELECT')
    or has_function_privilege('authenticated','public.qa_taxonomy_retag(jsonb,text,text[],text)','EXECUTE') then raise exception 'Permissions exposed'; end if;
end $$;
