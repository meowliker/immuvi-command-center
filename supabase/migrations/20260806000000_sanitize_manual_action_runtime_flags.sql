-- Runtime-only Action Plan flags must never persist. Older app tabs can still
-- post stale MANUAL_ACTIONS payloads, so strip them at the database boundary.
create or replace function public.strip_manual_action_runtime_payload()
returns trigger
language plpgsql
as $$
begin
  if new.payload is not null then
    new.payload = new.payload - array['_cu_creating', '_directWritePromise'];
  end if;
  return new;
end;
$$;

drop trigger if exists trg_strip_manual_action_runtime_payload on public.manual_actions;
create trigger trg_strip_manual_action_runtime_payload
before insert or update of payload on public.manual_actions
for each row execute function public.strip_manual_action_runtime_payload();

update public.manual_actions
set payload = payload - array['_cu_creating', '_directWritePromise']
where payload ?| array['_cu_creating', '_directWritePromise'];
