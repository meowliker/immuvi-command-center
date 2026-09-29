# Production Local Acceptance

Branch: `qa`. Surface: the Production tab inside the root command center at `/`.
This report concerns the Production feature, not a production deployment.

## Scope and Legacy Comparison

The audit reads `renderProduction`, `_productionItemFromManualAction`,
`rebuildProdFromManual`, the panel markup, drag handlers and add/edit/delete helpers
in `immuvi-command-center.html`. The HTML file is unchanged. The browser reference
executes only the two audited render functions with inert DOM/data, and loads CSS
and local fonts. It never executes legacy startup, authentication or integration code.

| Legacy surface | Next.js outcome |
| --- | --- |
| Production Board heading and Add Task | Restored compact heading and action; refresh remains an accessible icon |
| Three columns and counts | Same structure, 16px gap, compact headers, per-column counts; no duplicate KPI strip |
| Card name, angle/persona, format, funnel and AI Rec | Restored tags and card typography/padding/colors/left border; long names wrap |
| Ten named Format templates | Exact legacy option list retained, separate from Ad type; existing/custom stored values remain selectable |
| Add task | Atomic creative plus linked action, saved format and receipt recovery instead of transient PROD array mutation |
| Drag between columns | Same destination statuses; status select remains the keyboard/touch alternative in Task controls |
| Edit details/status/date/assignments | Compact disclosure exposes guarded editors, status/format selects, source links and task operations |
| Edit/delete helper functions | Legacy renderer does not wire these helpers to cards and transient PROD changes are rebuilt away; Next.js offers durable explicit controls |
| Remove versus delete | Distinct confirmed operations; removal keeps creative/Matrix/ClickUp, creative deletion tombstones local identity with optional remote retry |
| ClickUp creation/recovery/repair | Existing QA-only services, uncertain-create lock and exact identity checks; recovery indicator visible on collapsed cards |

## Intentional Differences

- Mild Winner and Killed are terminal, consistent with Action Plan; legacy render
  and rebuild functions disagree about Mild Winner. Same-column drops are no-ops,
  avoiding unintended status downgrades.
- Local creation persists authoritative records and does not automatically push
  ClickUp or assign Matrix cells. Empty taxonomy/date choices stay empty instead
  of silently choosing the first axis or assigning today's deadline.
- The Format template is action-level `payload.format`, not `ads.ad_type` or the
  creative's name. Existing action format takes precedence on the card; a clear
  falls back to the canonical ad type, matching the legacy display behavior.
- Extra mutation controls live in a keyboard-accessible disclosure. Source links
  are HTTP(S)-validated. Long names wrap rather than being permanently truncated.
- Board regions use 8px corner radii; legacy columns use 12px. Measured core card
  metrics match, but this is not a claim that every screenshot pixel is identical.
- Deletion/quarantine/tombstone guards, stale-version rejection and receipt checks
  are retained even where legacy code did not enforce them.

## Format Persistence

`qa_production_intake` wraps the previously installed atomic creator. It stores the
format in the action and includes it in the same durable request receipt. It also
accepts exact older pending requests without a format key. Receipt replay is
historical: it cannot overwrite later edits or resurrect removed tasks.

`qa_production_format` delegates access, version, identity, lifecycle and unresolved
creation checks to the existing guarded creative-edit function, then changes only
the action format with a history event. It does not change ad type or launch an
external sync. The client verifies the saved field before accepting the response.

Installed only migration `20260924020000_qa_production_formats` in QA project
`entgcnlfsnysnwyadzzp`. Readback verified migration registration, authenticated
execution, anonymous denial and no remaining fixture user/product. No existing
records or worker configuration were changed by installation.

## Verification

- 409 domain/service tests pass, including legacy pending-request compatibility
  and exact format receipt verification separately from creative ad type.
- Optimized Next.js build with TypeScript passes.
- All three Production browser suites pass together with 20 mocked mutation
  attempts, no unexpected errors and no external requests. Evidence:
  `/tmp/immuvi-production-final/results.json`.
- Full intercepted admin/member regression passes with 178 mocked mutation
  attempts, no unexpected browser errors and no external requests, including
  shared-dialog focus behavior and all prior feature workflows. Evidence:
  `/tmp/immuvi-production-acceptance-regression/results.json`.
- Direct legacy CSS comparison matches board gap, card padding/title size/title
  weight/background/left-border width, column background and header font size.
  Format options compare directly with the legacy AST-extracted constant.
- Compact idle cards, expanded controls and long titles fit 320/390/768/1440/1920px.
  Controls are checked for overlap and document/card overflow; screenshots inspected.
- Keyboard disclosure, forward/reverse modal Tab loops, Escape and restored opener
  focus pass. The shared modal hook now explicitly wraps Tab focus instead of
  allowing it to leave the dialog at the native browser boundary.
- Failed form reads show an error and disabled Create, then recover through Retry.
  Cancel/Escape do not write. Format saves survive reload/clear; an inconsistent
  response cannot update the displayed format or trigger ClickUp.
- Held saves disable further mutations, and switching products while a save is
  pending cannot insert the old product's result into the new board.
- Prior suites cover >500-row pagination, lifecycle suppression, stale drag/date
  snapshots, failed reads/retry, lost creation acknowledgements across reload,
  deletion/recovery, pending external sync and retained stale/unverified drafts.
- Rollback-only database tests pass before and after installation: named format
  independent of ad type, repeat receipt, conflicting request rejection, older
  receipts, stale format versions, clearing, historical replay and non-resurrection.

## Backlog Audit

| Backlog | Local evidence | Remaining external evidence |
| --- | --- | --- |
| 5: blank descriptions/custom fields | Shared scoped creation/field services, preserved brief, assignment and zero-value tests | Real destination-list field/description readback |
| 15: missing Product field | Existing QA destination/product guards and creation service tests; no new alternate push path | Test-list Product field readback |
| 47: disappearing due date | Canonical linked date, explicit clear, status move and reload tests; shared guarded save | Live ClickUp due_date delivery/retry |
| 48: stale angle in description | Shared cell identity resolver and same-source creation service; no Production-specific description builder | Real test-list description/custom-field agreement |
| 49: stale product context | Late read and late save product-isolation browser checks | Deployed multi-user/RLS acceptance in milestone 12 |
| 51: deleted tasks return | Tombstones, separate remove/delete, remote retry after reload, no read adoption or receipt resurrection | Live ClickUp deletion/recovery and real multi-user checks |
| 52/53: wrong statuses/missing fields | Existing destination-list-scoped schema/status services reused | Actual list schema/status/custom-field readback |

These checks are not a blanket claim that every historical backlog issue is fixed
by using Next.js. Unrelated worker, taxonomy, admin and live-service issues retain
their existing milestones and gates.

## External Gates and Safety

- All three local Production batches are complete; zero local finish batches
  remain. Next implementation milestone: 10, Command HQ. Production's live
  acceptance gate remains open, so overall counts remain 6/13 fully closed.
- Real ClickUp verification is restricted to approved test list `901616718146`;
  mocked browser success does not establish remote delivery.
- User visual/behavioral sign-off and deployed multi-user security acceptance remain.
- OneScale launch and classifier dispatch remain disabled; no isolated OneScale
  test destination has been supplied.
- No production database, legacy HTML, environment or deployment configuration
  changes. No commit, push or deployment. The local preview remains at `/`.
