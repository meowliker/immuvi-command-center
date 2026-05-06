# Agent 2 — Producer (Ad Image Generator)

**Date:** 2026-05-07
**Status:** Design + plan combined for fast execution
**Builds on:** Agent 1 (Strategist), shipped 2026-05-07
**Spec for Agent 1:** [docs/superpowers/specs/2026-05-06-strategist-agent-design.md](2026-05-06-strategist-agent-design.md)

---

## 1. Purpose

A one-click ad-image generator for any task in the Action Plan. User clicks "🎨 Generate ads" → modal pops up → user types instruction + count (default 5) → submit. A worker picks up the run, generates N images using Strategist memory + ClickUp task context + user instruction, uploads them to Google Drive + the ClickUp task, sets the Drive Link custom field, and flips status to "ready to launch."

UI shows live progress per task (Queued → Running → Done / Failed).

## 2. Goals

- One-click trigger from Action Plan
- Reads Strategist memory (Agent 1 output) so generated images match what's been winning
- Parallel image generation within a single run (5 nano-banana calls in parallel — independent images)
- Uploads to ClickUp task + Google Drive, sets Drive Link field, flips status
- Live progress in UI via the existing per-product realtime channel
- $0 marginal cost (Max plan) — but obeys the same rate-limit invariants as Agent 1

## 3. Non-Goals (v1)

- No video generation. Images only.
- No editing of existing winners — full new generation each time.
- No multi-product fanout — one run per task.
- No automated success measurement loop. Strategist learns from human-set status; we don't auto-decide what's a winner.

## 4. Existing Infrastructure Reused

| System | How |
|---|---|
| `tools/classify_worker.py` | Polls third queue (`producer_runs`) sequentially with classify + strategist |
| `claude -p` headless | Same invocation pattern, runs new `/produce-ad-image` skill |
| `~/.claude/skills/nano-banana/` | Image generation backend (`infsh app run google/gemini-3-pro-image-preview`) |
| `strategist_memory` Supabase row | Read at run time to inform prompts |
| Realtime `cc-${productId}` channel | Subscribe `producer_runs` rows for live status |
| Action Plan tab + ap-table styling | Button + status chip per task row |
| Auto-pause-when-Claude-idle | Inherited |

## 5. Trigger Flow

1. User on Action Plan tab clicks 🎨 button on a task row
2. Modal opens: textarea for instruction + number input for count (1-10, default 5)
3. Submit → INSERT into `producer_runs(task_id, product_id, instruction, count, status='pending', trigger='manual')`
4. Realtime subs notify all open tabs — task chip flips to ⏳ Queued
5. Worker polls `producer_runs`, claims pending row, marks `running` → `cc-${productId}` realtime fires → chip flips ⚙ Running
6. Worker shells `claude -p /produce-ad-image <run_id>` (with `--permission-mode bypassPermissions`)
7. Skill executes (see §7) — N nano-banana calls in parallel via bash `&`/`wait`
8. Skill uploads to Drive + ClickUp, updates ClickUp custom field + status
9. Skill marks `producer_runs.status='done'` + `outputs=[urls]` → realtime → chip flips ✓ Done
10. Action Plan task row status reflects new ClickUp state next sync

## 6. Data Model

### 6.1 New Supabase table: `producer_runs`

```sql
create table public.producer_runs (
  id              bigserial primary key,
  task_id         text   not null,           -- ClickUp task id
  product_id      text   not null references public.products(id) on delete cascade,
  instruction     text   not null default '',-- user's variation instructions
  count           int    not null default 5 check (count between 1 and 10),
  status          text   not null check (status in ('pending','running','done','failed')),
  trigger         text   not null default 'manual',
  outputs         jsonb,                     -- [{drive_url, clickup_attachment_id, prompt}]
  error           text,
  worker_id       text,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_producer_runs_pending on public.producer_runs(status, created_at) where status='pending';
create index idx_producer_runs_task    on public.producer_runs(task_id, created_at desc);

alter table public.producer_runs enable row level security;
create policy producer_runs_anon_all on public.producer_runs for all to anon using (true) with check (true);
alter publication supabase_realtime add table public.producer_runs;
```

## 7. The `/produce-ad-image` Skill

