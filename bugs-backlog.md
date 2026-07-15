# Immuvi Command Center — Bugs / Improvements Backlog

Tracked items the user has flagged. **Not** to be coded until explicitly approved.
Each entry is a planning note — design decisions, build approach, time estimate.

Status legend: 🆕 just-flagged · 📐 plan-locked · 🛠 in-progress · ✅ done

---

## Bug 1.1 — Cell data should respect active date filter (Scope vs Highlight)
**Status:** ✅ done — shipped 2026-05-01 (local only, no git push)
**Reported:** 2026-05-01
**Approved approach:** Ship **Scope mode as default**, with a toggle to **Highlight** for power users
**Surface:** Creative Matrix cells

### What shipped
- New `_mxv4.filterMode` state (`'scope'` default | `'highlight'`), persisted in localStorage as `mxv4.filterMode`, with `setMxv4FilterMode()` setter.
- New helpers: `_mxv4AdMatchesDateFilter(adWrapper)` (ad-level date predicate) and `_mxv4ScopeActive()` (true when scope is on AND a real date filter is active).
- `_mxv4AggregateAds(ads)` extracted from `_mxv4ClassifyCell` so we can compute counts/funnels/types/sources/dominant/stale twice (once filtered, once lifetime) without duplicating logic.
- `_mxv4ClassifyCell(angle, persona, options)` rebuilt:
  - When scope mode is on, returned `ads`, `total`, `counts`, `funnels`, `types`, `sources`, `dominant`, `lastCreatedAt`, `stale`, `hasApp` are filtered to the date window.
  - Always exposes a `lifetime` sub-object with the full lifetime view so consumers can show "X of N" hints without a second function call.
  - Pass `options.lifetime: true` to force-bypass scope mode.
- Filter-mode segmented toggle rendered in the filter row, **only when a date filter is active** (`Scope` / `Highlight`).
- Cell renderer:
  - When `state.scoped` and `lifetime.total > state.total`, count line shows `"7 creatives of 16"` with the lifetime hint in muted color.
  - 7d delta arrow hidden in scope mode (redundant with rebased count).
  - New "0 in window / N lifetime" empty state — dimmed cell shows `0 / N` plus a "in window · N lifetime" subtitle. Click still opens the modal so user can view lifetime ads.
- Hover card:
  - Shows `· of N lifetime` next to filtered count when scoped.
  - Shows a small "Showing in window only · click to view all" banner.
  - For empty-in-window-but-lifetime cells, renders a 🌙 "No activity in this window" section with the lifetime count.
- Strategy strip and angle-row coverage bar inherit the change automatically — they already call `_mxv4ClassifyCell()` which is now scope-aware.
- CSS: new `.mxv4-fmode-seg` segmented pill (matches the density toggle style) and `.mxv4-cell-lifehint` for the "of N" hint.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Toggle persists across reloads via localStorage.
- Cells with lifetime ads but 0 in window now render distinctly instead of looking identical to fresh empty cells.

### Files touched
- `/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html` (single-file app)
- No git push, no Vercel deploy — per user's local-only rule.

### What the user reported
> Cell shows "16 creatives" but I have a "This week" filter active. Only 7 of those creatives match. Should the cell show 7 (filtered) or 16 (lifetime)? The displayed winner name "12346" — is it a lifetime winner or a winner from this week? Confusing.

### Root cause
The matrix has two valid mental models for what a date filter means:
1. **Highlight** (current behavior) — filter dims non-matching cells; matching cells still show lifetime data.
2. **Scope** — filter rebases all numbers/chips/winners inside cells to the filter window; "16 creatives" becomes "7 creatives this week."

The app currently does Highlight. User expects Scope (industry standard — Stripe, Notion, Linear).

### ✅ Approved fix: Scope as default + toggle for Highlight

When a date filter is active, every cell renders against the filtered subset:
- **Count**: "7 creatives" with subtle "(of 16)" hint
- **Status chips**: rebased counts for filtered ads only
- **Status bar**: rebased proportions
- **Top winner inline**: only winners whose `lastStatusChangeAt` falls inside the window
- **Stamp** (Winner / Testing / etc): reflects filtered subset's dominant status
- **Funnel counts**: rebased
- **Recency / "Last X ago"**: last activity within the window
- **Action prompt**: recomputes against filtered subset
- **Empty-in-window cells with lifetime activity**: dim + show "0 this week / 16 lifetime"
- **Coverage bar (angle row)**: % of personas with **activity in window**, not lifetime
- **Strategy strip tiles** ("Where's the money", "Test next", etc.): rebase to filter window

Add a small toggle in the filter row:
`Filter mode: [ Scope ▾ ] (default) | [ Highlight ]` — persists in localStorage.

### Implementation outline
- Extend `_mxv4ClassifyCell(angle, persona, dateFilter)` to accept an optional date filter and pre-filter `state.ads` before counting/categorizing
- All cell render paths read from the filtered classification when filter active
- Hover card surfaces both views: "7 in window · 16 lifetime"
- Strategy strip tiles read filtered context
- New `_mxv4.filterMode` state ('scope' | 'highlight'), default 'scope', persisted

### Time estimate
~3 hours (refactor focused on `_mxv4ClassifyCell` + cell renderer)

### Edge cases to handle
- Cell has lifetime winners but no winner in window → stamp shifts away from "Winner" but show subtle "★ lifetime" badge
- Cell has zero ads in window AND zero lifetime → render normal empty-cell state
- Custom date range with `from > to` (user error) → show empty state with "invalid range" hint
- Filter mode toggle should NOT clear other filters — orthogonal concern

---

## Bug 1.2 — Custom same-day date range excludes everything (`dateTo` set to midnight)
**Status:** ✅ done — shipped 2026-05-01 (local only, no git push)
**Reported:** 2026-05-01
**Surface:** Creative Matrix → top filter row → custom date range picker

### What the user reported
> Created a new task today, set date filter to "Created date = today" (custom range 1 May → 1 May), task does not appear. Old tasks still show. Refresh doesn't help.

### Root cause
`_dpClickDate()` (immuvi-command-center.html:16972) stores `_dp.end = ms` directly from the calendar grid. The grid cells are built with `_dpStartOfDay(d.getTime())` (line 16868), so `ms` is **midnight 00:00:00** of the chosen day.

`_dpApply()` (line 17036) then writes that midnight value straight into `_mxv4.dateTo` without normalizing to end-of-day.

For a same-day pick (`1 May → 1 May`):
- `dateFrom` = May 1, 00:00:00.000
- `dateTo` = May 1, 00:00:00.000

Filter check in `_mxv4AdMatchesDateFilter()` (line 16744):
```js
if (rng.to && ts > rng.to) return false;
```
Any task with a timestamp later than midnight on May 1 (i.e. **every** task created during the day) gets filtered out. The window is effectively zero-width.

Note: `_dpPickPreset()` (line 17006) already does the right thing — `_dp.end = _dpEndOfDay(p.to)`. Only manual calendar clicks are broken.

### Approved fix (one-liner)
In `_dpApply()` at line 17038–17039, normalize the end of the range to end-of-day:
```js
_mxv4.dateFrom = _dpStartOfDay(_dp.start);
_mxv4.dateTo   = _dpEndOfDay(_dp.end);
```
Also persist these normalized values to localStorage so a reload doesn't reintroduce the bug.

### Time estimate
~5 min — single function, no ripple.

### Edge cases
- Range where start === end → must still cover the full day (this is the failing case).
- Reverse-order picks already get swapped in `_dpClickDate()`, so normalization happens after the swap — safe.
- Existing localStorage values written with the old (midnight) `dateTo` will self-heal next time the user opens the picker and reapplies; optional one-time migration not needed.

---

## Bug 1.3 — Filter row UI redesign (date / scope-highlight / view density)
**Status:** ✅ done — shipped 2026-05-01 (local only, no git push) · awaiting answers to open questions
**Reported:** 2026-05-01
**Surface:** Creative Matrix → top filter row

### What the user reported
- The Scope/Highlight segmented toggle reads as a "black blob" — Scope label invisible, Highlight label too faded. Doesn't look like a toggle.
- "Custom range…" is awkward: dropdown option + separate pill, two controls for one job.
- Density (`≡ Detailed`) doesn't have a real view-mode affordance — wants an icon-led control.
- Filter row feels flat and unorganized — wants groupings + a more beautiful layout.

### Root cause (UI/CSS)
- `.mxv4-fmode-seg button.on` (line 4714) sets `background: var(--t1)` (near-black) with `color: var(--lime)` — at 10.5px uppercase the lime washes out and the pill reads as a solid black ball.
- `.mxv4-fmode-seg button` (off-state) uses `color: var(--t3)` — too faded to register as the other half of a toggle.
- Date filter is split across three controls: dateRange `<select>` + dateBasis sub-`<select>` + custom-range pill (line 17827, 17848, 17887). All three visible simultaneously in custom mode.
- Density is a native `<select>` styled like every other dropdown — no icon group.
- No visual grouping in the filter row — every control has the same weight.

### Approved redesign (pending Q&A)

**Layout:** three soft-bordered groups separated by hairline rules — `FILTER` (Source / Funnel / Type), `TIME` (date + basis + scope/highlight), `VIEW` (density + Stale + Show-all + Refresh). Tiny uppercase group labels above each.

**Date control:** collapse the three-control trio into one button `📅 Today · Created date ▾` opening a single popover:
- Preset list on the left, calendar on the right
- DateBasis segmented control at the bottom (Created / Status changed / Last edit)
- Scope/Highlight segmented toggle inside the popover footer with one-line caption per option
- Apply / Reset footer
- Eliminates "Custom range…" as a separate state — clicking the calendar auto-switches to Custom

**Scope/Highlight redesign:**
- Move into the date popover footer (not the main row).
- Active: light lime tint (`rgba(214, 255, 75, 0.18)`), ink text, lime border.
- Inactive: transparent bg, `var(--t2)` text.
- Both labels readable.
- Optional: tiny indicator pill in the row only when Highlight is on (so default scope mode = clean row).

**View density:** replace `<select>` with a 3-icon segmented control (`▭ ▦ ▤`), lime accent on active, tooltips on hover. Same component vocabulary as the popover toggles.

**Right cluster:** Stale / Show-all / Refresh become icon-only with tooltips, separated from main controls by a vertical hairline.

**Component baseline:** 32px height, 10px radius, hover lifts border to ink + 4px soft shadow, active = lime-tint bg + ink text + lime border, 14px icons 6px from text.

### Open questions (need answers before coding)
1. Calendar in the popover — always visible, or only when Custom is selected?
2. Scope/Highlight — only inside popover, or also surface a tiny indicator pill in the row when Highlight is on?
3. Group labels (FILTER / TIME / VIEW) — keep, or rely on hairline separators only?
4. Icons — keep emoji (fast) or switch to inline SVG / Lucide for premium feel (~20 min extra)?

### Time estimate
- Decision Q&A: 5 min
- Date popover unification (preset + calendar + basis + scope toggle in one component): ~90 min
- Scope/Highlight visual fix + relocation: ~20 min
- Density icon segmented control: ~25 min
- Group dividers + labels + spacing pass: ~30 min
- Icon swap (if SVG chosen): +20 min
- **Total:** ~3 hours

### Edge cases
- Date popover should remember last basis + scope choice across opens (localStorage already writes these — just keep using the existing keys).
- "Apply" disabled when invalid range (start > end after manual flips).
- Mobile / narrow viewport — groups should wrap as a stack, not collapse into a single squished row.
- Empty preset state ("All time") should hide the dateBasis + scope toggles inside the popover (they only matter when filtering).

---

## Bug 1.4 — Highlight mode blurs nearly all cells (regression from Bug 1.1)
**Status:** ✅ done — shipped 2026-05-01 (local only, no git push)
**Reported:** 2026-05-01
**Surface:** Creative Matrix → cell rendering when filterMode=highlight + a date filter or overlay tile is active

### What the user reported
> When I select HIGHLIGHT, all cells are blurred and unreadable. When I select SCOPE, all cells become visible. Previously this was working fine.

### Root cause (two compounding causes, both introduced in Bug 1.1)

**Cause A — date filter adds a second dim layer in Highlight mode:**
`_mxv4CellPassesFilters()` (line 17701–17718) walks `state.ads` and returns `false` if no ad's basis-timestamp falls inside the active date window. In SCOPE mode `state.ads` is pre-filtered (every ad is in-window by definition) so the check always passes and no cell gets dimmed by date. In HIGHLIGHT mode `state.ads` is the lifetime list, the check actually runs, and any cell without an in-window ad gets the `dim` class. Stacked with the existing overlay-tile dim (Where's the money / Replicate / Gaps / Kill from `_mxv4CellHighlightClass`), nearly every cell ends up dimmed.

**Cause B — dim CSS was tuned far too aggressive:**
`.mxv4-cell.dim { opacity: 0.18; filter: grayscale(0.85); }` (line 3632). Even a single dim layer wipes out the cell content. The mxv3 fallback (`opacity: 0.30; grayscale: 0.4` at line 3252) is the "previously was fine" baseline. Bug 1.1 tightened this to "unambiguous from across the room", which over-shot.

### Approved fix (Option A — most conservative)

