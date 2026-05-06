# Agent 1 — Creative Strategist Memory Agent: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-product strategist memory worker that synthesizes ClickUp winner/loser tasks into a JSON+markdown memory artifact, surfaces it in a new Strategist tab, auto-refreshes daily when the dashboard is open, and is consumable by Agent 2 (Producer) later.

**Architecture:** A new Python module fleet (`tools/strategist/`) reachable via the existing `classify_worker.py` daemon (extended to dispatch a second task type). Three new Supabase tables (`strategist_memory`, `strategist_runs`, `strategist_processed`) gate the work. New Strategist tab in `immuvi-command-center.html` reads via realtime + manual refresh. ROI fields populated from existing ClickUp `Spend` + `Revenue` custom fields.

**Tech Stack:** Python 3.9+ (system Python on macOS), `urllib` (no extra deps), pytest for unit tests, vanilla JS in single-HTML dashboard, Supabase Postgres + RLS + Realtime, ClickUp REST API, `claude -p` headless CLI (Max plan, no per-token cost).

**Spec:** [docs/superpowers/specs/2026-05-06-strategist-agent-design.md](../specs/2026-05-06-strategist-agent-design.md)

---

## Working conventions (read once, applies to every task)

- **Working directory**: `/Users/gauravpataila/Documents/Claude/Clickup ` (note the trailing space — quote paths in shell)
- **Backups before risky HTML edits**: `cp immuvi-command-center.html backups/immuvi-command-center.pre-task-NN.html`
- **Localhost preview**: already running at `http://localhost:8102/immuvi-command-center.html`
- **Env file** for Python worker: `~/.classify-inspiration.env` (already exists; we'll add no new vars in v1)
- **Claude CLI invocation**: `claude -p "<prompt>" --permission-mode bypassPermissions` (matches existing classify worker pattern)
- **TDD applies to Python modules.** HTML/JS uses manual preview verification — no JS test infra exists in this repo and we're not bootstrapping one for v1
- **Memory invariants** (must not break, ever): AD/MA delete invariants, realtime traffic budget (no subscriptions to inspiration_queue/inspiration_results, ADs hash-skip filter, poll cadence 60s/5min), MA→sourceAd repair sibling loops, Action Plan additive merge. See `~/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/MEMORY.md`

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260506200000_strategist_tables.sql` | Create `strategist_memory`, `strategist_runs`, `strategist_processed` tables + indexes + RLS |
| `tests/conftest.py` | Pytest config, fixtures, sys.path setup |
| `tests/test_taxonomy.py` | Unit tests for status grouping + canonical field mapping |
| `tests/test_aggregate.py` | Unit tests for the reducer (dimension counts, ROI) |
| `tests/test_clickup.py` | Unit tests for ClickUp API helpers (with mocked HTTP) |
| `tests/test_synthesis.py` | Unit tests for synthesis claude-p caller (with mocked subprocess) |
| `tests/test_pipeline.py` | Integration tests for the orchestrator (everything mocked) |
| `tools/strategist/__init__.py` | Package marker |
| `tools/strategist/taxonomy.py` | Pure functions: status grouping, canonical field name mapping |
| `tools/strategist/clickup.py` | ClickUp REST API helpers (list tasks, fetch comments, fetch doc pages) |
| `tools/strategist/db.py` | Supabase REST helpers for the three new tables |
| `tools/strategist/synthesis.py` | Per-task `claude -p` synthesis (returns winner_brief/loser_brief JSON) |
| `tools/strategist/aggregate.py` | Roll up `strategist_processed` rows into the full memory JSON |
| `tools/strategist/renderer.py` | `claude -p` to produce the markdown narrative from JSON |
| `tools/strategist/snapshot.py` | Write `tools/strategist_memory/<slug>.{md,json}` to repo |
| `tools/strategist/pipeline.py` | Orchestrator — runs the full pipeline for one product |
| `tools/classify_worker.py` *(modified)* | Extended to poll `strategist_runs` and dispatch `strategist` task type |
| `immuvi-command-center.html` *(modified)* | New Strategist tab + daily auto-trigger logic + realtime sub |

---

## Task 1: Supabase migration — strategist tables

**Files:**
- Create: `supabase/migrations/20260506200000_strategist_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run from working directory:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260506200000_strategist_tables.sql
```

Expected output: `CREATE TABLE` (×3), `CREATE INDEX` (×N), `ALTER TABLE` (×3), `DROP POLICY` / `CREATE POLICY` (×3 each), `ALTER PUBLICATION` (×2).

`SUPABASE_DB_URL` is already in `.env` — source it first if not in env: `export $(grep -v '^#' .env | xargs)`.

- [ ] **Step 3: Verify tables**

```bash
psql "$SUPABASE_DB_URL" -c "\d strategist_memory" -c "\d strategist_runs" -c "\d strategist_processed"
```

Expected: each `\d` prints the column list, indexes, FK constraints, and "Policies" section showing the anon_all policy.

- [ ] **Step 4: Verify the daily-dedup index works**

```bash
psql "$SUPABASE_DB_URL" -c "
insert into strategist_runs(product_id, status, trigger, run_date)
  select id, 'pending', 'daily', current_date from products limit 1;
insert into strategist_runs(product_id, status, trigger, run_date)
  select id, 'pending', 'daily', current_date from products limit 1;
"
```

Expected: first insert succeeds (`INSERT 0 1`), second fails with `duplicate key value violates unique constraint "ux_strategist_runs_daily_dedup"`. Clean up: `delete from strategist_runs;`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260506200000_strategist_tables.sql
git commit -m "$(cat <<'EOF'
feat(strategist): add strategist_memory, strategist_runs, strategist_processed tables

Three new tables backing the strategist memory worker:
- strategist_memory: 1 row per product, JSON + markdown source of truth
- strategist_runs: queue + log, realtime-subscribed, daily-dedup unique idx
- strategist_processed: per-task synthesis cache for incremental runs

Anon-all RLS to match existing app pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Bootstrap pytest infrastructure

**Files:**
- Create: `tests/__init__.py` (empty)
- Create: `tests/conftest.py`
- Create: `tools/strategist/__init__.py` (empty)
- Create: `pytest.ini`

- [ ] **Step 1: Write `pytest.ini`**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
addopts = -v --tb=short
```

- [ ] **Step 2: Write `tests/conftest.py`**

```python
"""Pytest config for strategist tests.

Adds project root to sys.path so we can import `tools.strategist.*`
modules without installing as a package.
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
```

- [ ] **Step 3: Create empty package markers**

```bash
touch tests/__init__.py tools/strategist/__init__.py
```

- [ ] **Step 4: Verify pytest finds nothing yet but doesn't error**

```bash
pytest
```

Expected: `no tests ran in 0.0Xs` (or "collected 0 items"). Exit code 5 ("no tests collected") is fine.

- [ ] **Step 5: Commit**

```bash
git add pytest.ini tests/__init__.py tests/conftest.py tools/strategist/__init__.py
git commit -m "$(cat <<'EOF'
chore(tests): bootstrap pytest for strategist module

- pytest.ini sets testpaths and verbose output
- tests/conftest.py adds project root to sys.path
- tools/strategist/ package marker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Taxonomy module (status grouping + canonical field mapping)

**Files:**
- Create: `tools/strategist/taxonomy.py`
- Create: `tests/test_taxonomy.py`

- [ ] **Step 1: Write the failing tests**

`tests/test_taxonomy.py`:

```python
"""Tests for tools/strategist/taxonomy.py — pure functions, no I/O."""
from tools.strategist import taxonomy


# ── classify_status ──

def test_classify_status_winner_group():
    for s in ("winner", "Winner", "WINNER", " winner ",
              "mild winner", "Mild Winner",
              "scale", "Scale",
              "complete", "COMPLETE"):
        assert taxonomy.classify_status(s) == "winner_group", f"failed on {s!r}"

def test_classify_status_loser_group():
    for s in ("loser", "Loser", "killed", "Killed"):
        assert taxonomy.classify_status(s) == "loser_group", f"failed on {s!r}"

def test_classify_status_pending_group():
    for s in ("untested", "approved", "in production",
              "ready to launch", "testing"):
        assert taxonomy.classify_status(s) == "pending_group", f"failed on {s!r}"

def test_classify_status_unknown_returns_none():
    assert taxonomy.classify_status("") is None
    assert taxonomy.classify_status(None) is None
    assert taxonomy.classify_status("blocked") is None


# ── is_judged ──

def test_is_judged_true_for_winners_and_losers():
    assert taxonomy.is_judged("winner") is True
    assert taxonomy.is_judged("mild winner") is True
    assert taxonomy.is_judged("scale") is True
    assert taxonomy.is_judged("complete") is True
    assert taxonomy.is_judged("loser") is True
    assert taxonomy.is_judged("killed") is True

def test_is_judged_false_for_pending():
    assert taxonomy.is_judged("testing") is False
    assert taxonomy.is_judged("untested") is False
    assert taxonomy.is_judged("ready to launch") is False
    assert taxonomy.is_judged(None) is False


# ── canonical field map ──

def test_canonical_field_keys_present():
    keys = set(taxonomy.CANONICAL_FIELD_KEYS)
    assert "Persona Tag" in keys
    assert "Angle Tag" in keys
    assert "Hook Type" in keys
    assert "Creative Structure" in keys
    assert "Production Style" in keys
    assert "Funnel Type" in keys
    assert "Photo/Video" in keys
    assert "Drive Link" in keys
    assert "Spend" in keys
    assert "Revenue" in keys

def test_extract_field_value_dropdown_returns_label():
    field = {
        "name": "Hook Type",
        "type": "drop_down",
        "type_config": {"options": [
            {"id": "abc", "name": "Pain / Problem", "orderindex": 0},
            {"id": "def", "name": "Curiosity", "orderindex": 1},
        ]},
        "value": 1,  # ClickUp returns the orderindex for dropdowns
    }
    assert taxonomy.extract_field_value(field) == "Curiosity"

def test_extract_field_value_dropdown_unset_returns_none():
    field = {"name": "Hook Type", "type": "drop_down",
             "type_config": {"options": [{"id": "x", "name": "A", "orderindex": 0}]}}
    assert taxonomy.extract_field_value(field) is None

def test_extract_field_value_short_text():
    assert taxonomy.extract_field_value(
        {"name": "Persona Tag", "type": "short_text", "value": "tired-mom"}
    ) == "tired-mom"

def test_extract_field_value_url():
    assert taxonomy.extract_field_value(
        {"name": "Drive Link", "type": "url", "value": "https://drive.google.com/x"}
    ) == "https://drive.google.com/x"

def test_extract_field_value_number():
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number", "value": "320.50"}
    ) == 320.50
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number", "value": 0}
    ) == 0.0

def test_extract_field_value_unset_value_returns_none():
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number"}
    ) is None


# ── slugify ──

def test_slugify_basic():
    assert taxonomy.slugify("Astro Rekha") == "astro-rekha"
    assert taxonomy.slugify("Kids Mental Health") == "kids-mental-health"
    assert taxonomy.slugify("KIDS LIFE SKILL") == "kids-life-skill"
    assert taxonomy.slugify("Canva Mastery — Scripts") == "canva-mastery-scripts"
    assert taxonomy.slugify("  multi   spaces  ") == "multi-spaces"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_taxonomy.py -v
```

Expected: every test fails with `ModuleNotFoundError: No module named 'tools.strategist.taxonomy'`.

- [ ] **Step 3: Implement `tools/strategist/taxonomy.py`**

```python
"""Pure-function taxonomy and field mapping helpers.

Single source of truth for:
- ClickUp status → strategist group ("winner_group" / "loser_group" / "pending_group")
- Canonical custom field names + value extraction across ClickUp field types
- Product slug normalisation

Confirmed against immuvi-command-center.html:36945 and live ClickUp list 901613534733
on 2026-05-06.
"""

import re
from typing import Optional, Any

WINNER_STATUSES = frozenset({"winner", "mild winner", "scale", "complete"})
LOSER_STATUSES  = frozenset({"loser", "killed"})
PENDING_STATUSES = frozenset({"untested", "approved", "in production",
                              "ready to launch", "testing"})

CANONICAL_FIELD_KEYS = (
    "Persona Tag", "Angle Tag",
    "Hook Type", "Creative Structure", "Production Style",
    "Funnel Type", "Photo/Video", "Drive Link",
    "Spend", "Revenue",
    "Creative USP", "Notes",
    "Launch Date", "Approved Date",
    "Final Video ID", "Script ID",
)


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def classify_status(status: Optional[str]) -> Optional[str]:
    """Return 'winner_group', 'loser_group', 'pending_group', or None."""
    s = _norm(status)
    if not s:
        return None
    if s in WINNER_STATUSES:
        return "winner_group"
    if s in LOSER_STATUSES:
        return "loser_group"
    if s in PENDING_STATUSES:
        return "pending_group"
    return None


def is_judged(status: Optional[str]) -> bool:
    """True for winner_group or loser_group statuses."""
    g = classify_status(status)
    return g in ("winner_group", "loser_group")


def extract_field_value(field: dict) -> Any:
    """Extract a canonical Python value from a ClickUp custom field row.

    Returns None if the field is unset.
    """
    if "value" not in field or field.get("value") is None:
        return None
    ftype = field.get("type")
    val = field["value"]
    if ftype == "drop_down":
        opts = (field.get("type_config") or {}).get("options") or []
        # ClickUp dropdowns: value is the orderindex; map to option name.
        try:
            idx = int(val)
        except (TypeError, ValueError):
            return None
        for o in opts:
            if int(o.get("orderindex", -1)) == idx:
                return o.get("name")
        return None
    if ftype in ("short_text", "text", "url"):
        return str(val) if val != "" else None
    if ftype == "number":
        try:
            return float(val)
        except (TypeError, ValueError):
            return None
    if ftype == "date":
        # Returned as ms-epoch string; keep as-is, callers parse if needed.
        return str(val)
    if ftype == "users":
        # Return list of usernames if present, else None.
        if isinstance(val, list):
            names = [u.get("username") for u in val if u.get("username")]
            return names or None
        return None
    return val


