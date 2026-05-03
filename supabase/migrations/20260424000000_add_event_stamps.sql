-- Event stamps for Action Plan 2.0
-- Additive migration: existing code ignores unknown columns, so zero breakage.
-- Each stamp is set when the corresponding status transition happens.
-- Historical tasks will have NULL stamps (fall back to created_at in the UI).

alter table public.manual_actions
  add column if not exists approved_at  timestamptz,  -- liveStatus → In Production
  add column if not exists delivered_at timestamptz,  -- liveStatus → Ready to Launch
  add column if not exists launched_at  timestamptz,  -- liveStatus → Testing
  add column if not exists killed_at    timestamptz,  -- liveStatus → Loser (or Complete when liveStatus=Loser)
  add column if not exists scaled_at    timestamptz;  -- liveStatus → Scale or Winner

create index if not exists idx_ma_launched_at  on public.manual_actions(launched_at);
create index if not exists idx_ma_delivered_at on public.manual_actions(delivered_at);
create index if not exists idx_ma_killed_at    on public.manual_actions(killed_at);
create index if not exists idx_ma_scaled_at    on public.manual_actions(scaled_at);
create index if not exists idx_ma_approved_at  on public.manual_actions(approved_at);
