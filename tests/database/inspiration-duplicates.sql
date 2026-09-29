insert into public.products(id,name,config) values('qa-dupe-fixture','Duplicate fixture','{}'),('qa-dupe-foreign','Foreign duplicate','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000245','duplicate-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000245','qa-dupe-fixture');
insert into public.inspirations(id,product_id,url,title,status,data) values('QA-DUPE','qa-dupe-fixture','https://example.test/duplicate','Duplicate','Classified','{"angle":"Energy","notes":"keep","_dupeDetail":"legacy evidence","_clickupDocPageUrl":"https://example.test/brief"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000245","role":"authenticated"}',true);
set local role authenticated;
do $$
declare i public.inspirations%rowtype; payload jsonb; signature text; req uuid:=gen_random_uuid(); saved jsonb; previous timestamptz;
begin
 select * into i from public.inspirations where id='QA-DUPE';previous:=i.updated_at;
 signature:=jsonb_build_object('v',1,'productId',i.product_id,'id',i.id,'source',jsonb_build_array('energy','parents','tof','',''),'matches',jsonb_build_array(jsonb_build_array('AD','Name','Winner','exact')))::text;
 payload:=jsonb_build_object('duplicateSignature',signature,'fields','{}'::jsonb);
 begin perform public.qa_inspiration_duplicate_review('qa-dupe-foreign',req,'dismiss_duplicate',i.id,i.updated_at,payload);raise exception 'FAILED access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,req,'save',i.id,i.updated_at,payload);raise exception 'FAILED operation';
 exception when others then if sqlerrm<>'Invalid duplicate review' then raise; end if; end;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,i.updated_at,'{}');raise exception 'FAILED empty';
 exception when others then if sqlerrm<>'Invalid duplicate review' then raise; end if; end;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,i.updated_at,jsonb_set(payload,'{duplicateSignature}',to_jsonb(replace(signature,'qa-dupe-fixture','qa-dupe-foreign'))));raise exception 'FAILED foreign evidence';
 exception when others then if sqlerrm<>'Invalid duplicate evidence identity' then raise; end if; end;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,'2000-01-01',payload);raise exception 'FAILED stale';
 exception when others then if sqlerrm not like 'Inspiration changed%' then raise; end if; end;
 saved:=public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,i.updated_at,payload);
 if saved->'row'->'data'->>'_qaDupeReviewSignature' is distinct from signature or saved->'row'->'data'->>'_dupeBannerDismissed'<>'true'
   or saved->'row'->'data'->>'notes'<>'keep' or saved->'row'->'data'->>'_dupeDetail'<>'legacy evidence' or saved->'row'->'data'->>'_clickupDocPageUrl'<>i.data->>'_clickupDocPageUrl' then raise exception 'Review contract failed'; end if;
 if public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,previous,payload)<>saved then raise exception 'Replay failed'; end if;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,req,'dismiss_duplicate',i.id,previous,jsonb_set(payload,'{duplicateSignature}',to_jsonb(replace(signature,'Winner','Loser'))));raise exception 'FAILED collision';
 exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
 i:=jsonb_populate_record(i,saved->'row');
 reset role;
 insert into public.inspiration_queue(product_id,ins_id,url,status) values(i.product_id,i.id,i.url,'processing');
 select payload||jsonb_build_object('queue',to_jsonb(q)) into payload from public.inspiration_queue q where ins_id=i.id;
 set local role authenticated;
 begin perform public.qa_inspiration_duplicate_review(i.product_id,gen_random_uuid(),'dismiss_duplicate',i.id,i.updated_at,payload);raise exception 'FAILED active worker';
 exception when others then if sqlerrm not like 'Wait for the active classifier%' then raise; end if; end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.qa_inspiration_duplicate_review(text,uuid,text,text,timestamptz,jsonb)','EXECUTE') then raise exception 'Anonymous access'; end if; end $$;
