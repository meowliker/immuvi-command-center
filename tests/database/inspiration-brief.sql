insert into public.products(id,name,config) values('qa-brief-fixture','Brief fixture','{}'),('qa-brief-foreign','Foreign brief fixture','{}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000242','brief-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000242','qa-brief-fixture');
insert into public.inspirations(id,product_id,url,title,status,data) values('QA-BRIEF','qa-brief-fixture','https://example.test/source','Source','Saved','{"notes":"preserve","_classificationBrief":{"why_it_works":"preserve"}}');
insert into public.inspirations(id,product_id,url,title,status,data) values('QA-BRIEF-EXISTING','qa-brief-fixture','https://example.test/existing','Existing','Saved','{"_clickupDocPageUrl":"","briefUrl":"https://app.clickup.com/123/v/dc/existing/page"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000242","role":"authenticated"}',true);
set local role authenticated;
do $$
declare i public.inspirations%rowtype; req uuid:=gen_random_uuid(); saved jsonb; replay jsonb; url text:='https://app.clickup.com/123/v/dc/doc/page';
begin
 select * into i from public.inspirations where id='QA-BRIEF';
 begin perform public.qa_inspiration_brief('qa-brief-foreign',req,i.id,i.updated_at,url);raise exception 'FAILED access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin perform public.qa_inspiration_brief('qa-brief-fixture',req,i.id,i.updated_at,'https://evil.test/doc');raise exception 'FAILED URL';
 exception when others then if sqlerrm<>'Invalid brief link or source version' then raise; end if; end;
 begin perform public.qa_inspiration_brief('qa-brief-fixture',req,i.id,i.updated_at-interval '1 second',url);raise exception 'FAILED stale';
 exception when others then if sqlerrm not like 'Inspiration changed.%' then raise; end if; end;
 saved:=public.qa_inspiration_brief('qa-brief-fixture',req,i.id,i.updated_at,url);
 if saved->'row'->'data'->>'notes'<>'preserve' or saved->'row'->'data'->'_classificationBrief'<>i.data->'_classificationBrief'
   or saved->'row'->'data'->>'_clickupDocPageUrl'<>url or saved->>'dispatchEnabled'<>'false' then raise exception 'Save changed unrelated data'; end if;
 replay:=public.qa_inspiration_brief('qa-brief-fixture',req,i.id,i.updated_at,url);
 if replay<>saved then raise exception 'Receipt replay failed'; end if;
 begin perform public.qa_inspiration_brief('qa-brief-fixture',req,i.id,i.updated_at,url||'2');raise exception 'FAILED collision';
 exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
 begin perform public.qa_inspiration_brief('qa-brief-fixture',gen_random_uuid(),i.id,(saved->'row'->>'updated_at')::timestamptz,url||'2');raise exception 'FAILED overwrite';
 exception when others then if sqlerrm not like 'A brief link is already saved.%' then raise; end if; end;
 select * into i from public.inspirations where id='QA-BRIEF-EXISTING';
 begin perform public.qa_inspiration_brief('qa-brief-fixture',gen_random_uuid(),i.id,i.updated_at,url);raise exception 'FAILED fallback overwrite';
 exception when others then if sqlerrm not like 'A brief link is already saved.%' then raise; end if; end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.qa_inspiration_brief(text,uuid,text,timestamptz,text)','EXECUTE') then raise exception 'Anonymous access'; end if; end $$;