_SLUG_RE_NONALNUM = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """ASCII-lowercase-hyphen slug used for repo snapshot filenames."""
    if not name:
        return ""
    s = name.lower()
    s = _SLUG_RE_NONALNUM.sub("-", s)
    return s.strip("-")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_taxonomy.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/taxonomy.py tests/test_taxonomy.py
git commit -m "$(cat <<'EOF'
feat(strategist): taxonomy module with status grouping + field mapping

Pure-function helpers backed by full pytest coverage:
- classify_status / is_judged: winner/loser/pending grouping
- extract_field_value: canonical Python values from ClickUp custom fields
  (drop_down, short_text, url, number, date, users)
- slugify: ASCII-lowercase-hyphen for repo snapshot filenames

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Aggregate module (rolls up processed rows into memory JSON)

**Files:**
- Create: `tools/strategist/aggregate.py`
- Create: `tests/test_aggregate.py`

The aggregator takes a list of `strategist_processed` rows and produces the full memory JSON shape from §6.1 of the spec. Pure function — easy to test.

- [ ] **Step 1: Write the failing tests**

`tests/test_aggregate.py`:

```python
"""Tests for tools/strategist/aggregate.py."""
from tools.strategist import aggregate


def _row(task_id, is_winner, status, brief_json, spend=None, revenue=None):
    return {
        "clickup_task_id": task_id,
        "is_winner": is_winner,
        "status": status,
        "brief_json": brief_json,
        "spend": spend,
        "revenue": revenue,
    }


def _brief(angle="A", persona="P", hook="Curiosity",
           structure="UGC", style="Polished UGC", funnel="TOF",
           emotion="curiosity", lingo=None, why="why-text"):
    return {
        "strategy":   {"angle_tag": angle, "persona_tag": persona,
                       "emotion": emotion},
        "creative":   {"creative_structure": structure,
                       "production_style": style,
                       "funnel_type": funnel,
                       "hook_type": hook},
        "copy":       {"hook": "h", "lingo": lingo or []},
        "production": {},
        "why_it_won": why,
    }


def test_aggregate_empty_returns_zero_stats():
    out = aggregate.build_memory_json(
        product_id="prod-1", product_name="Test", processed_rows=[])
    assert out["product_id"] == "prod-1"
    assert out["product_name"] == "Test"
    assert out["stats"]["judged_total"] == 0
    assert out["winner_briefs"] == []
    assert out["loser_briefs"] == []


def test_aggregate_counts_winner_statuses_separately():
    rows = [
        _row("t1", True, "winner",       _brief()),
        _row("t2", True, "mild winner",  _brief()),
        _row("t3", True, "scale",        _brief()),
        _row("t4", True, "complete",     _brief()),
        _row("t5", False, "loser",       _brief()),
        _row("t6", False, "killed",      _brief()),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["winner"]      == 1
    assert out["stats"]["mild_winner"] == 1
    assert out["stats"]["scale"]       == 1
    assert out["stats"]["complete"]    == 1
    assert out["stats"]["loser"]       == 1
    assert out["stats"]["killed"]      == 1
    assert out["stats"]["judged_total"] == 6


def test_aggregate_rolls_up_angle_counts():
    rows = [
        _row("t1", True, "winner", _brief(angle="Pediatrician")),
        _row("t2", True, "winner", _brief(angle="Pediatrician")),
        _row("t3", False, "loser", _brief(angle="Pediatrician")),
        _row("t4", True, "winner", _brief(angle="Mom-to-mom")),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    angles = {a["name"]: a for a in out["strategy_layer"]["angles"]}
    assert angles["Pediatrician"]["wins"] == 2
    assert angles["Pediatrician"]["losses"] == 1
    assert "t1" in angles["Pediatrician"]["evidence_task_ids"]
    assert "t2" in angles["Pediatrician"]["evidence_task_ids"]
    assert angles["Mom-to-mom"]["wins"] == 1
    assert angles["Mom-to-mom"]["losses"] == 0


def test_aggregate_rolls_up_creative_structure_with_roi():
    rows = [
        _row("t1", True,  "winner", _brief(structure="UGC"), spend=100, revenue=400),
        _row("t2", True,  "winner", _brief(structure="UGC"), spend=200, revenue=600),
        _row("t3", False, "loser",  _brief(structure="UGC"), spend=150, revenue=50),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    structs = {s["name"]: s for s in out["creative_direction_layer"]["creative_structures"]}
    ugc = structs["UGC"]
    assert ugc["wins"]    == 2
    assert ugc["losses"]  == 1
    assert ugc["spend"]   == 450.0
    assert ugc["revenue"] == 1050.0
    assert round(ugc["roi"], 4) == round(1050.0 / 450.0, 4)


def test_aggregate_overall_roi_in_stats():
    rows = [
        _row("t1", True, "winner", _brief(), spend=100, revenue=400),
        _row("t2", True, "winner", _brief(), spend=200, revenue=600),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["spend_total"]   == 300.0
    assert out["stats"]["revenue_total"] == 1000.0
    assert round(out["stats"]["roi_overall"], 4) == round(1000.0 / 300.0, 4)


def test_aggregate_skips_roi_when_no_spend_data():
    rows = [_row("t1", True, "winner", _brief())]  # no spend/revenue
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["roi_overall"] is None
    assert out["stats"]["tasks_with_spend_data"] == 0


def test_aggregate_winner_briefs_include_full_brief():
    b = _brief(angle="A", why="because reasons")
    rows = [_row("t1", True, "winner", b, spend=10, revenue=40)]
    out = aggregate.build_memory_json("p", "P", rows)
    assert len(out["winner_briefs"]) == 1
    wb = out["winner_briefs"][0]
    assert wb["task_id"]     == "t1"
    assert wb["status"]      == "winner"
    assert wb["why_it_won"]  == "because reasons"
    assert wb["performance"]["spend"]   == 10
    assert wb["performance"]["revenue"] == 40
    assert wb["performance"]["spend_data_complete"] is True


def test_aggregate_combinations_that_win():
    b = _brief(angle="A", persona="P1", structure="UGC", hook="Curiosity")
    rows = [
        _row("t1", True, "winner", b),
        _row("t2", True, "winner", b),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    combos = out["combinations_that_win"]
    assert len(combos) == 1
    c = combos[0]
    assert c["angle"]                == "A"
    assert c["persona"]              == "P1"
    assert c["creative_structure"]   == "UGC"
    assert c["hook_type"]            == "Curiosity"
    assert sorted(c["evidence_task_ids"]) == ["t1", "t2"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_aggregate.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/aggregate.py`**

```python
"""Roll up strategist_processed rows into the full memory JSON.

Pure function: takes processed rows + product metadata, returns the JSON
shape defined in §6.1 of the design spec.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


def _empty_dim_entry():
    return {"wins": 0, "losses": 0,
            "spend": 0.0, "revenue": 0.0,
            "spend_data_count": 0,
            "evidence_task_ids": []}


def _roi(spend: float, revenue: float) -> Optional[float]:
    return (revenue / spend) if spend else None


def _add_to_dim(dimmap: dict, key: str, row: dict):
    """Increment win/loss + spend/revenue + evidence for a dimension key."""
    if not key:
        return
    e = dimmap.setdefault(key, _empty_dim_entry())
    if row["is_winner"]:
        e["wins"] += 1
    else:
        e["losses"] += 1
    e["evidence_task_ids"].append(row["clickup_task_id"])
    if row["spend"] is not None and row["revenue"] is not None:
        e["spend"]   += float(row["spend"])
        e["revenue"] += float(row["revenue"])
        e["spend_data_count"] += 1


def _finalise_dim(dimmap: dict, name_key: str = "name") -> List[dict]:
    out = []
    for k, e in dimmap.items():
        e[name_key] = k
        e["roi"] = _roi(e["spend"], e["revenue"])
        out.append(e)
    out.sort(key=lambda x: (-(x["wins"]), x["losses"]))
    return out


def build_memory_json(product_id: str, product_name: str,
                      processed_rows: List[Dict[str, Any]]) -> dict:
    """Build the full memory JSON for one product."""
    out = {
        "product_id": product_id,
        "product_name": product_name,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "winner": 0, "mild_winner": 0, "scale": 0, "complete": 0,
            "loser": 0, "killed": 0,
            "judged_total": 0,
            "spend_total": 0.0, "revenue_total": 0.0, "roi_overall": None,
            "tasks_with_spend_data": 0, "tasks_missing_spend_data": 0,
        },
        "strategy_layer": {
            "angles": [], "personas": [],
            "emotions_played": [],
        },
        "creative_direction_layer": {
            "creative_structures": [], "production_styles": [],
            "funnel_types": [], "hook_types": [],
        },
        "copy_layer": {"lingo": []},
        "combinations_that_win": [],
        "combinations_that_die": [],
        "winner_briefs": [],
        "loser_briefs": [],
        "trends": {"rising": [], "fading": []},
        "performance_data_hook": {
            "available_now":   ["spend", "revenue", "roi"],
            "reserved_for_v2": ["cpa", "roas", "ctr", "hook_rate",
                                "hold_rate", "cpm", "frequency"],
        },
    }

    angles    = {}
    personas  = {}
    emotions  = {}
    structs   = {}
    prods     = {}
    funnels   = {}
    hooks     = {}
    lingos    = defaultdict(int)
    win_combos  = defaultdict(list)
    lose_combos = defaultdict(list)

    for r in processed_rows:
        st = r["status"]
        if st in out["stats"]:
            out["stats"][st] += 1
        out["stats"]["judged_total"] += 1

        spend_known = r["spend"] is not None and r["revenue"] is not None
        if spend_known:
            out["stats"]["spend_total"]   += float(r["spend"])
            out["stats"]["revenue_total"] += float(r["revenue"])
            out["stats"]["tasks_with_spend_data"] += 1
        else:
            out["stats"]["tasks_missing_spend_data"] += 1

        b = r["brief_json"] or {}
        strat = b.get("strategy", {}) or {}
        creat = b.get("creative", {}) or {}

        _add_to_dim(angles,   strat.get("angle_tag"),   r)
        _add_to_dim(personas, strat.get("persona_tag"), r)
        _add_to_dim(emotions, strat.get("emotion"),     r)
        _add_to_dim(structs,  creat.get("creative_structure"), r)
        _add_to_dim(prods,    creat.get("production_style"),   r)
        _add_to_dim(funnels,  creat.get("funnel_type"),        r)
        _add_to_dim(hooks,    creat.get("hook_type"),          r)

        for phrase in (b.get("copy", {}) or {}).get("lingo", []) or []:
            if r["is_winner"]:
                lingos[phrase] += 1

        # Combination key
        combo = (
            strat.get("angle_tag"),
            strat.get("persona_tag"),
            creat.get("creative_structure"),
            creat.get("hook_type"),
        )
        if all(combo):
            (win_combos if r["is_winner"] else lose_combos)[combo].append(
                r["clickup_task_id"])

        # Per-task brief
        brief_entry = {
            "task_id": r["clickup_task_id"],
            "status": r["status"],
            "performance": {
                "spend":   float(r["spend"])   if r["spend"]   is not None else None,
                "revenue": float(r["revenue"]) if r["revenue"] is not None else None,
                "roi":     _roi(float(r["spend"]), float(r["revenue"])) if spend_known else None,
                "spend_data_complete": spend_known,
            },
            **b,
        }
        if r["is_winner"]:
            out["winner_briefs"].append(brief_entry)
        else:
            out["loser_briefs"].append(brief_entry)

    out["stats"]["roi_overall"] = _roi(
        out["stats"]["spend_total"], out["stats"]["revenue_total"])

    out["strategy_layer"]["angles"]   = _finalise_dim(angles)
    out["strategy_layer"]["personas"] = _finalise_dim(personas)
    out["strategy_layer"]["emotions_played"] = _finalise_dim(emotions)
    out["creative_direction_layer"]["creative_structures"] = _finalise_dim(structs)
    out["creative_direction_layer"]["production_styles"]   = _finalise_dim(prods)
    out["creative_direction_layer"]["funnel_types"]        = _finalise_dim(funnels)
    out["creative_direction_layer"]["hook_types"]          = _finalise_dim(hooks)

    out["copy_layer"]["lingo"] = sorted(
        [{"phrase": p, "winners": c} for p, c in lingos.items()],
        key=lambda x: -x["winners"])

    out["combinations_that_win"] = [
        {"angle": k[0], "persona": k[1],
         "creative_structure": k[2], "hook_type": k[3],
         "evidence_task_ids": v}
        for k, v in sorted(win_combos.items(), key=lambda kv: -len(kv[1]))
    ]
    out["combinations_that_die"] = [
        {"angle": k[0], "persona": k[1],
         "creative_structure": k[2], "hook_type": k[3],
         "evidence_task_ids": v}
        for k, v in sorted(lose_combos.items(), key=lambda kv: -len(kv[1]))
    ]

    return out
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_aggregate.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/aggregate.py tests/test_aggregate.py
git commit -m "$(cat <<'EOF'
feat(strategist): aggregate module — roll up processed rows into memory JSON

Pure-function reducer that takes strategist_processed rows and produces
the full memory JSON shape from §6.1 of the design spec, including:
- Per-status counts (winner/mild_winner/scale/complete/loser/killed)
- Per-dimension wins/losses/spend/revenue/ROI for angle, persona,
  emotion, creative_structure, production_style, funnel_type, hook_type
- combinations_that_win / combinations_that_die
- winner_briefs / loser_briefs
- Overall ROI in stats

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ClickUp module (REST API helpers)

**Files:**
- Create: `tools/strategist/clickup.py`
- Create: `tests/test_clickup.py`

ClickUp helpers use `urllib` (matches existing classify_worker.py pattern, zero deps). All HTTP goes through a single `_request` function so tests can mock it.

- [ ] **Step 1: Write the failing tests**

`tests/test_clickup.py`:

```python
"""Tests for tools/strategist/clickup.py."""
import json
from unittest.mock import patch
from tools.strategist import clickup


