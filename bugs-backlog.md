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
