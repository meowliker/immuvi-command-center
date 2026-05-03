-- Activity Events for Action Plan Live
-- Purely additive migration. Zero impact on existing tables, triggers, or the main app.
-- Main app has no knowledge of this table and will continue working exactly as before.

create table if not exists public.activity_events (
  id uuid primary key default uuid_generate_v4(),
  product_id text not null references public.products(id) on delete cascade,

  -- soft ref: action_id points to manual_actions.id (may be null or dangling after delete)
  action_id uuid,
  clickup_task_id text,

  event_type text not null,   -- created | launched | killed | scaled | winner | delivered
                              -- | approved | status_changed | renamed | desc_edited
                              -- | due_changed | angle_changed | persona_changed
                              -- | type_changed | funnel_changed | priority_changed
                              -- | deleted | clickup_task_created | clickup_synced_in
                              -- | angle_added | persona_added | inspiration_saved
                              -- | inspiration_classified | cell_opened

  field_name text,            -- for edit events: which field changed
  old_value text,
  new_value text,

  actor text,                 -- CFG.userLabel from main app (from ClickUp user profile)
  source text not null default 'app',   -- 'app' | 'clickup-poll' | 'remote-user' | 'system'

  metadata jsonb not null default '{}'::jsonb,  -- extra context: angle, persona, status, etc

  created_at timestamptz not null default now()
);

create index if not exists idx_events_product_created on public.activity_events(product_id, created_at desc);
create index if not exists idx_events_type on public.activity_events(event_type);
create index if not exists idx_events_action on public.activity_events(action_id);

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.activity_events;
  exception when duplicate_object then null;
  end;
end $$;

-- RLS (same open-to-anon pattern as the rest of the DB for v1)
alter table public.activity_events enable row level security;
drop policy if exists activity_events_anon_all on public.activity_events;
create policy activity_events_anon_all on public.activity_events for all to anon using (true) with check (true);
