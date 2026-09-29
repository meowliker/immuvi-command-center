insert into public.products(id,name) values('qa-img-test','Image test'),('qa-img-other','Other');
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-4000-8000-000000000094','image-fixture@example.test','{"must_change_password":false}');
insert into public.user_products(user_id,product_id) values('00000000-0000-4000-8000-000000000094','qa-img-test');
insert into public.ads(id,product_id,format_name,meta) values('qa-img-ad','qa-img-test','Image test','{}'),('qa-img-foreign','qa-img-other','Foreign','{}');
update public.products set config='{"production":{"retained":"Keep this"}}' where id='qa-img-test';
insert into public.qa_image_worker values('local-native',now(),true) on conflict(id) do update set heartbeat_at=now(),generation_available=true;
do $$ begin
  if to_regclass('public.qa_private_workers') is not null then
    insert into public.qa_private_workers(id,owner_id,name,token_hash,heartbeat_at,generation_available)
      values('00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000094','Image fixture',repeat('c',64),now(),true);
  end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000094","role":"authenticated"}',true);
set local role authenticated;
do $$
declare opts jsonb:='{"count":1,"instruction":"test","referenceUrl":"","referenceIds":[],"productName":"Fixture","offer":"","market":"","forbiddenAliases":""}'; r public.qa_image_runs;
begin
 begin
  perform public.qa_generate_images(gen_random_uuid(),'qa-img-other','qa-img-foreign',opts); raise exception 'FAILED foreign access';
 exception when others then if sqlerrm<>'Active product access is required' then raise; end if; end;
 begin
  perform public.qa_generate_images(gen_random_uuid(),'qa-img-test','qa-img-ad',opts||'{"count":11}'); raise exception 'FAILED count validation';
 exception when others then if sqlerrm<>'Choose 1 to 10 images' then raise; end if; end;
 begin
  perform public.qa_generate_images(gen_random_uuid(),'qa-img-test','qa-img-ad',opts||'{"referenceIds":["qa-img-foreign"]}'); raise exception 'FAILED reference scope';
 exception when others then if sqlerrm<>'Reference is outside this product' then raise; end if; end;
 r:=public.qa_generate_images('00000000-0000-4000-8000-000000000095','qa-img-test','qa-img-ad',opts);
 if (select config->'production'->>'retained' from public.products where id='qa-img-test') is distinct from 'Keep this' then raise exception 'Unrelated product configuration lost'; end if;
 if r.status<>'pending' or r.request->'creative'->>'id'<>'qa-img-ad' then raise exception 'Invalid snapshot'; end if;
 perform public.qa_generate_images(r.id,'qa-img-test','qa-img-ad',opts);
 if (select count(*) from public.qa_image_runs where product_id='qa-img-test')<>1 then raise exception 'Duplicate request'; end if;
 begin
  update public.qa_image_runs set status='done' where id=r.id; raise exception 'FAILED direct write';
 exception when insufficient_privilege then null; end;
 begin
  perform public.qa_generate_images(gen_random_uuid(),'qa-img-test','qa-img-ad',opts); raise exception 'FAILED concurrent generation';
 exception when unique_violation then null; end;
 if exists(select 1 from public.qa_image_runs where product_id='qa-img-other') then raise exception 'Foreign run visible'; end if;
end $$;
reset role;
insert into public.qa_image_runs(id,product_id,ad_id,requested_by,request,status) values('00000000-0000-4000-8000-000000000096','qa-img-other','qa-img-foreign','00000000-0000-4000-8000-000000000094','{}','done');
insert into storage.objects(bucket_id,name) values('qa-producer-images','00000000-0000-4000-8000-000000000095/1.png'),('qa-producer-images','00000000-0000-4000-8000-000000000096/1.png');
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects where bucket_id='qa-producer-images' and name like '00000000-0000-4000-8000-00000000009%')<>1 then raise exception 'Storage product isolation failed'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('qa-producer-images','untrusted.png'); raise exception 'FAILED browser upload';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
