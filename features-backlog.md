# Immuvi Command Center — Feature Backlog

Features noted for future implementation. Not urgent — build when prioritized.

---

## Feature 1 — Creative Matrix: Cell Hover Reveal

**Goal:** On hover over any matrix cell, reveal full status breakdown + winner task name(s) in an animated floating card.

**Trigger:** Mouseenter on any `.mxv4-cell` (in the new true-grid layout)

**Card content:**
- Header: Angle name × Persona name
- Winner section (if any): ★ icon + each winner's full task name (truncate at ~60 chars)
- Status chips for non-zero counts: Winner / Testing / In Prod / Ready / Untested / Loser — each with colored dot + label + count
- Funnel breakdown: TOF/MOF/BOF mini-bars
- Footer nudge: "Click to open →"

**Positioning:**
- Default: floats above the cell
- Smart-flip: if near bottom of viewport → appear below; if near right edge → appear to the left
- Width: ~280px, max-height auto
- Anchor with small arrow/notch pointing at the cell

**Animation:**
- Enter: spring scale `0.94 → 1` + opacity `0 → 1` + `translateY 6px → 0`, easing `cubic-bezier(0.16, 1, 0.3, 1)`, 220ms
- Chips inside: stagger in 40ms apart
- Exit: 120ms fade + scale-down

**Implementation notes:**
- Body-portaled (like persona dropdown) so it never clips at grid scroll edges
- Read winner names from `_mxv4ClassifyCell(angle, persona).ads.filter(a => a.status === 'Winner' || 'Scale' || 'Complete')`
- Hover delay: 150ms before show, 100ms before hide (debounced)
- Don't show for empty cells (or show only "Click to add a creative")

---

## Feature 2 — Creative Tracker: remove master-detail section entirely

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02 · **Confirmed:** 2026-05-02

**Goal:** Delete the master-detail layout altogether. The Tracker keeps only the Table view as its single rendering. The "10887" detail panel and the master-detail toggle pill at the top of the Tracker section both go away.

**Cleanup checklist:**
- Remove the `Master-detail` / `Table` segmented toggle.
- Default-and-only view becomes Table.
- Drop the `tracker.viewMode` (or equivalent) localStorage key once nothing reads it.
- Remove all DOM / CSS / JS associated with the master-detail layout.

---

## Feature 3 — Creative Tracker: collapse filter row into per-filter dropdowns

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02

**Goal:** In Table view the filter row currently spreads every option as inline pills (Date: All time / Today / This week / Last 14d / Last 30d · Status: Untested / Approved / In Production / Ready to Launch / Testing / Winner / Loser / Scale / Complete · Funnel: TOF / MOF / BOF). It's noisy. Replace each filter group with a single dropdown button that opens a panel of options (multi-select for Status, single-select for Date and Funnel — match the Matrix filter pattern we just shipped).

**Pattern reference:** the Matrix Status dropdown built 2026-05-02 — pill button shows "All / N selected / Single label", click opens floating panel with checkboxes, click-outside auto-closes, persisted to localStorage.

**Targets:**
- **Date** → reuse the *exact* date picker from the Creative Matrix filter row (`openMxv4DatePicker` — unified button with calendar, presets All time / Today / This week / Last 14d / Last 30d / Custom, and basis selector Created / Updated / Status changed). Same component, same UX. Persist to a Tracker-scoped key (e.g. `tracker.dateRange` / `tracker.dateBasis`) so it doesn't fight the Matrix's own state.
- **Status** → multi-select dropdown (mirror Matrix Status dropdown pattern)
- **Funnel** → multi-select dropdown
- "Reset all" stays where it is (right side)

---

## Feature 4 — Per-task inspiration link / source-of-inspiration trace

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02

**Goal:** Every task should surface where its idea came from, so the user can trace creative lineage.

**Cases to cover:**
1. **Task created from an inspiration** — show the inspiration's URL / ID directly on the task card (clickable, opens the inspiration brief).
2. **Task created from another task (recreate / variation)** — show the parent task as a chip; clicking it jumps to the parent. If the parent itself originated from an inspiration, surface that too (transitive — "via task 10805 ← inspiration AR-INS-014").
3. **Task created manually with no source** — show "—" or "Manual" so absence is explicit.

**Where it shows:**
- Task detail panel (new "Inspiration" / "Source" section)
- Optional: small icon badge on the task row in Table view

**Data:** check whether `inspoId` / `parentAdId` already exist on ad records — both have been seen in code. If yes, just surface them; if no, add a column / metadata field.

---

## Feature 5 — Creative USP on each task (sourced from origin)

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02 · **Confirmed:** 2026-05-02

**Goal:** Show the creative USP (unique selling points / brief) on each task, pulled from wherever the task originated.