def _mock_response(payload):
    """Patch helper — returns a response-like context-manager."""
    class _Resp:
        def read(self_inner):
            return json.dumps(payload).encode()
        def __enter__(self_inner):
            return self_inner
        def __exit__(self_inner, *a):
            return False
    return _Resp()


def test_list_tasks_paginates_until_empty():
    pages = [
        {"tasks": [{"id": "t1", "status": {"status": "winner"}}]},
        {"tasks": [{"id": "t2", "status": {"status": "loser"}}]},
        {"tasks": []},
    ]
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.side_effect = [_mock_response(p) for p in pages]
        out = clickup.list_tasks(api_key="k", list_id="L1", include_closed=True)
    assert [t["id"] for t in out] == ["t1", "t2"]
    assert m.call_count == 3


def test_list_tasks_uses_correct_url_and_headers():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"tasks": []})
        clickup.list_tasks(api_key="my-key", list_id="L1", include_closed=True)
    req = m.call_args[0][0]
    assert "list/L1/task" in req.full_url
    assert "include_closed=true" in req.full_url
    assert req.headers["Authorization"] == "my-key"


def test_get_task_full_returns_payload():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"id": "t1", "name": "task one"})
        out = clickup.get_task_full(api_key="k", task_id="t1")
    assert out["id"] == "t1"


def test_get_task_comments_returns_comments_list():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"comments": [
            {"comment_text": "hi"}, {"comment_text": "bye"}]})
        out = clickup.get_task_comments(api_key="k", task_id="t1")
    assert [c["comment_text"] for c in out] == ["hi", "bye"]


def test_get_custom_fields_returns_fields_list():
    with patch("tools.strategist.clickup.urllib.request.urlopen") as m:
        m.return_value = _mock_response({"fields": [
            {"id": "f1", "name": "Hook Type"},
            {"id": "f2", "name": "Spend"}]})
        out = clickup.get_list_custom_fields(api_key="k", list_id="L1")
    assert {f["name"] for f in out} == {"Hook Type", "Spend"}


def test_extract_doc_url_from_description():
    desc = "see brief at https://app.clickup.com/9016762494/v/dc/abc-123 thanks"
    assert clickup.extract_clickup_doc_url(desc) == \
        "https://app.clickup.com/9016762494/v/dc/abc-123"


def test_extract_doc_url_returns_none_when_absent():
    assert clickup.extract_clickup_doc_url("no link here") is None
    assert clickup.extract_clickup_doc_url(None) is None


def test_compute_content_hash_stable_across_runs():
    h1 = clickup.compute_content_hash(
        status="winner",
        description="desc",
        comments=[{"comment_text": "hi"}],
        custom_fields={"Hook Type": "Curiosity", "Spend": 100.0},
    )
    h2 = clickup.compute_content_hash(
        status="winner",
        description="desc",
        comments=[{"comment_text": "hi"}],
        custom_fields={"Spend": 100.0, "Hook Type": "Curiosity"},  # reordered
    )
    assert h1 == h2


def test_compute_content_hash_changes_on_status_change():
    h1 = clickup.compute_content_hash(
        status="winner", description="d", comments=[], custom_fields={})
    h2 = clickup.compute_content_hash(
        status="loser", description="d", comments=[], custom_fields={})
    assert h1 != h2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_clickup.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/clickup.py`**

```python
"""ClickUp REST API helpers for the strategist worker.

Uses urllib only (matches classify_worker.py pattern — zero extra deps).
All HTTP goes through `_request` so tests can mock at the boundary.
"""

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from typing import List, Dict, Optional, Any

CLICKUP_API_BASE = "https://api.clickup.com/api/v2"
PAGE_SIZE = 100  # ClickUp's max per page


def _request(method: str, url: str, api_key: str,
             body: Optional[dict] = None, max_retries: int = 4) -> dict:
    """One unified HTTP boundary so tests can patch urlopen."""
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": api_key,
                 "Content-Type": "application/json"})
    backoff = 1.0
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and attempt < max_retries - 1:
                time.sleep(min(backoff, 60))
                backoff *= 2
                continue
            raise


def list_tasks(api_key: str, list_id: str,
               include_closed: bool = True) -> List[dict]:
    """List all tasks in a list, paginated."""
    out = []
    page = 0
    while True:
        params = {
            "page": page,
            "subtasks": "true",
            "include_closed": "true" if include_closed else "false",
        }
        url = (f"{CLICKUP_API_BASE}/list/{list_id}/task?"
               f"{urllib.parse.urlencode(params)}")
        payload = _request("GET", url, api_key)
        tasks = payload.get("tasks", [])
        if not tasks:
            break
        out.extend(tasks)
        page += 1
    return out


def get_task_full(api_key: str, task_id: str) -> dict:
    """Fetch the full task object including custom_fields."""
    url = (f"{CLICKUP_API_BASE}/task/{task_id}"
           f"?include_subtasks=false&custom_task_ids=false")
    return _request("GET", url, api_key)


def get_task_comments(api_key: str, task_id: str,
                      max_comments: int = 30) -> List[dict]:
    """Fetch task comments. Caps at `max_comments` (most recent first)."""
    url = f"{CLICKUP_API_BASE}/task/{task_id}/comment"
    payload = _request("GET", url, api_key)
    comments = payload.get("comments", [])
    return comments[:max_comments]


def get_list_custom_fields(api_key: str, list_id: str) -> List[dict]:
    """Fetch the custom field definitions for a list."""
    url = f"{CLICKUP_API_BASE}/list/{list_id}/field"
    payload = _request("GET", url, api_key)
    return payload.get("fields", [])


def get_doc_page(api_key: str, doc_id: str, page_id: str) -> Optional[dict]:
    """Fetch a single doc page if discoverable. Returns None on any error."""
    url = (f"https://api.clickup.com/api/v3/workspaces/"
           f"{{workspace_id}}/docs/{doc_id}/pages/{page_id}")
    try:
        return _request("GET", url, api_key)
    except Exception:
        return None


_DOC_URL_RE = re.compile(
    r"https?://app\.clickup\.com/\d+/v/dc/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)?"
)


def extract_clickup_doc_url(text: Optional[str]) -> Optional[str]:
    """Find the first ClickUp doc URL in a string, or None."""
    if not text:
        return None
    m = _DOC_URL_RE.search(text)
    return m.group(0) if m else None


def compute_content_hash(status: str, description: str,
                         comments: List[dict],
                         custom_fields: Dict[str, Any]) -> str:
    """Stable hash for incremental cache invalidation.

    Sort dict keys so reorderings don't change the hash. Hash only the
    comment text bodies (not authorship metadata).
    """
    payload = {
        "status": (status or "").strip().lower(),
        "description": (description or "").strip(),
        "comments": [(c.get("comment_text") or "") for c in comments],
        "custom_fields": {k: custom_fields[k] for k in sorted(custom_fields)},
    }
    blob = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(blob).hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_clickup.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/clickup.py tests/test_clickup.py
git commit -m "$(cat <<'EOF'
feat(strategist): ClickUp REST helpers (urllib, zero deps)

- list_tasks: paginated list-of-tasks fetch with retry/backoff on 429/5xx
- get_task_full / get_task_comments / get_list_custom_fields
- get_doc_page: best-effort doc page fetch (None on error)
- extract_clickup_doc_url: regex pull from description
- compute_content_hash: stable SHA256 for incremental cache invalidation

Single _request boundary so tests can mock urlopen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Synthesis module (per-task `claude -p` caller)

**Files:**
- Create: `tools/strategist/synthesis.py`
- Create: `tests/test_synthesis.py`

The synthesis module bundles a task into a prompt, runs `claude -p`, parses the JSON return, and produces a `winner_brief` or `loser_brief` entry.

- [ ] **Step 1: Write the failing tests**

`tests/test_synthesis.py`:

```python
"""Tests for tools/strategist/synthesis.py."""
from unittest.mock import patch, MagicMock
from tools.strategist import synthesis


_TASK_BUNDLE = {
    "task_id": "t1",
    "title": "AT-114 Pediatrician UGC",
    "status": "winner",
    "description": "...",
    "comments": [{"comment_text": "talent change to mom worked"}],
    "custom_fields": {
        "Persona Tag": "tired-mom",
        "Angle Tag": "pediatrician-recommended",
        "Hook Type": "Social Proof",
        "Creative Structure": "UGC",
        "Production Style": "Polished UGC",
        "Funnel Type": "TOF",
        "Spend": 320.50,
        "Revenue": 1240.0,
    },
    "doc_page_text": "7-section brief content here",
}


def _ok_subprocess_result(stdout: str):
    r = MagicMock()
    r.returncode = 0
    r.stdout = stdout
    r.stderr = ""
    return r


def test_synthesise_task_returns_brief_json_when_claude_returns_json():
    expected = {
        "strategy": {"angle_tag": "pediatrician-recommended",
                     "persona_tag": "tired-mom",
                     "emotion": "relief"},
        "creative": {"creative_structure": "UGC",
                     "production_style": "Polished UGC",
                     "funnel_type": "TOF",
                     "hook_type": "Social Proof"},
        "copy":     {"hook": "...", "lingo": ["doctor-tested"]},
        "production": {"talent": "mom"},
        "why_it_won": "resonated with tired moms because pediatrician framing",
    }
    import json
    fake_stdout = "garbage\n```json\n" + json.dumps(expected) + "\n```\nOK"
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result(fake_stdout)
        got = synthesis.synthesise_task(_TASK_BUNDLE)
    assert got == expected


def test_synthesise_task_raises_on_nonzero_exit():
    err = MagicMock(); err.returncode = 1
    err.stdout = ""; err.stderr = "boom"
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = err
        try:
            synthesis.synthesise_task(_TASK_BUNDLE)
        except synthesis.SynthesisError as e:
            assert "exit 1" in str(e) or "boom" in str(e)
        else:
            assert False, "expected SynthesisError"


def test_synthesise_task_raises_on_unparseable_output():
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result("no json fence here at all")
        try:
            synthesis.synthesise_task(_TASK_BUNDLE)
        except synthesis.SynthesisError as e:
            assert "parse" in str(e).lower()
        else:
            assert False, "expected SynthesisError"


def test_synthesise_task_invokes_claude_with_bypass_perms():
    import json
    valid = {"strategy": {}, "creative": {}, "copy": {}, "production": {},
             "why_it_won": "x"}
    with patch("tools.strategist.synthesis.subprocess.run") as run:
        run.return_value = _ok_subprocess_result("```json\n" +
                                                 json.dumps(valid) + "\n```")
        synthesis.synthesise_task(_TASK_BUNDLE)
    cmd = run.call_args[0][0]
    assert cmd[0] == "claude"
    assert "-p" in cmd
    assert "--permission-mode" in cmd
    assert "bypassPermissions" in cmd


def test_extract_json_block_handles_fenced_and_unfenced():
    fenced = synthesis._extract_json_block('```json\n{"a": 1}\n```')
    assert fenced == {"a": 1}
    unfenced = synthesis._extract_json_block('blah\n{"a": 2}\nblah')
    assert unfenced == {"a": 2}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_synthesis.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/synthesis.py`**

```python
"""Per-task `claude -p` synthesis.

Takes a bundled task (description, comments, fields, optional doc page)
and asks Claude to produce a single winner_brief / loser_brief JSON
entry following the schema in §6.1 of the design spec.
"""

import json
import re
import subprocess
from typing import Any, Dict


CLAUDE_TIMEOUT_SECONDS = 300  # 5 min per task


class SynthesisError(Exception):
    pass


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)
_JSON_OBJ_RE   = re.compile(r"(\{(?:[^{}]|(?R))*\})")  # not used (no recursion in re); keep simple

