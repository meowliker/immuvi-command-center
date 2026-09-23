alter table public.inspiration_queue
  add column if not exists no_brief boolean not null default false;

comment on column public.inspiration_queue.no_brief is
  'Classification only: skip creative brief/scripts and ClickUp document creation. Captured at enqueue and retained on retries.';

create or replace function public.guard_inspiration_no_brief()
returns trigger language plpgsql as $$
begin
  -- A stale client's requeue must not silently change the original choice.
  if tg_op = 'UPDATE' then
    new.no_brief := old.no_brief;
  end if;
  if new.no_brief and new.status in ('claimed', 'classifying') then
    if new.claimed_by is null or not exists (
      select 1 from public.worker_registry w
      where w.worker_id = new.claimed_by
        and w.capabilities->'classification_only' = 'true'::jsonb
    ) then
      raise exception 'No Brief requires a classification-only capable worker; update the worker'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_inspiration_no_brief on public.inspiration_queue;
create trigger guard_inspiration_no_brief
before insert or update on public.inspiration_queue
for each row execute function public.guard_inspiration_no_brief();
