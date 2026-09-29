insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000249','product-admin@example.test','{"role":"admin","must_change_password":false}'),('00000000-0000-4000-8000-000000000250','product-member@example.test','{"role":"member","must_change_password":false}');
insert into public.products(id,name,config) values('qa-product-admin-fixture','Product controls fixture','{"clickup_list_id":"1301130000002447","clickup_sync":{"list_id":"1301130000002447"},"tracker_saved_views":[1],"production":{"offer":"Keep"}}'),('qa-product-admin-other','Other product','{}');
insert into public.ads(id,product_id,format_name,meta) values('qa-product-admin-ad','qa-product-admin-fixture','Keep existing value','{"creativeStructure":"Old choice"}'),('qa-product-admin-foreign','qa-product-admin-other','Foreign','{}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000249","role":"authenticated"}',true);
set local role authenticated;
do $$
declare request_id uuid:=gen_random_uuid(); req jsonb; saved jsonb; snapshot jsonb; p public.products%rowtype; catalog jsonb:='{"creativeStructure":[{"name":"QA choice","desc":"Example"}],"hookType":[],"productionStyle":[]}'; created text;
begin
  req:='{"name":"Fresh QA product","color":"#119944"}'; created:='qa-prod-'||request_id::text;
  saved:=public.qa_product_mutate(request_id,'create',created,null,req);
  if saved->'product'->>'name'<>'Fresh QA product' or saved->>'dispatchEnabled'<>'false' then raise exception 'Creation receipt failed'; end if;
  if public.qa_product_mutate(request_id,'create',created,null,req)<>saved then raise exception 'Create replay failed'; end if;
  begin perform public.qa_product_mutate(request_id,'create',created,null,req||'{"name":"Different"}'); raise exception 'FAILED identity';
  exception when others then if sqlerrm<>'Product request identity conflicts' then raise; end if; end;
  begin request_id:=gen_random_uuid(); perform public.qa_product_mutate(request_id,'create','qa-prod-'||request_id::text,null,req); raise exception 'FAILED duplicate';
  exception when others then if sqlerrm<>'Product name already exists' then raise; end if; end;
  select * into p from public.products where id='qa-product-admin-fixture';
  saved:=public.qa_product_mutate(gen_random_uuid(),'fields',p.id,p.updated_at,jsonb_build_object('catalog',catalog));
  if saved->'product'->'config'->'field_options'<>catalog or saved->'product'->'config'->'tracker_saved_views'<>'[1]' then raise exception 'Field options clobbered config'; end if;
  if (select meta->>'creativeStructure' from public.ads where id='qa-product-admin-ad')<>'Old choice' then raise exception 'Existing ad value changed'; end if;
  select * into p from public.products where id='qa-product-admin-fixture';
  begin perform public.qa_product_mutate(gen_random_uuid(),'fields',p.id,p.updated_at,jsonb_build_object('catalog',jsonb_set(catalog,'{creativeStructure}',catalog->'creativeStructure'||'[{"name":"qa choice","desc":"Duplicate"}]'))); raise exception 'FAILED duplicate option';
  exception when others then if sqlerrm<>'Duplicate field option' then raise; end if; end;
  begin perform public.qa_product_mutate(gen_random_uuid(),'fields',p.id,p.updated_at-interval '1 day',jsonb_build_object('catalog',catalog)); raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'Product changed%' then raise; end if; end;
  begin perform public.qa_product_mutate(gen_random_uuid(),'unlink',p.id,p.updated_at,'{"confirmName":"wrong"}'); raise exception 'FAILED confirmation';
  exception when others then if sqlerrm<>'Confirm the exact product name' then raise; end if; end;
  saved:=public.qa_product_mutate(gen_random_uuid(),'unlink',p.id,p.updated_at,jsonb_build_object('confirmName',p.name));
  if saved->'product'->'config' ? 'clickup_sync' or saved->'product'->'config' ? 'clickup_list_id' or saved->'product'->'config'->'production'<>'{"offer":"Keep"}' then raise exception 'Unlink failed or clobbered settings'; end if;
  if not exists(select 1 from public.ads where id='qa-product-admin-ad') then raise exception 'Unlink removed ads'; end if;
  snapshot:=public.qa_product_delete_preview(p.id);
  if snapshot->'counts'->>'ads'<>'1' or (snapshot->>'blocked')::boolean then raise exception 'Bad deletion manifest'; end if;
  update public.ads set format_name='Changed after preview' where id='qa-product-admin-ad';
  select * into p from public.products where id=p.id;
  begin perform public.qa_product_mutate(gen_random_uuid(),'delete',p.id,p.updated_at,jsonb_build_object('confirmName',p.name,'revision',snapshot->>'revision')); raise exception 'FAILED manifest';
  exception when others then if sqlerrm not like 'Product data changed since preview%' then raise; end if; end;
  insert into public.inspiration_queue(id,ins_id,product_id,url,status) values('00000000-0000-4000-8000-000000000251','qa-product-admin-inspiration',p.id,'https://example.test/queued','pending');
  snapshot:=public.qa_product_delete_preview(p.id);
  if not (snapshot->>'blocked')::boolean then raise exception 'Active queue not flagged'; end if;
  begin perform public.qa_product_mutate(gen_random_uuid(),'delete',p.id,p.updated_at,jsonb_build_object('confirmName',p.name,'revision',snapshot->>'revision')); raise exception 'FAILED work guard';
  exception when others then if sqlerrm not like 'Product has queued or running work%' then raise; end if; end;
  delete from public.inspiration_queue where id='00000000-0000-4000-8000-000000000251';
  snapshot:=public.qa_product_delete_preview(p.id); request_id:=gen_random_uuid(); req:=jsonb_build_object('confirmName',p.name,'revision',snapshot->>'revision');
  saved:=public.qa_product_mutate(request_id,'delete',p.id,p.updated_at,req);
  if saved->'product'<>'null' or exists(select 1 from public.ads where id='qa-product-admin-ad') or exists(select 1 from public.products where id=p.id) then raise exception 'Deletion failed'; end if;
  if public.qa_product_mutate(request_id,'delete',p.id,p.updated_at,req)<>saved then raise exception 'Deleted product receipt was lost'; end if;
  if not exists(select 1 from public.ads where id='qa-product-admin-foreign') then raise exception 'Foreign data changed'; end if;
  if not exists(select 1 from public.admin_audit_log where action='qa_product_delete' and target_product=p.id) then raise exception 'Audit missing'; end if;
  snapshot:=public.qa_product_delete_preview(created);
  select * into p from public.products where id=created;
  perform public.qa_product_mutate(gen_random_uuid(),'delete',created,p.updated_at,jsonb_build_object('confirmName',p.name,'revision',snapshot->>'revision'));
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000250","role":"authenticated"}',true);
do $$ begin
  begin perform public.qa_product_delete_preview('qa-product-admin-other'); raise exception 'FAILED member';
  exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
