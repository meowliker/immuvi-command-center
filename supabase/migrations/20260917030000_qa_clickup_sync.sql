-- QA-only import boundary. No production deployment is authorized by this migration.
create or replace function public.apply_qa_clickup_sync(
  p_product_id text, p_list_id text, p_expected_updated_at timestamptz, p_plan jsonb
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  product public.products%rowtype;
  current_ad public.ads%rowtype;
  next_ad public.ads%rowtype;
  current_action public.manual_actions%rowtype;
  item jsonb;
  task_id text;
  imported integer := 0;
  updated integer := 0;
  skipped integer := coalesce((p_plan->>'skipped')::integer, 0);
  action_count integer := 0;
begin
  if auth.uid() is null or not public.has_product(p_product_id) or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and not must_change_password
  ) then raise exception 'Active product access is required'; end if;
  if p_list_id is distinct from '901616718146' then raise exception 'Only the QA test list is permitted'; end if;
  if jsonb_typeof(p_plan->'ads') is distinct from 'array' or jsonb_typeof(p_plan->'actions') is distinct from 'array'
    then raise exception 'Invalid import plan'; end if;

  select * into product from public.products where id = p_product_id for update;
  if not found or product.updated_at is distinct from p_expected_updated_at then
    raise exception 'Product settings changed during sync. Retry with fresh settings.';
  end if;
  if coalesce(product.config->>'clickup_list_id', product.config->>'clickupListId') is distinct from p_list_id then
    raise exception 'Product ClickUp list changed. Nothing was imported.';
  end if;

  -- Serialize tombstone checks with deletion writes. These locks last only for
  -- the database commit, never while waiting for ClickUp HTTP requests.
  lock table public.deleted_ads in share mode;
  lock table public.ads in share row exclusive mode;
  lock table public.manual_actions in share row exclusive mode;
  for item in select value from jsonb_array_elements(p_plan->'ads') loop
    task_id := item->'patch'->>'clickup_task_id';
    if nullif(task_id, '') is null or item->'patch'->'meta'->>'_clickupListId' is distinct from p_list_id then
      raise exception 'Invalid task boundary';
    end if;
    select * into current_ad from public.ads where id = item->>'id';
    if found and current_ad.product_id is distinct from p_product_id then raise exception 'Cross-product creative identity'; end if;
    if current_ad.deleted_at is not null or exists (
      select 1 from public.deleted_ads where product_id = p_product_id and (id = item->>'id' or clickup_task_id = task_id)
    ) then skipped := skipped + 1; continue; end if;
    if current_ad.id is null then
      if item->>'expected_updated_at' is not null then raise exception 'Creative was removed during sync'; end if;
      if item->>'id' is distinct from 'cu:' || p_product_id || ':' || task_id then raise exception 'Invalid new creative identity'; end if;
    elsif current_ad.updated_at is distinct from (item->>'expected_updated_at')::timestamptz then
      raise exception 'Creative changed during sync. Nothing was imported; retry.';
    end if;
    if exists (select 1 from public.ads where product_id = p_product_id
      and id <> item->>'id' and (clickup_task_id = task_id or meta->>'_clickupId' = task_id)) then
      raise exception 'ClickUp task already has another creative. Nothing was imported.';
    end if;
    next_ad := jsonb_populate_record(current_ad, item->'patch');
    next_ad.id := item->>'id';
    next_ad.product_id := p_product_id;
    next_ad.deleted_at := null;
    next_ad.updated_at := now();
    if current_ad.id is null then
      next_ad.created_at := coalesce(next_ad.created_at, now());
      insert into public.ads (id, product_id, format_name, status, ad_link, drive_link, ad_type, funnel_stage,
        angle, persona, parent_ad_id, variation_number, ad_origin, clickup_task_id, meta, created_at, last_status_change_at)
      values (next_ad.id, next_ad.product_id, next_ad.format_name, next_ad.status, next_ad.ad_link, next_ad.drive_link,
        next_ad.ad_type, next_ad.funnel_stage, next_ad.angle, next_ad.persona, next_ad.parent_ad_id,
        next_ad.variation_number, next_ad.ad_origin, next_ad.clickup_task_id, next_ad.meta, next_ad.created_at, next_ad.last_status_change_at);
      imported := imported + 1;
    else
      update public.ads set format_name = next_ad.format_name, status = next_ad.status,
        ad_link = next_ad.ad_link, drive_link = next_ad.drive_link, ad_type = next_ad.ad_type,
        funnel_stage = next_ad.funnel_stage, angle = next_ad.angle, persona = next_ad.persona,
        parent_ad_id = next_ad.parent_ad_id, variation_number = next_ad.variation_number,
        clickup_task_id = task_id, meta = next_ad.meta, last_status_change_at = next_ad.last_status_change_at
        where id = current_ad.id and product_id = p_product_id;
      updated := updated + 1;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_plan->'actions') loop
    select * into current_action from public.manual_actions where id = (item->>'id')::uuid and product_id = p_product_id;
    if not found or current_action.updated_at is distinct from (item->>'expected_updated_at')::timestamptz then
      raise exception 'Action changed during sync. Nothing was imported; retry.';
    end if;
    task_id := coalesce(item->'payload'->>'_clickupId', item->'payload'->>'clickupTaskId');
    if exists (select 1 from public.deleted_ads where product_id = p_product_id and clickup_task_id = task_id) then continue; end if;
    update public.manual_actions set payload = item->'payload', live_status = item->>'live_status'
      where id = current_action.id and product_id = p_product_id;
    action_count := action_count + 1;
  end loop;
  update public.products set config = config || jsonb_build_object(
    'last_synced_at_ms', (extract(epoch from now()) * 1000)::bigint,
    'last_synced_count', (p_plan->>'fetched')::integer
  ) where id = p_product_id;
  return jsonb_build_object('imported', imported, 'updated', updated, 'actions', action_count,
    'skipped', skipped, 'fetched', (p_plan->>'fetched')::integer);