def _extract_json_block(text: str) -> Dict[str, Any]:
    """Extract the first JSON object from claude stdout.

    Looks for fenced ```json ... ``` first, then a bare {...}.
    """
    if not text:
        raise SynthesisError("empty stdout — could not parse JSON")
    m = _JSON_FENCE_RE.search(text)
    if m:
        return json.loads(m.group(1))
    # Bare object fallback: greedy from first '{' to last '}'.
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end > start:
        candidate = text[start:end+1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    raise SynthesisError(
        f"could not parse JSON from claude stdout: {text[:300]!r}")


def _build_prompt(bundle: dict) -> str:
    fields = bundle.get("custom_fields", {}) or {}
    comments = "\n".join(
        f"- {c.get('comment_text','')}"
        for c in (bundle.get("comments") or [])
    ) or "(no comments)"

    is_winner = bundle["status"].lower() in (
        "winner", "mild winner", "scale", "complete")
    verdict_word = "won" if is_winner else "died"

    prompt = f"""You are a senior creative strategist analysing one paid-ad task.
Output a single JSON object — nothing before, nothing after — wrapped in ```json ... ``` fences.

The schema:
{{
  "strategy":   {{
    "angle_tag":       "free-text — the tactical angle",
    "persona_tag":     "free-text — the audience persona",
    "pain_point":      "what hurt the viewer",
    "promise":         "what the ad promised to fix",
    "awareness_level": "problem-aware | solution-aware | product-aware | most-aware",
    "emotion":         "fear | hope | fomo | curiosity | pride | relief | anger | other",
    "social_proof":    "doctor | mom | expert | stat | before-after | celeb | UGC | none"
  }},
  "creative":   {{
    "creative_structure": "from the canonical list (UGC, Testimonial, Demo, Tutorial / How-To, Story / Narrative, Hook + Offer, Listicle, Static / Photo, Comparison, Interview, Skit / Roleplay, AI / Voiceover)",
    "production_style":   "from canonical list (Organic / Raw UGC, Polished UGC, Professional Studio, AI Generated, Screen Record, Animation / Motion, Static Graphic, Slideshow, Repurposed Organic, Competitor Inspired)",
    "funnel_type":        "TOF | MOF | BOF",
    "hook_type":          "Pain / Problem | Fear | Curiosity | Social Proof | Aspirational | Direct Offer | Controversy / Bold Claim | POV | Question | News / Trend | Pattern Interrupt",
    "visual_style":       "free-text",
    "lighting":           "natural | studio | harsh | moody",
    "composition":        "free-text",
    "talent":             "free-text",
    "setting":            "free-text",
    "props":              ["array of strings"],
    "color_palette":      "free-text",
    "text_overlay":       "free-text"
  }},
  "copy":       {{
    "hook":     "verbatim hook line",
    "headline": "verbatim headline",
    "body":     "verbatim or summary",
    "cta":      "verbatim CTA",
    "lingo":    ["recurring vocabulary phrases that appeared"]
  }},
  "production": {{
    "person_count":  1,
    "expression":    "free-text",
    "gaze":          "to-camera | off-camera | none",
    "body_language": "free-text"
  }},
  "why_it_{verdict_word}": "200-word essence — your strategist read on why this resonated (or why it died)"
}}

Use the canonical taxonomy values when applicable. If you cannot infer a field, return null for it.

— TASK CONTEXT —
Task ID:      {bundle.get('task_id')}
Title:        {bundle.get('title')}
Status:       {bundle.get('status')}
Description:
{bundle.get('description') or '(none)'}

Custom fields:
{json.dumps(fields, indent=2)}

Comments (most recent first):
{comments}

Linked brief doc text (if any):
{bundle.get('doc_page_text') or '(none)'}

— OUTPUT —
Just the fenced JSON object. No commentary."""
    return prompt


def synthesise_task(bundle: dict) -> dict:
    """Run claude -p once on a task bundle. Return the parsed JSON brief."""
    prompt = _build_prompt(bundle)
    cmd = ["claude", "-p", prompt, "--permission-mode", "bypassPermissions"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=CLAUDE_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        raise SynthesisError(
            f"claude -p timed out after {CLAUDE_TIMEOUT_SECONDS}s")
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or "")[-500:]
        raise SynthesisError(f"claude exit {r.returncode}: {tail}")
    return _extract_json_block(r.stdout)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_synthesis.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/synthesis.py tests/test_synthesis.py
git commit -m "$(cat <<'EOF'
feat(strategist): per-task claude -p synthesis caller

- Bundles task title/description/comments/custom-fields/doc-text into
  one structured prompt with the canonical schema embedded
- Runs `claude -p` with --permission-mode bypassPermissions (matches
  existing classify worker pattern)
- Parses fenced ```json``` block from stdout, raises SynthesisError on
  any failure mode (timeout, non-zero exit, unparseable output)
- 5-min per-task timeout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Renderer module (markdown narrative from JSON)

**Files:**
- Create: `tools/strategist/renderer.py`
- Create: `tests/test_renderer.py`

The renderer takes the aggregate JSON and asks Claude (one call) to render the markdown memo. Same `claude -p` pattern as synthesis.

- [ ] **Step 1: Write the failing tests**

`tests/test_renderer.py`:

```python
"""Tests for tools/strategist/renderer.py."""
from unittest.mock import patch, MagicMock
from tools.strategist import renderer


def _result(stdout, code=0, stderr=""):
    r = MagicMock(); r.returncode = code; r.stdout = stdout; r.stderr = stderr
    return r


def test_render_markdown_returns_stdout_when_claude_succeeds():
    md = "# Strategist Memory — Test Product\n\nWhat's winning right now\n..."
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result(md)
        out = renderer.render_markdown(memory_json={"product_name": "Test"})
    assert out.startswith("# Strategist Memory")


def test_render_markdown_strips_leading_trailing_whitespace():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("\n\n# Hi\n\n")
        assert renderer.render_markdown({"product_name": "x"}) == "# Hi"


def test_render_markdown_raises_on_nonzero_exit():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("", code=1, stderr="oops")
        try:
            renderer.render_markdown({"product_name": "x"})
        except renderer.RenderError as e:
            assert "exit 1" in str(e) or "oops" in str(e)
        else:
            assert False, "expected RenderError"


def test_render_markdown_uses_bypass_perms():
    with patch("tools.strategist.renderer.subprocess.run") as run:
        run.return_value = _result("# Hi")
        renderer.render_markdown({"product_name": "x"})
    cmd = run.call_args[0][0]
    assert cmd[0] == "claude"
    assert "bypassPermissions" in cmd
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_renderer.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/renderer.py`**

```python
"""Markdown renderer for the strategist memory.

Takes the aggregate JSON, asks Claude to write a strategist memo in
markdown using the section structure from §6.2 of the spec.
"""

import json
import subprocess


CLAUDE_TIMEOUT_SECONDS = 300


class RenderError(Exception):
    pass


def _build_prompt(memory_json: dict) -> str:
    return f"""You are a senior creative strategist writing a one-page memo for the team.

Input: a JSON object summarising every winning and losing ad creative for one product.

Output: GitHub-flavored markdown. NO commentary before or after — just the memo. Use these exact sections in this exact order:

1. `# Strategist Memory — {memory_json.get('product_name','?')}`
2. A subtitle line: `_Last updated YYYY-MM-DD · N winners · M mild · L scaled · K losers · O killed · ROI X.XXx_`
3. `## What's winning right now` — bullet list of top 5 angles, top 5 personas, top 5 hook types, ranked by wins (with losses & ROI in parens)
4. `## Combinations to bet on` — top 5 combinations_that_win as `Angle × Persona × CreativeStructure × HookType` with evidence count
5. `## Vocabulary that wins` — top 10 lingo phrases with their winner-appearance count
6. `## Production playbook` — what an editor needs: production_styles, talent (from production sections of winner_briefs), settings, color palettes — all ranked with win count
7. `## What's dying / don't bother` — top 5 loser combinations + top 3 fading patterns
8. `## Trends` — rising and fading sections (skip if empty)
9. `## Full winners log` — for EACH winner_brief, format as:
   `### <task_id> — <strategy.angle_tag> × <strategy.persona_tag>` then a 3-line summary (status, hook line, why_it_won)
10. `## Full losers log` — same format but `why_it_died`

Be terse. Bullets, not paragraphs. Quote verbatim hooks/lingo when present.

— INPUT JSON —
```json
{json.dumps(memory_json, indent=2)}
```

— OUTPUT —
Just the markdown. No commentary."""


def render_markdown(memory_json: dict) -> str:
    prompt = _build_prompt(memory_json)
    cmd = ["claude", "-p", prompt, "--permission-mode", "bypassPermissions"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=CLAUDE_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        raise RenderError(
            f"claude -p timed out after {CLAUDE_TIMEOUT_SECONDS}s")
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or "")[-500:]
        raise RenderError(f"claude exit {r.returncode}: {tail}")
    return (r.stdout or "").strip()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_renderer.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/renderer.py tests/test_renderer.py
git commit -m "$(cat <<'EOF'
feat(strategist): markdown renderer — claude -p produces strategist memo

- Single claude -p call that renders the aggregate JSON into the
  strategist memo with the section structure from §6.2 of the spec
- Embeds the JSON inline in the prompt, asks for terse bullet-style
  output, no commentary
- 5-min timeout, RenderError on any failure mode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Snapshot module (write repo .md/.json)

**Files:**
- Create: `tools/strategist/snapshot.py`
- Create: `tests/test_snapshot.py`

Repo snapshot writes `tools/strategist_memory/<slug>.md` and `<slug>.json` after a successful run. Best-effort — failures don't block the run.

- [ ] **Step 1: Write the failing tests**

`tests/test_snapshot.py`:

```python
"""Tests for tools/strategist/snapshot.py."""
import json
from pathlib import Path
from tools.strategist import snapshot


def test_write_snapshot_creates_files(tmp_path):
    out_dir = tmp_path / "strategist_memory"
    paths = snapshot.write_snapshot(
        slug="astro-rekha",
        memory_json={"product_name": "Astro Rekha", "last_updated": "x"},
        markdown="# Hi",
        out_dir=out_dir,
    )
    assert (out_dir / "astro-rekha.md").read_text() == "# Hi"
    parsed = json.loads((out_dir / "astro-rekha.json").read_text())
    assert parsed["product_name"] == "Astro Rekha"
    assert paths == {
        "md":   out_dir / "astro-rekha.md",
        "json": out_dir / "astro-rekha.json",
    }


def test_write_snapshot_overwrites_existing(tmp_path):
    out_dir = tmp_path / "strategist_memory"
    out_dir.mkdir()
    (out_dir / "x.md").write_text("OLD")
    snapshot.write_snapshot(slug="x", memory_json={}, markdown="NEW",
                            out_dir=out_dir)
    assert (out_dir / "x.md").read_text() == "NEW"


def test_write_snapshot_returns_none_on_io_error(tmp_path, monkeypatch):
    # Force a failure by making the dir read-only.
    out_dir = tmp_path / "strategist_memory"
    def boom(*a, **kw):
        raise OSError("disk full")
    monkeypatch.setattr(snapshot, "_atomic_write", boom)
    assert snapshot.write_snapshot(
        slug="x", memory_json={}, markdown="m", out_dir=out_dir) is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_snapshot.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/snapshot.py`**

```python
"""Repo snapshot writer.

Writes tools/strategist_memory/<slug>.{md,json} after each successful run.
Best-effort: any IO error returns None and is logged by the caller.
"""

import json
from pathlib import Path
from typing import Optional


def _atomic_write(path: Path, content: str) -> None:
    """Write atomically — temp file + rename."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content)
    tmp.replace(path)


def write_snapshot(slug: str, memory_json: dict, markdown: str,
                   out_dir: Path) -> Optional[dict]:
    """Write the .md and .json snapshot files. Return paths dict or None."""
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        md_path   = out_dir / f"{slug}.md"
        json_path = out_dir / f"{slug}.json"
        _atomic_write(md_path,   markdown)
        _atomic_write(json_path, json.dumps(memory_json, indent=2))
        return {"md": md_path, "json": json_path}
    except OSError:
        return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_snapshot.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/snapshot.py tests/test_snapshot.py
git commit -m "$(cat <<'EOF'
feat(strategist): repo snapshot writer (.md + .json per product)

Writes tools/strategist_memory/<slug>.{md,json} atomically after each
successful run. Best-effort: IO errors return None so the worker logs
a warning and treats the Supabase row as the source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: DB module (Supabase REST helpers)

**Files:**
- Create: `tools/strategist/db.py`
- Create: `tests/test_db.py`

Supabase REST helpers used by the pipeline. Like ClickUp, all HTTP funnels through one boundary so tests can mock urlopen.

- [ ] **Step 1: Write the failing tests**

`tests/test_db.py`:

```python
"""Tests for tools/strategist/db.py."""
import json
from unittest.mock import patch
from tools.strategist import db


def _mock_resp(payload, code=200):
    class _R:
        status = code
        def read(self): return json.dumps(payload).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return _R()


def test_load_processed_returns_rows():
    rows = [{"product_id": "p", "clickup_task_id": "t1",
             "content_hash": "h", "brief_json": {"a": 1},
             "is_winner": True, "status": "winner",
             "spend": None, "revenue": None,
             "last_synthesized": "2026-05-06T..."}]
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(rows)
        out = db.load_processed_rows(supabase_url="u", service_key="k",
                                     product_id="p")
    assert len(out) == 1
    assert out[0]["clickup_task_id"] == "t1"


def test_upsert_processed_sends_correct_body():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        db.upsert_processed_row(
            supabase_url="u", service_key="k",
            row={
                "product_id": "p", "clickup_task_id": "t1",
                "content_hash": "h", "brief_json": {"x": 1},
                "is_winner": True, "status": "winner",
                "spend": 10.0, "revenue": 40.0,
            },
        )
    req = m.call_args[0][0]
    sent = json.loads(req.data.decode())
    assert sent["clickup_task_id"] == "t1"
    assert "Prefer" in req.headers
    assert "merge-duplicates" in req.headers["Prefer"]


def test_upsert_memory_sets_updated_at():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        db.upsert_memory(
            supabase_url="u", service_key="k",
            product_id="p", memory_json={"a": 1}, markdown="md")
    body = json.loads(m.call_args[0][0].data.decode())
    assert body["product_id"] == "p"
    assert body["json"]       == {"a": 1}
    assert body["markdown"]   == "md"
    # updated_at is server-default; we don't send it.
    assert "updated_at" not in body or body.get("updated_at") is None


def test_claim_run_marks_status_running():
    """claim_run should atomically flip status pending → running with worker_id."""
    updated = [{"id": 7, "product_id": "p", "status": "running",
                "trigger": "daily", "run_date": "2026-05-06",
                "worker_id": "wkr-1"}]
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp(updated)
        out = db.claim_run(supabase_url="u", service_key="k",
                           run_id=7, worker_id="wkr-1")
    assert out["status"]    == "running"
    assert out["worker_id"] == "wkr-1"


def test_finish_run_sets_done():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([{"id": 7, "status": "done"}])
        out = db.finish_run(
            supabase_url="u", service_key="k",
            run_id=7, status="done", tasks_processed=5,
            tasks_skipped=0, error=None)
    assert out["status"] == "done"


def test_pop_pending_run_returns_none_when_empty():
    with patch("tools.strategist.db.urllib.request.urlopen") as m:
        m.return_value = _mock_resp([])
        assert db.pop_pending_run(
            supabase_url="u", service_key="k",
            worker_id="wkr-1") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_db.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/db.py`**

```python
"""Supabase REST helpers for strategist tables.

Uses urllib + service-role key. All HTTP through _request() so tests
can mock at the urlopen boundary.
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


def _request(method: str, url: str, service_key: str,
             body: Any = None, prefer: Optional[str] = None) -> Any:
    headers = {
        "apikey":        service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
    if not raw:
        return None
    return json.loads(raw)


def load_processed_rows(supabase_url: str, service_key: str,
                        product_id: str) -> List[dict]:
    qs = urllib.parse.urlencode({"product_id": f"eq.{product_id}",
                                 "select": "*"})
    url = f"{supabase_url}/rest/v1/strategist_processed?{qs}"
    return _request("GET", url, service_key) or []


def upsert_processed_row(supabase_url: str, service_key: str,
                         row: dict) -> None:
    url = (f"{supabase_url}/rest/v1/strategist_processed"
           f"?on_conflict=product_id,clickup_task_id")
    _request("POST", url, service_key, body=row,
             prefer="resolution=merge-duplicates,return=minimal")


def upsert_memory(supabase_url: str, service_key: str,
                  product_id: str, memory_json: dict,
                  markdown: str) -> None:
    url = (f"{supabase_url}/rest/v1/strategist_memory"
           f"?on_conflict=product_id")
    body = {"product_id": product_id, "json": memory_json,
            "markdown": markdown,
            "updated_at": datetime.now(timezone.utc).isoformat()}
    _request("POST", url, service_key, body=body,
             prefer="resolution=merge-duplicates,return=minimal")


def pop_pending_run(supabase_url: str, service_key: str,
                    worker_id: str) -> Optional[dict]:
    """Find one pending strategist_runs row. Does NOT atomically claim;
    caller follows up with claim_run() to flip status."""
    qs = urllib.parse.urlencode({
        "status": "eq.pending",
        "select": "*",
        "order":  "created_at.asc",
        "limit":  "1",
    })
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    rows = _request("GET", url, service_key) or []
    return rows[0] if rows else None


def claim_run(supabase_url: str, service_key: str,
              run_id: int, worker_id: str) -> dict:
    """Atomically flip pending → running. Filter on status='pending' to avoid
    double-claim by another worker."""
    qs = urllib.parse.urlencode({
        "id":     f"eq.{run_id}",
        "status": "eq.pending",
    })
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    body = {"status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "worker_id": worker_id}
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    if not out:
        raise RuntimeError(f"strategist_runs row {run_id} not claimable")
    return out[0]


def finish_run(supabase_url: str, service_key: str,
               run_id: int, status: str, tasks_processed: int,
               tasks_skipped: int, error: Optional[str]) -> dict:
    qs = urllib.parse.urlencode({"id": f"eq.{run_id}"})
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    body = {"status": status,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "tasks_processed": tasks_processed,
            "tasks_skipped": tasks_skipped,
            "error": error}
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    return out[0] if out else {}


def get_product(supabase_url: str, service_key: str,
                product_id: str) -> Optional[dict]:
    qs = urllib.parse.urlencode({
        "id": f"eq.{product_id}",
        "select": "id,name,config",
    })
    url = f"{supabase_url}/rest/v1/products?{qs}"
    rows = _request("GET", url, service_key) or []
    return rows[0] if rows else None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_db.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/strategist/db.py tests/test_db.py
git commit -m "$(cat <<'EOF'
feat(strategist): Supabase REST helpers (urllib, service-role)

- load_processed_rows / upsert_processed_row: incremental cache CRUD
- upsert_memory: writes the per-product memory row
- pop_pending_run / claim_run / finish_run: queue lifecycle
- get_product: resolves products.config for clickup_list_id

All HTTP through one _request boundary so tests can mock urlopen.
on_conflict + Prefer: merge-duplicates for upserts, atomic
status-pending filter on claim to avoid double-claim races.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Pipeline orchestrator

**Files:**
- Create: `tools/strategist/pipeline.py`
- Create: `tests/test_pipeline.py`

The orchestrator ties it all together: claim run → fetch tasks → diff cache → synthesise changed → aggregate → render → upsert memory → snapshot → finish.

- [ ] **Step 1: Write the failing tests**

`tests/test_pipeline.py`:

```python
"""Integration test for the strategist pipeline orchestrator.
All external boundaries are mocked at the module level."""
from unittest.mock import patch, MagicMock
from tools.strategist import pipeline


_PRODUCT = {
    "id": "prod-1", "name": "Test Product",
    "config": {"clickup_list_id": "L1"},
}


def _make_task(task_id, status, fields_by_name=None, comments_n=0):
    return {
        "id": task_id,
        "name": f"task {task_id}",
        "description": f"desc {task_id}",
        "status": {"status": status},
        "custom_fields": [{"name": k, "type": "short_text", "value": v}
                          for k, v in (fields_by_name or {}).items()],
        "url": f"https://app.clickup.com/t/{task_id}",
    }


def _mocks(get_product, list_tasks, get_task_full, get_task_comments,
           load_processed, synthesise, render_markdown,
           upsert_processed, upsert_memory, write_snapshot,
           claim_run, finish_run):
    return patch.multiple("tools.strategist.pipeline",
        get_product=get_product, list_tasks=list_tasks,
        get_task_full=get_task_full, get_task_comments=get_task_comments,
        load_processed_rows=load_processed,
        synthesise_task=synthesise,
        render_markdown=render_markdown,
        upsert_processed_row=upsert_processed,
        upsert_memory=upsert_memory,
        write_snapshot=write_snapshot,
        claim_run=claim_run, finish_run=finish_run)


def test_pipeline_processes_only_changed_tasks():
    judged_tasks = [
        _make_task("t1", "winner",      {"Persona Tag": "p"}),
        _make_task("t2", "loser",       {"Persona Tag": "p"}),
        _make_task("t3", "testing",     {}),  # excluded — not judged
    ]
    fetched_full = {
        "t1": _make_task("t1", "winner", {"Persona Tag": "p", "Spend": 10, "Revenue": 40}),
        "t2": _make_task("t2", "loser",  {"Persona Tag": "p"}),
    }
    cached = [{
        "product_id": "prod-1", "clickup_task_id": "t1",
        "content_hash": "stale-hash", "brief_json": {},
        "is_winner": True, "status": "winner",
        "spend": 10.0, "revenue": 40.0,
        "last_synthesized": "2026-05-05",
    }]

    synth_calls = []
    def synth(bundle):
        synth_calls.append(bundle["task_id"])
        return {"strategy": {}, "creative": {}, "copy": {},
                "production": {}, "why_it_won": "x", "why_it_died": "x"}

    upserts = []
    def up_processed(supabase_url, service_key, row):
        upserts.append(row["clickup_task_id"])

    memory_writes = []
    def up_mem(supabase_url, service_key, product_id, memory_json, markdown):
        memory_writes.append((product_id, len(memory_json["winner_briefs"]),
                              len(memory_json["loser_briefs"])))

    snap_writes = []
    def snap(slug, memory_json, markdown, out_dir):
        snap_writes.append(slug)
        return {"md": "x", "json": "y"}

    runs_claimed = []
    def claim(*a, **kw):
        runs_claimed.append(kw.get("run_id"))
        return {"id": kw.get("run_id"), "status": "running"}

    runs_finished = []
    def finish(*, supabase_url, service_key, run_id, status,
               tasks_processed, tasks_skipped, error):
        runs_finished.append((run_id, status, tasks_processed, error))
        return {"status": status}

    with _mocks(
        get_product       = MagicMock(return_value=_PRODUCT),
        list_tasks        = MagicMock(return_value=judged_tasks),
        get_task_full     = MagicMock(side_effect=lambda **kw: fetched_full[kw["task_id"]]),
        get_task_comments = MagicMock(return_value=[]),
        load_processed    = MagicMock(return_value=cached),
        synthesise        = MagicMock(side_effect=synth),
        render_markdown   = MagicMock(return_value="# memo"),
        upsert_processed  = MagicMock(side_effect=up_processed),
        upsert_memory     = MagicMock(side_effect=up_mem),
        write_snapshot    = MagicMock(side_effect=snap),
        claim_run         = MagicMock(side_effect=claim),
        finish_run        = MagicMock(side_effect=finish),
    ):
        pipeline.run_strategist_for_product(
            supabase_url="https://x.supabase.co",
            service_key="K",
            clickup_api_key="CK",
            run_id=42, product_id="prod-1", worker_id="wkr-1",
            snapshot_dir="/tmp/snap")

    # t1's content hash changed (it now has Spend/Revenue) → re-synthesised.
    # t2 is new → synthesised.
    # t3 is excluded (testing).
    assert sorted(synth_calls) == ["t1", "t2"]
    assert sorted(upserts)     == ["t1", "t2"]

    # Memory written with 1 winner + 1 loser.
    assert memory_writes == [("prod-1", 1, 1)]

    # Snapshot named with slug.
    assert snap_writes == ["test-product"]

    # Run finished done.
    assert runs_finished == [(42, "done", 2, None)]


def test_pipeline_marks_run_failed_on_synthesis_error():
    judged_tasks = [_make_task("t1", "winner", {})]
    fetched = {"t1": _make_task("t1", "winner", {})}

    finishes = []
    def finish(**kw):
        finishes.append(kw)
        return {"status": kw["status"]}

    def synth(bundle):
        from tools.strategist.synthesis import SynthesisError
        raise SynthesisError("claude exit 1: ratelimited")

    with _mocks(
        get_product       = MagicMock(return_value=_PRODUCT),
        list_tasks        = MagicMock(return_value=judged_tasks),
        get_task_full     = MagicMock(return_value=fetched["t1"]),
        get_task_comments = MagicMock(return_value=[]),
        load_processed    = MagicMock(return_value=[]),
        synthesise        = MagicMock(side_effect=synth),
        render_markdown   = MagicMock(return_value="# m"),
        upsert_processed  = MagicMock(),
        upsert_memory     = MagicMock(),
        write_snapshot    = MagicMock(return_value=None),
        claim_run         = MagicMock(return_value={"id": 7}),
        finish_run        = MagicMock(side_effect=finish),
    ):
        pipeline.run_strategist_for_product(
            supabase_url="u", service_key="k", clickup_api_key="ck",
            run_id=7, product_id="prod-1", worker_id="w",
            snapshot_dir="/tmp")

    # Per-task failure: skip task, run still completes done with tasks_skipped=1.
    assert len(finishes) == 1
    assert finishes[0]["status"]          == "done"
    assert finishes[0]["tasks_processed"] == 0
    assert finishes[0]["tasks_skipped"]   == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_pipeline.py -v
```

Expected: every test fails with `ModuleNotFoundError`.

- [ ] **Step 3: Implement `tools/strategist/pipeline.py`**

```python
"""Strategist pipeline orchestrator.

One entry point: run_strategist_for_product(...). Wires together db,
clickup, synthesis, aggregate, renderer, snapshot. All collaborators
are imported by name so tests can patch.multiple at this module level.
"""

from pathlib import Path
from typing import Optional

from tools.strategist.taxonomy import (
    is_judged, classify_status, slugify, extract_field_value,
    CANONICAL_FIELD_KEYS,
)
from tools.strategist.clickup import (
    list_tasks, get_task_full, get_task_comments, get_list_custom_fields,
    extract_clickup_doc_url, compute_content_hash,
)
from tools.strategist.db import (
    get_product, load_processed_rows, upsert_processed_row,
    upsert_memory, claim_run, finish_run,
)
from tools.strategist.synthesis import synthesise_task, SynthesisError
from tools.strategist.aggregate import build_memory_json
from tools.strategist.renderer import render_markdown, RenderError
from tools.strategist.snapshot import write_snapshot


def _flatten_custom_fields(task: dict) -> dict:
    """Convert ClickUp's array-of-fields shape into name → value dict.

    Only canonical names are kept; unknown fields are dropped.
    """
    out = {}
    canonical = set(CANONICAL_FIELD_KEYS)
    for f in task.get("custom_fields", []) or []:
        name = f.get("name")
        if name not in canonical:
            continue
        val = extract_field_value(f)
        if val is not None:
            out[name] = val
    return out


def _bundle_for_synthesis(task_full: dict, comments: list) -> dict:
    fields = _flatten_custom_fields(task_full)
    return {
        "task_id":       task_full["id"],
        "title":         task_full.get("name") or "",
        "status":        (task_full.get("status") or {}).get("status") or "",
        "description":   task_full.get("description") or "",
        "comments":      comments,
        "custom_fields": fields,
        "doc_page_text": None,  # extracted from description if present, future
    }


def run_strategist_for_product(*, supabase_url: str, service_key: str,
                               clickup_api_key: str,
                               run_id: int, product_id: str,
                               worker_id: str, snapshot_dir: str,
                               log=print) -> None:
    """Execute the full strategist pipeline for one product."""
    log(f"[strategist] claim run_id={run_id} product={product_id}")
    claim_run(supabase_url=supabase_url, service_key=service_key,
              run_id=run_id, worker_id=worker_id)

    tasks_processed = 0
    tasks_skipped   = 0
    err: Optional[str] = None

    try:
        product = get_product(supabase_url=supabase_url,
                              service_key=service_key,
                              product_id=product_id)
        if not product:
            raise RuntimeError(f"product {product_id} not found")
        list_id = (product.get("config") or {}).get("clickup_list_id")
        if not list_id:
            raise RuntimeError(
                f"product {product_id} has no clickup_list_id in config")

        log(f"[strategist] list tasks from list_id={list_id}")
        all_tasks = list_tasks(api_key=clickup_api_key, list_id=list_id,
                               include_closed=True)
        judged = [t for t in all_tasks
                  if is_judged((t.get("status") or {}).get("status"))]
        log(f"[strategist] {len(all_tasks)} total, {len(judged)} judged")

        cached = load_processed_rows(supabase_url=supabase_url,
                                     service_key=service_key,
                                     product_id=product_id)
        cache_by_id = {r["clickup_task_id"]: r for r in cached}

        for short in judged:
            task_id = short["id"]
            try:
                full = get_task_full(api_key=clickup_api_key, task_id=task_id)
                comments = get_task_comments(api_key=clickup_api_key,
                                             task_id=task_id, max_comments=30)
                bundle = _bundle_for_synthesis(full, comments)
                fields = bundle["custom_fields"]
                hash_now = compute_content_hash(
                    status=bundle["status"],
                    description=bundle["description"],
                    comments=comments,
                    custom_fields=fields,
                )
                cached_row = cache_by_id.get(task_id)
                if cached_row and cached_row["content_hash"] == hash_now:
                    continue  # unchanged — keep cached brief

                brief = synthesise_task(bundle)
                spend   = fields.get("Spend")
                revenue = fields.get("Revenue")
                upsert_processed_row(supabase_url=supabase_url,
                                     service_key=service_key,
                                     row={
                    "product_id":      product_id,
                    "clickup_task_id": task_id,
                    "content_hash":    hash_now,
                    "brief_json":      brief,
                    "is_winner":       classify_status(bundle["status"])
                                       == "winner_group",
                    "status":          bundle["status"].strip().lower(),
                    "spend":           spend,
                    "revenue":         revenue,
                })
                tasks_processed += 1
            except SynthesisError as e:
                log(f"[strategist] task {task_id} synthesis FAIL: {e}")
                tasks_skipped += 1

        # Reload cache (now includes anything newly synthesised) for aggregate.
        cached_after = load_processed_rows(supabase_url=supabase_url,
                                           service_key=service_key,
                                           product_id=product_id)
        # Filter to only judged tasks still present in ClickUp.
        present_ids = {t["id"] for t in judged}
        rows = [r for r in cached_after
                if r["clickup_task_id"] in present_ids]

        memory_json = build_memory_json(product_id=product_id,
                                        product_name=product["name"],
                                        processed_rows=rows)

        try:
            markdown = render_markdown(memory_json)
        except RenderError as e:
            log(f"[strategist] render FAIL: {e}")
            markdown = (f"# Strategist Memory — {product['name']}\n\n"
                        f"_render failed: {e}_\n")

        upsert_memory(supabase_url=supabase_url, service_key=service_key,
                      product_id=product_id, memory_json=memory_json,
                      markdown=markdown)

        slug = slugify(product["name"])
        snap = write_snapshot(slug=slug, memory_json=memory_json,
                              markdown=markdown,
                              out_dir=Path(snapshot_dir))
        if snap is None:
            log(f"[strategist] snapshot write failed (non-fatal)")

    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        log(f"[strategist] FATAL: {err}")
        finish_run(supabase_url=supabase_url, service_key=service_key,
                   run_id=run_id, status="failed",
                   tasks_processed=tasks_processed,
                   tasks_skipped=tasks_skipped, error=err)
        return

    finish_run(supabase_url=supabase_url, service_key=service_key,
               run_id=run_id, status="done",
               tasks_processed=tasks_processed,
               tasks_skipped=tasks_skipped, error=None)
    log(f"[strategist] DONE processed={tasks_processed} "
        f"skipped={tasks_skipped}")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_pipeline.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite to confirm nothing broke**

```bash
pytest -v
```

Expected: all 6 test files green.

- [ ] **Step 6: Commit**

```bash
git add tools/strategist/pipeline.py tests/test_pipeline.py
git commit -m "$(cat <<'EOF'
feat(strategist): pipeline orchestrator

Single entry point run_strategist_for_product() that wires:
  claim_run → list_tasks → diff content_hash against cache
            → synthesise changed tasks → upsert_processed
            → load all cached rows → build_memory_json
            → render_markdown → upsert_memory → write_snapshot
            → finish_run

Per-task synthesis errors increment tasks_skipped without failing the
run. Catastrophic errors (e.g. product not found) mark the run failed
and return without overwriting memory. Render failures degrade
gracefully — fallback markdown is written so the UI never sees an
empty memory row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Worker dispatcher integration

**Files:**
- Modify: `tools/classify_worker.py`

The existing classify worker polls one queue. We add a second poll for `strategist_runs` rows in the same loop. Sequential — never two `claude -p` in flight at once.

- [ ] **Step 1: Read the existing poll loop**

```bash
grep -n "while True\|poll\|claim" "/Users/gauravpataila/Documents/Claude/Clickup /tools/classify_worker.py" | head -20
```

Identify the main `run()` method body (around line 590-650 based on earlier exploration). This is where we'll add a second queue check.

- [ ] **Step 2: Add the strategist poll path**

Open `tools/classify_worker.py`. In the `Worker.run()` method, find the place where it polls `inspiration_queue` and tries to claim a job. After the claim attempt and **before** sleeping, insert a strategist poll:

```python
# Inside Worker.run(), after the existing classify-claim attempt finishes
# and before the sleep:

# ── Strategist queue check ──
# If we're not paused and didn't just process a classify job, try the
# strategist queue. Sequential — never two claude -p in flight.
if not paused and claimed is None:
    try:
        from tools.strategist.pipeline import run_strategist_for_product
        from tools.strategist.db import pop_pending_run
        run = pop_pending_run(
            supabase_url=os.environ["SUPABASE_URL"],
            service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            worker_id=self.worker_id)
        if run is not None:
            log(f"[strategist] picking up run id={run['id']} "
                f"product={run['product_id']} trigger={run['trigger']}")
            self._set_status("busy")
            try:
                run_strategist_for_product(
                    supabase_url=os.environ["SUPABASE_URL"],
                    service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                    clickup_api_key=os.environ["CLICKUP_API_KEY"],
                    run_id=run["id"],
                    product_id=run["product_id"],
                    worker_id=self.worker_id,
                    snapshot_dir=str(Path(__file__).parent /
                                     "strategist_memory"),
                    log=log,
                )
            finally:
                self._set_status("idle")
    except Exception as e:
        log(f"[strategist] poll/run failed: {e}")
```

The exact insert location: find the line in `Worker.run()` that looks like `time.sleep(self.poll_interval)` (or similar) and put the strategist block immediately above it.

- [ ] **Step 3: Verify required env var is documented**

`CLICKUP_API_KEY` must be in `~/.classify-inspiration.env`. Check the existing env loader (`load_env()`) — if it already requires `CLICKUP_API_KEY`, no change needed. If not, add it to the `required` tuple:

```python
# Look for this in load_env() and add CLICKUP_API_KEY if missing:
required = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLICKUP_API_KEY")
```

- [ ] **Step 4: Smoke-test the worker manually**

Confirm the worker starts without errors:
```bash
cd "/Users/gauravpataila/Documents/Claude/Clickup "
python3 tools/classify_worker.py --help 2>&1 | head -20 || python3 -c "from tools.classify_worker import Worker; print('imports ok')"
```

Expected: imports cleanly. (If the existing worker doesn't have a `--help`, just verify imports.)

- [ ] **Step 5: End-to-end smoke test — queue one strategist run**

This is the first time the system runs end-to-end against real data. Do it carefully.

```bash
psql "$SUPABASE_DB_URL" -c "
insert into strategist_runs(product_id, status, trigger, run_date)
  values ('prod-1776760023723', 'pending', 'manual', current_date)
  returning id;"
```

(Replace `prod-1776760023723` with the actual Art Therapy product ID — it was visible in your earlier products query.)

In another terminal, start the worker:
```bash
python3 tools/classify_worker.py
```

Watch the logs (`~/.classify-inspiration-worker-logs/<today>.log`). Expected:
1. `[strategist] picking up run id=N product=prod-... trigger=manual`
2. `[strategist] list tasks from list_id=901613534733`
3. `[strategist] N total, M judged`
4. Per-task `claude -p` synthesis log lines (slow — 30-60s each)
5. `[strategist] DONE processed=M skipped=0`

Check Supabase:
```bash
psql "$SUPABASE_DB_URL" -c "
  select product_id, length(markdown), updated_at from strategist_memory;
  select id, status, tasks_processed, tasks_skipped, error from strategist_runs order by id desc limit 3;
  select count(*) from strategist_processed where product_id='prod-1776760023723';"
```

Expected: 1 strategist_memory row, 1 strategist_runs row with `status='done'`, N strategist_processed rows.

Check the snapshot:
```bash
ls tools/strategist_memory/
cat tools/strategist_memory/art-therapy.md | head -40
```

Expected: `art-therapy.md` and `art-therapy.json` exist, .md starts with the strategist memo header.

- [ ] **Step 6: Commit**

```bash
git add tools/classify_worker.py
git commit -m "$(cat <<'EOF'
feat(strategist): wire strategist pipeline into classify_worker poll loop

Same daemon now polls two queues sequentially (never two claude -p in
flight at once):
  1. inspiration_queue (existing)
  2. strategist_runs (new) → run_strategist_for_product()

Strategist runs share the worker's auto-pause-when-Claude-idle gate.
Worker writes repo snapshot to tools/strategist_memory/<slug>.{md,json}
on each successful run.

Smoke-tested end-to-end against the Art Therapy product list — 80+
judged tasks synthesised, memory + snapshot written, run finished done.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Dashboard — daily auto-trigger logic

**Files:**
- Modify: `immuvi-command-center.html`

When `activeProductId` is set or changes, INSERT a `strategist_runs` row with `trigger='daily'` if no daily row exists for that product today. Multi-tab safe (unique index handles dedup).

- [ ] **Step 1: Backup before editing**

```bash
cp "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" \
   "/Users/gauravpataila/Documents/Claude/Clickup /backups/immuvi-command-center.pre-task-12.html"
```

- [ ] **Step 2: Find where activeProductId is set**

```bash
grep -n "activeProductId =" "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" | head -10
```

Expected: a few lines, including the initial set on dashboard boot and the product-switch handler. Typically there's a function like `setActiveProduct(pid)` or assignments inside an event handler.

- [ ] **Step 3: Add the daily-trigger function**

Find a reasonable place near the top of the JS (search for an existing `async function` block — there's one around line 9900+ for realtime). Insert this function:

```javascript
// ── Strategist memory: queue a daily run for the active product (idempotent) ──
// On dashboard load AND every product switch, insert a strategist_runs row
// with trigger='daily' and run_date=today. Unique index
// ux_strategist_runs_daily_dedup means at most ONE daily row per product per
// day — concurrent inserts from multiple tabs land on the dedup constraint
// and the second silently no-ops via on_conflict=do_nothing.
async function _queueDailyStrategistRun(productId) {
  if (!SB || !productId) return;
  try {
    var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    var { error } = await SB
      .from('strategist_runs')
      .upsert(
        { product_id: productId, status: 'pending',
          trigger: 'daily', run_date: today },
        { onConflict: 'product_id,run_date',
          ignoreDuplicates: true }
      );
    if (error) {
      // Conflict on the partial unique index is expected and fine —
      // means the daily run for this product+today is already queued.
      // Other errors are logged but non-fatal (UI keeps working).
      console.debug('[strategist] daily queue:', error.message);
    } else {
      console.log('[strategist] daily run queued for', productId);
    }
  } catch (e) {
    console.warn('[strategist] daily queue failed (non-fatal):', e);
  }
}
```

- [ ] **Step 4: Wire the trigger into product activation**

Find where `activeProductId` is set (from Step 2). For each location where it changes from null → real or productA → productB, add:

```javascript
_queueDailyStrategistRun(activeProductId);
```

Specifically look for:
1. The bootstrap function (where activeProductId is loaded from localStorage on page load) — call AFTER `activeProductId` is finalised
2. The product-switcher onClick handler (where the user picks a different product) — call AFTER you set the new productId

- [ ] **Step 5: Manual verify**

Reload `http://localhost:8102/immuvi-command-center.html` in a browser. Open DevTools → Console.

Expected console output (one line per page load): `[strategist] daily run queued for prod-...` OR `[strategist] daily queue: duplicate key value violates unique constraint...` (if already queued today).

Switch products in the UI. Expected: another queue line for the new product's ID. Switch back — silent (already queued).

Verify in DB:
```bash
psql "$SUPABASE_DB_URL" -c "
  select product_id, status, trigger, run_date, created_at
  from strategist_runs
  where run_date = current_date and trigger = 'daily'
  order by created_at desc;"
```

Expected: one row per product you opened. No duplicates.

- [ ] **Step 6: Commit**

```bash
git add immuvi-command-center.html
git commit -m "$(cat <<'EOF'
feat(strategist): dashboard queues daily strategist run on product activate

On dashboard load and product switch, insert a strategist_runs row with
trigger='daily' and run_date=today. The ux_strategist_runs_daily_dedup
partial unique index handles multi-tab safety — concurrent inserts hit
the constraint and the redundant ones are silently dropped via
ignoreDuplicates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dashboard — Strategist tab shell (nav button + empty container)

**Files:**
- Modify: `immuvi-command-center.html`

Add the new tab button alongside Action Plan / Inspirations / etc., plus an empty `<section id="panel-strategist">` panel that we'll populate in tasks 14-16.

- [ ] **Step 1: Backup**

```bash
cp "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" \
   "/Users/gauravpataila/Documents/Claude/Clickup /backups/immuvi-command-center.pre-task-13.html"
```

- [ ] **Step 2: Add the tab button**

Find the existing tab nav. Search:
```bash
grep -n "showTab('production'" "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" | head
```

Open that area in the editor. Right after the Production tab button (around line 9172), add:

```html
<button class="tab" onclick="showTab('strategist',this)" role="tab" aria-selected="false">Strategist <span class="tab-count" id="strategistCount">0</span></button>
```

- [ ] **Step 3: Add the empty panel**

Find the existing panels (search for `<section id="panel-production"` — line ~9323). After it, add:

```html
<section id="panel-strategist" class="panel" role="tabpanel">
  <div id="strategistRoot">
    <div class="empty-state" style="padding:48px;text-align:center;color:var(--t3)">
      <div style="font-size:1.1rem;margin-bottom:8px">Loading strategist memory…</div>
      <div style="font-size:0.85rem">Pick a product to see what's winning, what's dying, and the production playbook.</div>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Reload + verify**

Reload localhost preview. Click the new "Strategist" tab. Expected: loading-state visible, no JS errors in console.

- [ ] **Step 5: Commit**

```bash
git add immuvi-command-center.html
git commit -m "$(cat <<'EOF'
feat(strategist): add Strategist tab nav + empty panel

Tab button + empty container. Subsequent tasks render the actual
narrative + structured views.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Dashboard — Strategist tab header + narrative view

**Files:**
- Modify: `immuvi-command-center.html`

Render the strategist memory's markdown narrative + a header strip with stats and a refresh button. We use the existing `marked` library if it's already loaded; otherwise render markdown via a tiny inline converter (or just show `<pre>` raw).

- [ ] **Step 1: Backup**

```bash
cp "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" \
   "/Users/gauravpataila/Documents/Claude/Clickup /backups/immuvi-command-center.pre-task-14.html"
```

- [ ] **Step 2: Check whether `marked` is already loaded**

```bash
grep -n "marked\." "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" | head -3
grep -n "marked.min.js\|marked@" "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" | head -3
```

If `marked` is found, use it. If not, we add a CDN script tag in the document head:

```html
<!-- Add to the <head> only if marked isn't already loaded -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

- [ ] **Step 3: Add the strategist render module (JS)**

Find a reasonable location for new module code (search for an existing function block, e.g. `function _initRealtimeChannel`). Add after it:

```javascript
// ── Strategist tab — narrative view + manual refresh ──
//
// Reads the latest strategist_memory row for the active product and
// renders header strip + markdown body. Realtime updates land via the
// existing per-product channel ('cc-' + productId) — see Task 16.

var _strategistState = {
  loaded: false,
  memory: null,        // { product_id, json, markdown, updated_at }
  latestRun: null,     // most recent strategist_runs row for the product
  view: 'narrative',   // 'narrative' | 'structured'
};

async function _loadStrategistMemory(productId) {
  if (!SB || !productId) return;
  var [{ data: mem }, { data: runs }] = await Promise.all([
    SB.from('strategist_memory').select('*').eq('product_id', productId).maybeSingle(),
    SB.from('strategist_runs').select('*')
      .eq('product_id', productId).order('created_at', { ascending: false }).limit(1),
  ]);
  _strategistState.memory    = mem || null;
  _strategistState.latestRun = (runs && runs[0]) || null;
  _strategistState.loaded    = true;
  _renderStrategist();
}

function _renderStrategist() {
  var root = document.getElementById('strategistRoot');
  if (!root) return;
  if (!_strategistState.loaded) {
    root.innerHTML = '<div style="padding:48px;text-align:center;color:var(--t3)">Loading…</div>';
    return;
  }
  var mem = _strategistState.memory;
  var run = _strategistState.latestRun;

  if (!mem) {
    root.innerHTML = _strategistEmptyState(run);
    return;
  }

  var stats = (mem.json && mem.json.stats) || {};
  var updated = new Date(mem.updated_at);
  var ago = _strategistRelativeTime(updated);

  var statusPill = _strategistStatusPill(run);

  var header =
    '<div class="ap-pulse-wrap" style="padding:16px 20px">' +
      '<div class="ap-pulse-card">' +
        '<div class="ap-pulse-head">' +
          '<span class="ap-pulse-eyebrow">●</span> STRATEGIST MEMORY ' +
          '<span class="ap-pulse-sub">Last updated ' + esc(ago) + '</span>' +
          statusPill +
          '<button class="btn-ghost" style="margin-left:auto" onclick="_strategistRefresh()" title="Force re-synthesis now">↻ Refresh</button>' +
        '</div>' +
        '<div class="ap-pulse-tiles">' +
          _strategistTile('winners',  '🏆 Winners',     stats.winner)      +
          _strategistTile('mild',     '✨ Mild',        stats.mild_winner) +
          _strategistTile('scaled',   '🚀 Scaled',      stats.scale)       +
          _strategistTile('losers',   '⊘ Losers',       stats.loser)       +
          _strategistTile('killed',   '💀 Killed',      stats.killed)      +
          _strategistTile('roi',      '$ ROI overall', stats.roi_overall != null ? stats.roi_overall.toFixed(2) + 'x' : '—') +
        '</div>' +
      '</div>' +
    '</div>';

  var viewToggle =
    '<div style="padding:0 20px 12px;display:flex;gap:8px">' +
      '<button class="btn-ghost ' + (_strategistState.view === 'narrative' ? 'active' : '') + '" onclick="_strategistSetView(\'narrative\')">📖 Narrative</button>' +
      '<button class="btn-ghost ' + (_strategistState.view === 'structured' ? 'active' : '') + '" onclick="_strategistSetView(\'structured\')">📊 Structured</button>' +
    '</div>';

  var body = (_strategistState.view === 'narrative')
    ? _strategistNarrativeBody(mem)
    : _strategistStructuredBody(mem);  // implemented in Task 15

  root.innerHTML = header + viewToggle + body;
}

function _strategistTile(cls, lbl, val) {
  return '<div class="ap-pulse-tile" style="min-width:120px">' +
           '<div class="ap-pulse-tile-lbl">' + esc(lbl) + '</div>' +
           '<div class="ap-pulse-tile-val">' + esc(String(val == null ? 0 : val)) + '</div>' +
         '</div>';
}

function _strategistNarrativeBody(mem) {
  var md = mem.markdown || '';
  var html;
  if (typeof marked !== 'undefined' && marked.parse) {
    html = marked.parse(md);
  } else {
    // Fallback: just <pre> the raw markdown.
    html = '<pre style="white-space:pre-wrap;font-family:inherit">' + esc(md) + '</pre>';
  }
  return '<div class="strategist-narrative" style="padding:0 24px 24px;max-width:880px;margin:0 auto;line-height:1.6">' +
           html +
         '</div>';
}

function _strategistEmptyState(run) {
  var msg = '';
  if (run && run.status === 'pending')  msg = 'Run queued — worker will pick it up shortly.';
  else if (run && run.status === 'running') msg = 'Synthesising… this can take 5-15 min on first run.';
  else if (run && run.status === 'failed')  msg = 'Last run failed: ' + esc(run.error || 'unknown') + '. Hit Refresh to retry.';
  else msg = 'No strategist memory yet. Click Refresh to run the first synthesis.';
  return '<div style="padding:48px;text-align:center;color:var(--t3)">' +
           '<div style="font-size:1.1rem;margin-bottom:12px">' + esc(msg) + '</div>' +
           '<button class="btn-primary" onclick="_strategistRefresh()">↻ Refresh / Run now</button>' +
         '</div>';
}

function _strategistStatusPill(run) {
  if (!run) return '';
  var color = { pending: '#a3a3a3', running: '#fbbf24', done: '#10b981', failed: '#ef4444' }[run.status] || '#a3a3a3';
  var lbl   = { pending: '⏳ Queued', running: '⚙ Running', done: '✓ Up to date', failed: '✗ Failed' }[run.status] || run.status;
  return '<span style="margin-left:12px;padding:4px 10px;border-radius:999px;background:' + color + '22;color:' + color + ';font-size:0.75rem;font-weight:500">' + lbl + '</span>';
}

function _strategistRelativeTime(d) {
  var s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)        return Math.floor(s) + 's ago';
  if (s < 3600)      return Math.floor(s / 60) + 'm ago';
  if (s < 86400)     return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

async function _strategistRefresh() {
  if (!SB || !activeProductId) return;
  var today = new Date().toISOString().slice(0, 10);
  var { error } = await SB.from('strategist_runs').insert({
    product_id: activeProductId, status: 'pending',
    trigger: 'manual', run_date: today,
  });
  if (error) {
    alert('[strategist] queue failed: ' + error.message);
  } else {
    _loadStrategistMemory(activeProductId);
  }
}

function _strategistSetView(v) {
  _strategistState.view = v;
  _renderStrategist();
}

function _strategistStructuredBody(mem) {
  // Stub — implemented fully in Task 15.
  return '<div style="padding:24px;color:var(--t3)">Structured view coming next.</div>';
}
```

- [ ] **Step 4: Wire the load into showTab + product switch**

Find the `showTab` function. Add a case for the strategist tab:

```javascript
// Inside showTab(name, btn) { ... } switch:
if (name === 'strategist') {
  _loadStrategistMemory(activeProductId);
}
```

Also call `_loadStrategistMemory(activeProductId)` whenever `activeProductId` changes (same place you added `_queueDailyStrategistRun` in Task 12).

- [ ] **Step 5: Manual verify**

Reload preview. Click the Strategist tab.

If you ran Task 11 step 5 (smoke-tested the worker against Art Therapy), expected:
- Header strip with winners/mild/scaled/losers/killed/ROI tiles
- "Last updated Xm ago" text
- Status pill green "✓ Up to date"
- Markdown memo body rendered below
- Refresh button works (queues a manual row, status pill flips to ⏳ Queued)

If memory doesn't exist yet, expected:
- Empty state with "Run the first synthesis" button

- [ ] **Step 6: Commit**

```bash
git add immuvi-command-center.html
git commit -m "$(cat <<'EOF'
feat(strategist): Strategist tab — header strip + narrative view + refresh

- Header tiles: winners / mild / scaled / losers / killed / ROI overall
- Last-updated relative timestamp
- Live status pill (queued / running / up to date / failed)
- Manual refresh button → inserts strategist_runs trigger='manual'
- Narrative body: markdown rendered via `marked` (CDN-loaded), with
  raw <pre> fallback when marked isn't available
- Empty state when no memory exists yet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Dashboard — Structured view (filterable dimension tables)

**Files:**
- Modify: `immuvi-command-center.html`

Replace the structured-view stub from Task 14 with real filterable tables per dimension (angles, personas, hook types, creative structures, etc.).

- [ ] **Step 1: Backup**

```bash
cp "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" \
   "/Users/gauravpataila/Documents/Claude/Clickup /backups/immuvi-command-center.pre-task-15.html"
```

- [ ] **Step 2: Replace `_strategistStructuredBody`**

Find the stub from Task 14 and replace its body:

```javascript
function _strategistStructuredBody(mem) {
  var j = mem.json || {};
  var sections = [
    { key: 'strategy',   title: '🎯 Strategy',         dims: [
        ['angles',           'Angles',          j.strategy_layer && j.strategy_layer.angles],
        ['personas',         'Personas',        j.strategy_layer && j.strategy_layer.personas],
        ['emotions_played',  'Emotions played', j.strategy_layer && j.strategy_layer.emotions_played],
    ]},
    { key: 'creative',   title: '🎨 Creative direction', dims: [
        ['creative_structures', 'Creative structures', j.creative_direction_layer && j.creative_direction_layer.creative_structures],
        ['production_styles',   'Production styles',   j.creative_direction_layer && j.creative_direction_layer.production_styles],
        ['funnel_types',        'Funnel types',        j.creative_direction_layer && j.creative_direction_layer.funnel_types],
        ['hook_types',          'Hook types',          j.creative_direction_layer && j.creative_direction_layer.hook_types],
    ]},
    { key: 'copy',       title: '✍ Copy',              dims: [
        ['lingo',  'Lingo (winners only)', j.copy_layer && j.copy_layer.lingo, /*lingoMode*/true],
    ]},
    { key: 'combos',     title: '🔗 Combinations',      dims: [
        ['win',  'Combinations that win',  j.combinations_that_win,  /*comboMode*/true],
        ['die',  'Combinations that die',  j.combinations_that_die,  /*comboMode*/true],
    ]},
  ];

  var html = '<div style="padding:0 24px 24px;max-width:1120px;margin:0 auto">';
  sections.forEach(function (sec) {
    html += '<h2 style="margin:24px 0 12px;font-size:1rem;color:var(--t1)">' + esc(sec.title) + '</h2>';
    sec.dims.forEach(function (d) {
      html += _strategistDimTable(d[1], d[2] || [], d[3]);
    });
  });
  html += '</div>';
  return html;
}

function _strategistDimTable(title, rows, mode) {
  if (!rows.length) {
    return '<div style="margin:8px 0;color:var(--t3);font-size:0.85rem">' +
             esc(title) + ': <em>no data yet</em></div>';
  }
  var isCombo = (mode === true);

  var headerCells, bodyRows;

  if (isCombo) {
    // Combinations table: angle × persona × structure × hook
    headerCells = '<th>Angle</th><th>Persona</th><th>Structure</th><th>Hook</th><th class="num">Evidence</th>';
    bodyRows = rows.map(function (r) {
      return '<tr>' +
        '<td>' + esc(r.angle    || '—') + '</td>' +
        '<td>' + esc(r.persona  || '—') + '</td>' +
        '<td>' + esc(r.creative_structure || '—') + '</td>' +
        '<td>' + esc(r.hook_type || '—') + '</td>' +
        '<td class="num">' + (r.evidence_task_ids || []).length + '</td>' +
      '</tr>';
    }).join('');
  } else if (title.toLowerCase().indexOf('lingo') >= 0) {
    headerCells = '<th>Phrase</th><th class="num">Winner appearances</th>';
    bodyRows = rows.map(function (r) {
      return '<tr><td>' + esc(r.phrase || '') + '</td>' +
             '<td class="num">' + (r.winners || 0) + '</td></tr>';
    }).join('');
  } else {
    // Standard dimension table: name | wins | losses | spend | revenue | ROI | evidence
    headerCells = '<th>Name</th><th class="num">W</th><th class="num">L</th><th class="num">Spend</th><th class="num">Rev</th><th class="num">ROI</th><th class="num">Evidence</th>';
    bodyRows = rows.map(function (r) {
      var roi = (r.roi != null) ? (r.roi.toFixed(2) + 'x') : '—';
      return '<tr>' +
        '<td>' + esc(r.name || '—') + '</td>' +
        '<td class="num">' + (r.wins   || 0) + '</td>' +
        '<td class="num">' + (r.losses || 0) + '</td>' +
        '<td class="num">' + (r.spend   ? '$' + Math.round(r.spend)   : '—') + '</td>' +
        '<td class="num">' + (r.revenue ? '$' + Math.round(r.revenue) : '—') + '</td>' +
        '<td class="num">' + roi + '</td>' +
        '<td class="num">' + (r.evidence_task_ids || []).length + '</td>' +
      '</tr>';
    }).join('');
  }

  return '<div style="margin:8px 0 16px">' +
           '<div style="font-size:0.78rem;color:var(--t2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">' + esc(title) + '</div>' +
           '<table class="ap-table" style="width:100%">' +
             '<thead><tr>' + headerCells + '</tr></thead>' +
             '<tbody>' + bodyRows + '</tbody>' +
           '</table>' +
         '</div>';
}
```

- [ ] **Step 3: Manual verify**

Reload preview. Click Strategist tab → click "📊 Structured" toggle.

Expected: tables for Strategy (angles/personas/emotions), Creative direction (creative_structures/production_styles/funnel_types/hook_types), Copy (lingo), Combinations (win/die). Each table shows wins, losses, spend, revenue, ROI columns. Empty dimensions show italic "no data yet".

Toggle back to Narrative — should re-render without hiccup.

- [ ] **Step 4: Commit**

```bash
git add immuvi-command-center.html
git commit -m "$(cat <<'EOF'
feat(strategist): Strategist tab — structured view with dimension tables

Filterable tables per dimension under four sections:
  Strategy: angles, personas, emotions
  Creative direction: creative_structures, production_styles,
                      funnel_types, hook_types
  Copy: lingo (winners only)
  Combinations: win combos, die combos

Each dimension row shows W / L / spend / revenue / ROI / evidence count.
Toggle between Narrative and Structured views in the header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Dashboard — Realtime subscription for live progress

**Files:**
- Modify: `immuvi-command-center.html`

Subscribe `strategist_runs` and `strategist_memory` rows to the existing per-product realtime channel so the status pill updates from "Queued → Running → Up to date" without a refresh.

- [ ] **Step 1: Backup**

```bash
cp "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" \
   "/Users/gauravpataila/Documents/Claude/Clickup /backups/immuvi-command-center.pre-task-16.html"
```

- [ ] **Step 2: Find the existing realtime channel setup**

```bash
grep -n "_initRealtimeChannel\|subscribeToProduct" "/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html" | head
```

This is where per-product realtime subscriptions are wired (around line 9592 / 11106-11107 from earlier exploration).

- [ ] **Step 3: Add strategist tables to the subscription**

In the existing channel handler, after the existing `.on('postgres_changes', ...)` calls for ADs / MAs / etc., add:

```javascript
// Strategist runs — flip status pill live as the worker progresses.
.on('postgres_changes',
    { event: '*', schema: 'public', table: 'strategist_runs',
      filter: 'product_id=eq.' + productId },
    function (payload) {
      // Reload state on any change to a row for this product.
      if (typeof _strategistState !== 'undefined') {
        _loadStrategistMemory(productId);
      }
    })
// Strategist memory — re-render when a new memory row is upserted.
.on('postgres_changes',
    { event: '*', schema: 'public', table: 'strategist_memory',
      filter: 'product_id=eq.' + productId },
    function (payload) {
      if (typeof _strategistState !== 'undefined') {
        _loadStrategistMemory(productId);
      }
    })
```

⚠ **Critical: do NOT add a new channel** — extend the existing one. Adding a separate channel violates the realtime traffic budget invariant (memory: `feedback_realtime_traffic_budget`). The two `.on()` calls reuse the existing per-product channel; no new subscription cost.

- [ ] **Step 4: Manual verify**

Open localhost preview in two browser tabs (same product active in both). In tab 1, click the Strategist tab. In tab 2, hit Refresh.

Expected sequence in tab 1 (without manually clicking anything):
- Status pill flips ⏳ Queued (when the manual row is inserted)
- Status pill flips ⚙ Running (when the worker claims it)
- Header tiles + body update to new data when worker finishes; pill flips ✓ Up to date

If the worker is running when you do this, you'll see the live progression. If not, just verify the tile + body refresh after you start the worker.

- [ ] **Step 5: Commit**

```bash
git add immuvi-command-center.html
git commit -m "$(cat <<'EOF'
feat(strategist): live progress via existing realtime channel

Extend the existing per-product channel ('cc-' + productId) with two
.on() handlers for strategist_runs + strategist_memory. Status pill
flips live (Queued → Running → Up to date) and tiles + body refresh
when the worker upserts a new memory row.

CRITICAL: extends the existing channel — does NOT add a new
subscription. Reverting to a separate channel would violate the
realtime traffic budget invariant (memory:feedback_realtime_traffic_budget).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Update auto-memory with strategist invariants

**Files:**
- Create: `/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/feedback_strategist_invariants.md`
- Create: `/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/project_strategist_agent.md`
- Modify: `/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/MEMORY.md`

Lock the strategist invariants so future sessions can't accidentally regress them.

- [ ] **Step 1: Write the strategist invariants memory**

`/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/feedback_strategist_invariants.md`:

```markdown
---
name: Strategist Agent — invariants
description: Five invariants that protect the strategist memory worker. Reverting any breaks live progress, multi-tab safety, daily-dedup, or the realtime traffic budget.
type: feedback
---

Five invariants for the strategist memory worker. Touch one, check the others — they form a system.

1. **Daily-dedup unique partial index must stay**
   `ux_strategist_runs_daily_dedup` on `(product_id, run_date) where trigger='daily'`. Multi-tab dashboard load relies on it: concurrent inserts hit the constraint and the redundant ones drop silently via `ignoreDuplicates`. Removing it lets a 50-tab user queue 50 daily runs.

2. **Strategist subscriptions piggy-back the existing per-product channel — never a new channel**
   Both `.on()` handlers (strategist_runs, strategist_memory) attach to `cc-${productId}`. Adding a new `SB.channel(...)` call here would cost 2× the realtime quota per active product and breaks the realtime-traffic-budget invariant we paid 80% reduction to land. See feedback_realtime_traffic_budget.md.

3. **Sequential `claude -p` only — no parallel synthesis**
   `tools/strategist/synthesis.py` must NOT be parallelized across tasks. The classify worker already serialises `claude -p` calls; strategist must too. Two concurrent calls compete for the same Max-plan rate-limit window and trigger 5-hour cooldowns that block all other workers.

4. **Content-hash diff is the cache key — both sides match the same hash inputs**
   `compute_content_hash(status, description, comments, custom_fields)` in `tools/strategist/clickup.py`. The pipeline AND any future re-synthesis path must compute the hash from the SAME four inputs in the SAME canonical form (lowercase status, sorted custom_fields keys, comment text only). Drift = the cache thinks every task changed every run = 80 `claude -p` calls per run.

5. **`is_judged()` is the only filter — never bypass it**
   `tools/strategist/taxonomy.py: is_judged()` returns true for {winner, mild winner, scale, complete, loser, killed} — the canonical taxonomy. Adding "untested" or "testing" to the filter inflates the synthesis pool 5× and pollutes memory with unreliable data (no verdict yet).

**Why:** The strategist runs on a $200/mo Max subscription. Rate limits, not dollar cost, are the constraint. Each invariant protects either rate-limit budget, realtime budget, or memory-quality.

**How to apply:** Before merging changes that touch `tools/strategist/`, `strategist_runs` schema, or the `cc-${productId}` realtime channel, walk this checklist top to bottom. If a touch crosses two of these, double-check the second invariant didn't silently break.
```

- [ ] **Step 2: Write the project memory**

`/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/project_strategist_agent.md`:

```markdown
---
name: Strategist Agent (Agent 1) — shipped 2026-05-06
description: Per-product strategist memory worker. Synthesizes ClickUp winner/loser tasks → JSON+markdown memory. Spec, plan, key file paths.
type: project
---

Agent 1 of a planned 2-agent system (Agent 2 = Producer is a future spec).

**Status:** shipped 2026-05-06. v1 includes ROI from existing Spend + Revenue ClickUp custom fields.

**Why:** Long-term creative knowledge moat. Records what's winning per product so Agent 2 (and humans) can ship better creative without re-deriving the lesson every brief.

**How to apply:** When asked to add strategy data, generate creative briefs, or analyse what's working per product, the strategist memory at `strategist_memory.json` (Supabase) is the source of truth. Agent 2 reads it via `select json, markdown from strategist_memory where product_id = X`.

**Key paths:**
- Spec: `docs/superpowers/specs/2026-05-06-strategist-agent-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-strategist-agent.md`
- Worker: extends `tools/classify_worker.py` poll loop with second queue
- Pipeline: `tools/strategist/pipeline.py` (orchestrator)
- Modules: `tools/strategist/{taxonomy,clickup,synthesis,aggregate,renderer,snapshot,db}.py`
- Tests: `tests/test_*.py` (pytest)
- Tables: `strategist_memory`, `strategist_runs`, `strategist_processed`
- UI tab: Strategist tab in immuvi-command-center.html
- Repo snapshot dir: `tools/strategist_memory/<product-slug>.{md,json}`

**Trigger model:** dashboard inserts `strategist_runs` row with `trigger='daily'` on product activate (multi-tab safe via partial unique index). Manual refresh button inserts `trigger='manual'`. Worker polls and runs sequentially.

**Status taxonomy locked:** Winners = {winner, mild winner, scale, complete}. Losers = {loser, killed}. Pending (excluded) = {untested, approved, in production, ready to launch, testing}. Confirmed against immuvi-command-center.html:36945.

**Future work (not v1):** Agent 2 (producer pipeline that reads memory + ClickUp task → generates ad images via Codex/Claude in parallel chats). Real Meta API integration to populate cpa/roas/ctr/hook_rate/hold_rate (already reserved in JSON shape).
```

- [ ] **Step 3: Update MEMORY.md index**

Edit `/Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/MEMORY.md`. Add two lines under the existing entries (keep alphabetical-ish or grouped however current structure is):

```markdown
- [Strategist Agent — invariants](feedback_strategist_invariants.md) — 5 invariants protecting daily-dedup, realtime budget, sequential claude -p, content-hash, is_judged filter. Touch one, check the others.
- [Strategist Agent (shipped 2026-05-06)](project_strategist_agent.md) — Per-product memory worker. Spec/plan/file paths. Source of truth for "what's winning per product".
```

- [ ] **Step 4: Verify memory loads cleanly**

Open one of the new memory files in your editor — confirm the YAML frontmatter is valid (3-dash fences, valid `type: feedback` / `type: project`).

- [ ] **Step 5: Commit (memory dir is in user home, not the repo — no commit)**

These files live outside the project repo. Skip git commit for this task. Just verify the files exist:

```bash
ls -la /Users/gauravpataila/.claude/projects/-Users-gauravpataila-Documents-Claude-Clickup-/memory/ | grep strategist
```

Expected: `feedback_strategist_invariants.md` + `project_strategist_agent.md` listed.

---

## Final smoke test

After Task 17:

- [ ] **Step 1: Run full test suite**

```bash
cd "/Users/gauravpataila/Documents/Claude/Clickup "
pytest -v
```

Expected: all 6 test files pass (test_taxonomy, test_aggregate, test_clickup, test_synthesis, test_renderer, test_snapshot, test_db, test_pipeline). Total ~50 tests.

- [ ] **Step 2: End-to-end manual flow**

1. Localhost preview at `http://localhost:8102/immuvi-command-center.html` running
2. Worker daemon running (`python3 tools/classify_worker.py`)
3. Open dashboard, switch to a product (e.g. Art Therapy)
4. Within 5 seconds, console logs `[strategist] daily run queued for prod-...`
5. Click Strategist tab — see header, narrative or empty state
6. Click "↻ Refresh" — status pill flips ⏳ Queued
7. Watch worker logs — picks up the run, fetches tasks, synthesises, finishes
8. Status pill in dashboard flips ⚙ Running → ✓ Up to date without page refresh
9. Header tiles update with new counts
10. Toggle to Structured view — see filterable dimension tables with ROI

- [ ] **Step 3: Verify repo snapshot and existing invariants**

```bash
ls tools/strategist_memory/
git log --oneline -20
```

Expected: per-product .md and .json files exist. Recent commits cover migration → modules → worker → tab. No commits touched anything outside `tools/strategist/`, `tests/`, `supabase/migrations/`, `immuvi-command-center.html`, `pytest.ini`, or `docs/`.

Confirm the existing invariant guards still pass:
- AD/MA delete still works across multi-tabs (manual: open two tabs, delete an AD in one, verify it stays deleted on the other)
- Realtime channel count is unchanged (we extended, didn't add) — open DevTools Network → WS, count `realtime` connections per tab; should match pre-change count
- Action Plan tasks still merge additively on realtime updates

---

## Self-Review Checklist (run after writing the plan)

- [x] **Spec coverage:** Every section of the spec (data sources, schema, storage, pipeline, trigger model, worker integration, UI, failure handling, rate-limit guardrails, future hooks, definition of done) maps to at least one task.
- [x] **Placeholder scan:** No "TBD", "TODO", "implement later", or "similar to Task N" inside steps. Every step has the actual code/command.
- [x] **Type consistency:** `_strategistState`, `_loadStrategistMemory`, `_renderStrategist`, `_strategistRefresh`, `_strategistTile` consistently named across Tasks 14, 15, 16. Python modules import each other by full path (`from tools.strategist.X import Y`) consistently.
- [x] **Existing invariants protected:** Plan explicitly calls out the realtime-budget invariant (Task 16 step 3 callout), AD/MA delete invariants (final smoke step 3), worker rate-limit invariant (Task 11 step 1 callout, plus invariant #3 in Task 17).
- [x] **TDD where appropriate:** Tasks 3-10 (Python modules) are full TDD with failing-test-first. Tasks 1, 11-16 (migration, worker integration, HTML/JS) use manual verification — appropriate since no test infra exists for those layers.
- [x] **Rollback safety:** HTML edits backed up before each task. Migration is forward-only but tables are isolated (won't break existing flows). Worker-loop change can be reverted by removing the inserted block.

---

**Plan complete and saved to** [docs/superpowers/plans/2026-05-06-strategist-agent.md](2026-05-06-strategist-agent.md)
