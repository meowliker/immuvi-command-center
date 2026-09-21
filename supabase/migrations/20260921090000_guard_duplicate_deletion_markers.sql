-- Automatic duplicate retirement is row-scoped, never a task-wide deletion.
-- This installs a write guard only; historical data repairs are separate.
create or replace function public.deleted_ads_scope_duplicate_retirement()
returns trigger language plpgsql as $$
begin
  if new.deleted_by in ('trigger:collapse_local_dup_on_sync', 'self-heal') then
    -- An automated upsert must not replace a deliberate deletion marker.
    if tg_op = 'UPDATE' and old.deleted_by is distinct from 'trigger:collapse_local_dup_on_sync'
       and old.deleted_by is distinct from 'self-heal' then
      return old;
    end if;

    if new.deleted_by = 'trigger:collapse_local_dup_on_sync' or exists (
      select 1 from public.ads a
      where a.id = new.id and a.product_id = new.product_id
        and a.deleted_at is not null
        and nullif(a.meta->>'_supersededByAdId', '') is not null
    ) then
      new.clickup_task_id := null;
      new.deleted_by := 'trigger:collapse_local_dup_on_sync';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists deleted_ads_scope_duplicate_retirement on public.deleted_ads;
create trigger deleted_ads_scope_duplicate_retirement
before insert or update on public.deleted_ads
for each row execute function public.deleted_ads_scope_duplicate_retirement();