end;
$$;
revoke all on function public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) from public, anon;
grant execute on function public.apply_qa_clickup_sync(text,text,timestamptz,jsonb) to authenticated;

create or replace function public.save_qa_clickup_link(
  p_product_id text, p_list_id text, p_list_name text, p_mappings jsonb, p_expected_updated_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare product public.products%rowtype;
begin
  if auth.uid() is null or not public.is_admin() or not exists (
    select 1 from public.profiles where id = auth.uid() and not must_change_password
  ) then raise exception 'Only an active administrator can configure ClickUp'; end if;
  if p_list_id is distinct from '901616718146' then raise exception 'Only the QA test list is permitted'; end if;
  if jsonb_typeof(p_mappings) is distinct from 'object' then raise exception 'Invalid field mappings'; end if;
  lock table public.products in share row exclusive mode;
  select * into product from public.products where id = p_product_id;
  if not found or product.updated_at is distinct from p_expected_updated_at then
    raise exception 'Product settings changed. Check the connection again before saving.';
  end if;
  if exists (select 1 from public.products where id <> p_product_id
    and coalesce(config->>'clickup_list_id', config->>'clickupListId') = p_list_id) then
    raise exception 'This ClickUp list is already linked to another product';
  end if;
  update public.products set config = (config - 'clickupListId' - 'clickupListName') || jsonb_build_object(
    'clickup_list_id', p_list_id, 'clickup_list_name', p_list_name,
    'clickup_sync', jsonb_build_object('list_id', p_list_id, 'mappings', p_mappings)
  ) where id = p_product_id returning * into product;
  return jsonb_build_object('updated_at', product.updated_at);
end;
$$;
revoke all on function public.save_qa_clickup_link(text,text,text,jsonb,timestamptz) from public, anon;
grant execute on function public.save_qa_clickup_link(text,text,text,jsonb,timestamptz) to authenticated;
