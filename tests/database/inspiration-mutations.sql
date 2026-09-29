insert into public.products(id,name,config) values('qa-inspiration-test','Inspiration fixture','{"clickup_list_id":"1301130000002447","ins_prefix":"QIT"}'),('qa-inspiration-other','Foreign','{"ins_prefix":"OTHER"}');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000201','inspiration-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000201','qa-inspiration-test');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated"}',true);
set local role authenticated;
do $$
declare i public.inspirations%rowtype; q jsonb; r jsonb; replay jsonb; request_id uuid:=gen_random_uuid();
  fields jsonb:='{"mode":"url","fields":{"sourceUrl":"https://example.test/qa-inspiration","platform":"Other"}}';
begin
  begin perform public.qa_inspiration_mutate('qa-inspiration-other',request_id,'create',null,null,fields); raise exception 'FAILED foreign';
  exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
  r:=public.qa_inspiration_mutate('qa-inspiration-test',request_id,'create',null,null,fields);
  if r->>'dispatchEnabled'<>'false' or r->'queue'->>'status'<>'blocked' or r->'queue'->>'worker_assignment'<>'blocked:qa-isolation' then raise exception 'Intake is claimable'; end if;
  replay:=public.qa_inspiration_mutate('qa-inspiration-test',request_id,'create',null,null,fields);
  if replay<>r or (select count(*) from public.inspirations where product_id='qa-inspiration-test')<>1 then raise exception 'Duplicate request was repeated'; end if;
  begin perform public.qa_inspiration_mutate('qa-inspiration-test',request_id,'create',null,null,fields||'{"mode":"manual"}'); raise exception 'FAILED receipt collision';
  exception when others then if sqlerrm<>'Request identity conflicts with a previous operation' then raise; end if; end;
  begin perform public.qa_inspiration_mutate('qa-inspiration-test',gen_random_uuid(),'create',null,null,fields); raise exception 'FAILED duplicate URL';
  exception when others then if sqlerrm not like 'This source URL already exists%' then raise; end if; end;
  i:=jsonb_populate_record(i,r->'row');q:=r->'queue';
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'save',i.id,'2000-01-01',jsonb_build_object('queue',q)); raise exception 'FAILED stale';
  exception when others then if sqlerrm not like 'Inspiration changed.%' then raise; end if; end;
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,'{"fields":{"_clickupDocPageUrl":""}}'); raise exception 'FAILED protected field';
  exception when others then if sqlerrm not like 'Unsupported inspiration field:%' then raise; end if; end;
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'requeue',i.id,i.updated_at,'{}'); raise exception 'FAILED queue version';
  exception when others then if sqlerrm<>'Queue changed. Reopen this inspiration.' then raise; end if; end;
  reset role;
  update public.inspiration_queue set status='failed',attempts=3,claimed_by='old-worker',claimed_at=now(),processed_at=now(),error_message='Old error' where ins_id=i.id;
  select to_jsonb(t) into q from public.inspiration_queue t where ins_id=i.id;
  set local role authenticated;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'requeue',i.id,i.updated_at,jsonb_build_object('queue',q));
  if r->'queue'->>'attempts'<>'0' or r->'queue'->>'claimed_by' is not null or r->'queue'->>'processed_at' is not null or r->'queue'->>'status'<>'blocked' then raise exception 'Retry retained terminal state'; end if;
  i:=jsonb_populate_record(i,r->'row');q:=r->'queue';
  reset role;
  update public.inspiration_queue set status='claimed' where ins_id=i.id;
  select to_jsonb(t) into q from public.inspiration_queue t where ins_id=i.id;
  set local role authenticated;
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'delete',i.id,i.updated_at,jsonb_build_object('queue',q)); raise exception 'FAILED active job';
  exception when others then if sqlerrm not like 'Wait for the active classifier%' then raise; end if; end;
