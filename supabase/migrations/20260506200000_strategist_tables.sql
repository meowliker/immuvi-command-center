-- ============================================================
-- Strategist Memory Agent — per-product memory tables
-- ============================================================
-- Spec: docs/superpowers/specs/2026-05-06-strategist-agent-design.md
--
-- Three tables:
--   1. strategist_memory     — one row per product, source of truth
--   2. strategist_runs       — queue + run log, realtime-subscribed
--   3. strategist_processed  — per-task synthesis cache (incremental)
-- ============================================================

-- ── 1. strategist_memory ──
create table if not exists public.strategist_memory (
  product_id  text primary key references public.products(id) on delete cascade,
  json        jsonb       not null,
  markdown    text        not null,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_strategist_memory_updated_at
  on public.strategist_memory(updated_at);

-- ── 2. strategist_runs ──
create table if not exists public.strategist_runs (
  id              bigserial primary key,
  product_id      text not null references public.products(id) on delete cascade,
  status          text not null check (status in ('pending','running','done','failed')),
  trigger         text not null check (trigger in ('daily','manual','backfill')),
  run_date        date not null,
  started_at      timestamptz,
  finished_at     timestamptz,
  tasks_processed int  default 0,
  tasks_skipped   int  default 0,
  error           text,
  worker_id       text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_strategist_runs_pending
  on public.strategist_runs(status, created_at)
  where status = 'pending';

create index if not exists idx_strategist_runs_product_date
  on public.strategist_runs(product_id, run_date);

-- Daily-dedup: only one daily row per product per day.
-- Manual + backfill triggers can stack.
create unique index if not exists ux_strategist_runs_daily_dedup
  on public.strategist_runs(product_id, run_date)
  where trigger = 'daily';

-- ── 3. strategist_processed ──
create table if not exists public.strategist_processed (
  product_id        text not null references public.products(id) on delete cascade,
  clickup_task_id   text not null,
  content_hash      text not null,
  brief_json        jsonb not null,
  is_winner         boolean not null,
  status            text not null,
  spend             numeric,
  revenue           numeric,
  last_synthesized  timestamptz not null default now(),
  primary key (product_id, clickup_task_id)
);

create index if not exists idx_strategist_processed_winner
  on public.strategist_processed(product_id, is_winner);

-- ── 4. RLS — anon-all, matches existing app pattern ──
alter table public.strategist_memory     enable row level security;
alter table public.strategist_runs       enable row level security;
alter table public.strategist_processed  enable row level security;

drop policy if exists strategist_memory_anon_all     on public.strategist_memory;
drop policy if exists strategist_runs_anon_all       on public.strategist_runs;
drop policy if exists strategist_processed_anon_all  on public.strategist_processed;

create policy strategist_memory_anon_all
  on public.strategist_memory for all to anon using (true) with check (true);

create policy strategist_runs_anon_all
  on public.strategist_runs for all to anon using (true) with check (true);

create policy strategist_processed_anon_all
  on public.strategist_processed for all to anon using (true) with check (true);

-- ── 5. Realtime — opt the runs + memory tables in ──
alter publication supabase_realtime add table public.strategist_runs;
alter publication supabase_realtime add table public.strategist_memory;
