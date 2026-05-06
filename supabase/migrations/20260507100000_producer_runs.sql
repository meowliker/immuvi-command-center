-- ============================================================
-- Producer Agent — per-task ad image generation runs
-- ============================================================
-- Spec: docs/superpowers/specs/2026-05-07-producer-agent-design.md
--
-- One row per "generate ad images" run for an Action Plan task.
-- Worker polls pending rows, runs /produce-ad-image skill, marks done.
-- ============================================================

create table if not exists public.producer_runs (
  id              bigserial primary key,
  task_id         text   not null,
  product_id      text   not null references public.products(id) on delete cascade,
  instruction     text   not null default '',
  count           int    not null default 5 check (count between 1 and 10),
  status          text   not null check (status in ('pending','running','done','failed')),
  trigger         text   not null default 'manual',
  outputs         jsonb,
  error           text,
  worker_id       text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_producer_runs_pending
  on public.producer_runs(status, created_at) where status='pending';

create index if not exists idx_producer_runs_task
  on public.producer_runs(task_id, created_at desc);

alter table public.producer_runs enable row level security;
drop policy if exists producer_runs_anon_all on public.producer_runs;
create policy producer_runs_anon_all on public.producer_runs
  for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.producer_runs;
