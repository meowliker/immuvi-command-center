-- User-authorized QA list rotation. Apply only to QA project entgcnlfsnysnwyadzzp.
-- Existing tasks are not moved, deleted or relabeled. Historical migrations stay intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare
  old_list constant text := '901616718146';
  new_list constant text := '1301130000002447';
  signature text;
  routine regprocedure;
  definition text;
begin
  lock table public.qa_clickup_creations in access exclusive mode;
  if exists(select 1 from public.qa_clickup_creations where list_id <> new_list) then
    raise exception 'Resolve and archive prior-list creation receipts before changing the QA allowlist';
  end if;
  foreach signature in array array[
    'public.apply_qa_clickup_sync(text,text,timestamptz,jsonb)',
    'public.save_qa_clickup_link(text,text,text,jsonb,timestamptz)',
    'public.qa_creation_claim(text,text,uuid,uuid,timestamptz,timestamptz,timestamptz,jsonb)',
    'public.qa_plan_repair(text,text,timestamptz,uuid,timestamptz,timestamptz,text,text,uuid,uuid,uuid,jsonb)',
    'public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)',
    'public.qa_stale_cleanup_scope(uuid,text,jsonb,timestamptz)',
    'public.qa_stale_cleanup_preview(uuid,text,jsonb,timestamptz)'
  ] loop
    routine := to_regprocedure(signature);
    if routine is null then raise exception 'Missing QA routine: %', signature; end if;
    definition := pg_get_functiondef(routine);
    if position(quote_literal(old_list) in definition) = 0 then
      raise exception 'Unexpected QA routine allowlist: %', signature;
    end if;
    -- Keep every permission, version check and ownership check exactly as installed.
    execute replace(definition, quote_literal(old_list), quote_literal(new_list));
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and position(old_list in p.prosrc)>0) then
    raise exception 'An unreviewed database routine still references the old test list';
  end if;
end $$;
alter table public.qa_clickup_creations drop constraint qa_clickup_creations_list_id_check;
alter table public.qa_clickup_creations add constraint qa_clickup_creations_list_id_check
  check(list_id='1301130000002447');
commit;
