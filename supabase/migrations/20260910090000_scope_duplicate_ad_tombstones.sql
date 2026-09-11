-- A duplicate-row retirement must not delete the surviving ClickUp task.
create or replace function public.ads_normalize_sync_identity()
returns trigger language plpgsql as $$
declare
  owner_name text;
  owner_list text;
  source_list text;
begin
  select name, config->>'clickup_list_id' into owner_name, owner_list
    from public.products where id = new.product_id;
  source_list := coalesce(nullif(new.meta->>'clickupListId', ''), nullif(new.meta->>'listId', ''));
  if owner_list is not null and source_list = owner_list then
    new.meta := coalesce(new.meta, '{}'::jsonb) || jsonb_build_object(
      '_syncProductId', new.product_id, '_syncProductName', owner_name);
  end if;

  -- Stale clients may re-save the retired row's old task ID. Keep it row-only.
  if tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is not null
     and old.meta->>'_supersededByAdId' is not null then
    new.clickup_task_id := null;
    new.meta := coalesce(new.meta, '{}'::jsonb) || jsonb_build_object(
      '_supersededByAdId', old.meta->>'_supersededByAdId',
      '_supersededClickUpTaskId', old.meta->>'_supersededClickUpTaskId');
  end if;
  return new;
end;
$$;

drop trigger if exists ads_normalize_sync_identity on public.ads;
create trigger ads_normalize_sync_identity before insert or update on public.ads
for each row execute function public.ads_normalize_sync_identity();

create or replace function public.ads_collapse_local_dup_on_sync()
returns trigger language plpgsql as $$
declare
  victim record;
begin
  if new.clickup_task_id is null or new.clickup_task_id = ''
     or new.id <> new.clickup_task_id or new.deleted_at is not null then
    return new;
  end if;

  for victim in
    select a.id from public.ads a
    where a.product_id = new.product_id and a.deleted_at is null
      and a.id <> new.id and a.id ~ '^AD-[0-9]+'
      and a.clickup_task_id = new.clickup_task_id
      and not exists (
        select 1 from public.deleted_ads d where d.id = a.id
          and d.deleted_by is distinct from 'trigger:collapse_local_dup_on_sync'
      )
  loop
    update public.ads set deleted_at = now(), clickup_task_id = null,
      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
        '_supersededByAdId', new.id, '_supersededClickUpTaskId', new.clickup_task_id)
      where id = victim.id;
    insert into public.deleted_ads(id, product_id, clickup_task_id, deleted_at, deleted_by)
      values(victim.id, new.product_id, null, now(), 'trigger:collapse_local_dup_on_sync')
      on conflict(id) do update set clickup_task_id = null
      where deleted_ads.deleted_by = 'trigger:collapse_local_dup_on_sync';

    update public.manual_actions set payload = payload
      || case when payload->>'sourceAdId' = victim.id then jsonb_build_object('sourceAdId', new.id) else '{}'::jsonb end
      || case when payload->>'_sourceAdId' = victim.id then jsonb_build_object('_sourceAdId', new.id) else '{}'::jsonb end
      || case when payload->>'adId' = victim.id then jsonb_build_object('adId', new.id) else '{}'::jsonb end
      where product_id = new.product_id and
        (payload->>'sourceAdId' = victim.id or payload->>'_sourceAdId' = victim.id or payload->>'adId' = victim.id);

    update public.matrix_cells m set
      creative_assignments = (
        select coalesce(jsonb_agg(mapped.value order by mapped.first_position), '[]'::jsonb)
        from (
          select case when value = to_jsonb(victim.id::text) then to_jsonb(new.id::text) else value end as value,
            min(ordinality) as first_position
          from jsonb_array_elements(m.creative_assignments) with ordinality
          group by case when value = to_jsonb(victim.id::text) then to_jsonb(new.id::text) else value end
        ) mapped
      ),
      meta = case when jsonb_typeof(m.meta->'per_ad') = 'object' and (m.meta->'per_ad') ? victim.id then
        jsonb_set(m.meta, '{per_ad}', ((m.meta->'per_ad') - victim.id) || jsonb_build_object(new.id,
          (m.meta->'per_ad'->victim.id) || coalesce(m.meta->'per_ad'->new.id, '{}'::jsonb)))
        else m.meta end
      where m.product_id = new.product_id and
        (m.creative_assignments @> jsonb_build_array(victim.id) or (m.meta->'per_ad') ? victim.id);
  end loop;
  return new;
end;
$$;
