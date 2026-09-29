insert into public.products(id,name,config) values('qa-detail-fixture','Detail fixture','{}'),('qa-detail-foreign','Other detail','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000243','detail-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000243','qa-detail-fixture');
insert into public.inspirations(id,product_id,url,title,status,data) values('QA-DETAIL','qa-detail-fixture','https://example.test/detail','Old','Saved','{"formatName":"Old","notes":"keep","_clickupDocPageUrl":"https://example.test/brief","_classificationBrief":{"why_it_works":"keep"}}');
insert into public.ads(id,product_id,format_name,status,meta) values('qa-detail-child','qa-detail-fixture','Old','Testing','{"_fromInspoId":"QA-DETAIL"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000243","role":"authenticated"}',true);
set local role authenticated;
do $$
declare i public.inspirations%rowtype; a public.ads%rowtype; req uuid:=gen_random_uuid(); saved jsonb; payload jsonb; before_version timestamptz;
begin
 select * into i from public.inspirations where id='QA-DETAIL';select * into a from public.ads where id='qa-detail-child';before_version:=i.updated_at;
 payload:=jsonb_build_object('fields','{"formatName":"New","formatDetail":"Specific detail"}'::jsonb,'queue',null,'children',jsonb_build_array(jsonb_build_object('id',a.id,'version',a.updated_at)));
 begin perform public.qa_inspiration_detail('qa-detail-foreign',req,'save',i.id,i.updated_at,payload);raise exception 'FAILED access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin perform public.qa_inspiration_detail(i.product_id,req,'save',i.id,i.updated_at-interval '1 second',payload);raise exception 'FAILED stale';
 exception when others then if sqlerrm not like 'Inspiration changed.%' then raise; end if; end;
 begin perform public.qa_inspiration_detail(i.product_id,req,'save',i.id,i.updated_at,jsonb_set(payload,'{children}','[]'));raise exception 'FAILED children';
 exception when others then if sqlerrm not like 'Linked creatives changed.%' then raise; end if; end;
 saved:=public.qa_inspiration_detail(i.product_id,req,'save',i.id,i.updated_at,payload);
 if saved->'row'->'data'->>'creativeUSP'<>'New '||chr(8212)||' Specific detail' or saved->'row'->'data'->>'notes'<>'keep'
   or saved->'row'->'data'->>'_clickupDocPageUrl'<>'https://example.test/brief' or saved->'row'->'data'->'_classificationBrief'<>i.data->'_classificationBrief'
   or (select format_name from public.ads where id=a.id)<>'New' or saved->>'dispatchEnabled'<>'false' then raise exception 'Detail/rename did not preserve contracts'; end if;
 if public.qa_inspiration_detail(i.product_id,req,'save',i.id,before_version,payload)<>saved then raise exception 'Replay failed'; end if;
 begin perform public.qa_inspiration_detail(i.product_id,req,'save',i.id,before_version,jsonb_set(payload,'{fields,formatDetail}','"Other"'));raise exception 'FAILED collision';
 exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
 i:=jsonb_populate_record(i,saved->'row');
 begin perform public.qa_inspiration_detail(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,'{"fields":{"formatDetail":"x","_clickupDocPageUrl":"evil"}}');raise exception 'FAILED protected field';
 exception when others then if sqlerrm not like 'Unsupported inspiration field:%' then raise; end if; end;
 saved:=public.qa_inspiration_detail(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,'{"fields":{"formatDetail":""},"queue":null}');
 if saved->'row'->'data'->>'creativeUSP'<>'New' then raise exception 'Clear failed'; end if;
 i:=jsonb_populate_record(i,saved->'row');
 reset role;
 insert into public.inspiration_queue(product_id,ins_id,url,status) values(i.product_id,i.id,i.url,'processing');
 select jsonb_build_object('fields','{"formatDetail":"blocked"}'::jsonb,'queue',to_jsonb(q)) into payload from public.inspiration_queue q where ins_id=i.id;
 set local role authenticated;
 begin perform public.qa_inspiration_detail(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,payload);raise exception 'FAILED active queue';
 exception when others then if sqlerrm not like 'Wait for the active classifier%' then raise; end if; end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.qa_inspiration_detail(text,uuid,text,text,timestamptz,jsonb)','EXECUTE') then raise exception 'Anonymous access'; end if; end $$;