Bulk of Agent 2's intelligence lives in the skill file at `~/.claude/skills/produce-ad-image/SKILL.md`. The Python pipeline shells `claude -p` with this skill name as the prompt; the skill runs all the work.

**Skill flow:**

1. **Resolve run** — `select * from producer_runs where id=<run_id>` via `curl` + Supabase REST
2. **Resolve task** — `GET /task/<task_id>` from ClickUp API (custom_fields, description, status, list_id)
3. **Resolve product** — `select id, name, config from products where id=<product_id>`
4. **Resolve strategist memory** — `select json, markdown from strategist_memory where product_id=<product_id>` (best-effort; agent runs without if missing)
5. **Build N prompts** — Claude internally synthesizes N distinct image prompts using:
   - Task description + comments (extracted from ClickUp)
   - Inspiration brief if linked (parse description for ClickUp doc URL, fetch)
   - Strategist memory (winning angles, personas, hook types, lingo)
   - User instruction from `producer_runs.instruction`
6. **Generate N images in parallel** via background bash:
   ```
   for i in 1..N: infsh app run google/gemini-3-pro-image-preview --input "{prompt:..., negative_prompt:..., ratio:'1:1'}" -o /tmp/agent2_<run>_<i>.png &
   wait
   ```
7. **Upload to Google Drive** — Use the `gdrive` CLI if present (or fall back to ClickUp-only attachments + flag in producer_runs.error). Get a shareable folder/file URL.
8. **Upload as ClickUp attachments** — `POST /task/<task_id>/attachment` with each PNG (multipart)
9. **Set Drive Link custom field** — `POST /task/<task_id>/field/<drive_link_field_id>` with the Drive folder URL
10. **Set status to "ready to launch"** — `PUT /task/<task_id>` with `{status: "ready to launch"}`
11. **Mark run done** — `PATCH producer_runs where id=<run_id>` with `status='done'`, outputs array, finished_at
12. **Print** `OK <run_id>` so the worker can verify

**Timeout per skill run:** 10 minutes (5x synthesis time of strategist; image gen is slow).

**Drive fallback:** If `gdrive` CLI isn't installed, skip Drive upload — set `producer_runs.error` to a soft warning (`"drive upload skipped: gdrive not installed"`) but still complete the run successfully (ClickUp attachments + Drive Link blank). User can install `gdrive` later.

## 8. UI Changes (immuvi-command-center.html)

### 8.1 Button per Action Plan task row

In the existing Action Plan task row actions cell, add:
```
<button class="btn-ghost" onclick="_producerOpenModal('<task_id>','<product_id>')" title="Generate ad images">🎨</button>
```

### 8.2 Modal

```html
<div id="producerModal" class="modal" style="display:none">
  <div class="modal-content">
    <h3>Generate Ad Images</h3>
    <label>Instruction (optional — describe the variation you want)</label>
    <textarea id="producerInstruction" rows="4" placeholder="e.g. 'Same as the doctor angle, but with mom-to-mom UGC vibe'"></textarea>
    <label>How many images?</label>
    <input id="producerCount" type="number" min="1" max="10" value="5">
    <div class="actions">
      <button onclick="_producerSubmit()" class="btn-primary">Generate</button>
      <button onclick="_producerCloseModal()" class="btn-ghost">Cancel</button>
    </div>
  </div>
</div>
```

### 8.3 Per-task status chip

In each Action Plan task row, add a chip cell that shows the latest `producer_runs` row status for that task:
- ⏳ Queued (yellow)
- ⚙ Running (blue)
- ✓ Done (green) — clicking opens Drive folder
- ✗ Failed (red) — clicking shows error

### 8.4 Realtime sub

Extend existing `cc-${productId}` channel with `.on('postgres_changes', { table: 'producer_runs', filter: 'product_id=eq.<id>' }, ...)`. NO new channel.

## 9. Open Questions / Risks

- **Drive upload mechanism**: gdrive CLI may not be installed. v1 handles gracefully (skip + warn) — Phase 2 adds Drive MCP integration if useful.
- **ClickUp attachment size limit**: 100 MB per file. Single-image PNGs are <5MB, no concern.
- **nano-banana errors mid-batch**: If 2 of 5 generation calls fail, run still completes with the 3 that succeeded; outputs array reflects which prompts ran.
- **Inspiration doc page fetch**: Same regex/extract pattern used by Strategist (extract_clickup_doc_url). Best-effort.

