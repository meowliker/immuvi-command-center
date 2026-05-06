-- ============================================================
-- Worker pool for distributed inspiration classification
-- ============================================================
-- Purpose: stop manual `claude -p /clickup-creative-pipeline` runs.
-- Instead, any number of machines (laptop, Mac mini, teammate's box)
-- can register as workers and pick up pending inspirations from
-- inspiration_queue automatically.
--
-- This migration:
--   1. Extends inspiration_queue with worker-aware columns.
--   2. Adds a worker_registry table for live worker presence.
--   3. Mirrors the existing v1 anon-all RLS pattern so the dashboard
--      and Python workers can read/write under the anon key.
-- ============================================================

-- ── 1. inspiration_queue: worker-aware columns ──────────────
alter table public.inspiration_queue
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists worker_assignment text default 'auto',
    -- 'auto'                  → any worker can claim
    -- '<worker_id>'           → only this worker can claim
    -- 'preferred:<worker_id>' → that worker first; others claim only if its
    --                            heartbeat is older than 2 minutes.
  add column if not exists attempts int not null default 0;

create index if not exists idx_queue_claimed_by
  on public.inspiration_queue(claimed_by);
create index if not exists idx_queue_assignment
  on public.inspiration_queue(worker_assignment);

-- ── 2. worker_registry: who is alive, what can they do ─────
create table if not exists public.worker_registry (
  worker_id            text primary key,            -- 'gp-laptop', 'gp-mac-mini', etc.
  hostname             text,
  os                   text,                        -- 'darwin', 'linux'
  python_version       text,
  claude_code_version  text,
  last_heartbeat       timestamptz default now(),
  last_job_at          timestamptz,
  jobs_completed_total int  default 0,
  jobs_failed_total    int  default 0,
  status               text default 'idle',         -- idle | busy | paused | offline
  current_job_id       uuid,
  capabilities         jsonb default '{}'::jsonb,   -- {"ffmpeg":true,"whisper":true,"claude":true}
  enabled              bool default true,           -- soft kill switch
  created_at           timestamptz default now()
);

create index if not exists idx_worker_heartbeat
  on public.worker_registry(last_heartbeat);
create index if not exists idx_worker_status
  on public.worker_registry(status);

-- ── 3. RLS — same anon-all pattern as the rest of the schema ─
alter table public.worker_registry enable row level security;
drop policy if exists worker_registry_anon_all on public.worker_registry;
create policy worker_registry_anon_all
  on public.worker_registry
  for all
  to anon
  using (true)
  with check (true);