end $$;
reset role;
insert into public.inspirations(id,product_id,url,title,status,data) values('QIT-INS-100','qa-inspiration-test','https://example.test/manual','Old','Saved','{"formatName":"Old","creativeUSP":"Old — detail","_clickupDocPageUrl":"https://example.test/brief","notes":"keep","_dupeType":"similar"}');
insert into public.ads(id,product_id,format_name,status,meta,clickup_task_id) values('qa-inspiration-child','qa-inspiration-test','Old','Testing','{"_fromInspoId":"QIT-INS-100"}','synthetic-task');
insert into public.manual_actions(id,product_id,payload) values('00000000-0000-4000-8000-000000000202','qa-inspiration-test','{"sourceAdId":"qa-inspiration-child","title":"Old","description":"keep"}');
set local role authenticated;
do $$
declare i public.inspirations%rowtype; a public.ads%rowtype; r jsonb; children jsonb; result_id uuid:=gen_random_uuid(); b jsonb; script jsonb;
begin
  select * into i from public.inspirations where id='QIT-INS-100'; select * into a from public.ads where id='qa-inspiration-child';
  children:=jsonb_build_array(jsonb_build_object('id',a.id,'version',a.updated_at));
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,'{"fields":{"formatName":"New"},"children":[]}');raise exception 'FAILED stale children';
  exception when others then if sqlerrm<>'Linked creatives changed. Reopen the rename editor.' then raise; end if; end;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'save',i.id,i.updated_at,jsonb_build_object('fields','{"formatName":"New","notes":""}'::jsonb,'children',children));
  i:=jsonb_populate_record(i,r->'row');
  if i.data->>'_clickupDocPageUrl'<>'https://example.test/brief' or i.data->>'notes'<>'' or i.data->>'creativeUSP'<>'New — detail' or (select format_name from public.ads where id=a.id)<>'New'
    or (select payload->>'title' from public.manual_actions where payload->>'sourceAdId'=a.id)<>'New' then raise exception 'Rename failed to preserve/mirror fields'; end if;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'approve',i.id,i.updated_at); i:=jsonb_populate_record(i,r->'row');
  if i.status<>'Approved' then raise exception 'Approval failed'; end if;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'dismiss_duplicate',i.id,i.updated_at); i:=jsonb_populate_record(i,r->'row');
  if i.data->>'_dupeType'<>'similar' or i.data->>'_dupeBannerDismissed'<>'true' then raise exception 'Duplicate evidence was removed'; end if;
  reset role;
  insert into public.inspiration_results(id,ins_id,product_id,source_url) values(result_id,i.id,i.product_id,i.url);
  set local role authenticated;
  begin perform public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'import',i.id,i.updated_at,jsonb_build_object('result_id',result_id,'result_at',now()));raise exception 'FAILED incomplete import';
  exception when others then if sqlerrm not like 'Classification is incomplete:%' then raise; end if; end;
  script:='{"variation":"Test","intent":"Test","hook_text":"Test","source_format_match":"Test","voice_over_script":"Test","cta":"Test","what_to_change":"Test","why_it_should_work":"Test","script_breakdown":[{"time":"0:00-0:03","label":"HOOK","caption_voice_over":"Test","visual_beat":"Test","editor_note":"Test"}]}';
  b:=jsonb_build_object('frame_by_frame',jsonb_build_array(jsonb_build_object('time','0:00-0:03')),'why_it_works','Test','replication_brief','Test','what_to_test','Test','competitor_intel','Test','our_next_ad','Test','inspiration_script_skeleton','Test','next_ad_scripts',jsonb_build_array(script,script,script));
  reset role;
  update public.inspiration_results set classification='{"hook_type":"Question","creative_structure":"Demo","production_style":"UGC","funnel_type":"TOF","angle":"Custom angle","persona":"Custom persona","creative_usp":"Imported format","creative_hypothesis":"Test"}',brief=b where id=result_id;
  set local role authenticated;
  select jsonb_build_array(jsonb_build_object('id',id,'version',updated_at)) into children from public.ads where id=a.id;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'import',i.id,i.updated_at,jsonb_build_object('result_id',result_id,'result_at',now(),'children',children)); i:=jsonb_populate_record(i,r->'row');
  if i.status<>'Classified' or i.data->'_classificationBrief'<>b or i.data->>'_clickupDocPageUrl'<>'https://example.test/brief'
    or (select format_name from public.ads where id=a.id)<>'Imported format'
    or exists(select 1 from public.angles where product_id=i.product_id and name='Custom angle') then raise exception 'Result import lost contract or created taxonomy'; end if;
  r:=public.qa_inspiration_mutate(i.product_id,gen_random_uuid(),'delete',i.id,i.updated_at);
  if r->>'deleted'<>'true' or exists(select 1 from public.inspirations where id=i.id) or exists(select 1 from public.inspiration_results where id=result_id)
    or not exists(select 1 from public.ads where id=a.id) then raise exception 'Deletion removed downstream creative or kept source'; end if;
end $$;
reset role;
