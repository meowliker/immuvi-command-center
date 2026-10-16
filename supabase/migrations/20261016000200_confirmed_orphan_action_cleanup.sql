-- Preview is read-only. Commit requires the exact action selected in preview.
-- Never edit a creative or reuse its possibly foreign, legacy source-ID marker.
create or replace function public.delete_orphan_action(
  p_product_id text, p_source_ad_id text, p_expected_clickup_id text,
  p_action_id uuid default null, p_confirm boolean default false
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  action_row public.manual_actions%rowtype;
  action_ids uuid[];
  task_ids text[];
  marker_id text;
  marker public.deleted_ads%rowtype;
  deleted_time timestamptz;
begin
  if auth.uid() is null or not public.has_product(p_product_id) then
    raise exception using errcode = '42501', message = 'Product access denied';
  end if;
  if nullif(p_source_ad_id,'') is null or (p_confirm and p_action_id is null) then
    raise exception using errcode = 'PT409', message = 'Select and confirm the exact Action Plan entry';
  end if;
  if exists(select 1 from public.ads where product_id=p_product_id and
    (id=p_source_ad_id or (nullif(p_expected_clickup_id,'') is not null and clickup_task_id=p_expected_clickup_id))) then
    raise exception using errcode = 'PT409', message = 'A saved creative exists; use normal creative deletion';
  end if;
  if nullif(p_expected_clickup_id,'') is not null and exists(
    select 1 from public.ads where product_id<>p_product_id and clickup_task_id=p_expected_clickup_id
  ) then
    raise exception using errcode = 'PT409', message = 'Task belongs to another product';
  end if;
  select array_agg(id) into action_ids from public.manual_actions where product_id=p_product_id
    and (payload->>'sourceAdId'=p_source_ad_id or payload->>'adId'=p_source_ad_id)
    and (p_action_id is null or id=p_action_id);
  if coalesce(cardinality(action_ids),0)=0 then
    if p_action_id is not null then
      marker_id := 'orphan-action:' || p_product_id || ':' || p_action_id::text;
      select * into marker from public.deleted_ads where id=marker_id and product_id=p_product_id
        and coalesce(clickup_task_id,'')=coalesce(p_expected_clickup_id,'');
      if found then
        return jsonb_build_object('id',p_source_ad_id,'productId',p_product_id,'actionId',p_action_id,
          'markerId',marker_id,'deletedAt',marker.deleted_at,'alreadyDeleted',true,
          'clickupTaskIds',case when nullif(p_expected_clickup_id,'') is null then '[]'::jsonb else jsonb_build_array(p_expected_clickup_id) end);
      end if;
    end if;
    raise exception using errcode = 'P0002', message = 'No saved orphan action matches this request';
  end if;
  if cardinality(action_ids)<>1 then
    raise exception using errcode = 'PT409', message = 'Multiple actions match; select the exact Action Plan entry';
  end if;
  if p_confirm then
    select * into action_row from public.manual_actions where id=action_ids[1] and product_id=p_product_id for update;
  else
    select * into action_row from public.manual_actions where id=action_ids[1] and product_id=p_product_id;
  end if;
  if not found then
    raise exception using errcode = 'PT409', message = 'Action changed';
  end if;
  if action_row.payload->>'_productBoundaryQuarantined'='true'
    or (nullif(action_row.payload->>'sourceAdId','') is not null and action_row.payload->>'sourceAdId'<>p_source_ad_id)
    or (nullif(action_row.payload->>'adId','') is not null and action_row.payload->>'adId'<>p_source_ad_id) then
    raise exception using errcode = 'PT409', message = 'Action source identity changed';
  end if;
  select coalesce(array_agg(distinct task_id),array[]::text[]) into task_ids from (
    select nullif(action_row.payload->>'_clickupId','') as task_id
    union all select nullif(action_row.payload->>'clickupTaskId','')
  ) ids where task_id is not null;
  if cardinality(task_ids)>1 or coalesce(task_ids[1],'')<>coalesce(p_expected_clickup_id,'') then
    raise exception using errcode = 'PT409', message = 'Action ClickUp identity changed';
  end if;
  marker_id := 'orphan-action:' || p_product_id || ':' || action_row.id::text;
  select * into marker from public.deleted_ads where id=marker_id;
  if found and (marker.product_id<>p_product_id or coalesce(marker.clickup_task_id,'')<>coalesce(task_ids[1],'')) then
    raise exception using errcode = 'PT409', message = 'Deletion marker conflict';
  end if;
  deleted_time := coalesce(marker.deleted_at,clock_timestamp());
  if p_confirm then
    insert into public.deleted_ads(id,product_id,clickup_task_id,deleted_at,deleted_by)
      values(marker_id,p_product_id,task_ids[1],deleted_time,auth.uid()::text)
      on conflict(id) do nothing;
    delete from public.manual_actions where id=action_row.id and product_id=p_product_id;
  end if;
  return jsonb_build_object('id',p_source_ad_id,'productId',p_product_id,'actionId',action_row.id,
    'markerId',marker_id,'deletedAt',case when p_confirm then deleted_time else null end,
    'actionLocalId',action_row.payload->>'id',
    'taskName',coalesce(action_row.payload->>'title',action_row.payload->>'taskName',p_source_ad_id),
    'clickupTaskIds',to_jsonb(task_ids),'preview',not p_confirm);
end;
$$;
revoke all on function public.delete_orphan_action(text,text,text,uuid,boolean) from public, anon;
grant execute on function public.delete_orphan_action(text,text,text,uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