1. **Soften the dim** — `.mxv4-cell.dim` → `opacity: 0.42; filter: grayscale(0.45);` (readable but de-emphasized). Hover bump can be `opacity: 0.75;`.
2. **Drop the date-filter check from `_mxv4CellPassesFilters`** (lines 17701–17718). Date filter then only drives:
   - Overlay tile counts (Where's the money / etc.)
   - Scope mode rebasing
   - The "0 in window / N lifetime" sleep card (Scope-only state, line 17964)
   The date filter no longer adds a second dim layer in Highlight mode.

Result: Highlight mode dims only via the overlay tile (one signal, readable cells). Scope mode rebases numbers and keeps the sleep card. Both modes finally feel distinct without making cells unreadable.

### Time estimate
~10 min. CSS one-liner + remove a 17-line block from `_mxv4CellPassesFilters`. No logic risk.

### Edge cases
- Cell with zero lifetime ads → still passes (line 17687 already handles this).
- Cell with an in-window ad AND failing other filters (funnel/type/source/stale) → still dims via those checks (kept).
- Hover-peek behavior on dimmed cells → keep `.mxv4-cell.dim:hover { opacity: 0.75; filter: grayscale(0.2); }`.

### Considered alternatives
- **B. Soften dim only.** Keep both dim paths but make the dim gentler. Less invasive but still double-dims and reads as noisy.
- **C. Add a "no overlay" off-state.** Only dim when the user explicitly picks an overlay. Bigger change, more discoverability work, deferred.

---

## Feature 2.1 — Sort angle rows in the Creative Matrix (with Manual drag-to-reorder)
**Status:** ✅ done — shipped 2026-05-01 (local only, no git push)
**Reported:** 2026-05-01
**Surface:** Creative Matrix → filter row → VIEW group → sort dropdown

### What shipped
- New `_mxv4.angleSort` state (default `'manual'`), persisted under `mxv4.angleSort`.
- New `_mxv4.angleManualOrder` array (per-product), persisted under `mxv4.angleManualOrder`.
- Sort dropdown in the VIEW group offers 10 modes: Manual order, Most worked on, Least worked on, Most recent activity, Oldest activity, Newest angle, Oldest angle, Status priority, Name A→Z, Name Z→A.
- New helpers `_mxv4BuildAngleStats()` and `_sortAnglesForMatrix()` — sort returns a *copy*, never mutates `ANGLES` (so Action Plan / coverage strip / strategy tiles keep insertion order, per spec).
- Drag-to-reorder when Manual is active: ⋮⋮ handle on each row's left edge, full HTML5 drag/drop with lime drop-indicator, persisted on drop.
- Angles map gets `createdAt: a.created_at` from Supabase (one-line addition); local `addAngle` and auto-discover paths backfill `createdAt: Date.now()`.
- Stable secondary tiebreaker — alphabetical by name — applied to all sort modes.

### Other consumers untouched (confirmed by code review)
- Action Plan, coverage strip, strategy tiles, dashboard KPIs, persona panel — all keep iterating the canonical `ANGLES` array in insertion order. Sort scope is strictly the Creative Matrix per Q&A.

### Files touched
- `/Users/gauravpataila/Documents/Claude/Clickup /immuvi-command-center.html` (single-file app)

### Verified
- JS parses cleanly via `new Function()` check.
- Server still serves HTTP 200 on http://localhost:8098/immuvi-command-center.html.

---

## Bug 2 — New product "Medical": synced ads disappear on refresh (schema mismatch on `ads.created_at` / `ads.updated_at`)
**Status:** 🆕 just-flagged · **Reported:** 2026-05-02
**Surface:** Any product, but visible on the freshly-added "Medical" product because it has no historical ad rows to mask the issue
**Severity:** High — every ad sync silently fails to persist for every product; only the first-ever ad insert per product (done before this regression) is saved, so older products keep their stale rows and look fine while new products end up empty after refresh.

### What the user reported
> Added a new product **Medical** + linked its ClickUp list. Pressing **Sync** loads tasks into the UI as expected. After a page refresh, all the synced data is gone.

### Root cause (verified live against Supabase, 2026-05-02)
`_adToRow()` at immuvi-command-center.html:7221–7222 writes the local epoch-ms timestamps straight into the DB:
```js
created_at: a.createdAt || null,   // e.g. 1777709269927
updated_at: a.updatedAt || null,   // e.g. 1777709352083
```

The migration `supabase/migrations/20260430000000_add_ad_timestamps.sql` (which would change these columns from `timestamp with time zone` → `bigint`) **has never been applied to the live Supabase project** — the file is still untracked in `git status`.

Live schema today:
- `ads.created_at` = `timestamp with time zone` (proof: Astro Rekha row returns `"2026-04-20T11:36:00.011002+00:00"`)
- `ads.updated_at` = `timestamp with time zone`
- `ads.last_status_change_at` = `bigint` (this column was migrated, returns `1777560119688` cleanly)

Postgres tries to coerce the integer `1777709269927` into `timestamptz` and rejects the entire `ads.upsert(...)` batch with:
```
code: "22008"
message: "date/time field value out of range: \"1777709269927\""
hint:    "Perhaps you need a different \"datestyle\" setting."
```

`saveProductData` uses `Promise.allSettled`, so the failed `ads` upsert is logged once as `[SB] saveProductData partial errors` and the other tables (`angles`, `personas`, `matrix_cells`, `manual_actions`) save successfully. The UI shows nothing wrong because in-memory ADS still have the data. On refresh, `loadProductData()` returns 0 ads → blank Medical.

### Live proof captured during diagnosis
For `prod-1777663097896` (Medical) right after Sync:
- `products` row: ✅ exists, `last_synced_count: 361`
- `angles`: 10 ✅
- `personas`: 6 ✅
- `matrix_cells`: 60 ✅
- `ads`: **0** ❌
- Manual single-row upsert reproduced the 22008 error exactly.

### Why other products *look* fine
Older products' `ads.created_at` rows were inserted before this regression and contain ISO timestamps. Re-syncs since then have been silently failing too — the existing rows just stay there. So this is a hidden "every ad save is failing for everyone" bug, but only freshly-added products surface it visibly.

### Two candidate fixes (decide before coding)
1. **Run the migration properly.** `20260430000000_add_ad_timestamps.sql` as written only backfills NULL `created_at` — applying it on the live DB would either fail (column is already populated as timestamptz) or wipe the type change. Needs amending to do an in-place type change with conversion: `ALTER COLUMN created_at TYPE bigint USING (EXTRACT(EPOCH FROM created_at) * 1000)::bigint;` (and same for `updated_at`). Then app code stays as-is.
2. **Convert in the app.** In `_adToRow` (line 7221–7222), send `a.createdAt ? new Date(a.createdAt).toISOString() : null` instead of the raw number. Cheap, 2-line patch, no schema change. Loses the "raw epoch ms, no lossy conversion" property the migration was designed to give, but unblocks Medical immediately and stops the silent failure for every other product too.

### Time estimate
- Option 1 (schema fix + safe migration rewrite + apply to prod): ~30 min including a backup snapshot.
- Option 2 (app-side ISO conversion): ~5 min, plus a one-line `_normalizeTs` audit on the read path (already handles ISO strings — should be safe).

### Edge cases
- Existing rows already have ISO strings in `created_at` — Option 1 must convert them, not blow them away. Option 2 is forward-compatible automatically (the column stays `timestamptz`).
- `last_status_change_at` is already `bigint` — neither fix touches it.
- Realtime subscribers in other tabs read via `_rowToAd` → `_normalizeTs`, which already handles both ISO strings and numeric strings, so no client-side fan-out work needed.
- The product's `last_synced_count` field will keep being right (it's set independently via `upsertProduct`), so don't trust that count as a "save worked" signal in future debugging.

---


## Bug 3 — Matrix cell "+ Add Creative" modal: page scrolls behind modal when checking rows
**Status:** 🆕 just-flagged
**Reported:** 2026-05-03
**Surface:** Creative Matrix → cell modal → "+ Add Creative" tab → "From Inspiration" / "Creative Tracker" sub-tabs

### Repro
1. Open a Matrix cell (e.g. Career & Life Success × Young Couples).
2. Switch to the **+ Add Creative** tab.
3. Pick **From Inspiration** (or Creative Tracker).
4. Scroll the table inside the modal to find a row further down.
5. Click a checkbox on a lower row.

**Expected:** modal scroll position stays put; only the checkbox toggles.
**Actual:** the underlying page (or the modal scroll container) jumps — table scroll position resets / the whole modal layout shifts upward.

### Notes
- Likely cause candidates to investigate when fixing:
  - Re-render of the inspo/tracker list on checkbox click resets the scroll container's `scrollTop` (no scroll-position preservation around `innerHTML =` rewrite).
  - `body` scroll not locked while modal is open, so focus shift / layout-thrash on re-render bubbles up to the page.
  - Checkbox handler triggers a parent re-render (`renderMatrix` / cell modal re-open) instead of a localized row update.
- Do **not** code yet — flagged for batched fix.

## Bug 5 — New tasks pushed from Matrix → Action Plan land in ClickUp with blank description and blank custom fields
**Status:** 🆕 just-flagged — plan drafted, awaiting answers to open questions before coding
**Reported:** 2026-05-03
**Surface:** Creative Matrix cell modal → "+ Add Creative" (From Inspiration / Creative Tracker / Blank Brief) with "Push to Action Plan now" → Action Plan → "+ ClickUp"

### Symptom (from screenshot — task `KM-264-INS-039` in `Kids Mental Health`)
- ClickUp task description is just `Manually pushed from matrix` + the hidden marker comment.
- All custom fields blank: Angle, Angle Tag, Approved Date, Creative Structure, Creative USP, Drive Link, Editor, Final Video ID, Funnel Type, Hook Type, Launch Date, Notes.
- Tags applied (`app-created`, `production`) — so the create call worked, the payload just had no description/CF data.

### Root cause (traced)
`createClickUpTaskFromAction` (immuvi-command-center.html:17077) builds custom fields in two passes:
- Pass 1 (line 17166): hardcoded 5-field allowlist via `buildFieldsPayload` → angle, persona, funnelStage, adType, adLink.
- Pass 2 (line 17180): every other ClickUp field, **gated on `sourceAd._customFieldsRaw`**.

Spawn paths build the AD with **typed top-level properties only**, never seeding `_customFieldsRaw`:
- `addInspoToCell` (line 29103)
- mxv4 modal "Add" — inspo branch (line 27973) and tracker-clone branch (line 28017)
- `executeMxv4Blank` (line 28084)

Result for any AD that hasn't round-tripped through ClickUp yet: `_customFieldsRaw === undefined` → Pass 2 skipped entirely → ClickUp task lands with everything except the 5 legacy fields blank.

Description fallback to `act.reason` ("Manually pushed from matrix") at line 17149 is the second symptom — it fires when `sourceAd` lookup fails. Lookup uses `act.sourceAdId || act.adId` then a `formatName === act.title` fallback (lines 17100-17112). Either the `_localNew` AD got replaced by a realtime echo before push, or `sourceAdId` was rekeyed by sync — both are reproducible timing edges.

### Plan
1. **Seed `_customFieldsRaw` at spawn time** in all three paths (`addInspoToCell`, mxv4 inspo branch, mxv4 tracker-clone branch, `executeMxv4Blank`). Build lcName-keyed entries from typed fields, using `CLICKUP_FIELD_META` to determine each field's expected value shape:
   - `hook type` ← `hookType`
   - `creative structure` ← `creativeStructure`
   - `production style` ← `productionStyle`
   - `creative usp` ← `creativeUSP`
   - `creative hypothesis` ← `creativeHypothesis`
   - `drive link` ← `driveLink` (only when non-empty)
   - `notes` ← `notes`
   - drop_down values stored in whatever shape Pass 2 already expects (orderindex vs option id — to be verified by inspecting an AD that already round-tripped)
   - For the tracker-clone path: copy `parent._customFieldsRaw` first, then overlay clone's own fields — recovers Editor/Reviewer/extras the parent already has.

2. **Harden source-AD lookup in `createClickUpTaskFromAction`** to mirror `recreateClickUpTask`'s 3-strategy pattern (line 16921-16937): by `sourceAdId/adId` → by `_clickupId` → by `formatName === act.title`. Add a 4th fallback: scan `CELL_CREATIVE_ASSIGNMENTS[angle||persona]` for an AD whose formatName matches `act.title`. Kills the "blank description" symptom from realtime-echo timing.

3. **Defensive log** when Pass 2 produces an empty payload AND `sourceAd` has typed fields — surface a one-time toast so future ClickUp field-ID drift becomes visible instead of silently writing blank tasks.

### Verification (post-code)
- Inspo into fresh cell → Push to AP → "+ ClickUp" → open task → description shows full Creative Brief table AND Hook Type / Creative Structure / Production Style / Drive Link / Notes / etc. are populated.
- Same with tracker-clone path (Editor inherited from parent).
- `executeMxv4Blank` path — typed fields populate where present.

### Risks
- Drop_down value shape (orderindex vs option id) — must inspect a reconciled AD before coding so the create payload doesn't 400.
- `CLICKUP_FIELD_META` may not be loaded yet on a brand-new product (loads after first sync) — Pass 2 still no-ops in that case, same as today.

### Locked decisions (answered by user 2026-05-03)
1. **Editor / assignees:** at ClickUp push time, if the Action Plan card / matched sourceAd already has assignee + reviewer set, copy those onto the new ClickUp task. If empty, leave empty. NO inheritance from inspo/parent at spawn time — only at push time, and only if real values exist on the action.
2. **Drive Link CF on tracker clones:** stays empty at create time. Parent's drive link still appears in description as "Inspiration Drive". Editor fills the CF after rendering.
3. **Notes inheritance:** inherit verbatim — copy `insp.notes` / `parent.notes` into the new ClickUp task's Notes CF.
4. **Angle Tag CF:** populate as plain text = `act.angle` (the angle name). The ClickUp API does not reliably accept the dropdown variant of this field on this workspace, so the existing CF is the text version — write the angle name as a string.
5. **Initial ClickUp status:** if `act.liveStatus` is set (matrix status at push time), use it via `_cuStatusMap`. If empty/unset, fall back to `untested` (NOT `to do`).
6. **Defensive log:** `console.warn` only when Pass 2 produces an empty payload but typed fields exist on `sourceAd`. No toast, no UI noise.
7. **Approved Date / Launch Date / Final Video ID:** stay blank on create — not part of the seed map.

### Implementation impact of the locked decisions
- Drop the "copy assignees from parent at spawn time" idea entirely. Assignee inheritance happens **inside `createClickUpTaskFromAction`**, reading from `act.assignees` / `sourceAd.assignees` only.
- Seed map for `_customFieldsRaw` becomes: `hook type`, `creative structure`, `production style`, `creative usp`, `creative hypothesis`, `notes`, `angle tag` (text = angle). Drive Link, Approved Date, Launch Date, Final Video ID intentionally absent.
- Status logic: replace the current `if (_initCuStatus) createPayload.status = _initCuStatus;` with `createPayload.status = _initCuStatus || 'untested';` so empty liveStatus lands as untested.

## Bug 6 — Spawning the same inspo into a different cell shows the existing task instead of creating a new one (serial-id collision)
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03
**Surface:** Creative Matrix → cell modal → "+ Add Creative" → "From Inspiration" tab → check inspo already used in another angle/same persona

### Symptom
User selects an inspiration that's already been used in a different angle but the same persona, expecting a fresh task in the new cell. Instead the cell renders the EXISTING task (its old `formatName`, old `createdAt`, old Editor/Reviewer/Approved Date, old `_clickupId`). It looks like the existing ClickUp task got "linked" to the new cell — but in fact a new AD WAS spawned, it just collided on `id` with the existing one and got shadowed during render lookups.

### Root cause
`nextAdSerial = (ADS.length || 0) + 1` in 3 places (boot, switchProduct from cache, switchProduct from Supabase). Whenever any AD has been deleted (tombstoned, removed from ClickUp, etc) `ADS.length` is smaller than the highest existing serial. `nextSerialId()` then returns an id like `AD-097` that already exists in `ADS`. Two ADs now share `id: 'AD-097'`. Every render path uses `ADS.find(a => a.id === X)` which always returns the FIRST match → the older AD wins → the new spawn is invisible. From the user's POV it looks like the existing task got linked into a new cell.

### Fix
- New helper `_computeNextAdSerial()` scans every `ADS[i].id` and `ADS[i].formatName`, extracts the numeric serial via `^[A-Za-z]+-(\d+)`, returns `max + 1`. Numeric ClickUp ids (no leading letters) are correctly skipped — they aren't serial-derived. Tombstoned ids that were already replayed back from Supabase are still in ADS so they're covered.
- Replaced all 3 length-based assignments with `nextAdSerial = _computeNextAdSerial()`.
- Empty-product branch (`nextAdSerial = 1`) left untouched — correct for a brand-new product.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview check: helper executed against a synthetic fixture containing `AD-097` and `KM-264-INS-039` returned 265; the buggy formula would have returned 5. Real ADS returns 95 (matches highest serial in the live dataset).

## Bug 7 — 3-way live sync: edits in tab A don't appear in tab B (or appear as "1 ClickUp task" orphan)
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03
**Surface:** Multi-tab usage of the matrix and Action Plan; ClickUp ↔ app sync

### Symptom
User opened the app in two tabs. Spawned a creative in tab A's matrix cell — visible in tab A. Tab B (even after refresh) either showed nothing or rendered "1 ClickUp task" orphan in the cell. Same problem for Action Plan pushes. ClickUp-side edits also took up to 30s to fan back into the app.

### Root cause (3 layers)
1. **No `ad-added` realtime event.** Spawn paths only called the debounced `saveState()` (300ms). A peer's reconciliation depended on `sync-needed` post-flush + `loadProductData()` roundtrip — so for a brief window, tab B's `matrix_cells` row referenced an AD id that wasn't in tab B's local `ADS` array → render path showed "1 ClickUp task" orphan instead of the new creative.
2. **`sync-needed` receiver dropped events when the tab was busy saving.** `if (_saveScheduled || _saveInFlight) return;` at two points meant a tab actively saving its own edits silently ignored peer broadcasts. The peer's update would never reconcile until the user manually refreshed.
3. **ClickUp poll fixed at 30s regardless of tab visibility.** Foreground tabs got the same 30s cadence as background tabs — slow fan-in for active users, wasted quota on dormant tabs.

### Fix
1. **New realtime events** (`_initRealtimeChannel`):
   - `ad-added` — payload includes the full AD object + cellKey. Receiver folds the AD into `ADS`, pushes its id into `CELL_CREATIVE_ASSIGNMENTS[cellKey]`, ensures `ANGLE_PERSONAS[angle]` includes the persona, then re-renders matrix / creatives / action plan / tab counts. Echo-guarded by `clientId === _myClientId`.
   - `cell-assignment-changed` — authoritative replace of a cell's `creative_assignments` array for non-spawn moves (move between cells, remove from cell). Echo-guarded.
