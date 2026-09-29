-- Run inside a transaction after the migration; always ROLLBACK the fixtures.
insert into public.products (id, name, config) values
  ('qa-clickup-smoke', 'QA ClickUp transaction test', '{"clickup_list_id":"1301130000002447","keep":"yes"}');

select set_config('request.jwt.claims', json_build_object('sub', (
  select id from public.profiles where role = 'admin' and is_active and not must_change_password limit 1
), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  stamp timestamptz;
  result jsonb;
  plan jsonb;
  changed integer;
begin
  select updated_at into stamp from public.products where id = 'qa-clickup-smoke';
  plan := jsonb_build_object('fetched', 1, 'skipped', 0, 'actions', '[]'::jsonb, 'ads', jsonb_build_array(jsonb_build_object(
    'id', 'cu:qa-clickup-smoke:fixture-task', 'expected_updated_at', null,
    'patch', jsonb_build_object('format_name', 'Synthetic task', 'clickup_task_id', 'fixture-task', 'status', 'Untested',
      'created_at', '2026-09-17T00:00:00Z', 'last_status_change_at', 1800000000000,
      'meta', jsonb_build_object('_clickupListId', '1301130000002447', 'notes', 'preserved')))));
  result := public.apply_qa_clickup_sync('qa-clickup-smoke', '1301130000002447', stamp, plan);
  if result->>'imported' <> '1' then raise exception 'Expected one imported task: %', result; end if;
  if not exists (select 1 from public.ads where id = 'cu:qa-clickup-smoke:fixture-task' and meta->>'notes' = 'preserved') then
    raise exception 'Import did not persist metadata';
  end if;

  -- A stale edit must roll back the entire import, including earlier new rows.
  select updated_at into stamp from public.products where id = 'qa-clickup-smoke';
  plan := jsonb_set(plan, '{ads,0,id}', '"cu:qa-clickup-smoke:new-task"');
  plan := jsonb_set(plan, '{ads,0,patch,clickup_task_id}', '"new-task"');
  plan := jsonb_set(plan, '{ads}', (plan->'ads') || jsonb_build_array(jsonb_build_object(
    'id', 'cu:qa-clickup-smoke:fixture-task', 'expected_updated_at', '2000-01-01T00:00:00Z',
    'patch', jsonb_build_object('clickup_task_id', 'fixture-task', 'meta', jsonb_build_object('_clickupListId', '1301130000002447')))));
  begin
    perform public.apply_qa_clickup_sync('qa-clickup-smoke', '1301130000002447', stamp, plan);
    raise exception 'FAILED: stale plan was accepted';
  exception when others then
    if sqlerrm not like 'Creative changed during sync%' then raise; end if;
  end;
  if exists (select 1 from public.ads where id = 'cu:qa-clickup-smoke:new-task') then raise exception 'Partial import was committed'; end if;

  insert into public.deleted_ads (id, product_id, clickup_task_id) values ('qa-clickup-deleted', 'qa-clickup-smoke', 'new-task');
  plan := jsonb_set(plan, '{ads}', jsonb_build_array(plan->'ads'->0));
  result := public.apply_qa_clickup_sync('qa-clickup-smoke', '1301130000002447', stamp, plan);
  if result->>'skipped' <> '1' then raise exception 'Tombstone failed: %', result; end if;
  if exists (select 1 from public.ads where id = 'cu:qa-clickup-smoke:new-task') then raise exception 'Deleted task resurrected'; end if;
  if (select config->>'keep' from public.products where id = 'qa-clickup-smoke') <> 'yes' then raise exception 'Product configuration overwritten'; end if;

  begin
    perform public.apply_qa_clickup_sync('qa-clickup-smoke', 'production', stamp, plan);
    raise exception 'FAILED: production list accepted';
  exception when others then
    if sqlerrm not like 'Only the QA test list%' then raise; end if;
  end;
  begin
    perform public.apply_qa_clickup_sync('qa-clickup-smoke', '901616718146', stamp, plan);
    raise exception 'FAILED: retired test list accepted';
  exception when others then
    if sqlerrm not like 'Only the QA test list%' then raise; end if;
  end;
  begin
    perform public.save_qa_clickup_link('qa-clickup-smoke', '901616718146', 'Retired list', '{}'::jsonb, stamp);
    raise exception 'FAILED: retired list link accepted';
  exception when others then
    if sqlerrm not like 'Only the QA test list%' then raise; end if;
  end;
  begin
    perform public.save_qa_clickup_link('qa-clickup-smoke', '1301130000002447', 'Duplicate list', '{}'::jsonb, stamp);
    raise exception 'FAILED: duplicate product list link accepted';
  exception when others then
    if sqlerrm not like 'This ClickUp list is already linked%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  begin
    perform public.apply_qa_clickup_sync('qa-clickup-smoke', '1301130000002447', stamp, plan);
    raise exception 'FAILED: unknown user accepted';
  exception when others then
    if sqlerrm not like 'Active product access is required%' then raise; end if;
  end;
end;
$$;
reset role;