**Resolution rules:**
1. **Task created from a ClickUp task as inspiration** → fetch the USP from the source ClickUp task (read the relevant ClickUp custom field on the parent task).
2. **Task created from an Inspiration entry (inspo brief)** → fetch the USP from the Inspiration tab record (the brief that the task was generated from).
3. **Manual / no-source task** → blank or "—".

**Where it shows:**
- Task detail panel — dedicated "USP" / "Creative brief" section.
- Optional Tracker Table column (driven by Feature 6 column manager) — read-only, shows a truncated preview, full text in the detail panel.

**Open follow-up (small):** confirm the *exact* ClickUp custom field name for USP on the parent task, and the field on the Inspiration record, so the lookup hits the right key.

---

## Feature 6 — Table view: drag-and-drop column manager + saved view

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02

**Goal:** Let the user customise which columns appear in Table view by dragging columns into / out of / around the table. The chosen layout persists per user (localStorage at minimum, ideally Supabase if cross-device matters), so reopening Table view always restores the saved column set + order.

**Mechanics:**
- "Add column" affordance — a `+` chip at the right of the header row, opens a panel of available columns. The panel surfaces **two sources** side-by-side:
  1. **App columns** — every native field this app already tracks per task (Status, Funnel, AD Type, Source, Origin, Created, Last activity, Inspiration link, Parent task, USP, Win rate, etc.).
  2. **ClickUp columns** — every custom field on the underlying ClickUp list, fetched live. The cell pulls the value directly from that ClickUp custom field for each task. Updates as ClickUp updates.
- Drag column headers left/right to reorder. Visual drop indicator between columns.
- Drag a column off the table (or click an X on the header) to remove it.
- Live persist: every change saves immediately to localStorage. View is restored on next open without action.
- **Saved views (v1.5):** support naming and saving multiple column sets ("QA view", "Winner-only view", "Production handoff"). Top-of-Tracker dropdown to switch between them. One default view shipped per user.

**State keys:**
- `tracker.tableColumns` — current column ids in display order (array).
- `tracker.savedViews` — `[{ id, name, columns: [...], filters: {...} }, ...]`.
- `tracker.activeView` — id of the currently-applied view.

**Default seed for fresh users:** `['name','status','adType','funnel','source','created']`.

**Open follow-up:** decide what happens to a saved view if a ClickUp custom field is later deleted in ClickUp — column should auto-remove with a one-time toast, not silently render blank cells.

---

## Feature 7 — Cell Add-Creative picker redesign (Tracker + Inspiration)

**Status:** 🆕 just-flagged · **Reported:** 2026-05-02 · **Confirmed:** 2026-05-02
**Surface:** Creative Matrix → cell modal → "+ Add Creative" panel (the cell-level picker, NOT the global top-bar `openAddCreative()` modal)

### Goal
Replace the current `_mxv3RenderAddTracker` / `_mxv3RenderAddInspiration` panels with a cleaner two-tab picker that surfaces all the decision-relevant info at a glance, restoring the UX of the previous app.

### Two-tab picker layout
```
[ From Creative Tracker ]   [ From Inspiration ]
🔍 sticky search…                [ filter ▾ ]
──────────────────────────────────────────────────
  card · card · card …
```

### Tracker tab — rules
- **Parent-only filter.** Exclude every ad where:
  - `parentAdId` is set (variations like AD-013-v2 / v3 are hidden — only AD-013 shows)
  - `taskType === 'production'` (production clones)
  - `trackerRefId` is set
  - `_fromInspoId` points to an inspiration already represented as its own parent