2. **Helpers** `_broadcastAdAdded(ad, cellKey)` and `_broadcastCellAssignment(cellKey, newAssignments)` — fire-and-forget broadcasts, mirror the existing `apBroadcastActionAdded` pattern.
3. **`saveStateNow()`** — no-debounce immediate flush. Cancels any pending debounced save and queues an immediate `_flushStateToSupabase` write. Used at every spawn path so local→DB latency drops from 300ms+ to "next tick + network roundtrip."
4. **Spawn paths now call `saveStateNow()` + broadcast** instead of `saveState()` alone:
   - `addInspoToCell` — also wires `CELL_CREATIVE_ASSIGNMENTS[cellKey]` directly so the broadcast carries a coherent snapshot (was previously left to `buildCreativeUsageIndex`'s auto-populate step, opening a tiny race window).
   - mxv4 modal "Add" inspo branch + tracker-clone branch.
   - `executeMxv4Blank`.
   - `createActionFromMatrix` (action push — already had its own `apBroadcastActionAdded`, now also force-flushes the DB write).
5. **`sync-needed` receiver no longer drops events when busy.** Renamed the inline timer callback to `_runMerge`, replaced the early-return guards with bounded retry (3 attempts × 600ms) so a peer's reconciliation always lands eventually; initial delay is dynamic (150ms idle / 800ms when a local save is in flight) so we don't stomp on our own pending writes.
6. **Visibility-aware ClickUp polling** in `startAutoSync()`:
   - Foreground: 10s interval (was 30s) → ClickUp-side changes fan in within ~10s.
   - Background: 60s (was 30s) → reduces wasted quota on dormant tabs.
   - Re-schedules on `visibilitychange`. Fires an immediate `pollFullSync()` on `visibilitychange → visible` and on `window.focus` so switching back to the tab refreshes within ~1s.
   - Listener wired only once (`window._immuviVisListenerWired` guard).

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview check after reload: `_broadcastAdAdded` / `_broadcastCellAssignment` / `saveStateNow` exist; spawn paths reference `_broadcastAdAdded`; `sync-needed` receiver uses bounded retry (`_retriesLeft`); visibility listener wired in `startAutoSync`.
- Receiver-logic synthetic test: a fake `ad-added` payload from a peer correctly folded the new AD into `ADS` (87 → 88) and pushed its id into `CELL_CREATIVE_ASSIGNMENTS['Career & Life Success||Young Couples']` (0 → 1). Test entry cleaned afterwards.
- No console errors after reload.

### Behavioral change for the user
- Spawning a creative in tab A → visible in tab B in <500ms (broadcast fan-out + immediate DB write), no refresh needed.
- Pushing a task to Action Plan in tab A → visible in tab B's Action Plan in <500ms (existing `action-added` broadcast + immediate DB write).
- ClickUp-side edits → reflected in the foreground tab within ~10s; instant on tab focus.
- Two tabs both saving simultaneously → no longer silently drop each other's updates.

## Bug 8 — Sticky push-checkbox · "Moved to Action Plan" button label · cell empties after refresh
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03
**Surface:** Creative Matrix → "+ Add Creative" modal · cell row → Action Plan button · refresh persistence

### Symptoms
1. **Push-to-Action-Plan checkbox**: defaulted to ON on every modal open, regardless of user's last choice. Spawns landed in Action Plan even when the user didn't intend to push.
2. **Button label**: cell row showed "→ Action Plan" before push and "✓ In Action Plan" after — wording was "In", not "Moved to". User wanted clearer "Moved to Action Plan" copy.
3. **Cell empties on refresh**: after spawning an inspo into a cell (and pushing to Action Plan), refreshing the browser left the matrix cell empty. Action Plan still had the row but with Origin = Manual + Hook = blank.

### Root cause for #3
ClickUp poll's merge code re-keys an AD's id from local `AD-NNN` to its ClickUp task id in some flows (notably `parsed.id = _existingFallback.id` runs only when `_clickupId` was already set on the local AD; other flows can leave `parsed.id` as the ClickUp id). When the AD's id changes, the cell-assignment array (`CELL_CREATIVE_ASSIGNMENTS[cellKey]`) and the per-ad meta keys (`MATRIX_CELL_META["{adId}||angle||persona"]`) and `MANUAL_ACTIONS.sourceAdId` are NOT updated to follow. After a refresh, `loadProductData` returns the AD under its new id, but the cell array still references the old id → render lookup `ADS.find(a => a.id === oldId)` returns undefined → cell renders empty. Same id-mismatch caused Action Plan's `apResolveCard` to fall back to `kind: 'manual'` since `act.sourceAdId → AD.id` resolution failed.

### Fix
1. **Sticky checkbox preference** (`addPushAction`):
   - Initial value reads from `localStorage.getItem('mxv4_addPushAction_pref')` (defaults to `true` on first visit).
   - `toggleMxv4AddPushAction()` writes the new value to `localStorage` on every toggle so it sticks across reloads + tabs.
2. **Button copy** changed in two places:
   - `createActionFromMatrix` — DOM swap after push now emits `"✓ Moved to Action Plan · {status} · Open ↗"`.
   - Cell renderer's `mx-dt-action-sent` badge now reads `"✓ Moved to Action Plan — {status}"`.
3. **`_reconcileCellAssignments()` helper** that heals orphan cell-assignment ids:
   - Builds O(1) lookups: `byId`, `byCu` (covers both `_clickupId` and `clickupTaskId`), `byFmt`.
   - Walks every cell. For each id: if it matches an AD by id, keep. Otherwise try ClickUp-id match, then formatName match, and rewrite the cell entry to that AD's current id. True orphans (no resolution path) are left as-is so a future ClickUp sync can heal them.
   - Same remap is applied to `MATRIX_CELL_META` keys and to `MANUAL_ACTIONS.sourceAdId / .adId` so Action Plan rows keep their AD link too.
   - Returns the number of remappings made; logs them via `console.log`.
4. **Wired into 3 lifecycle points** so healing always runs:
   - End of `importTasksFromClickUp` — right after `ADS = newAds`. Catches mid-session re-keys.
   - `loadState()` (initial boot from Supabase) — covers state saved with stale ids before the fix landed.
   - Both branches of `switchProduct` (cached + fresh load).

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload:
  - `_mxv4.addPushAction` first-load value `true`; after `toggleMxv4AddPushAction()` → `false`, localStorage `mxv4_addPushAction_pref="false"`; toggled again → `true`, localStorage `"true"`. Sticky pref works.
  - `createActionFromMatrix` source contains `"Moved to Action Plan"`.
  - Synthetic reconcile test: AD with `id="AD-OLD-…"` + `_clickupId="CU-…"`; cell stored `CU-…` (orphan); after `_reconcileCellAssignments()`: cell array now contains `AD-OLD-…`, `MATRIX_CELL_META` key remapped to new id, old key removed, `MANUAL_ACTIONS.sourceAdId` remapped, return value `1`. All four assertions green.
- No console errors.

### Behavioral change for the user
- The "Push to Action Plan now" checkbox now opens the modal in the user's last-chosen state — toggle off once, it stays off.
- After moving a creative to Action Plan, the cell row reads "✓ Moved to Action Plan — {status}" instead of "→ Action Plan".
- Refreshing the page no longer empties matrix cells when an AD's id has been re-keyed by ClickUp sync. The reconciler heals the cell on every load + every sync.

## Bug 9 — `importTasksFromClickUp` silently drops local ADs whose ClickUp task isn't in the current fetch
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03
**Surface:** Creative Matrix → spawn an inspo into a cell → after refresh the cell is empty (even when the user did NOT push to Action Plan)

### Symptom
Spawn a creative into a Matrix cell. The cell shows the new task immediately. Refresh the browser → the task is gone from the cell. This happened even when the user explicitly did NOT click "Push to Action Plan" (so no MANUAL_ACTION row was created — just a local AD).

### Root cause
`importTasksFromClickUp` (immuvi-command-center.html:18814) had a final loop that was supposed to "silently keep" local-only ADs across a poll cycle:
```js
for (var i = 0; i < ADS.length; i++) {
  var localAd = ADS[i];
  if (!localAd._clickupId) {
    newAds.push(localAd);
  }
  // ADS with a _clickupId that wasn't in the fetched set: silently keep to avoid
  // accidental data loss
}
```
The comment said "silently keep" but the code only kept ADs **without** a `_clickupId`. ADs with a `_clickupId` whose task was missing from the current ClickUp fetch (paging, list-filter mismatch, freshly-created task not yet indexed, network blip, archived task) silently fell off `newAds`. After `ADS = newAds`, the AD was gone from memory; the next `saveStateNow()` then wrote the empty state back to Supabase. After refresh the cell rendered empty because both `ADS` AND `CELL_CREATIVE_ASSIGNMENTS` had lost the linkage.

### Fix
Added an `else if (!fetchedClickupIds[localAd._clickupId])` branch that pushes any local AD with a `_clickupId` that didn't come back in this fetch onto `newAds`. The AD survives the poll. Comment now matches behavior. Also seeds `seenAngles` / `seenPersonas` from the preserved AD so taxonomy auto-discover doesn't lose its angle/persona.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload: synthetic test pushed two local ADs (one with `_clickupId`, one without), called `importTasksFromClickUp([])` (empty fetch — worst case). Before the fix the `_clickupId` AD got dropped (`withCuKept: false`); after the fix both survive (`noCuKept: true`, `withCuKept: true`).
- No console errors.

### Behavioral change
Refreshing the page no longer empties matrix cells when a freshly-spawned AD's `_clickupId` wasn't in the most recent ClickUp fetch. Combined with Bug 8's `_reconcileCellAssignments`, the matrix now survives any combination of id-rekey, fetch paging, and reload timing without losing the user's spawn.

## Bug 9 (continued) — `created_at` NOT NULL silently dropped every fresh inspo spawn from `ads` table
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03 (recurrence after Bug 9 v1)
**Surface:** Creative Matrix → "+ Add Creative" → "From Inspiration" → check inspo → cell renders "1 ClickUp task" orphan after refresh

### The actual root cause (different from Bug 9 v1)
Bug 9 v1 fixed the `importTasksFromClickUp` drop-loop bug, but the user kept seeing the orphan. Investigation found the AD row was NEVER reaching the `ads` table at all. The cell-assignment row WAS landing in `matrix_cells`, leaving the cell pointing at a non-existent AD.

Smoking gun via direct synthetic test in preview: `_writeAdRowDirect({...no createdAt...})` returned the Postgres error:
```
null value in column "created_at" of relation "ads" violates not-null constraint
```
`addInspoToCell` (immuvi-command-center.html:29688) never set `createdAt` on the new AD. `_adToRow` then produced `created_at: _msToIso(undefined)` → `null` → upsert rejected by Postgres → the entire row failed silently while `matrix_cells.upsert` (in the same `Promise.all`) succeeded. Result: cell row exists, AD row missing → render shows "1 ClickUp task" orphan after every refresh.

### Fix (two layers, defense in depth)
1. **`_adToRow` backstop** — `created_at` and `updated_at` now fall back to "now" if the AD object lacks both:
   ```js
   created_at: _msToIso(a.createdAt) || _msToIso(a.updatedAt) || _msToIso(Date.now()),
   updated_at: _msToIso(a.updatedAt) || _msToIso(a.createdAt) || _msToIso(Date.now()),
   ```
   Belt: any spawn site that forgets to stamp `createdAt` still produces a valid row.
2. **`addInspoToCell`** — stamp `createdAt: Date.now()` and `_localNew: true` on the new AD object directly. Braces: matches the convention already used by `executeMxv4Add` and `executeMxv4Blank`, so the in-memory AD object also has the timestamp for filters/sort.

### Also wired in this turn (originally Bug 9 v1, now together with the createdAt fix)
- New helpers `_writeAdRowDirect(ad)` and `_writeMatrixCellDirect(cellKey)` — single-row upserts that bypass the bulk snapshot save. Used at every spawn site as a belt-and-braces guarantee that the AD + cell land in the DB regardless of any concurrent merge race.
- All four spawn paths (`addInspoToCell`, `executeMxv4Add` inspo branch, `executeMxv4Add` tracker-clone branch, `executeMxv4Blank`) now call `_writeAdRowDirect` + `_writeMatrixCellDirect` BEFORE the snapshot `saveStateNow` and the `_broadcastAdAdded`.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload: `_writeAdRowDirect({...no createdAt...})` returns `{ ok: true }` (was returning a NOT NULL error before the backstop). Test row cleaned afterwards via `SB.from('ads').delete()`.
- All four spawn sites now reference `_writeAdRowDirect`.
- No console errors.

### One-time cleanup applied
Found one orphan cell-assignment in production — `matrix_cells` row `650936e3-04a8-4180-9bb8-30df955822a3` (Career & Life Success × Young Couples in astro-rekha) had `creative_assignments: ["AD-12633"]` but no matching AD row anywhere. Cleaned via direct PATCH to `creative_assignments: []` and emptied `meta.per_ad`.

### Behavioral change for the user
- Spawning a creative into a Matrix cell now actually persists the AD to the database. Refreshing the page keeps the task in the cell.
- Backstop in `_adToRow` means future spawn paths can't accidentally lose data to the same NOT NULL constraint.

## Bug 10 — Status reverts within 10s of editing · Editor/Reviewer not flowing to ClickUp · poll cadence too aggressive
**Status:** ✅ done — shipped 2026-05-03 (local only)
**Reported:** 2026-05-03
**Surface:** Creative Matrix → status dropdown · ClickUp task creation · ClickUp poll cadence

### Symptoms
1. Change a creative's status to "Ready to Launch" in the Matrix → within 10s the status reverts to "Untested" (or whatever ClickUp's stale value is).
2. Editor / Reviewer chosen via the matrix-modal user-pickers don't appear on the new ClickUp task after push.
3. 10s foreground poll cadence felt too aggressive — wider safety window for local edits desired.

### Root causes
1. **Status revert** — `importTasksFromClickUp` (line 18839 pre-fix) called `_stampAdStatusChange(existing, parsed.status)` unconditionally. The 10s ClickUp poll fired before the user's just-pushed status reached ClickUp, so the poll read the OLD status and overwrote the user's local "Ready to Launch" back to "Untested". A guard window already existed for `MANUAL_ACTIONS.liveStatus` (15s, line ~18836) but the AD status path had none.
2. **Editor/Reviewer not flowing** — `createClickUpTaskFromAction` only mapped to `createPayload.assignees` from `sourceAd.assignees`. But the matrix-modal user-picker writes to `sourceAd._customFieldsRaw['editor']` (the synthetic assignees mirror, line 18874). For freshly-spawned ADs that the user assigned via the cell modal, `sourceAd.assignees` was undefined → no assignees flowed → ClickUp task landed with empty Editor.
3. **Poll cadence** — Bug 7 set foreground polling to 10s. User asked for 30s.

### Fix
1. **Recency guard for AD status** in `importTasksFromClickUp`:
   ```js
   var _localChangedAt = existing.lastStatusChangeAt || 0;
   var _withinLocalWindow = (_localChangedAt && (Date.now() - _localChangedAt) < 45000);
   if (parsed.status && !_withinLocalWindow) {
     _stampAdStatusChange(existing, parsed.status);
   }
   ```
   45s window covers two full 30s poll cycles plus network latency, so the local change always wins until ClickUp actually catches up.
2. **Editor source widening** in `createClickUpTaskFromAction`:
   - Read `_assigneeIds` from `sourceAd.assignees` first, fall back to `sourceAd._customFieldsRaw['editor']` second. So picks made in either UI flow into the new ClickUp task. Reviewer was already covered by Pass 2's loop over `_customFieldsRaw` (it's a real custom field, not native).
3. **Direct ClickUp push** from `changeAdStatusFromMatrix`:
   - When status changes in the matrix, fire `_syncToClickUp(ad._clickupId, { status: cuStatus }, 'matrix status → …')` immediately. ClickUp side reflects the new value within seconds, so the next poll's data IS the new value (not stale) — combined with the 45s recency guard, status reverts can't happen.
4. **Poll cadence** in `startAutoSync`:
   - Foreground 30s (was 10s). Background 60s unchanged.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload:
  - `startAutoSync` source contains `30000`, no `10000`.
  - `importTasksFromClickUp` source contains `_withinLocalWindow` guard.
  - `createClickUpTaskFromAction` source contains `_customFieldsRaw['editor']` fallback.
  - `changeAdStatusFromMatrix` source calls `_syncToClickUp`.
  - 45s window arithmetic verified with synthetic timestamp = `Date.now()` → `withinWindow === true`.
