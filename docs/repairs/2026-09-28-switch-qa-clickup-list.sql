-- Explicitly requested QA product link change. No ClickUp task mutation.
-- Execute only against project entgcnlfsnysnwyadzzp after the allowlist migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
declare p public.products%rowtype; before_config jsonb;
begin
  lock table public.products in share row exclusive mode;
  lock table public.qa_clickup_creations in share row exclusive mode;
  select * into p from public.products where id='qa-sample-astrorekha' for update;
  if not found or p.name <> 'AstroRekha - QA Sample'
    or p.config->>'clickup_list_id' is distinct from '901616718146' then
    raise exception 'QA product link changed; inspect before retrying';
  end if;
  if exists(select 1 from public.products where id <> p.id and
    coalesce(config->>'clickup_list_id',config->>'clickupListId')='1301130000002447') then
    raise exception 'New test list is already linked to another product';
  end if;
  if (public.qa_product_manifest(p.id)->>'blocked')::boolean
    or exists(select 1 from public.qa_image_runs where product_id=p.id and status in ('pending','running')) then
    raise exception 'Resolve active QA work before relinking';
  end if;
  if exists(select 1 from public.admin_audit_log where action='qa_clickup_list_rotated_20260928' and target_product=p.id) then
    raise exception 'List rotation already recorded';
  end if;
  before_config := p.config;
  update public.products set config=(config-array['clickupListId','clickupListName','clickup_sync','last_synced_at_ms','last_synced_count'])
    || jsonb_build_object('clickup_list_id','1301130000002447','clickup_list_name','Immuvi Test 1',
      'clickup_sync',jsonb_build_object('list_id','1301130000002447','mappings','{}'::jsonb))
    where id=p.id returning * into p;
  insert into public.admin_audit_log(actor_id,action,target_product,meta) values(null,'qa_clickup_list_rotated_20260928',p.id,
    jsonb_build_object('source','operator-cli: explicit user request','projectRef','entgcnlfsnysnwyadzzp',
      'beforeConfig',before_config,'afterConfig',p.config,'remoteTasksChanged',0,'localTasksChanged',0));
end $$;
commit;
