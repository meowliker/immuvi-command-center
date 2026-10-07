-- One explicit, product-authorized deletion; no cascade to variations or inspirations.
create or replace function public.delete_creative(p_ad_id text, p_product_id text, p_expected_clickup_id text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  current_ad public.ads%rowtype;
  task_ids text[];
  deleted_time timestamptz;
begin
  if auth.uid() is null or not public.has_product(p_product_id) then
    raise exception using errcode = '42501', message = 'Product access denied';
  end if;
  select * into current_ad from public.ads
    where id = p_ad_id and product_id = p_product_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Creative not found in this product';
  end if;
  if nullif(current_ad.meta->>'_supersededByAdId', '') is not null
     or current_ad.meta->>'_productBoundaryQuarantined' = 'true' then
    raise exception using errcode = 'PT409', message = 'Creative identity requires review';
  end if;
  select coalesce(array_agg(distinct task_id), array[]::text[]) into task_ids from (
    select nullif(current_ad.clickup_task_id, '') as task_id
    union all
    select nullif(clickup_task_id, '') from public.deleted_ads
      where id = p_ad_id and product_id = p_product_id and current_ad.deleted_at is not null
    union all
    select nullif(payload->>'_clickupId', '') from public.manual_actions
      where product_id = p_product_id and
        (payload->>'sourceAdId' = p_ad_id or payload->>'adId' = p_ad_id)
  ) ids where task_id is not null;
  if cardinality(task_ids) > 1 or coalesce(task_ids[1], '') <> coalesce(p_expected_clickup_id, '') then
    raise exception using errcode = 'PT409', message = 'Creative task identity changed; refresh before deleting';
  end if;
  if exists (select 1 from public.ads where id <> p_ad_id and deleted_at is null
      and clickup_task_id = any(task_ids)) then
    raise exception using errcode = 'PT409', message = 'Another creative shares this task; review before deleting';
  end if;
  if exists (select 1 from public.deleted_ads where id = p_ad_id and product_id <> p_product_id) then
    raise exception using errcode = 'PT409', message = 'Deletion marker belongs to another product';
  end if;
  deleted_time := coalesce(current_ad.deleted_at, clock_timestamp());
  insert into public.deleted_ads(id, product_id, clickup_task_id, deleted_at, deleted_by)
    values (p_ad_id, p_product_id, task_ids[1], deleted_time, auth.uid()::text)
    on conflict (id) do update set clickup_task_id = excluded.clickup_task_id,
      deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by
      where deleted_ads.product_id = p_product_id;
  if current_ad.deleted_at is null then
    update public.ads set deleted_at = deleted_time where id = p_ad_id and product_id = p_product_id;
  end if;
  delete from public.manual_actions where product_id = p_product_id
    and (payload->>'sourceAdId' = p_ad_id or payload->>'adId' = p_ad_id);
  return jsonb_build_object('id', p_ad_id, 'productId', p_product_id,
    'deletedAt', deleted_time, 'clickupTaskIds', to_jsonb(task_ids));
end;
$$;
revoke all on function public.delete_creative(text,text,text) from public, anon;
grant execute on function public.delete_creative(text,text,text) to authenticated;
notify pgrst, 'reload schema';