- No console errors.

### Behavioral change for the user
- Status changes in the matrix immediately push to ClickUp AND survive at least 45s of polling — no more revert to the previous status.
- Editor/Reviewer picked in the cell modal flow into the ClickUp task on push, regardless of whether they were stored on `assignees` or in the `_customFieldsRaw` mirror.
- Foreground polling drops from 10s to 30s, giving local edits a wider safety window.

### Bug 10 (cont) — Action Plan status push used wrong ClickUp status name
**Reported:** 2026-05-03 (recurrence after Bug 10 v1)
**Symptom:** "Status change works from Creative Matrix but not from Action Plan." User confirmed matrix path worked (after Bug 10 wired direct `_syncToClickUp`), but Action Plan status changes still didn't reach ClickUp.
**Root cause:** `updateManualActionStatus` (line 15431) had `'Untested' → 'to do'` in its `cuStatusMap`. This workspace's actual ClickUp status name is `'untested'` — ClickUp silently rejects PUTs with unknown status names, so the entire push was a no-op. The matrix path used `'untested'` (correct) so it worked.
**Fix:** Changed the AP map's `'Untested'` entry to `'untested'`, matching the matrix path and the `_cuStatusMap` in `createClickUpTaskFromAction`. All three status maps now agree.
**Verified:** Live preview — `updateManualActionStatus` source no longer contains `'to do'` and now contains `'Untested': 'untested'`.

### Bug 10 (cont 2) — Matrix / Action Plan / Tracker / ClickUp = same task, every edit must propagate everywhere instantly
**Reported:** 2026-05-03
**Symptom:** Status change in Matrix didn't reflect in Action Plan card immediately (only after the next 30s poll). User asked for the same instant-everywhere behavior to apply to ALL fields, not just status.
**Root causes:**
1. `changeAdStatusFromMatrix` updated the AD + cell meta, but didn't touch `MANUAL_ACTIONS[i].liveStatus` for the linked action — so Action Plan card kept showing the stale liveStatus until the poll.
2. `saveAdFieldUnified` (the central edit path used by every field — name, due, custom fields, status) updated state + pushed to ClickUp + broadcast to peers + persisted to Supabase, but **didn't trigger a local re-render of any surface**. So the SAME tab's Matrix / Action Plan / Tracker / Production panels showed stale state until the user navigated away and back.
**Fix:**
1. **`changeAdStatusFromMatrix`** now walks `MANUAL_ACTIONS`, finds the linked action by `sourceAdId / adId / shared _clickupId`, sets `liveStatus = newStatus` and stamps `_liveStatusChangedAt = Date.now()` (mirrors AP-side guard so a stale poll can't revert). Also stamps `MATRIX_CELL_META[adId||angle||persona].actionStatus = newStatus` and calls `renderActionPlan()` after the matrix re-render.
2. **`saveAdFieldUnified`** now ALWAYS calls `renderMatrix() / renderActionPlan() / renderCreatives() / renderProduction() / renderMxv4Modal() / updateTabCounts()` after every save. Each call wrapped in try/catch so a missing renderer never breaks the save.
**Verified (live preview):**
- `changeAdStatusFromMatrix` source contains `_ma.liveStatus = newStatus`.
- `saveAdFieldUnified` source contains all six render calls.
- No console errors.

**Behavioral change for the user:**
- Changing status (or any other field) in Matrix instantly updates the Action Plan row, the Tracker row, the Production kanban card, and the cell modal — same browser tab, same instant. The ClickUp push fires in parallel, the realtime broadcast covers other browsers.

### Bug 10 (cont 3) — Realtime receiver only re-rendered Matrix/AP/Modal on `status` changes; other fields and other surfaces were skipped
**Reported:** 2026-05-03
**Symptom:** "If someone else is using the app, my changes should be visible to them instantly." Status broadcasts already worked but other fields didn't refresh peer surfaces, and the Tracker / Production panels never refreshed cross-tab on any field.
**Fix in `_initRealtimeChannel` `field-update` handler:**
1. **Status events** now also update the linked `MANUAL_ACTIONS[i].liveStatus` (with `_liveStatusChangedAt` stamp for the recency guard) and `MATRIX_CELL_META[adId||angle||persona].actionStatus` — mirrors what `changeAdStatusFromMatrix` does locally, so peers' Action Plan rows and matrix cell badges follow.
2. **Universal re-render** — every field-update broadcast now triggers `renderMatrix() / renderActionPlan() / renderCreatives() / renderProduction() / renderMxv4Modal() / updateTabCounts()`, not just status. Each call wrapped in try/catch.
**Verified (live preview):**
- Receiver source contains `_rma.liveStatus = p.value` and `MATRIX_CELL_META[_rmKey].actionStatus = p.value`.
- All six render calls present inside the field-update branch.
- No console errors.

**Behavioral change:** Tab A edits any field on a creative → within ~150ms (one Supabase realtime broadcast) Tab B's Matrix, Action Plan, Tracker, Production kanban, cell modal, and tab counts all reflect the change. Same for Tab A's other open browsers (different machines, same product).

### Bug 10 (cont 4) — Action Plan status change didn't reflect in Creative Matrix or ClickUp
**Reported:** 2026-05-03
**Symptom:** Status change from Action Plan stayed in the AP card only — Matrix cell still showed the old status, and the ClickUp task didn't update either. Matrix → AP path worked.
**Root causes (4 gaps in `updateManualActionStatus`):**
1. **Matrix cell wrong key** — wrote `MATRIX_CELL_META[cellAdKey].actionStatus = newStatus` only. The cell renderer reads `.status`, not `.actionStatus`. So the matrix display kept showing the old status until something else (like a poll) re-set `.status`.
2. **No `renderMatrix()` call** — the function refreshed AP / Production / Creatives but not the matrix or the cell modal. AP-side edits stayed invisible there until the user navigated away and back.
3. **No `field-update` broadcast** — peers learned about AP-side status edits only via the post-flush `sync-needed` roundtrip (slow). The matrix-side function broadcasts but the AP-side one didn't.
4. **ClickUp push gated on `act._clickupId` only** — if the action object somehow lacked `_clickupId` but the linked AD had one, no push fired. (Common during a window right after AP push when the action_id is set on the AD before propagating back to the action object.)

**Fix in `updateManualActionStatus`:**
1. Set BOTH `MATRIX_CELL_META[cellAdKey].status = newStatus` AND `.actionStatus = newStatus` so every consumer is current.
2. Add `renderMatrix() / renderMxv4Modal() / updateTabCounts()` calls to the post-state render block (joining the existing AP / Production / Creatives renders). All wrapped in try/catch.
3. Emit a `field-update` broadcast with `field: 'status'` and the linked AD's id, mirroring what `changeAdStatusFromMatrix` does. Other browsers see the change in <500ms.
4. Cache the `linkedAd` during the loop, then fall back to `linkedAd._clickupId` for the ClickUp push when `act._clickupId` is missing — so the push reliably fires regardless of which object holds the link.

**Verified (live preview):** seven assertions all green —
- `MATRIX_CELL_META[cellAdKey].status = newStatus` ✓
- `MATRIX_CELL_META[cellAdKey].actionStatus = newStatus` ✓
- `renderMatrix()` call present ✓
- `renderMxv4Modal()` call present ✓
- Broadcast emits `field-update` ✓
- ClickUp push falls back to `linkedAd._clickupId` ✓
- `'Untested' → 'untested'` mapping present ✓
- No console errors

**Behavioral change:** Status change in Action Plan now reflects in Matrix cell, Creative Tracker, Production kanban, AND the ClickUp task instantly — same parity as Matrix → AP. Other browsers see it within ~150ms via realtime broadcast.

### Bug 10 (cont 5) — Cell modal showed "Untested" because meta.status (cached) won over ad.status (live)
**Reported:** 2026-05-03
**Symptom:** After AP-side status change to "Scale", clicking the matrix cell still showed the row in "Untested". Refreshing the page fixed it (because saveState had eventually flushed both, and on reload everything matched).
**Root cause:** `_mxv4ClassifyCell` and the legacy v3 cell ad-list both read `meta.status || ADS[j].status || 'Untested'`. `MATRIX_CELL_META[…].status` is a **denormalized cache** that can lag behind a peer broadcast or a save round-trip. When the cache is stale and the AD object is fresh, the cache won → modal showed the old value.
**Fix:** Inverted priority at both call sites — `ADS[j].status || meta.status || 'Untested'`. The AD object is the source of truth; meta is a fallback. Same pattern keeps the cell renderer aligned with the rest of the codebase (which already reads `ad.status` directly).
**Verified (live preview):**
- Classifier source contains `ADS[j].status || meta.status` (inverted order).
- Synthetic E2E: set `ad.status = 'Scale'` AND `meta.status = 'Untested'` (stale cache), call `_mxv4ClassifyCell` → returns `'Scale'`. Pre-fix would have returned `'Untested'`.
- No console errors.

**Behavioral change:** Status changes propagate to the cell modal instantly, no refresh needed, even when the cached `MATRIX_CELL_META` hasn't been updated yet.

## Bug 11 — Merged personas/angles re-appear after refresh + Personas/Angles UI redesign
**Status:** ✅ done — shipped 2026-05-03 (LOCAL ONLY, NOT pushed to git or Vercel per user request)
**Reported:** 2026-05-03
**Surface:** Angles tab + Personas tab — Merge button · table styling

### Symptom 1 — re-population after refresh
Selecting two personas (or angles) and clicking Merge correctly merges them on the surface (the losing names disappear from the list, ADs are remapped to the survivor). After refresh, the losing names reappear.

### Root cause
`executeMergePersonas` and `executeMergeAngles` removed the losing names from the in-memory PERSONAS/ANGLES arrays and updated ADs to the survivor, but did NOT call `_rememberTaxonomyDeletion(...)`. So the next 30s ClickUp poll's `autoDiscoverTaxonomy` saw a fetched task whose `persona` (or `angle`) custom field still carried the old name (push hadn't propagated yet, was rate-limited, or the AD never had a `_clickupId`) — and re-created the row from that stale value. Same vector that `deleteAngle` / `deletePersona` already protect against.

### Fix
Added a tombstone pass at the top of both merge functions:
```js
if (typeof _rememberTaxonomyDeletion === 'function' && activeProductId) {
  losingNames.forEach(function (n) {
    try { _rememberTaxonomyDeletion('angle' /* or 'persona' */, activeProductId, n); } catch (e) {}
  });
}
```
Mirrors the existing `deleteAngle` / `deletePersona` pattern. The next poll's `autoDiscoverTaxonomy` checks the tombstone before adding a name.

### Symptom 2 — UI request
"Make the UI of angle and persona section inspired by the Action plan section table structure."

