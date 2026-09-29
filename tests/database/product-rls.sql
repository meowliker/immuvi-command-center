-- Every fixture and policy change is rolled back by check-qa-database-suite.mjs.
do $$ declare t text; begin
  foreach t in array array['products','ads','manual_actions','angles','personas','angle_personas','matrix_cells',
    'inspirations','inspiration_queue','inspiration_results','deleted_ads','activity_events',
    'producer_runs','strategist_memory','strategist_processed','strategist_runs',
    'competitor_brands','competitor_creatives','competitor_research_queue','strategist_recommendations',
    'task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass)
      or has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('authenticated','public.'||t,'TRUNCATE')
      or exists(select 1 from pg_policies where schemaname='public' and tablename=t
        and (roles<>array['authenticated']::name[] or qual='true' or with_check='true'))
      then raise exception 'Unsafe table boundary: %',t; end if;
  end loop;
end $$;
insert into public.products(id,name,config) values
 ('qa-rls-own','RLS fixture','{"clickup_list_id":"1301130000002447"}'),('qa-rls-foreign','Foreign fixture','{}');
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000401','qa-rls-member@example.test','{"must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000402','qa-rls-admin@example.test','{"role":"admin","must_change_password":false}'),
 ('00000000-0000-4000-8000-000000000403','qa-rls-forced@example.test','{"must_change_password":true}'),
 ('00000000-0000-4000-8000-000000000404','qa-rls-inactive@example.test','{"must_change_password":false}');
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000404';
insert into public.user_products(user_id,product_id) values
 ('00000000-0000-4000-8000-000000000401','qa-rls-own'),
 ('00000000-0000-4000-8000-000000000403','qa-rls-own'),
 ('00000000-0000-4000-8000-000000000404','qa-rls-own');
insert into public.ads(id,product_id,format_name) values
 ('qa-rls-own-ad','qa-rls-own','Own'),('qa-rls-foreign-ad','qa-rls-foreign','Foreign');
insert into public.task_video_winners(ad_id,drive_file_id,file_name) values
 ('qa-rls-own-ad','qa-rls-own-file','Own'),('qa-rls-foreign-ad','qa-rls-foreign-file','Foreign');
insert into public.task_drive_cache(ad_id,drive_file_id,file_name) values
 ('qa-rls-own-ad','qa-rls-own-file','Own'),('qa-rls-foreign-ad','qa-rls-foreign-file','Foreign');
insert into public.variation_briefs(ad_id,drive_file_id,brief_markdown) values
 ('qa-rls-own-ad','qa-rls-own-file','Own'),('qa-rls-foreign-ad','qa-rls-foreign-file','Foreign');
insert into public.variation_brief_queue(parent_ad_id,target_ad_id,drive_file_id,status) values
 ('qa-rls-own-ad','qa-rls-own-ad','qa-rls-own-file','failed'),
 ('qa-rls-foreign-ad','qa-rls-foreign-ad','qa-rls-foreign-file','failed'),
 ('qa-rls-own-ad','qa-rls-foreign-ad','qa-rls-mixed-file','failed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}',true);
set local role authenticated;
do $$ declare changed int; t text; n int; stamp timestamptz; result jsonb; begin
  if not public.has_product('qa-rls-own') or public.has_product('qa-rls-foreign') or public.is_admin() then raise exception 'Member access helper failed'; end if;
  if (select count(*) from public.products where id like 'qa-rls-%')<>1
    or (select count(*) from public.ads where id like 'qa-rls-%')<>1 then raise exception 'Foreign product read leaked'; end if;
  update public.ads set format_name='Denied' where id='qa-rls-foreign-ad';
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Foreign update accepted'; end if;
  delete from public.ads where id='qa-rls-foreign-ad';
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Foreign delete accepted'; end if;
  begin
    insert into public.ads(id,product_id,format_name) values('qa-rls-forged','qa-rls-foreign','Denied');
    raise exception 'Foreign insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.ads set product_id='qa-rls-foreign' where id='qa-rls-own-ad';
    raise exception 'Foreign reparent accepted';
  exception when insufficient_privilege then null; end;
  update public.products set config='{"clickup_list_id":"production"}' where id='qa-rls-own';
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Member settings edit accepted'; end if;
  foreach t in array array['task_video_winners','task_drive_cache','variation_briefs'] loop
    execute format('select count(*) from public.%I where ad_id like ''qa-rls-%%''',t) into n;
    if n<>1 then raise exception 'Auxiliary read leaked: %',t; end if;
    begin
      execute format('update public.%I set ad_id=''qa-rls-foreign-ad'' where ad_id=''qa-rls-own-ad''',t);
      raise exception 'Auxiliary foreign write accepted: %',t;
    exception when insufficient_privilege then null; end;
  end loop;
  if (select count(*) from public.variation_brief_queue where drive_file_id like 'qa-rls-%')<>1 then raise exception 'Mixed queue read leaked'; end if;
  begin
    insert into public.variation_brief_queue(parent_ad_id,target_ad_id,drive_file_id,status)
      values('qa-rls-own-ad','qa-rls-foreign-ad','qa-rls-forged-file','failed');
    raise exception 'Mixed queue write accepted';
  exception when insufficient_privilege then null; end;
  -- Legitimate member writes and validated product-metadata updates still work.
  select updated_at into stamp from public.ads where id='qa-rls-own-ad';
  perform public.qa_tracker_save('qa-rls-own','qa-rls-own-ad',stamp,'{"format_name":"Member saved"}','{}');
  select updated_at into stamp from public.products where id='qa-rls-own';
  result:=public.apply_qa_clickup_sync('qa-rls-own','1301130000002447',stamp,'{"fetched":0,"skipped":0,"ads":[],"actions":[]}');
  if result->>'fetched'<>'0' then raise exception 'Member sync blocked'; end if;
  begin
    perform public.qa_tracker_access('qa-rls-foreign'); raise exception 'Foreign lock accepted';
  exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
end $$;
reset role;
-- Existing sessions lose direct table access immediately when account state changes.
update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000401';
set local role authenticated;
do $$ declare actor text; begin
  foreach actor in array array['401','403','404'] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000'||actor,'role','authenticated')::text,true);
    if public.has_product('qa-rls-own') or exists(select 1 from public.ads where id like 'qa-rls-%')
      or exists(select 1 from public.task_video_winners where ad_id like 'qa-rls-%') then raise exception 'Blocked account retained data access: %',actor; end if;
    if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Password/account gate cannot read own profile'; end if;
  end loop;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}',true);
  if (select count(*) from public.products where id like 'qa-rls-%')<>2 then raise exception 'Admin read failed'; end if;
  update public.products set name='Admin settings' where id='qa-rls-own';
  if not found then raise exception 'Admin settings failed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.ads; raise exception 'Anonymous read accepted'; exception when insufficient_privilege then null; end;
  begin perform public.qa_tracker_access('qa-rls-own'); raise exception 'Anonymous RPC accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
