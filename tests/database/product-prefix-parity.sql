do $$ begin
  if public.qa_product_initials('Astro Rekha')<>'AR' or public.qa_product_initials('Immuvi')<>'I'
    or public.qa_product_initials(E'  QA\tTest\nProduct Four  ')<>'QTP' or public.qa_product_initials('')<>'INS' then raise exception 'Incorrect product prefix'; end if;
end $$;
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-4000-8000-000000000291','prefix-parity@example.test','{"role":"admin","must_change_password":false}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000291","role":"authenticated"}',true);
set local role authenticated;
do $$ declare req uuid:='00000000-0000-4000-8000-000000000292'; saved jsonb; begin
  saved:=public.qa_product_mutate(req,'create','qa-prod-'||req::text,null,'{"name":"QA Prefix Parity","color":"#112233"}');
  if saved->'product'->'config'->>'ins_prefix'<>'QPP' then raise exception 'Create prefix mismatch'; end if;
  if public.qa_product_mutate(req,'create','qa-prod-'||req::text,null,'{"name":"QA Prefix Parity","color":"#112233"}')<>saved then raise exception 'Replay changed'; end if;
  if (select count(*) from public.admin_audit_log where meta->>'requestId'=req::text)<>1 then raise exception 'Duplicate audit'; end if;
  begin perform public.qa_product_initials('Forged'); raise exception 'FAILED private helper'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- A pre-existing receipt must retain its historical prefix on replay.
update public.products set config=jsonb_set(config,'{ins_prefix}','"OLD"') where id='qa-prod-00000000-0000-4000-8000-000000000292';
update public.qa_product_admin_receipts set response=jsonb_set(response,'{product,config,ins_prefix}','"OLD"') where request_id='00000000-0000-4000-8000-000000000292';
set local role authenticated;
do $$ declare saved jsonb; begin
  saved:=public.qa_product_mutate('00000000-0000-4000-8000-000000000292','create','qa-prod-00000000-0000-4000-8000-000000000292',null,'{"name":"QA Prefix Parity","color":"#112233"}');
  if saved->'product'->'config'->>'ins_prefix'<>'OLD' then raise exception 'Historical replay rewritten'; end if;
end $$;
reset role;