### Fix
Added a CSS overlay below the legacy `.tracker-row` rules that flattens the card-per-row look into an Action-Plan-style flat table:
- `.tracker-grid` is now a single rounded container with a sticky header (matches `.ap-table-wrap`).
- `.tracker-header` is sticky-on-scroll with backdrop blur and uppercase label styling (matches AP's `thead th`).
- `.tracker-row` loses its individual border + shadow, gets a single bottom-rule, and uses a 3px inset box-shadow rail on the left for status accent (matches AP's `age-red/yellow/green` rail).
- Hover is a subtle background tint instead of a lift — Action-Plan-style.
- Stat pills use `JetBrains Mono` like AP's numeric cells; clickable pills invert to dark on hover.
- Status badges use the same pill shape and color tokens used elsewhere in the app.
- Same markup, no JS changes — visual upgrade only. If the user wants to roll back, the original rules above the override remain unchanged.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload:
  - `executeMergePersonas` source contains `_rememberTaxonomyDeletion('persona'`.
  - `executeMergeAngles` source contains `_rememberTaxonomyDeletion('angle'`.
  - Synthetic call to `_rememberTaxonomyDeletion` followed by `_isTaxonomyTombstoned` returns true → tombstone storage and lookup both work.
  - Stylesheet inspection confirms `.tracker-header { position: sticky; ... }` rule is applied.
- Pre-existing `[SB] getResults` console-noise was already there before this turn — unrelated.

### Behavioral change for the user
- Merging personas/angles now sticks across refresh — the merged-away rows do not come back via the next ClickUp poll.
- Personas + Angles tables visually match the Action Plan table (sticky header, flat rows with status rail, hover tint, mono stat pills) without any markup changes.

### NOT pushed
Per the user's explicit request, this fix lives only in the local file. Not committed, not pushed to GitHub, not deployed to Vercel.

## Bug 12 — Page blinks + scroll snaps to top every 30s on live sync
**Status:** ✅ done — shipped 2026-05-03 (LOCAL ONLY, NOT pushed to git or Vercel per user request)
**Reported:** 2026-05-03
**Surface:** Every panel (Matrix / Action Plan / Tracker / Personas / Angles) — perceptible flash + scroll reset every poll cycle, especially when user is interacting (scrolling, hovering, clicking).

### Symptom
1. Every 30s when the foreground ClickUp poll fires, the page "blinks" — visible flash as multiple panels rebuild via `innerHTML =`.
2. Scroll position snaps back to top after a sync-needed merge or a peer's field-update broadcast.
3. Clicking on something during a render causes the click target to disappear / move because the rendered DOM was about to get replaced.

### Root cause
Realtime + poll handlers all called `renderAll()` (or a cascade of `renderMatrix() / renderActionPlan() / …`) unconditionally. Each renderer wipes its container with `innerHTML = …`. That kills:
- the user's scroll position (browser resets `scrollTop` after a big DOM swap unless it's an anchor scroll),
- focus on any open input / contenteditable / select,
- mid-flight click targets,
- any open dropdown / picker.

### Fix (4 layers)
1. **`_userIsActivelyEditing()`** helper — returns true if `document.activeElement` is an `input`, `textarea`, `select`, or contenteditable. Lets event handlers skip cascading re-renders while the user is mid-edit.
2. **`renderAll()` now wraps `_renderAllInternal()` with scroll-preservation** — captures `window.scrollY` before, restores via `requestAnimationFrame` after.
3. **`_renderAllSilent()`** — variant used by autoref-driven entry points (sync-needed merge, realtime DB-change merge). Skips entirely if `_userIsActivelyEditing()` is true OR if a matrix v4 picker is open. Otherwise calls `renderAll()` (which preserves scroll).
4. **`field-update` receiver + `saveAdFieldUnified` cascading renders** now both:
   - `return` early when `_userIsActivelyEditing()` is true (peer broadcasts can't blow away the user's open input mid-typing).
   - Capture `window.scrollY` before the cascade and restore on `requestAnimationFrame`.

Sites updated:
- `_initRealtimeChannel` sync-needed handler (line ~8624) → uses `_renderAllSilent()`.
- `_initRealtimeChannel` realtime DB-change merge (line ~9807) → uses `_renderAllSilent()`.
- `_initRealtimeChannel` field-update broadcast handler — early-return + scroll preservation.
- `saveAdFieldUnified` cascading renders — scroll preservation.
- `renderAll()` — top-level scroll preservation around `_renderAllInternal()`.

### Verified
- JS parses cleanly (Node `new Function()` check).
- Live preview after reload, six assertions all green:
  - `_userIsActivelyEditing` exists ✓
  - `_renderAllSilent` exists ✓
  - `renderAll()` source contains `window.scrollTo` ✓
  - sync-needed handler references `_renderAllSilent` ✓
  - `saveAdFieldUnified` source contains scroll-preservation marker ✓
  - Synthetic edit-mode test: focusing a `<input>` makes `_userIsActivelyEditing()` return true; blurring returns false ✓
- Pre-existing `[SB] getResults` console-noise is unrelated to this change.

### Behavioral change for the user
- Every-30s poll no longer triggers a visible blink — the renderers either skip entirely (user is interacting) or run with scroll preserved.
- Clicking, scrolling, or typing during a sync interval no longer gets interrupted by a DOM swap.
- Peer broadcasts (other browsers' edits) no longer blow away the local user's open input / dropdown.

### NOT pushed
Per the user's request, this fix lives only in the local file. Not committed, not pushed to GitHub, not deployed to Vercel.

## Bug 13 — Adding or deleting a product silently failed; row gone after refresh
**Status:** ✅ done — shipped 2026-05-03 (LOCAL ONLY, NOT pushed to git or Vercel per user request)
**Reported:** 2026-05-03
**Surface:** Product picker → "+ Add Product" / "Delete Product"

### Symptom
- "I add a product, it appears in the picker. After refresh it's gone."
- "I delete a product, it disappears. After refresh it's back."

### Root cause
`addProduct` and `confirmDeleteProduct` were "optimistic-then-fire-and-forget":
- `addProduct` did `PRODUCTS.push(prod); try { await DB.upsertProduct(prod); } catch (e) { console.error(...) }`. If the upsert errored (network blip, RLS misconfig, schema mismatch), the catch swallowed it to console — UI showed success and the local row, but the DB never got it. After refresh, `listProducts()` returned the unchanged set and the user's "added" product was gone.
- `confirmDeleteProduct` had the same shape — local filter happened first, DB call could fail silently.
- `DB.upsertProduct` / `DB.deleteProduct` themselves only logged the error and returned undefined, so callers had no way to know.

### Fix
1. **`DB.upsertProduct` / `DB.deleteProduct` now return `{ ok, error }`** — structured result so callers can branch on success/failure. Errors still go to console for debugging, but they're also returned.
2. **`addProduct`**: call `DB.upsertProduct` BEFORE pushing to `PRODUCTS`. If `!ok`, surface the error via toast (`'Could not save product — ' + reason`) and bail. After upsert, do a verification read (`SB.from('products').select('id').eq('id', prod.id)`) — if the row isn't there despite ok:true, surface a different toast and bail. Only after both checks succeed do we push locally + switch.
3. **`confirmDeleteProduct`**: hit `DB.deleteProduct` BEFORE filtering `PRODUCTS`. If `!ok`, surface the error via toast and bail — leaves local state untouched. After successful delete, run the rest of the cleanup (tombstone, filter, switch) and removed the now-redundant second `DB.deleteProduct` call.

### Verified
- JS parses cleanly.
- Live preview synthetic test:
  - Stubbed `closeModal` + `toast`, called `addProduct('Test Bug13 …', …)`.
  - Verified row landed in DB (`SB.from('products').select(...)` returned the new id).
  - Local `PRODUCTS` includes the new product.
  - Toast log shows the success path fired.
  - Test row cleaned up via direct `SB.from('products').delete()`.
- Pre-existing `[SB] getResults` console noise unrelated.

### Behavioral change for the user
- If add/delete actually fails (network, RLS, schema), the user now sees `Could not save product — <reason>` instead of false success. They can retry knowing what went wrong.
- Local state never drifts from DB state on add/delete — the local row is only added/removed AFTER the DB confirms.

### NOT pushed
Per the user's request, lives only in the local file.

---

## Bug 14 — Instagram inspirations classified against a 640×640 center crop, losing on-image text + CTA
**Status:** ✅ done — shipped 2026-05-12 (deployed to Vercel, propagated to both workers automatically)
**Reported:** 2026-05-12 by Gaurav after queuing `https://www.instagram.com/p/DXHT__ZAPLI/` as `C-INS-011` in the Canva product
**Surface:** classify-inspiration skill (Claude) + immuvi-creative-producer skill (Codex) + classify_worker.py pipeline

### Symptom
- Instagram photo posts whose key content sits near the edges (post text, "TAKE TEST" CTA buttons, branding overlays) were getting classified against an image that was missing those elements.
- Specifically `C-INS-011` (Perfect Match Astro post "You will marry a man with this name" + TAKE TEST button on a rainy airport window) was classified with empty `ctaText`, empty `formatName`, empty `creativeUSP`, empty `creativeHypothesis`, empty `notes`, and an "Off-Brand FLAG" angle — because the classifier only saw the small Astro "A" logo in the center of a dark rainy window, not the actual marketing content overlay.
- The ClickUp doc page brief embedded the cropped preview image, making it obvious to the user that the wrong image had been classified.

### Root cause
Instagram has progressively locked down unauthenticated access:
1. `yt-dlp` returns `"There is no video in this post"` for photo posts and 401 for reels without cookies.
2. `gallery-dl` without `--cookies-from-browser` returns a login redirect.
3. The unauthenticated GraphQL endpoint (`?__a=1&__d=dis`) returns 403.
4. **The `og:image` meta tag (which we were using as the only fallback) is a server-side 640×640 center crop** — Instagram cropped it before serving. Stripping the `stp=` crop param from the signed URL just makes Meta's CDN return the Instagram logo placeholder.
5. Third-party downloader sites (igram.world, snapinsta.app, etc.) work intermittently — they break weekly as Instagram rotates anti-scrape measures.

The original Step 3 pipeline branch only had two methods (yt-dlp → og:image), so photo posts always fell through to the cropped og:image.

### Fix — 3-method robust download chain in `fb_ad_classifier.download_instagram_media(url, work_dir)`

| # | Method | Quality | Requires | Speed |
|---|---|---|---|---|
| 1 | `gallery-dl --cookies-from-browser` (tries chrome → firefox → brave → edge → safari) | **1080×1920 original** | An IG-logged-in browser on this worker machine | ~1s |
| 2 | `snapinsta.to/en2` driven via Playwright | **1080×1920 original** | `playwright` + chromium installed | ~12-20s |
| 3 | `og:image` via `User-Agent: facebookexternalhit/1.1` | 640×640 center crop | Pure stdlib — always works | ~1s |

Each method's failure cascades to the next. Method 3 has ~100% uptime so the chain never returns nothing. OG metadata (caption, username, likes/comments) is always fetched alongside so `snapshot.page_name` + `body_text` are populated regardless of which method downloaded the pixels.

Critical Cloudflare Turnstile detail for method 2: **headless Playwright was tried first and failed** — snapinsta uses Turnstile in "invisible" mode and Cloudflare's risk engine flags pure-headless Chromium fingerprints, refusing to issue a token (form submit hangs, backend returns "No data"). The only reliable fix was `headless=False` with `--window-position=-3000,-3000` and `--disable-blink-features=AutomationControlled` — a real Chromium opens off-screen, Turnstile auto-solves in ~10s, then the window closes. Persistent profile + cached `cf_clearance` cookie also did NOT work because snapinsta requires a *fresh* Turnstile token per submission, not just a page-level clearance.

### Files changed
- `team-skill/fb_ad_classifier.py` — added `download_instagram_media()`, `_ig_download_gallery_dl()`, `_ig_download_snapinsta()`, `_ig_download_og()`, `_ig_get_duration()`. Also added `import shutil`. Existing `fetch_instagram_og()` (added earlier today) is reused inside the chain for metadata + final fallback.
- `team-skill/SKILL.md` — Step 3's `elif platform == "instagram"` branch simplified to call `download_instagram_media(url, work_dir)`; `from fb_ad_classifier import ...` import line updated to include the new symbols.
- `team-skill/immuvi-creative-producer/SKILL.md` — added a new "**Step 2.1 — Downloading Instagram links**" section between Step 2 and Step 3 with a self-contained Python script (`/tmp/ig_dl.py`) that Codex writes inline and runs, replicating the same 3-method chain without depending on `fb_ad_classifier.py` (since the immuvi skill ships SKILL.md only, no companion Python).

Local mirrors at `~/.claude/skills/classify-inspiration/` and `~/.codex/skills/{classify-inspiration,immuvi-creative-producer}/` were also updated and their `.SKILL.md.etag` / `.fb_ad_classifier.py.etag` cache files were busted so Step 0 picks up the new files on the next run.

### Verified end-to-end across both workers
- **gp-laptop** (MacBook Pro, Claude): re-queued `C-INS-011`, worker picked it up within 15s, Step 0 auto-update pulled the new files, method 1 (gallery-dl with logged-in Chrome cookies) won → got 1080×1920 JPEG → Claude vision classified all 12 fields with the actual on-image text. Total time 5m 38s.
- **gp-mac-mini** (Mac mini, Codex): pinned the same queue row to `worker_assignment='gp-mac-mini'`, worker claimed it within ~20s, Step 0 auto-pulled the new files independently, Codex's inline `/tmp/ig_dl.py` script ran the same chain (method 1 won via gallery-dl), 1080×1920 → Codex vision classified. Total time 7m 39s. Codex even filled `headline` (which Claude left blank) and chose a smarter `creativeStructure="Hook + Offer"` (vs Claude's "Static / Photo").

The before/after diff on `C-INS-011`:

| Field | BEFORE (og 640×640 crop) | AFTER (gallery-dl 1080×1920 full) |
|---|---|---|
| bodyCopy | just the IG caption | `"You will marry a man with this name\nTAKE TEST"` — text read directly off the image overlay |
| ctaText | empty | `"TAKE TEST"` |
| formatName | empty | `"Curiosity Bait Static"` |
| creativeUSP | empty | `"Curiosity Bait Static — mysterious personal prediction drives test-taking action"` |
| creativeHypothesis | empty | `"Made to exploit curiosity about future love life with a personalized hook. Works because self-referential curiosity demands resolution, driving clicks."` |
| notes | empty | `"Dark rainy airport window background. Cursive text overlay with future spouse prediction. White TAKE TEST CTA. A logo top center."` |
| angle | `"Off-Brand / Cross-Product (FLAG)"` (wrong — flagged because classifier couldn't see the brand-relevant content) | `"Meme / Pattern-Interrupt Format"` |
| persona | `"Astrology Enthusiasts 18-35"` | `"Curious Women 18-35"` |
| productionStyle | `"Professional Studio"` (wrong) | `"Static Graphic"` (correct) |

### Operational notes
- Mac mini originally only had `og:image` fallback because it doesn't necessarily have an IG-logged-in browser. If teammates want 1080p quality on the Mac mini (not just the 640×640 crop), they need either (a) someone logged into Instagram in any browser on the Mac mini for method 1, or (b) `playwright` + chromium installed for method 2 to kick in. Method 3 (og) always works as final fallback.
- The auto-update pipeline (worker pulls `classify_worker.py` from Vercel every 60s; skill Step 0 pulls `SKILL.md` + `fb_ad_classifier.py` on every classify run) means future Instagram improvements deploy to all workers automatically — no SSH, no manual sync. This was the entire point of the auto-update plumbing and it worked perfectly here.

### Followups (not blocking)
- Sweep older Instagram inspirations that were classified pre-2026-05-12 against the cropped image — they have empty `formatName` / `creativeUSP` / `creativeHypothesis` and would benefit from re-queueing now that the new chain is live. SQL filter would be something like `where platform='Instagram' and url like '%instagram.com/p/%' and coalesce(data->>'formatName','')=''` → reset queue rows to `pending`.

---

## Bug 15 — Product field missing when assigning Action Plan tasks to ClickUp
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Action Plan → "+ ClickUp" task creation → ClickUp custom field `Product`

### Symptom
- When assigning/pushing a task from the app to ClickUp, the ClickUp task could be created without the `Product` custom field filled.
- This made the task incomplete even though the app already knew the product context from the active product, OneScale launch mapping, or source AD metadata.

### Root cause
The post-create field sync only attempted `productName` inside the `if (sourceAd)` block and used only `getActiveProduct().name`.
That made Product fragile in three cases:
1. If the action's source AD lookup failed or was stale, the entire field-sync block skipped.
2. If OneScale/product-profile metadata had the better product name, it was ignored.
3. If a cached ClickUp field map existed but did not include the Product field, the app treated the map as valid and never refetched it.

This was the same class of bug as Bug 5 / Bug 10: field data was available, but the sync path trusted one object shape and one cached map too much.

### Fix
1. Added `_clickUpProductNameForTask(task, sourceAd)` as a single resolver. It prefers:
   - `oneScaleProductName` from the action or source AD,
   - direct `productName` / `product` / `productProfileName`,
   - saved product production config,
   - OneScale list mapping product name,
   - active dashboard product name as the final fallback.
2. `createClickUpTaskFromAction` now computes Product before task creation and runs post-create field sync when either a source AD exists OR a product name exists.
3. The post-create proxy now targets the new ClickUp task even without a source AD, so Product can still be pushed.
4. If Product is needed but the cached ClickUp field map lacks `productName`, the app refetches the field map before pushing fields.
5. `_seedCuRawFromTypedFields` now seeds the `product` custom-field raw value for newly spawned ADs when ClickUp metadata is available.
6. Field discovery now also recognizes `Product Name`, `Product Profile`, and `Product Profile Name` as aliases for the ClickUp Product field.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- Diff checked to ensure existing Bug 5 / Bug 10 behaviors remain intact: source AD field copying still runs, user fields still post-create PUT separately, and Product is now added as an extra resilient field rather than replacing the existing sync flow.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 21 — Classify-inspiration skill was missing Bug 14's shared Instagram downloader
**Status:** ✅ done — fixed 2026-07-02
**Reported:** 2026-07-02 during backlog regression audit
**Surface:** `team-skill/fb_ad_classifier.py` + `team-skill/SKILL.md` Instagram classification path

### Symptom
- The backlog said Bug 14 shipped a shared `download_instagram_media()` helper in `fb_ad_classifier.py` with the `gallery-dl → snapinsta → og:image` fallback chain.
- The producer skill contained an inline Instagram fallback chain, but the classify-inspiration helper and pipeline script did not expose or call the shared downloader.
- As a result, classifier-side Instagram photo posts could still miss the robust full-media path documented in Bug 14.

### Root cause
Bug 14's producer-side instructions and classifier-side helper drifted apart.
`team-skill/immuvi-creative-producer/SKILL.md` had the 3-method chain, while `team-skill/fb_ad_classifier.py` only had the older Open Graph helper and `team-skill/SKILL.md` did not route Instagram URLs through a shared downloader.

### Fix
1. Added `download_instagram_media(url, work_dir)` to `team-skill/fb_ad_classifier.py`.
2. Added helper methods for the documented fallback chain:
   - `_ig_download_gallery_dl()`
   - `_ig_download_snapinsta()`
   - `_ig_download_og()`
   - `_ig_get_duration()`
3. Reused `fetch_instagram_og()` for metadata and the final fallback.
4. Updated the classify-inspiration pipeline script in `team-skill/SKILL.md` to import and call `download_instagram_media()` for Instagram URLs.

### Verified
- `team-skill/fb_ad_classifier.py` compiles with `python3 -m py_compile`.
- Static checks confirm `download_instagram_media`, `gallery-dl`, `snapinsta`, and Open Graph fallback are present in the helper.
- Static checks confirm `team-skill/SKILL.md` imports `download_instagram_media` and routes `platform == "instagram"` through it.
- `immuvi-command-center.html` script still parses cleanly.
- `git diff --check` passed.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 20 — Inspiration-assigned tasks wait for ClickUp before Angle/Persona columns fill
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Inspirations → place/add to matrix → Push to Action Plan → Action Plan custom-field columns `Angle Tag` / `Persona Tag`

### Symptom
- When a task was assigned from an Immuvi inspiration, the Action Plan row could show empty or delayed `Angle Tag` / `Persona Tag` values until ClickUp sync fetched the task back.
- This was wrong because the inspiration placement flow already knows the target Angle and Persona at creation time.

### Root cause
Inspiration spawn paths created ADs with top-level `ad.angle` / `ad.persona`, and the ClickUp push path eventually wrote `Angle Tag` / `Persona Tag`.
But the Action Plan custom-field columns render from the local `_customFields` mirror.
Fresh inspiration-spawned ADs only seeded `_customFieldsRaw`, not `_customFields`, so the UI waited for the next ClickUp import to rebuild the display mirror.

This is related to Bug 19 but earlier in the lifecycle: Bug 19 made the drawer recover missing cell identity; this bug makes the row columns correct immediately when the task is created from an Immuvi inspiration.

### Fix
1. Added `_seedCuDisplayFromTypedFields(ad)` to build the local display custom-field mirror from typed AD fields.
2. Added `_seedCuMirrorsFromTypedFields(ad)` to seed both `_customFields` and `_customFieldsRaw` together.
3. Updated inspiration spawn, tracker-clone spawn, blank-brief spawn, and generic matrix → Action Plan push paths to seed local mirrors before rendering.
4. `apResolveCard` now refreshes its custom-field display reference after `_apResolveCellIdentity` heals missing Angle/Persona mirrors.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- Targeted static checks confirm immediate display-mirror seeding for MXv4 inspiration spawn, legacy `addInspoToCell`, blank-brief spawn, tracker-clone spawn, and existing matrix → Action Plan push.
- Regression checks confirm Bug 10's `Untested` status map stays clean, Bug 19 description/cell identity recovery stays present, and ClickUp post-create field sync still falls back to `sourceAngle/sourcePersona`.
- `git diff --check` passed.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 16 — Script-bank table turns into `[table-embed:...]` text in production task descriptions
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Script Bank / ClickUp synced task → Action Plan assignment → Production Queue ClickUp task description

### Symptom
- In the script bank task, the product/creative description table looked correctly organized as a two-column `Field / Value` table.
- After assigning the item to the production queue, the production task description showed ClickUp's internal rich-table serialization, e.g. `[table-embed:1:1 Field | 1:2 Value | ...]`.
- The production description became clumsy and hard to read, and the creative hypothesis appeared below the leaked table text.

### Root cause
ClickUp's API can return rich description tables as a serialized plain-text token (`[table-embed:...]`).
The app was storing that raw API string locally and the sync parser treated everything before the first separator as `creativeHypothesis`.
So the source task's table could be cached as hypothesis/prose and then reused when building the new production task description.

This repeated the same class of issue as earlier ClickUp field bugs: reusing ClickUp API shapes directly instead of normalizing them at the app boundary.

### Fix
1. Added a ClickUp description normalizer that converts `[table-embed:row:col ...]` back into a normal markdown table.
2. Added a creative-hypothesis extractor that specifically reads the `Creative Hypothesis` section and strips table/scaffold content before caching it.
3. `parseClickUpTask` now stores normalized descriptions locally and no longer treats the top creative brief table as hypothesis.
4. `buildTaskDescription` sanitizes `ad.creativeHypothesis` before rendering, so old already-polluted local rows don't leak table serialization into new production tasks.
5. Brief-row appenders now normalize the existing task description before writing it back, preventing later brief inheritance from re-saving the bad table token.
6. Table cell values are escaped before generating markdown rows, so links or values with pipes/newlines cannot break the table layout.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- A sample matching the reported `[table-embed:...]` screenshot converts to:
  `| Field | Value |` table rows, and extracts only `The ad was made to spark curiosity about everyday medicinal plants.` as the hypothesis.
- `git diff --check` passed.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 17 — Production task descriptions missing inspiration/source ad links
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Script Bank / synced ClickUp task → Action Plan assignment → Production Queue task description

### Symptom
- Some production tasks were created without the inspiration link / source ad link in the description.
- The source URL could still exist elsewhere, such as inside the original ClickUp description table, a `Source Ad:` line, the inspiration record, or `_sourceInspoAdUrl`, but the production description only rendered from `ad.adLink`.

### Root cause
`buildTaskDescription` only added the `Inspiration Link` table row when `ad.adLink` was already populated.
But ClickUp sync and older task paths store source URLs in several shapes:
1. ClickUp custom field `Inspiration Link`.
2. Normalized or raw ClickUp description table row `Inspiration Link`.
3. Text line `Source Ad: <url>`.
4. Inspiration metadata (`sourceUrl`) or `_sourceInspoAdUrl`.

When the URL lived in any shape except `ad.adLink`, the production task was missing the link.

### Fix
1. Added `_sourceAdUrlForDescription(ad)` as the single source-link resolver.
2. The resolver checks `ad.adLink`, `_sourceInspoAdUrl`, `_sourceAdUrl`, inspiration records, and URLs embedded in normalized ClickUp descriptions.
3. `buildTaskDescription` now uses the resolver for the `Inspiration Link` table row, so production descriptions include the source URL even if `ad.adLink` was blank.
4. `parseClickUpTask` now backfills `adLink` from description rows/lines when the ClickUp custom field is empty.
5. Tracker-derived production clones now carry the source description into the synthetic description object, allowing table-only links to be recovered.
6. `_apParseInspoLinksFromDesc` now recognizes `Source Ad`, `Inspiration Link`, `Inspo Link`, `Ad Link`, `Reference Link`, and brief-table labels after normalizing ClickUp rich-table embeds.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- A sample matching the reported table shape successfully extracts:
  - source ad URL from `Inspiration Link`,
  - brief doc URL from `Aryan's Brief`.
- `git diff --check` passed.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 18 — Edit Creative modal still mapped `Untested` to ClickUp `to do`
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Creative Tracker / Matrix → Edit Creative modal → save status back to ClickUp

### Symptom
- The Bug 10 audit found one remaining legacy status map where saving from the Edit Creative modal converted app status `Untested` into ClickUp status `to do`.
- The workspace ClickUp list uses `untested`, so that path could silently fail or behave differently from the Action Plan and Matrix status paths.

### Root cause
Bug 10 fixed the primary Action Plan, Matrix, task-create, and unified field-save status maps, but the older `saveEditCreative()` path still had its own local `cuStatusMap`.
That duplicate map was missed and kept the old `Untested -> to do` value.

### Fix
Changed the `saveEditCreative()` map to use `Untested -> untested`, matching the other ClickUp status sync paths.

### Verified
- Static audit confirms no remaining `Untested -> to do` custom ClickUp status map in `immuvi-command-center.html`.
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.

---

## Bug 19 — Action Plan drawer sometimes hides Angle × Persona under the task title
**Status:** ✅ done — fixed 2026-07-02 (pushed to production)
**Reported:** 2026-07-02
**Surface:** Action Plan → task detail drawer header / Provenance cell row / Open in Matrix button

### Symptom
- The task detail drawer should show the task's matrix cell directly under the task name, e.g. `Stress Sleep And Hormone Relief × Women Seeking Natural Remedies`.
- Some tasks showed a blank/`— × —` cell line, or had no usable cell context for the drawer/provenance actions, even though the task belonged to a real Angle × Persona cell.

### Root cause
The drawer read Angle/Persona only from `display.angle/persona` and `act.sourceAngle/sourcePersona`.
For synced/adopted ClickUp tasks, those values can be missing if the task was hydrated from ClickUp before the local action carried a cell snapshot.
The same data could still exist in other shapes:
1. ClickUp custom fields `Angle Tag` / `Persona Tag`.
2. Top-level parsed AD fields.
3. The creative-brief markdown table inside the task description.
4. `act.angle/persona` on older/manual action rows.

A second gap made future misses more likely: `_seedCuRawFromTypedFields` seeded `Angle Tag` but not `Persona Tag`, and post-create field sync preferred `act.angle/persona` without falling back to `sourceAngle/sourcePersona`.

### Fix
1. Added a reusable description-field extractor that reads normal markdown tables and normalized ClickUp table embeds.
2. `parseClickUpTask` now backfills missing Angle/Persona from the task description table when custom fields are empty.
3. `_seedCuRawFromTypedFields` now seeds both `Angle Tag` and `Persona Tag`.
4. ClickUp post-create field sync now falls back to `act.sourceAngle/sourcePersona` before source AD values.
5. Added `_apResolveCellIdentity(act, ad)` so Action Plan cards resolve cell identity from action snapshots, AD fields, custom-field mirrors, and description tables in one place.
6. The drawer provenance cell row now uses the resolved display Angle/Persona, not only the older `act.sourceAngle/sourcePersona` fields.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- Targeted static checks confirm description-table recovery, Persona Tag seeding, sourceAngle/sourcePersona post-create fallback, canonical drawer identity resolution, and resolved display cell provenance.
- `git diff --check` passed.

### Pushed
Pushed to `main` for production deployment on 2026-07-02 after explicit user approval.

---

## Bug 22 — Wrong ClickUp list made Canva tasks appear inside ADHD
**Status:** ✅ done — fixed 2026-07-03 (local only, not pushed)
**Reported:** 2026-07-03
**Surface:** Product selector → ADHD → Action Plan / ClickUp sync

### Symptom
- While ADHD was selected, the Action Plan showed Canva tasks such as `CA-...` and `CI-...`.
- The rows were persisted under the ADHD product, so they continued to appear even after normal reloads.

### Root cause
The ADHD product was accidentally linked to the ClickUp list named `Canva Income Mastery`.
Because ClickUp sync trusts the active product's configured list, syncing ADHD imported Canva tasks into ADHD-scoped `ads` and `manual_actions` rows.

This is the same family as the previous product/field sync bugs: the app accepted a cross-product ClickUp configuration without validating that the selected list actually belonged to the active product.

### Fix
1. Added a ClickUp list/product mismatch guard that compares the active product name with the linked ClickUp list name and with other products already using the same list.
2. `syncClickUp()` now blocks before fetching tasks when the active product is linked to a list that looks like another product.
3. `saveProductClickUpLink()` now rejects mismatched links before saving them, so the bad configuration cannot be reintroduced from Product Profiles.
4. Cleaned the existing ADHD data pollution in Supabase:
   - deleted 48 Canva-prefixed `ads` rows,
   - deleted 53 related `manual_actions` rows,
   - pruned 17 matrix-cell assignment references to the deleted rows,
   - unlinked ADHD from the Canva ClickUp list through the sanctioned `unlink_product_clickup` RPC.

### Verified
- ADHD product config now has no ClickUp list linked.
- Canva and Canva Income Mastery still retain their Canva ClickUp list config.
- ADHD now has 0 `CA-`, `CI-`, `CIM-`, or `CM-` prefixed `ads` / Action Plan rows.
- Static checks confirm the mismatch guard runs before `fetchAllTasks()` and before saving a product ClickUp link.

---

## Bug 23 — Script Bank approvals created production tasks with default status and empty fields
**Status:** ✅ done — fixed 2026-07-03 (local only, not pushed)
**Reported:** 2026-07-03
**Surface:** Script Bank → approve task → production ClickUp task

### Symptom
- Approving a Script Bank task created a production task in ClickUp with status `to assign` instead of `Assigned`.
- The generated ClickUp description contained the Script Bank brief/table data, but the actual ClickUp fields were blank.

### Root cause
The production-task create path built the description from the source task, but custom fields were populated only from top-level AD fields and `_customFieldsRaw`.
Script Bank source tasks can carry the correct data inside the ClickUp description table while those top-level/mirror fields are empty.

The same create path also stripped `status` from the initial create payload and only mapped `Approved` to `approved`, so Script Bank approval pushes could fall back to the ClickUp list default status.

### Fix
1. Added a description-field hydration step before production task creation so Angle, Persona, Funnel, Ad Type, Hook Type, Creative Structure, Production Style, USP, Product, Drive Link, Notes, and Inspiration Link are recovered from the Script Bank description table.
2. Seeded ClickUp custom-field mirrors from those recovered values before building the create payload.
3. Expanded create-time and post-create field sync to use source fallbacks and push Product, Creative USP, Drive Link, Notes, and source ad link.
4. Forwarded `status` through `apiCreateTask()` and made Script Bank approval pushes create/update ClickUp tasks as `Assigned`.
5. Added `Assigned` to local status parsing and status-save maps so subsequent syncs preserve it instead of collapsing it to `Untested`.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm the Script Bank hydration helper runs before task description/custom-field creation, `apiCreateTask()` forwards status, Script Bank approvals map to `Assigned`, duplicate ClickUp status maps include `Assigned`, and ClickUp `assigned` status parses back as local `Assigned`.
- Static backlog-regression checks confirm the product/list mismatch guard, source-ad link resolver, Action Plan drawer cell resolver, and `Untested -> untested` status convention remain present.

---

## Bug 24 — Script Bank approval status still fell back to ClickUp `to assign`
**Status:** ✅ done — fixed 2026-07-04 (local only, not pushed)
**Reported:** 2026-07-04
**Surface:** Script Bank → approve task → production ClickUp task status

### Symptom
- Script Bank-approved tasks still landed in ClickUp as the default `to assign` status instead of `assigned`.

### Root cause
Bug 23 fixed the create path only when the active target product/list looked like Script Bank.
In the real flow, the target can be the production queue while the source task carries the Script Bank list identity in `sourceAd.clickupListName` / `sourceAd.listName`.
That meant the Script Bank override did not fire, so the create path still tried to create/update the task as `approved`.

There was a second edge: when ClickUp statuses were not loaded yet, the fallback status value was `Assigned` with a capital A. The workspace status is lowercase `assigned`, so ClickUp could reject/ignore the update and leave the task in the list default `to assign`.

### Fix
1. Broadened Script Bank detection to check both the active target list and the source task's ClickUp list name.
2. Changed Script Bank approval create status to ClickUp's lowercase `assigned` API value.
3. Added post-create status fallback retries so ClickUp status updates try safe casing variants instead of silently leaving the task at the default status.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm Script Bank detection now reads source task list names, the override sends lowercase `assigned`, post-create status updates use fallback casing retries, `apiCreateTask()` still forwards status, and ClickUp `assigned` still parses back as local `Assigned`.
- Static regression check confirms no `Untested -> to do` status map was reintroduced.

---

## Bug 25 — Clean stale removed stale ads but left wrong-product angles/personas
**Status:** ✅ done — fixed 2026-07-04 (local only, not pushed)
**Reported:** 2026-07-04
**Surface:** Product Profile → Clean stale

### Symptom
- `Clean stale` removed stale imported tasks/ads from the active product, but stale Angle and Persona rows from the old/wrong ClickUp list remained.
- The product could still show taxonomy from another product even after the stale ads were cleaned.

### Root cause
`cleanStaleAds()` only soft-deleted stale ads and pruned cell assignment references.
It did not inspect whether the deleted stale ads were the only remaining source for their angle/persona names.
Because auto-discovered taxonomy is stored separately in `angles`, `personas`, and `ANGLE_PERSONAS`, those rows survived even when all related stale ads were gone.

### Fix
1. Added a stale-cleanup taxonomy prune that collects angle/persona names from the stale ads being removed.
2. After stale ads are removed, it deletes only those angle/persona rows that are no longer used by remaining local ads or current live ClickUp-list tasks, including live tasks whose taxonomy is only present in the description table.
3. It also removes those names from `ANGLE_PERSONAS`, purges orphaned matrix keys, tombstones deleted taxonomy names to prevent rediscovery, and persists the cleaned state immediately.
4. The cleanup toast now reports how many stale angles/personas were pruned along with the stale ads.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm `cleanStaleAds()` now calls the taxonomy prune after stale ADS removal, prunes stale-only Angle/Persona rows, preserves taxonomy still used by remaining ads or live ClickUp tasks, removes stale names from `ANGLE_PERSONAS`, tombstones deleted taxonomy names, prunes empty cell assignments, and persists the cleaned state immediately.
- Static regression check confirms the Bug 24 lowercase `assigned` status path and the `Untested -> untested` convention remain intact.

---

## Bug 26 — Clean stale confirmation did not show Angle/Persona names and used browser alerts
**Status:** ✅ done — fixed 2026-07-04 (local only, not pushed)
**Reported:** 2026-07-04
**Surface:** Product Profile → Clean stale confirmation

### Symptom
- The Clean stale confirmation only previewed stale task names.
- It did not show which stale Angle and Persona names would be removed.
- The flow used browser-native `alert`, `confirm`, and `prompt` popups, which were cramped and hard to read.

### Root cause
The stale cleanup confirmation was built as a plain text native browser dialog.
Even after Bug 25 added taxonomy pruning, the UI did not preview the taxonomy prune plan before the user confirmed.

### Fix
1. Replaced Clean stale browser dialogs with the app's modal popup.
2. Added a dry-run taxonomy prune plan so the modal can show stale Angle and Persona names before deletion.
3. The modal now previews stale ads with their Angle and Persona values.
4. The zero-task safety warning, low-fetch warning, high-risk typed confirmation, and final cleanup confirmation all use app modals.
5. Closing the modal with Cancel, X, or overlay now safely resolves as cancel.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm the Clean stale flow uses app modals for zero-task, low-fetch, high-risk typed confirmation, and final confirmation states.
- Static checks confirm the final confirmation shows stale Angle names, stale Persona names, and stale ad previews with each ad's Angle/Persona values.
- Static regression checks confirm Bug 25 taxonomy pruning still runs after stale ADS removal, Bug 24 lowercase `assigned` status handling remains present, and no `Untested -> to do` map was reintroduced.

---

## Bug 27 — Clean stale did not remove product-level foreign taxonomy rows
**Status:** ✅ done — fixed 2026-07-04 (local only, not pushed)
**Reported:** 2026-07-04
**Surface:** Product Profile → Clean stale

### Symptom
- The Clean stale modal could show stale ads to remove, but still show `No angle rows will be removed` and `No persona rows will be removed`.
- Products such as Canva could keep Angle/Persona rows that belonged to other products, even after stale ads were cleaned.

### Root cause
Bug 25 only planned taxonomy removal from the stale ad rows being deleted.
If wrong-product Angle/Persona rows were no longer attached to those stale ads, or the stale ads did not carry local angle/persona values, the cleanup plan never considered those taxonomy rows.

### Fix
1. Clean stale now derives the current product taxonomy source of truth from the currently linked ClickUp list's Angle/Persona fields.
2. Local Angle/Persona rows that are not present in that current list are treated as wrong-product/stale taxonomy and shown in the modal before removal.
3. Protected local work is preserved: local-only ads, New Find ads, winner/parent variations, `_localNew` rows, and local ads still connected to current-list ClickUp tasks.
4. The cleanup parser now resolves ClickUp dropdown/label option IDs to option names before comparing taxonomy, so random option IDs are not mistaken for real Angle/Persona names.
5. Clean stale can now run a taxonomy-only cleanup when no stale ads exist but wrong-product taxonomy rows remain.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Synthetic cleanup-plan check confirms wrong-product Angle/Persona rows are planned for removal, current-list taxonomy is kept, protected local taxonomy is kept, and ClickUp dropdown option IDs resolve to option names before comparison.
- Static regression checks confirm taxonomy tombstones remain, browser-native clean-stale prompts were not reintroduced, the Bug 24 lowercase `assigned` path remains protected, and no `Untested -> to do` map was reintroduced.

---

## Bug 28 — Clean stale over-selected valid product taxonomy and truncated preview lists
**Status:** ✅ done — fixed 2026-07-06 (local only, not pushed)
**Reported:** 2026-07-06
**Surface:** Product Profile → Clean stale confirmation

### Symptom
- The Clean stale modal showed valid Canva Angle/Persona rows as removal candidates.
- Long cleanup previews used `...and N more`, so the user could not see the full deletion list before confirming.

### Root cause
Bug 27 made the taxonomy cleanup too broad by treating any local Angle/Persona name missing from the current ClickUp list's parsed taxonomy as removable.
That was unsafe because legitimate product taxonomy can exist locally even when ClickUp does not currently expose that name through synced task fields.

The modal also capped taxonomy and stale-ad previews, which hid some deletion candidates behind summary text.

### Fix
1. Changed taxonomy pruning back to a conservative rule: remove Angle/Persona rows only when the name comes from stale ads being removed and is not used by remaining local/current work or current ClickUp task taxonomy.
2. Removed the broad `not present in current ClickUp list = delete` rule.
3. Updated modal wording from wrong-product cleanup to stale-only cleanup so the preview matches the safer behavior.
4. Removed truncation from Angle, Persona, and stale-ad preview lists so every planned deletion is visible before confirmation.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Synthetic cleanup-plan check confirms valid Canva taxonomy that is still used by remaining local work is kept even when it is not returned by the current ClickUp taxonomy fields.
- Synthetic cleanup-plan check confirms stale-only health taxonomy tied only to stale ads is still planned for removal.
- Static checks confirm the cleanup modal no longer emits `...and N more` truncation for Angle, Persona, or stale-ad preview lists, and the broad `foreignToCurrentList` deletion rule is gone.

---

## Bug 29 — Cross-product ClickUp duplicates leaked Canva tasks/taxonomy into ADHD
**Status:** ✅ done — fixed 2026-07-07 (local only, not pushed)
**Reported:** 2026-07-07
**Surface:** Product switcher → ADHD / Action Plan / Creative Tracker / Clean stale

### Symptom
- ADHD showed Canva/general creative rows in Action Plan and Creative Tracker.
- ADHD also showed wrong-product Angle/Persona rows, such as Canva-oriented taxonomy.
- Clean stale could still be confusing because old rows lacked reliable source-list metadata and some wrong-product rows were protected by action/cell references.

### Root cause
Bug 22 blocked the obvious bad-link/manual-sync path, but it did not protect every ClickUp fetch path and it did not quarantine existing polluted rows.

Live data showed that most older `ads` rows had blank embedded `clickupListId/clickupListName`, so the app could only trust `product_id`. Several ClickUp task IDs were duplicated across products, including Canva tasks stored under ADHD. Since `loadProductData()` loaded only by `product_id`, those duplicate rows rendered as ADHD rows. Action Plan virtual adoption could also surface polluted `ADS` rows even when no clean manual action existed.

### Fix
1. Added product-boundary source stamping so ClickUp list-task fetches stamp `list_id/list_name` and imported ads persist `_syncProductId/_syncProductName` plus list identity.
2. Added a shared ClickUp list/product guard to manual sync, live poll, and Clean stale so mismatched product/list links cannot fetch or clean against the wrong list.
3. Added a conservative product-boundary quarantine pass during product load, manual sync, live poll, and Clean stale. It detects active `ads` rows whose ClickUp task ID also exists under another product and whose product signals better match that other product, or whose saved list identity belongs to another product.
4. Quarantined rows are hidden from Creative Tracker, Action Plan virtual/adopted cards, tab counts, angle/persona stats, tracker filters, matrix auto-assignment, and derived status calculations without being hard-deleted during normal load.
5. Clean stale now treats confirmed quarantined rows as removable even when they are action-linked, and removes linked `manual_actions` rows during the confirmed cleanup so wrong-product Action Plan rows do not survive after their stale ad is removed.
6. Product switches reset the quarantine map so one product's hidden rows cannot temporarily affect another product while cached data renders.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- Static checks confirm product-boundary quarantine is wired into product load, manual sync, live poll, Clean stale, Creative Tracker, Action Plan resolution, tab counts, taxonomy stats, tracker filters, and matrix auto-assignment.
- Static checks confirm `syncClickUp()`, `pollFullSync()`, and `cleanStaleAds()` all call the shared ClickUp list/product guard before fetching.
- Static regression checks confirm Clean stale still uses modal confirmation, Bug 24 lowercase `assigned` status handling remains present, and no `Untested -> to do` status map was reintroduced.

---

## Bug 30 — Moved creatives stayed assigned to their old matrix cell
**Status:** ✅ done — fixed 2026-07-08; sync hardening added 2026-07-09
**Reported:** 2026-07-08
**Surface:** Creative Tracker inline Angle/Persona edits → Creative Matrix cells

### Symptom
- Two `Founding Member` tasks moved to `Canva Mastery Buyers` still appeared in the old `Side-Hustle Sellers 22-45` cell.
- The ad rows had the correct persona, but the old matrix cell still counted/rendered the same task ids.

### Root cause
Matrix placement is stored separately from the ad's canonical `angle` / `persona` fields in `matrix_cells.creative_assignments` and per-cell metadata.
The inline move path only removed the creative from the one old cell implied by the current ad fields.
If the creative was already present in another stale cell assignment, that extra assignment survived.

The general orphan purge intentionally does not remove every mismatch between `ad.angle/persona` and cell placement because the app supports intentional per-cell production clones and manual picker flows.

### Fix
1. Added `_removeCreativeFromNonCanonicalCells(adId, targetAngle, targetPersona)` to remove a moved creative from every non-target matrix cell and clear its stale per-cell metadata.
2. Wired the helper only into canonical Creative Tracker angle/persona edits, preserving the Add Creative picker and production-clone behavior.
3. Broadcast and directly upsert changed matrix cells so peers and Supabase see the move cleanup quickly, then keep the normal `saveState()` snapshot as the full persistence backstop.

### Follow-up — 2026-07-09
`CIM-FM-01` reproduced the same duplicate-cell symptom after its persona changed through a non-Creative-Tracker path.
The first fix only covered the Creative Tracker dropdown path.
Action Plan custom-field edits, generic custom field saves, realtime field-update echoes, manual Sync, and background ClickUp poll could still mutate `ad.angle` / `ad.persona` directly without clearing old matrix cell assignments.

Follow-up fix:
1. Added `_syncCanonicalCellAssignmentForAd(ad, options)` as the shared invariant for canonical angle/persona changes.
2. Kept `ad.id` in exactly its canonical `ad.angle × ad.persona` matrix cell and removed it from every other cell.
3. Wired the shared helper into Creative Tracker inline edits, Action Plan tag edits, generic custom-field saves, realtime field-update echoes, manual Sync existing-task updates, and background poll existing-task updates.
4. For user edits, changed cells are broadcast and directly upserted. For background sync, the in-memory matrix is corrected and the normal `saveState()` flush persists the change.

### Follow-up — 2026-07-09 sync canonicalization
Some older duplicate assignments could still survive because they did not require a current angle/persona field change during the sync that loaded them.
The per-ad mutation helper fixed future moves, but manual/background sync also needs a whole-product pass that treats ClickUp's current angle/persona as canonical for every active ClickUp-backed ad.

Sync hardening:
1. Added `_reconcileSyncedAdsToCanonicalCells(options)` to scan active ClickUp-linked ads after import/poll merges.
2. For each synced ad, it calls `_syncCanonicalCellAssignmentForAd()` so the ad remains only in its canonical `angle × persona` cell and gets removed from stale cells.
3. Wired the reconciliation into manual `syncClickUp()`, the end of `importTasksFromClickUp()`, and `pollFullSync()` after product-boundary quarantine.
4. Scoped the reconciliation to ClickUp-backed ads only and skipped product-boundary quarantined rows so local-only/manual matrix work is not swept away by sync.
5. Ran a live data repair for the existing duplicates: 23 active synced ads were cleaned, removing 25 stale cell references across 14 matrix cells.

### Verified
- `immuvi-command-center.html` script parses cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm the move helper is present, the inline angle/persona editor calls it, cell assignment broadcast remains available, Clean stale modal code remains present, lowercase `Assigned` status handling remains present, and no `Untested -> to do` map was introduced.
- Live data repair confirmed `Founding Member × Canva Mastery Buyers` keeps `AD-1783077201511` / `AD-1783077282760`, while `Founding Member × Side-Hustle Sellers 22-45` now only keeps `AD-1783071530496`.
- Follow-up live data repair confirmed `CIM-FM-01` / `AD-1783071530496` remains only in `Founding Member × Canva Mastery Buyers` after its canonical persona changed there.
- Product-scoped live audit after the broader repair found 3,668 active ClickUp-backed ads and `0` duplicate/stale synced cell placements.

---

## Bug 31 — Inspiration queue rows failed but still displayed as Queued
**Status:** ✅ done — fixed 2026-07-11
**Reported:** 2026-07-11
**Surface:** Inspirations queue + distributed classifier worker

### Symptom
- Canva inspirations `C-INS-001`, `C-INS-060`, and `C-INS-061` appeared stuck as `Queued` while the Mac mini worker showed `idle`.
- Live `inspiration_queue` rows were actually `failed`, but matching `inspirations` rows still had `status: Queued`, so the table/count badge hid the real failure.

### Root cause
1. The Inspirations table rendered the persisted `inspirations.status` and did not merge the latest `inspiration_queue.status` for pending/classifying/failed rows.
2. The pipeline refresh counted queue failures but did not populate `window.INSPIRATION_QUEUE`, so the row renderer could not reliably display queue-state truth.
3. The classifier worker preferred Claude whenever it was installed. If Claude was logged out or returned 401 credentials errors, it did not fall back to Codex even when Codex was available.

### Fix
1. Load current `inspiration_queue` rows during `loadInspirations()` and the pipeline pulse refresh.
2. Render queue status as the visible row status for pipeline rows: `pending/processing → Queued`, `claimed/classifying → Classifying`, `failed → Failed`.
3. Exclude failed queue rows from the local queued counter.
4. Added `Queued`, `Classifying`, and `Failed` to the Inspirations status filter.
5. Added worker fallback: on agent authentication failures, retry the same classify prompt with the alternate installed agent before marking the queue attempt failed.

### Live repair
- Corrected malformed `C-INS-001` URL to `https://www.facebook.com/ads/library/?id=843318062124216`.
- Requeued `C-INS-001`, `C-INS-060`, and `C-INS-061` with clean attempts/error state.

---

## Bug 32 — Inspiration table header/count rendered but rows were blank
**Status:** ✅ done — fixed 2026-07-11
**Reported:** 2026-07-11
**Surface:** Inspirations tab table renderer

### Symptom
- Inspirations tab showed the toolbar, table header, and result count such as `56 / 56`.
- The table body was empty, so no inspiration rows were visible even though the data had loaded.

### Root cause
Bug 31 introduced `_insQueueDisplayStatus()` so the Inspirations UI could display live queue truth (`Queued`, `Classifying`, `Failed`) instead of stale `inspirations.status`.
That helper was accidentally declared inside `getQueuedItems()`, but `renderInspirations()` called it from outside that local scope.

The result was a `ReferenceError` during row rendering: the outer chrome and count could update, then the renderer stopped before writing rows into `#insTbody`.

### Fix
1. Moved `_insQueueDisplayStatus(ins, queueByInsId)` to shared scope near the queue helpers.
2. Kept the same queue-status behavior from Bug 31.
3. Passed `renderInspirations()`' existing `queueByInsId` lookup into the helper so row filtering, sorting, and status badges use the same queue snapshot.

### Verified
- `immuvi-command-center.html` script blocks parse cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Browser smoke test confirmed a mocked classified inspiration renders one `#insTbody tr[data-ins-id]` row and updates the result counter without `_insQueueDisplayStatus` / `ReferenceError` console errors.
- Static check confirms Bug 31 behavior remains wired: queue rows still load into `window.INSPIRATION_QUEUE`, `Queued` / `Classifying` / `Failed` remain in the status filter, failed queue rows remain excluded from the queued counter, and the table renderer still derives visible status from queue state.

---

## Bug 33 — ClickUp bullet-prefixed angle values created duplicate Angle rows
**Status:** ✅ done — fixed locally 2026-07-11
**Reported:** 2026-07-11
**Surface:** ClickUp sync / auto-discovered taxonomy / Angles tab

### Symptom
- KIDS LIFE SKILL Angles tab showed duplicate-looking angle rows with leading hyphens, e.g. `- Future consequence` beside `Future Consequence`.
- The app treated the hyphenated values as new angles and auto-added them.

### Root cause
ClickUp task data contained angle values copied from list/bullet text, such as `- Future consequence`.

The taxonomy normalizer only stripped trailing legacy status-badge fragments such as `⭐ Winner`; it did not strip leading list markers.
Also, auto-discovery compared raw lowercased names, so `Future Consequence` and `- Future consequence` had different lookup keys.
Even after stripping the dash, casing differences such as `Future consequence` vs `Future Consequence` could split exact-match stats unless the incoming value was canonicalized to the existing row's casing.

### Fix
1. `_normalizeTaxonomyName()` now strips leading bullet/list markers (`-`, en/em dash, `•`, `*`) before stripping old status badges.
2. Added `_taxonomyLookupKey()` and `_canonicalTaxonomyName()` so incoming taxonomy values compare by normalized key and reuse the existing Angle/Persona row's casing.
3. Wired canonicalization into ClickUp task parsing, auto-discovery, strategist recommendation approval, Action Plan inline Angle/Persona edits, generic custom-field edits, realtime custom-field updates, description hydration, and cleanup taxonomy parsing.

### Live audit
- Found 3 active KIDS LIFE SKILL ads with dash-prefixed angles:
  - `86d2q44vg` → `- Dysregulated kid` (matches existing `Dysregulated kid`)
  - `86d2pddgv` → `- Future consequence` (matches existing `Future Consequence`)
  - `86d29zvud` → `- wanting your child to be more independent` (new clean candidate: `wanting your child to be more independent`)
- Assignment audit found 4 active KIDS LIFE SKILL matrix placements currently pointing at non-canonical angle/persona cells:
  - `86d2q44vg` is assigned under `- Dysregulated kid × - Persona 1 - Age 35-44 , F, Overwelmed MOM`; canonical target is `Dysregulated kid × Persona 1 - Age 35-44 , F, Overwelmed MOM`.
  - `86d2pddgv` is assigned under `- Future consequence × - 35 to 44, Female, MOM`; canonical target is `Future Consequence × 35 to 44, Female, MOM`.
  - `86d3ddhmw` is assigned under `School doesn't teach this × Mom raising kids`; canonical target is `School Doesn't Teach This × Mom raising kids`.
  - `86d3dbw8q` is assigned under `Raising independent kids × Mom raising kids`; canonical target is `Raising Independent Kids × Mom raising kids`.

### Live repair
- Repaired KIDS LIFE SKILL Supabase data on 2026-07-11 without pushing code.
- Updated 8 active ad rows to clean/canonical Angle and Persona values, including the `_customFields` mirrors in `ads.meta`.
- Merged matrix cell assignments into canonical cells and removed duplicate/stale non-canonical cell rows.
- Removed duplicate hyphenated Angle rows when a clean equivalent existed, and renamed the unique hyphenated Angle row to `wanting your child to be more independent`.
- Removed/renamed the hyphenated Persona rows to clean names.
- Final verification, including a delayed re-check after stale-client writeback risk:
  - `0` bad ad taxonomy values.
  - `0` bad Angle rows.
  - `0` bad Persona rows.
  - `0` bad matrix cells.
  - `0` misassigned creatives.

### Verified
- `immuvi-command-center.html` script blocks parse cleanly via Node `new Function()` extraction.
- `git diff --check` passed.
- Static checks confirm taxonomy canonicalization is wired into auto-discovery, ClickUp task parsing, Action Plan inline edits, generic custom-field edits, realtime custom-field updates, and cleanup taxonomy parsing.
- Dynamic helper check confirms:
  - `- Future consequence` canonicalizes to existing `Future Consequence`.
  - `— Dysregulated kid` canonicalizes to existing `Dysregulated kid`.
  - `• wanting your child to be more independent` becomes clean `wanting your child to be more independent`.
  - Existing status-badge cleanup still works for `Future Consequence ⭐ Winner`.
- Follow-up helper check confirms duplicate lookup prefers the clean existing row if both `Future Consequence` and `- Future consequence` exist locally.
- Live data verification after repair stayed clean after a 6-second delayed check.

---

## Bug 34 — Winner Variation and ClickUp rows rendered as duplicate creatives for the same task
**Status:** ✅ done — fixed locally 2026-07-11
**Reported:** 2026-07-11
**Surface:** Creative Matrix cell modal / Creative Tracker / ClickUp sync

### Symptom
- In `KIDS LIFE SKILL`, the task `kids life - 12991/9821 (2 winner) - V16 - Production Style` showed twice in the same cell:
  - once as a Winner Variation row (`86d2pa55v-V16`)
  - once as a ClickUp-imported row (`86d3c637y`)
- After the teammate changed the ClickUp task status to `Mild Winner`, both app rows reflected that same status, proving they represented the same ClickUp task.

### Root cause
Older fixes repaired duplicate `MANUAL_ACTIONS` rows and stale `sourceAdId` links, but did not collapse duplicate `ADS` rows.

So when the same ClickUp task existed as both:
- the app-created local variation id, e.g. `86d2pa55v-V16`
- and the ClickUp task id, e.g. `86d3c637y`

`pollFullSync()` updated both rows in place instead of treating them as the same creative. That let the modal/table render both origins (`Winner Variation` and `ClickUp`) for one underlying task.

### Fix
1. Added `_collapseDuplicateClickUpAds()` to group active ads by `_clickupId` / `clickupTaskId`.
2. The collapse keeps the app-created variation row when present, preserving `Winner Variation`, parent id, variation number, Action Plan links, and matrix placement.
3. It remaps:
   - `CELL_CREATIVE_ASSIGNMENTS`
   - `MATRIX_CELL_META`
   - `MANUAL_ACTIONS.sourceAdId`
   - `MANUAL_ACTIONS.adId`
4. Wired the collapse into:
   - initial load
   - manual ClickUp import
   - live ClickUp polling
   - save flush boundary

### Live repair
- Repaired KIDS LIFE SKILL Supabase data on 2026-07-11 without pushing code.
- Kept the correct Winner Variation rows:
  - `86d2pa55v-V15` with ClickUp task `86d3c637d`
  - `86d2pa55v-V16` with ClickUp task `86d3c637y`
  - `86d2pa55v-V17` with ClickUp task `86d3c63e6`
- Hard-deleted only the duplicate app rows keyed by ClickUp id:
  - `86d3c637d`
  - `86d3c637y`
  - `86d3c63e6`
- Did not soft-delete/tombstone those ClickUp ids, because they are real ClickUp tasks and must continue syncing.
- Remapped 1 manual action and 1 matrix cell that still referenced the duplicate ClickUp-key rows.

### Verified
- Live verification after repair:
  - `0` active duplicate ClickUp-id groups.
  - `0` stale matrix-cell references to the removed duplicate rows.
  - `0` stale manual-action references to the removed duplicate rows.
  - `V16` remains visible as a single Winner Variation row with status `Mild Winner`.

---

## Bug 35 — Canva Command HQ showed angles/personas from other products
**Status:** ✅ done locally — fixed and repaired 2026-07-11; not pushed yet
**Reported:** 2026-07-11
**Surface:** Command HQ coverage intelligence / ClickUp sync / Clean stale

### Symptom
- Canva Command HQ showed foreign Angle/Persona rows such as Herbal Healing Bundle, ADHD, Phonics/Nursing, and other product taxonomy.
- The user had already run Clean stale, and the rows were not shown as stale data.

### Root cause
This was a third product-boundary leak, separate from the stale-cell and duplicate-creative bugs.

The contaminated Canva rows were real `ads` rows stored under Canva's `product_id`, but their ClickUp custom field said `Product = Herbal Healing Bundle`.
The previous guards only checked:
1. source ClickUp list id/name,
2. duplicate ClickUp ownership in another product,
3. `_syncProductId` stamps.

Those Herbal rows did not trip those checks, so Clean stale protected them when they still had product-local references, then the orphaned Angle/Persona master rows remained visible after the rows were removed.
Archived zero-count ADHD personas were also still present as product taxonomy rows, so Command HQ counted/rendered them even though no active Canva creatives used them.

### Fix
1. Added ClickUp Product custom-field enforcement to `_applyProductBoundaryQuarantine()`.
2. Added `_adDeclaredProductName()` to read `product`, `Product`, `product name`, `product profile`, and object/array-shaped custom field values.
3. Added `_productNameMatchesDeclaredField()` so rows whose declared ClickUp Product does not match the active product/list aliases are quarantined before rendering or sync reconciliation.
4. Kept the check conservative: valid Canva aliases such as `Canva`, `Canva Mastery`, or `Canva Mastery - Scripts` still pass.

### Live repair
- Soft-deleted 5 active Herbal Healing Bundle rows that were stored under Canva:
  - `86d3ehkuq` / `HH-026-INS-015`
  - `86d3ddn35` / `HH-025-INS-013`
  - `86d3d5pbp` / `HH-024-HHH - 13605-1`
  - `86d3d2vxj` / `HH-022-HHH - 13605-1`
  - `86d3ehkuf` / `HH-027-INS-014`
- Updated their `deleted_ads` tombstones with ClickUp task ids so sync will not resurrect them into Canva.
- Deleted 6 zero-use foreign Angle rows from Canva.
- Deleted 12 zero-use foreign Persona rows from Canva, including the archived ADHD rows and the Herbal/Phonics/Nursing rows.

### Verified
- Live verification immediately after repair and after a 7-second delayed re-check:
  - `0` active `HH-*` rows in Canva.
  - `0` active Canva rows whose ClickUp Product field declares a non-Canva product.
  - `0` remaining known foreign Angle rows.
  - `0` remaining known foreign Persona rows.
  - Canva taxonomy count is back to `9` angles and `8` personas.
- `immuvi-command-center.html` inline script blocks parse cleanly via Node `new Function()` extraction.
- `git diff --check` passed.

---

## Bug 36 — Dash/case taxonomy duplicates came back from stale KIDS LIFE snapshots
**Status:** ✅ fixed locally 2026-07-11; needs deploy before final repair will stick
**Reported:** 2026-07-11
**Surface:** KIDS LIFE SKILL Command HQ / ClickUp sync / Creative Matrix save

### Symptom
- KIDS LIFE SKILL still showed duplicate Angle rows such as:
  - `Future Consequence` and `Future consequence`
  - duplicate `Dysregulated kid`
  - duplicate `wanting your child to be more independent`
- ClickUp task `kids life - 13032` had blank `Angle`, dashed `Angle Tag`, and description text `Angle - Future consequence`, so it kept appearing under the lower-case duplicate.

### Root cause
Bug 33 fixed the main ClickUp parse and auto-discovery paths, but two holes remained:
1. `parseClickUpTask()`'s description fallback used `_normalizeTaxonomyName()` instead of `_canonicalTaxonomyName()`, so a task with blank Angle/Angle Tag could still create `Future consequence` from the description even when `Future Consequence` already existed.
2. `saveProductData()` persisted whatever duplicate taxonomy rows, custom-field mirrors, and matrix-cell keys were already in a browser's memory. A stale production tab rewrote the old bad snapshot after the live repair, recreating duplicate Angle rows and empty dash-prefixed matrix cells.

### Fix
1. `_canonicalTaxonomyName()` now chooses the preferred existing row for a normalized taxonomy key, preferring non-bulleted and older existing taxonomy rows.
2. Added `_dedupeTaxonomyItems()` and wired it into product load and save so duplicate Angle/Persona rows collapse before UI use or Supabase upsert.
3. Changed the description fallback in `parseClickUpTask()` to canonicalize against existing Angles/Personas.
4. Added save-time AD taxonomy scrubbing so `ad.angle/ad.persona`, `_customFields`, and string-shaped `_customFieldsRaw` mirrors are written with the canonical value.
5. Added save-time matrix-cell key canonicalization so dash-prefixed or lower-case cell keys merge into the canonical cell instead of being re-upserted.

### Live investigation
- The first repair deleted 3 duplicate Angle rows, 2 duplicate Persona rows, patched 18 ads, removed 66 empty bad matrix cells, and merged 1 active bad cell.
- A stale/live client then rewrote the old snapshot at `2026-07-11T10:16:06Z`, recreating:
  - `ang-auto-1783762792800-1` / `Future consequence`
  - `ang-auto-1783762792800-2` / `Dysregulated kid`
  - 27 empty dash-prefixed matrix cells
  - dashed `_customFields` mirrors for `86d2pddgv`

### Verified
- `immuvi-command-center.html` inline script blocks parse cleanly via Node `new Function()` extraction.
- `git diff --check` passed.

---

## Bug 37 — Producer worker crashed when Codex moved from Codex.app to ChatGPT.app
**Status:** ✅ fixed locally 2026-07-13; not pushed yet
**Reported:** 2026-07-13
**Surface:** Producer runs / Mac worker pool

### Symptom
- Producer Run `#257` for task `86d3nevgj` (`AR-155-INS-019 - V3 - Full Remake`) failed instantly on `gp-mac-mini`.
- Error: `worker thread crashed: [Errno 2] No such file or directory: '/Applications/Codex.app/Contents/Resources/codex'`.

### Root cause
The task name was not the issue.
The producer worker hardcoded Codex CLI to `/Applications/Codex.app/Contents/Resources/codex`.
Newer installs expose the same CLI under `/Applications/ChatGPT.app/Contents/Resources/codex`.

`gp-mac-mini` was still enabled and allowed to claim producer jobs even though its worker registry reported `"codex": false`, so it claimed the run and crashed before image generation began.

### Fix
1. Added `_resolve_codex_bin()` to check:
   - `CODEX_BIN` env override,
   - `codex` on PATH,
   - `/Applications/ChatGPT.app/Contents/Resources/codex`,
   - `/Applications/Codex.app/Contents/Resources/codex`.
2. Wired worker capability probing, generic agent dispatch, and producer command execution through the resolver.
3. Changed producer execution to fail gracefully with a clear `Codex CLI not found` error if no executable exists.
4. Added a worker-loop guard so workers without Codex do not claim producer runs.
5. Updated setup scripts so they recognize ChatGPT.app as a valid Codex CLI install.

### Verified
- `tools/classify_worker.py` and `team-skill/classify_worker.py` compile with `python3 -m py_compile`.
- `team-skill/setup-mac-worker.sh` and `tools/setup-mac-worker.sh` pass `bash -n`.
- Local machine confirms Codex exists at `/Applications/ChatGPT.app/Contents/Resources/codex`.

---

## Bug 38 — Archived / foreign taxonomy still appeared in Creative Matrix
**Status:** ✅ fixed locally 2026-07-15
**Reported:** 2026-07-15
**Surface:** Creative Matrix / Angle-Persona taxonomy / archive behavior

### Symptom
- Angles and personas from other products could still appear in the Creative Matrix.
- Archived personas could remain visible as matrix columns.

### Root cause
The previous fixes cleaned or quarantined `angles`, `personas`, and `ads`, but the matrix still treated `ANGLE_PERSONAS` as a taxonomy source.
`ANGLE_PERSONAS` is rebuilt from `matrix_cells`, so old assignment-only cell rows could invent persona columns even when the product's `personas` row was archived, deleted, or never belonged to that product.

Live audit on 2026-07-15 confirmed the shape:
- Canva had 61 `matrix_cells` rows whose `persona_id` did not exist in Canva's `personas` table.
- Canva had 37 `matrix_cells` rows whose `angle_id` did not exist in Canva's `angles` table.
- Several products had matrix cells pointing at archived personas.

### Fix
1. Added `_matrixTaxonomyAllowed()` so matrix rendering is anchored to the active product's authoritative `ANGLES` / `PERSONAS` rows.
2. Stopped `deriveMasterPersonas()` from unioning arbitrary names out of `ANGLE_PERSONAS`.
3. Filtered matrix rows, columns, Add Persona dropdowns, active-persona detection, and v3/v4 decision contexts through the same matrix taxonomy guard.
4. Extended `purgeOrphanedMatrixKeys()` to scrub orphan `ANGLE_PERSONAS` links, not only `CELL_CREATIVE_ASSIGNMENTS` and `MATRIX_CELL_META`.
5. Archive actions now force the Matrix archive toggle back to hidden so newly archived rows disappear immediately.
6. Added the missing `archived_at` schema/migration contract for `angles` and `personas`.

### Verified
- Inline scripts compile with `new Function()` extraction check.
- `git diff --check` passes.

---

## Bug 39 — Inspiration Photo/Video type inverted or shown before classification
**Status:** ✅ fixed locally 2026-07-15
**Reported:** 2026-07-15
**Surface:** Inspiration tab / Creative Matrix "From Inspiration" picker / classify-inspiration worker

### Symptom
- Newly added inspirations sometimes showed `Video` for photo posts or `Photo` for video posts.
- In the Creative Matrix picker, queued inspirations could display `Video` before classification finished.

### Root cause
1. The dashboard created queued inspiration rows with `adType: 'Video'`, so any UI that rendered the raw field showed a confident but unverified type.
2. The newer Creative Matrix inspiration picker rendered `i.adType` directly for queued/classifying rows, unlike the main Inspiration table which hides pending classification fields.
3. The classifier contract only required a non-empty `adType`; it did not require a factual downloaded `mediaKind`, so an LLM-style `photo_video` guess could pass worker verification even when it contradicted the fetched media.

### Fix
1. Queued/manual inspiration rows now start with blank `adType` and `mediaKind`.
2. Creative Matrix "From Inspiration" picker renders `—` for pending/failed inspiration type instead of raw defaults.
3. Classification result mapping now derives/stores `mediaKind` and corrects obvious contradictions before saving `adType`.
4. Downloader helper emits factual `media_kind` / `is_video` for TikTok, Instagram, and Facebook media.
5. Worker prompt and server-side verification now require `mediaKind` and reject contradictions like `image + Video`, `carousel + Video`, or `video + Photo`.

### Prevention
- Do not infer media type from `duration_seconds` alone: TikTok photo posts can have slideshow duration, and Instagram reels can probe as `0` when metadata extraction fails.
- Future classifiers must preserve `mediaKind` from the downloader and only use LLM classification for creative style/format labels.