reset role;
insert into public.qa_clickup_creations(id,product_id,ad_id,action_id,list_id,state,payload,lease_token,lease_until)
  values('00000000-0000-4000-8000-000000000252','qa-product-admin-other','qa-product-admin-foreign',gen_random_uuid(),'1301130000002447','uncertain','{}',gen_random_uuid(),now());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000249","role":"authenticated"}',true);
set local role authenticated;
do $$ declare p public.products%rowtype; begin
  select * into p from public.products where id='qa-product-admin-other';
  begin perform public.qa_product_mutate(gen_random_uuid(),'unlink',p.id,p.updated_at,jsonb_build_object('confirmName',p.name)); raise exception 'FAILED recovery guard';
  exception when others then if sqlerrm not like 'Resolve pending ClickUp creation%' then raise; end if; end;
  if not (public.qa_product_delete_preview(p.id)->>'blocked')::boolean then raise exception 'Uncertain creation not flagged'; end if;
end $$;
reset role;
update public.profiles set must_change_password=true where id='00000000-0000-4000-8000-000000000249';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000249","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.qa_product_delete_preview('qa-product-admin-other'); raise exception 'FAILED password gate';
  exception when others then if sqlerrm<>'Active QA administrator access is required' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_product_manifest(text,boolean)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_product_admin_receipts','SELECT') then raise exception 'Permissions exposed'; end if;
end $$;