---

# IMPLEMENTATION PLAN — 6 tasks (parallel-friendly)

## Task structure

| # | Task | Depends on | Round |
|---|------|-----------|-------|
| 1 | Migration: `producer_runs` table | — | A (parallel) |
| 2 | `tools/producer/db.py` — REST helpers (pop_pending, claim, finish) | — | A (parallel) |
| 3 | `~/.claude/skills/produce-ad-image/SKILL.md` — the agent skill | — | A (parallel) |
| 4 | Worker integration: extend classify_worker.py to poll producer_runs | 2 + 3 | B |
| 5 | UI in immuvi-command-center.html: button + modal + chip + realtime sub | 1 | C |
| 6 | Memory invariants update | all | D |

**Parallel structure:** Round A dispatches 3 implementers concurrently. Then B, C, D sequentially.

## Task 1: Migration

```sql
-- supabase/migrations/20260507100000_producer_runs.sql

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
```

Apply via psql against live DB. Verify with `\d producer_runs`. Commit.

## Task 2: `tools/producer/db.py`

Mirror `tools/strategist/db.py` shape. Functions:
- `pop_pending_run(supabase_url, service_key, worker_id)` → next pending row or None
- `claim_run(supabase_url, service_key, run_id, worker_id)` → flip pending→running atomically
- `finish_run(supabase_url, service_key, run_id, status, outputs, error)` → mark done/failed

Tests in `tests/test_producer_db.py`. Same urllib mock pattern.

## Task 3: `~/.claude/skills/produce-ad-image/SKILL.md`

A markdown skill file. Contents follow the flow in §7. Self-contained — uses `curl` + `infsh` + ClickUp REST API + Supabase REST API. No Python deps beyond what classify-inspiration already requires (system Python, requests, ffmpeg if needed). Skill writes intermediate PNGs to `/tmp/agent2_<run>_<i>.png` and cleans up after upload.

## Task 4: Worker integration

In `tools/classify_worker.py`, add a third queue check after the strategist check (sequential — never parallel). Pseudo-insert:

```python
if not paused and job is None:
    # ... strategist check (already in place) ...
    # NEW: producer check
    try:
        from tools.producer.db import pop_pending_run as pop_producer
        run = pop_producer(supabase_url=..., service_key=..., worker_id=...)
        if run is not None:
            log(f"[producer] picking up run id={run['id']} task={run['task_id']}")
            self.is_busy = True; self.current_job_id = run['id']
            try:
                # Run the produce-ad-image skill via claude -p
                cmd = ["claude", "-p", f"/produce-ad-image {run['id']}",
                       "--permission-mode", "bypassPermissions"]
                subprocess.run(cmd, timeout=600)  # 10 min
            finally:
                self.is_busy = False; self.current_job_id = None
    except Exception as e:
        log(f"[producer] poll/run failed: {e}")
```

(Skill itself updates the producer_runs row to done/failed — worker just invokes claude -p.)

## Task 5: UI in immuvi-command-center.html

Single big task — touches one file, must be sequential. Adds:
1. 🎨 button per Action Plan task row
2. Producer modal with textarea + count input
3. `_producerOpenModal`, `_producerCloseModal`, `_producerSubmit` JS
4. Per-task status chip rendered in Action Plan rows from latest producer_runs row
5. `.on('postgres_changes', { table: 'producer_runs' }, …)` extension to existing `cc-${productId}` channel

## Task 6: Memory invariants update

Two new memory files:
- `feedback_producer_invariants.md` — invariants like "sequential `claude -p`", "extend channel don't add", "skill is the brain not the worker"
- `project_producer_agent.md` — shipped, paths, how to consume

---

## Definition of Done

- Migration applied to live Supabase
- `tests/test_producer_db.py` green; full suite still passes
- `/produce-ad-image` skill installed and runnable
- Worker daemon polls producer_runs successfully
- UI button + modal + chip + realtime live verified on localhost
- Generating 5 images on a real Action Plan task → ClickUp attachments + Drive folder URL + status="ready to launch" within ~5 minutes
- Memory updated
- Existing Strategist v1 and AD/MA invariants intact
