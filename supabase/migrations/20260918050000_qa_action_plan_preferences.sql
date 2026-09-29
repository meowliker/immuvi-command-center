alter table public.profiles add column if not exists ap_col_state jsonb;

-- Only the caller's QA preference namespace changes; legacy views remain intact.
create or replace function public.qa_plan_preferences(p_expected jsonb,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare profile public.profiles%rowtype; view_item jsonb; col jsonb;
begin
  select * into profile from public.profiles where id=auth.uid() for update;
  if not found or not profile.is_active or profile.must_change_password then raise exception 'Active user access is required'; end if;
  if profile.ap_col_state is not null and jsonb_typeof(profile.ap_col_state)<>'object' then raise exception 'Existing legacy preferences require review'; end if;
  if profile.ap_col_state->'qa_next' is distinct from p_expected then raise exception 'Saved views changed in another tab. Reopen column preferences before saving.'; end if;
  if jsonb_typeof(p_value) is distinct from 'object' or p_value->>'version' is distinct from '1' or jsonb_typeof(p_value->'views') is distinct from 'array' then raise exception 'Invalid saved views'; end if;
  if jsonb_array_length(p_value->'views') not between 1 and 30 or octet_length(p_value::text)>150000 then raise exception 'Saved view limit exceeded'; end if;
  if not exists(select 1 from jsonb_array_elements(p_value->'views') v where v->>'id'='default') or
    not exists(select 1 from jsonb_array_elements(p_value->'views') v where v->>'id'=p_value->>'activeViewId') or
    exists(select 1 from jsonb_array_elements(p_value->'views') v group by v->>'id' having count(*)>1) then raise exception 'Invalid active or duplicate view'; end if;
  for view_item in select value from jsonb_array_elements(p_value->'views') loop
    if jsonb_typeof(view_item->'id') is distinct from 'string' or jsonb_typeof(view_item->'name') is distinct from 'string' then raise exception 'Invalid view definition'; end if;
    if coalesce(length(view_item->>'id'),0) not between 1 and 80 or coalesce(length(trim(view_item->>'name')),0) not between 1 and 80 or jsonb_typeof(view_item->'columns') is distinct from 'array' then raise exception 'Invalid view definition'; end if;
    if jsonb_array_length(view_item->'columns') not between 2 and 120 then raise exception 'Invalid column count'; end if;
    if exists(select 1 from jsonb_array_elements(view_item->'columns') c group by c->>'key' having count(*)>1) then raise exception 'Duplicate columns'; end if;
    for col in select value from jsonb_array_elements(view_item->'columns') loop
      if jsonb_typeof(col->'key') is distinct from 'string' or coalesce(length(col->>'key'),0) not between 1 and 160 or jsonb_typeof(col->'hidden') is distinct from 'boolean'
        or jsonb_typeof(col->'width') is distinct from 'number' then raise exception 'Invalid column definition'; end if;
      if (col->>'width')::numeric not between 44 and 600 then raise exception 'Invalid column width'; end if;
    end loop;
    if not exists(select 1 from jsonb_array_elements(view_item->'columns') c where c->>'key'='title' and c->'hidden'='false'::jsonb)
      or not exists(select 1 from jsonb_array_elements(view_item->'columns') c where c->>'key'='cb' and c->'hidden'='false'::jsonb) then raise exception 'Task and selection columns must stay visible'; end if;
  end loop;
  update public.profiles set ap_col_state=coalesce(ap_col_state,'{}')||jsonb_build_object('qa_next',p_value) where id=auth.uid();
  return p_value;
end $$;
revoke all on function public.qa_plan_preferences(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.qa_plan_preferences(jsonb,jsonb) to authenticated;