- **Group by parent format, not by occurrence.** If AD-013 is linked into 3 cells, it shows ONCE in this list. Picking it links the same parent into the current cell — no clone, no new variation.
- **Hide already-linked.** If the AD is already in this `cellKey` (per `CELL_CREATIVE_ASSIGNMENTS`), exclude it (existing behavior at line 17694).
- **Each row shows:**
  - Format name (`a.formatName || a.id`)
  - Status badge — Winner / Loser / Testing / In Production / Ready / Untested (use existing `classify()` color map at line 17710)
  - Funnel chip + Ad Type chip
  - Angle (muted) — only if it differs from the current cell's angle
  - **Created date** from `a.createdAt` ("12 Apr"; add year if not current year)
  - **🔗 Drive link** chip from `a.driveLink` (priority over `adLink`); missing → no chip (don't print "—")
- **Sort:** Winners → Testing → In Production → Ready → Untested → Loser; within each tier, newest `createdAt` first.
- **Click row → link AD into cell** via existing `mxv3LinkFromTracker(adId)` handler at line 17721.
- **Empty state:** "No parent tracker creatives match." with a tiny "Create new instead →" link that drops to the manual blank form (`_mxv3RenderAddBlank`).

### Inspiration tab — rules (per user spec)
Each card shows ALL of:
- Title / format name (`i.title || i.name`)
- **Inspiration link** as `🔗 inspo` chip (`i.adLink`) — primary chip on this tab
- Ad Type
- Funnel stage
- Angle (muted)
- Notes — single-line truncate at ~80 chars, full text on hover
- Status (if the inspiration carries one — e.g. `i.status` or `i.tag`)
- Date added (`i.createdAt` or `i.dateAdded`)

**Click → spawn** a new ad via existing `mxv3SpawnFromInspiration(inspoId)`. Sort: most recently added first.

### Always-visible filter dropdown (both tabs)
A persistent dropdown control in the picker header — same visual vocabulary as the Matrix Status dropdown shipped 2026-05-02 (pill button → floating panel → checkboxes → click-outside autoclose → persisted to localStorage).

**Filter facets per tab:**
- **Tracker tab:** Status (multi), Funnel (multi), Ad Type (multi), Angle (multi)
- **Inspiration tab:** Ad Type (multi), Funnel (multi), Angle (multi), "Has Drive link / Has Inspo link" (toggle)

State persists per tab under `mxv4.addPickerFilters.tracker` and `mxv4.addPickerFilters.inspo` so re-opening the picker keeps the last filter choice.

### Source-aware link rule (per user spec)
- Task created from a **Tracker parent** → on the new linked ad, write the **Google Drive link** into the linked card / detail panel (Drive is the canonical reference for production-side context).
- Task created from an **Inspiration** → write the **inspiration link** into the spawned ad as the source-of-truth (matches Feature 4 — per-task inspiration trace).

### Visual / interaction polish
- Drop the long gray instruction line; cards are self-evident.
- Sticky search input + sticky filter dropdown at top of the panel.
- Card height ~64px, lime hover lift, full-row click target — remove the separate "+ Link" button.
- Status dot uses `var(--win)` / `var(--testing)` / `var(--loser)` / `var(--t3)`.
- Date format: `Intl.DateTimeFormat` short style; year omitted when current year.
- Drive / Inspo chip uses `target="_blank" rel="noopener"`; clicking the chip does NOT trigger the row click (`event.stopPropagation()`).

### Resolved open questions
1. **Surface:** cell-level picker (`_mxv3RenderAddTracker` / `_mxv3RenderAddInspiration`). Global `openAddCreative()` modal is OUT of scope.
2. **Variations:** AD-013 only — variations are completely hidden, no "+2 variations" badge.
3. **Default tab:** **Tracker first** for new users (most common action). Re-open keeps the last-used tab — `mxv4.addPickerActiveTab` already persists today; just keep it.
4. **Date source:** `createdAt`.
5. **Link rule:** Tracker → Drive link on the new card · Inspiration → inspiration link on the new card. (Both still stored in their respective `driveLink` / `adLink` fields — no schema change.)

### Data — no schema change
All fields already present on `ADS[]` and `INSPIRATIONS[]`:
- ADS: `formatName`, `status`, `adType`, `funnelStage`, `angle`, `persona`, `parentAdId`, `taskType`, `trackerRefId`, `_fromInspoId`, `createdAt`, `driveLink`, `adLink`, `_clickupId`.
- INSPIRATIONS: `title`/`name`, `adLink`, `driveLink`, `adType`, `funnelStage`, `angle`, `notes`, `status`, `createdAt`.

Only addition is a derived predicate `_isParentFormat(ad)` — pure runtime helper, no DB.

### Out of scope
- Global top-bar `+ Add Creative` modal (`openAddCreative()`) — separate surface, not touched.
- No realtime / Supabase changes.
- No multi-select. Single click = single link, same as today.
- No changes to what `mxv3LinkFromTracker` / `mxv3SpawnFromInspiration` do downstream.

### Time estimate (~2.5h total)
- 30 min — `_isParentFormat` filter + status/date/drive helpers
- 45 min — card visual + sort + sticky search
- 40 min — always-visible filter dropdown component (reuse Matrix Status dropdown pattern)
- 20 min — Inspiration card layout (more fields than Tracker)
- 15 min — empty state + "Create new instead →" fallback link
- 10 min — tab default + persistence wiring
- 10 min — smoke test against Astro Rekha + Medical (once Bug 2 is unblocked) + KMH

### Edge cases
- Tracker parent with 0 cells linked anywhere (orphan) → still shows in the list, sorted by status tier.
- Inspiration with no `adLink` AND no `driveLink` → still selectable, just no link chip rendered.
- Inspiration with very long `notes` → ellipsis at ~80 chars; full text in `title` attribute (native tooltip).
- Filter dropdown with zero matches → empty state explains "No matches for current filter — clear filter or switch tab".
- Switching tab while a filter is active → filter is per-tab (keys above), so the other tab's state isn't affected.
- A parent format whose status was just changed (e.g. Untested → Winner) by another user via realtime → list re-sorts on next render; no stale cached row.

---

