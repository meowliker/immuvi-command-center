# Inspiration Migration

Step 8 of the existing 13-milestone plan. Work remains local on `qa` at `/`.
The legacy dashboard is the reference, not an iframe or a replacement route.

## Three Acceptance Batches

1. **Complete: library and details.** Product-scoped paginated library, queue-state
   reconciliation, filters/sorting, provenance/brief/usage drawer, realtime,
   error recovery, keyboard and responsive verification.
2. **Complete locally: intake and mutations.** URL/manual intake, duplicate review, editable fields
   and rename, approval, deletion, retry/repost state reset, classification-result
   import and worker-health/QA-destination guards. Preserve the classifier's
   existing eight-section brief contract and server-owned fields.
3. **Complete locally: placement/imports and acceptance.** Suggested/custom Matrix placement,
   cross-product imports, insights/trends/Pulse, guarded queue-only recovery,
   source-task ad-type synchronization and batch result imports are
   implemented. The final legacy/backlog audit and local regression pass;
   isolated live integration and user sign-off remain open.

These are three batches within milestone 8, not additional project milestones.
No worker is enabled or dispatched by the QA migration. Intake/requeue deliberately
remain blocked until an isolated QA classifier is verified.

## Batch 1 Implementation

- Replaced the queue-only default with the Inspiration library. Library/Queue
  are internal views in the same command-center tab. The queue monitor remains
  available; no temporary route was introduced.
- Added a compact table following the legacy column order and density, with
  a sticky ID column, stable sorting, seven facets, searchable identifiers,
  filter chips/reset, result totals, and contained horizontal scrolling.
- Added the shared-style overlay drawer with classification, hypothesis, notes,
  body copy, available voice-over text, source/brief links, duplicate metadata,
  imported provenance, and creative/cell usage. This batch does not offer
  mutation controls or claim that duplicate review/placement is finished.
- Reads use stable 500-row pages for inspirations, queue, ads, tombstones and
  Matrix cells. The queue monitor no longer silently stops at 80 rows. Projected
  data is scoped to the captured product; stale product requests cannot commit.
- Queue-only records with inspiration IDs remain visible. The newest queue
  record determines pending/classifying/failed/worker-blocked labels. A failed
  request retains previously loaded rows and reports an error; it is not an
  empty successful library. Primary-key realtime deletion refreshes the scope.
- Usage excludes foreign, deleted, tombstoned and quarantined creatives and
  counts distinct Matrix cells. Filters and open details survive realtime
  updates; deleted details close after refreshed data confirms removal.
- Media evidence corrects image/video inversion, while pending/failed/blocked
  items have no invented media type. Brief text is plain React text, `<br>` is
  normalized to line breaks, unavailable-transcript placeholders are omitted,
  and unsafe URL schemes/embedded credentials are not rendered as links.

## Backlog Boundaries

- Bugs 31/32: failed queue labels and populated library rows are covered locally.
- Bug 39: stored media-kind correction and no premature type are covered locally.
- Bugs 45/46: failed versus worker-blocked display is covered. Actual retry reset,
  worker-health contracts, and claim/dispatch behavior belong to batch 2.
- Bug 49: read scoping and delayed product-switch responses are covered. Historical
  prefix/data repair and write-side product validation are not proved by this batch.
- Bugs 50/61: plain body-copy line breaks and unavailable-transcript suppression
  are covered. Audio transcription, CTA normalization, classification content,
  and eight-section generated brief quality remain worker/integration acceptance.
- No existing Supabase/ClickUp data was repaired or mutated by these checks.

## Batch 1 Verification

- 327 domain/service tests pass, including eight new library/read tests.
- TypeScript and the optimized Next.js build pass.
- Focused intercepted browser acceptance passes with zero mutations, unexpected
  browser errors, or external requests. It covers 502 visible records, all seven
  combined facets, identifier search, sorting, queue-only failure/block states,
  scoped usage, literal text/links, live drawer preservation, failure/retry,
  deletion, late product responses, and 320/390/768/1440px layouts.
- Screenshot checks wait for the drawer animation to finish; settled desktop
  and mobile screenshots were inspected. This is not a blanket pixel-identical
  or live-backend acceptance claim.
- Focused evidence: `/tmp/immuvi-inspiration-library-settled/results.json` and
  adjacent screenshots. The full admin/member regression also passes, with zero
  unexpected browser errors/external requests and the unchanged 99 mocked
  mutation attempts. Evidence: `/tmp/immuvi-inspiration-regression/results.json`.
- Production HTML, environment and deployment configuration, and OneScale
  callback files are unchanged. No commits, pushes, deployments, SQL migrations,
  live backend writes, or worker dispatches were performed.

## Batch 2 Implementation

- Added URL and manual intake, editing/rename, approval, duplicate review,
  confirmation-based deletion, retry/reset, and explicit stored-result import.
  All controls live inside the existing Inspiration tab and overlay dialogs.
- Added one QA-only RPC with authenticated product access, protected JSON-field
  merging, row/queue/linked-creative version checks, active-job rejection, and
  transactional request receipts. A lost acknowledgement can be retried with
  the same request ID without repeating a create, delete, import or queue reset.
  Ambiguous responses retain/freeze the draft; definite conflicts keep it editable.
- Intake keeps legacy product-prefix/sequential IDs under a prefix lock, rejects
  duplicate source URLs, and scopes all records to the captured product. Renames
  and imported name changes update eligible linked creatives and Action Plan
  titles atomically. Existing guarded QA ClickUp pushes handle remote names;
  failed/missing-token pushes remain pending in Creative Tracker.
- URL intake and retry always write `status=blocked` and
  `worker_assignment=blocked:qa-isolation`. Retry clears claims, attempt counts,
  processed timestamps and old errors, replacing them with the isolation reason.
  No health-check failure can fall through into claimable work.
- Imports require an exact same-product/source/result timestamp, reject results
  older than a retry or already imported, validate required classification/brief
  sections and three script structures, and preserve the complete stored brief.
  Classifier-owned document fields survive manual edits and imports without a new
  document URL. Import does not create global Angle/Persona taxonomy.
- Deletion removes only the selected inspiration, queue row and stored result;
  downstream creatives, Action Plan records and ClickUp tasks remain intact.
  Duplicate review retains its match evidence. A successful save refreshes the
  current row before closing, avoiding stale snapshots on the next quick action.

## Batch 2 Verification And Limits

- 334 domain/service tests pass; TypeScript and the optimized Next.js build pass.
- QA SQL transaction fixtures pass for product denial, duplicate URLs, receipt
  replay/collision, protected fields, stale row/queue/creative snapshots, active
  jobs, blocked retry/reset, atomic rename propagation, approval, duplicate
  evidence, incomplete/complete import and source-only deletion. Fixtures and
  test DDL were rolled back. The tested migration was then applied only to
  `entgcnlfsnysnwyadzzp` and recorded as `20260922010000`.
- Focused intercepted browser acceptance passes with 11 mocked mutation attempts,
  zero unexpected errors/external requests, lost-ack replay, retained stale drafts,
  the full mutation sequence, and 320/390/768/1440px editor bounds. Screenshots
  were inspected. Evidence: `/tmp/immuvi-inspiration-mutations/results.json`.
- Full intercepted admin/member regression passes with 110 mocked mutation
  attempts, zero unexpected browser errors and zero external requests.
  Evidence: `/tmp/immuvi-inspiration-mutations-regression/results.json`.
- Read-back confirms the QA migration is recorded, authenticated RPC access is
  granted, anonymous execution is denied, and direct receipt reads are denied.
- Queue-only historical rows remain inspectable but read-only. Their recovery,
  source-task ad-type push parity, batch result-import ergonomics and complete
  legacy visual/backlog comparison remain final batch acceptance checks, not
  proof supplied by this mutation flow. Generated brief content/audio quality,
  live classification and live ClickUp pushes remain integration acceptance.
- Only the QA schema was changed. No existing user data repair, production change,
  worker enablement, OneScale launch, commit, push or deployment was performed.

## Batch 3 Progress: Matrix Placement

- Added the legacy drawer's suggested-cell action and custom Angle/Persona
  selectors without a new page. Suggestions require unique active canonical
  taxonomy matches in the current product; missing/ambiguous matches are not
  guessed or created. Custom selections survive realtime refreshes and archived
  choices remain visible as unavailable rather than silently changing destination.
- Shows cell totals, testing/winner counts and already-placed state. Destination
  reads are paginated and use canonical Matrix membership, excluding foreign,
  quarantined, deleted, tombstoned and explicitly removed creatives. Read errors
  disable placement and offer retry. Drawer keyboard navigation includes selects.
- Reuses `qa_matrix_create`: independent creative naming, source/brief provenance,
  atomic assignment and existing request recovery. The client verifies the saved
  creative's source/product and explicit target-cell assignment before success.
  Lost acknowledgements keep the request and lock destination changes until retry;
  definite conflicts retain the selected cell. Repeating the source in a cell
  does not create another creative. No Action Plan or ClickUp task is auto-created.
- Hardened the same Matrix RPC to reject blocked/unknown source states and
  non-terminal classifier queues, and not reuse quarantined/tombstoned source
  copies. Matrix's own source picker now reconciles queue state and disables those
  sources too. Worker dispatch and OneScale remain disabled.
- 341 domain/service tests, TypeScript and optimized build pass. Rolled-back QA
  SQL checks cover the existing Matrix contracts plus blocked sources/queues,
  lost-ack replay, duplicate placement and lifecycle guards. Focused intercepted
  browser checks pass with four mocked mutation attempts, zero unexpected errors
  or external requests, stale-source retry, unavailable-axis/read recovery and
  320/390/768/1440px bounds. Desktop/mobile screenshots were inspected.
  Evidence: `/tmp/immuvi-inspiration-placement/results.json`.
- Full intercepted admin/member regression passes with 114 mocked mutation
  attempts, zero unexpected browser errors and zero external requests. Evidence:
  `/tmp/immuvi-inspiration-placement-regression/results.json`.
- Migration `20260923010000` was applied only to QA project
  `entgcnlfsnysnwyadzzp`. No existing user records were repaired or migrated;
  transaction fixtures were rolled back. Nothing is committed, pushed or deployed
  to production. The local QA server is running at `http://127.0.0.1:3000/`.

## Batch 3 Progress: Cross-Product Imports

- Added Other Products inside the existing Inspiration tab, with accessible-product
  selection, Inspirations/Winning Formats views, search, sorting, select-visible,
  and a shared selection across both views. No route or embedded HTML was added.
- Copies are destination-owned Inspirations with fresh sequential IDs and reset
  status/dates. Classification content, stored brief/document links and immediate
  source identity are retained; prior import lineage is preserved separately.
  Source queue claims, assignees, duplicate flags and old result receipts are not
  copied. Winning formats must be eligible root creatives, not children, deleted,
  quarantined or tombstoned records, including legacy metadata-only references.
- The QA-only RPC checks authenticated active access to every source and destination,
  uses deterministic product locking, validates the selected source versions and
  classifier state, and commits the entire batch atomically. Exact source/URL
  duplicates are skipped. Request receipts recover a lost reply without another
  copy; changed request identities are rejected. Up to 50 sources per batch.
- Source products remain read-only. Unlike legacy imports, this does not write
  source `reusedIn` arrays or fetch missing briefs from ClickUp automatically.
  Stored brief links and destination provenance are supported now; cross-product
  reuse-count parity and missing remote brief retrieval remain final acceptance
  checks. Import creates no queue, Matrix, Action Plan or ClickUp records.
- Stale conflicts retain selection until an explicit source refresh. Partial read
  failure cannot masquerade as an empty successful list. Product deselection drops
  its selected sources; aborted source reads cannot restore deselected rows.
- All 347 domain/service tests, TypeScript and optimized build pass. Rolled-back
  QA SQL checks cover source/destination denial, stale batch rollback, receipt
  replay/collision, identity/URL duplicates, child/tombstone/blocked-queue guards,
  retained content/provenance, source immutability, and anonymous denial.
- Focused intercepted browser acceptance passes with four mocked mutation attempts,
  no unexpected errors/external requests, mixed selection, lost-reply recovery,
  duplicates, stale refresh, partial-read recovery and 320/390/768/1440px bounds.
  Desktop/mobile screenshots were inspected. Evidence:
  `/tmp/immuvi-inspiration-cross-import/results.json`.
- Full intercepted admin/member regression passes with 118 mocked mutation
  attempts, zero unexpected browser errors and zero external requests. Evidence:
  `/tmp/immuvi-inspiration-cross-import-regression/results.json`.
- Migration `20260923020000` was applied only to QA project
  `entgcnlfsnysnwyadzzp`; no existing user/source records were changed. Worker and
  OneScale launch isolation remain in place. Nothing was committed, pushed or
  deployed; production HTML, environment and deployment configuration are unchanged.
  Read-back confirms the migration ledger entry and authenticated-only execution;
  anonymous execution is denied. The local preview responds at `http://127.0.0.1:3000/`.

## Batch 3 Progress: Insights, Trends And Pulse

- Added same-page Trends and Insights beside Library/Queue, retaining the legacy
  replication funnel, top-eight win-rate groups by Angle/Hook, the thirty most
  recent unused inspirations, and two fourteen-day activity charts. Unused rows
  open the existing drawer and restore trigger focus on close. Analytics retain
  their legacy full-product scope rather than silently inheriting table filters.
- Added the two-period Pulse strip: current Pending/Classifying/Blocked/Failed
  states, today's Classified/Placed activity, and period Classified/Placed/Tested/
  Winners/Killed totals with classified/placed deltas. Single-tile toggle filters
  compose with existing search/facets, including zero-result selections. Clicking
  a tile returns to Library; views, refreshes and drawer changes retain filters.
  Clear-all resets facets/search and the tile; the tile chip clears only the tile.
- Reused the existing calendar popover, eight date presets, validated custom dates,
  cancel/focus behavior and reset. Changing dates updates an active period tile
  without clearing table filters. Today/pipeline tiles keep their independent
  scope. Product changes reset state; the shared minute/focus/visibility clock
  updates date windows even without backend events.
- Counts and tile membership now use the same projected records and predicates.
  Classified requires a real ready record or a Saved record with classification
  evidence, rather than counting every failed/queued/manual row as a success.
  Classification activity uses the existing classifiedAt/created_at fallback;
  both Pulse and Trends use that same timestamp. This deliberately corrects the
  legacy counter/filter disagreement and its separate trend timestamp basis.
- Placed and outcomes count linked creatives, while a tile returns their distinct
  source inspirations. Outcome windows use creative creation time and current
  status, matching the legacy cohort semantics, not historical status transitions.
  Mixed outcomes contribute once to the winner funnel; decided-creative win rates
  retain Complete and the current library's Mild Winner behavior. Unknown rates
  remain unknown rather than becoming zero. Queue-only entries participate in
  pipeline filters, not classified totals, funnels, win rates or trend placements.
- Canonical usage retains legacy creative timestamp/status fallbacks and aligns
  ClickUp tombstone identity precedence with Tracker. Foreign, deleted, tombstoned,
  quarantined and duplicate creatives cannot inflate totals. Invalid/missing/future
  timestamps are excluded from dated counts. Charts use local calendar days across
  DST; custom end dates include their final millisecond. Default deltas compare
  the prior calendar week, and explicit ranges compare the prior equal time span.
- Pulse shows unknown values until loaded. Failed refreshes retain the previous
  snapshot with an error across all three views. Queue/worker inspection reuses
  the existing Queue view; no worker enablement or external call was added.
- All 356 domain/service tests and TypeScript pass. Focused intercepted browser
  checks pass with zero writes, errors or external requests, covering live counts,
  filters, drawer/focus, period drafts/validation/reset, read recovery, clock/product
  reset and 320/390/768/1440px layouts. Desktop/mobile screenshots were inspected.
  Fourteen bars fit narrow screens with sparse labels and no horizontal clipping.
  Evidence: `/tmp/immuvi-inspiration-analytics-final/results.json`.
- Full intercepted admin/member regression passes with 118 mocked mutation
  attempts, zero unexpected errors and zero external requests. Evidence:
  `/tmp/immuvi-inspiration-analytics-regression-final/results.json`. A final
  exact-rate ranking correction is covered by a separate domain regression and
  a rerun of focused browser acceptance; displayed rates remain rounded.
- Work remains local on `qa`. No migration, live backend write, repair, production
  change, commit, push or deployment was performed in this read-only sub-step.

## Batch 3 Progress: Queue-Only Recovery

- Queue rows now open the same Inspiration drawer through Inspect. Missing library
  records have an explicit Recover queue entry confirmation, not automatic repair.
  Successful recovery keeps the original source ID, URL, platform and queued date,
  restores only the source record, and reveals the existing edit/import/requeue/delete
  controls after the refreshed snapshot confirms it exists.
- The dedicated QA-only RPC requires active product access, a complete unchanged
  queue snapshot and a terminal/blocked status. It rejects active/unknown states,
  invalid source URLs, existing IDs, cross-product queue/result identities, foreign
  or ambiguous product prefixes, duplicate library URLs and recorded QA deletions.
  Same-product and source-ID locks plus immutable request receipts prevent duplicate
  restoration on retry. Definite conflicts require closing/reopening the snapshot;
  ambiguous replies keep the original request for safe acknowledgement recovery.
- Recovery places the source and queue in Blocked state with
  `worker_assignment=blocked:qa-isolation` and clears old claims. Attempts, queued
  time and processed time are retained. The complete original queue snapshot is
  stored as protected audit metadata, with its original status/error/worker/attempts
  visible in the drawer. Saved classification results and downstream creatives,
  Action Plan records and ClickUp tasks are not changed by recovery.
- Stored-result import remains a separate explicit action with the existing complete
  brief/source/version checks. Preserving the queued date avoids incorrectly making
  that result stale. Explicit requeue still resets attempts and chronology under the
  existing isolation guard; recovery itself does not reset retry history or dispatch.
- Unknown/missing identities and active claims are not guessed or forcibly cancelled.
  Conflicting IDs/URLs/prefixes and known deletions require separately reviewed data
  repair. The deletion guard covers recorded QA deletion receipts; it cannot prove
  whether a legacy deletion with no retained evidence was intentional.
- All 360 domain/service tests, TypeScript and optimized build pass. Rolled-back QA
  SQL fixtures cover access/snapshot denial, ID/URL/prefix/deletion guards, unchanged
  results/creatives, retained chronology/audit, receipt replay/collision, incomplete
  result rejection, explicit complete-result import and guarded retry. Anonymous
  execution is denied by the migration.
- Focused intercepted browser verification passes with five mocked mutation attempts,
  zero unexpected errors/external requests, Queue inspection, cancellation, lost-ack
  retry, audit/usage preservation, result import, stale conflict/reopen, active-job
  denial, deletion refresh and 320/390/768/1440px bounds. Desktop/mobile screenshots
  were inspected. Evidence: `/tmp/immuvi-inspiration-recovery/results.json`.
- Full intercepted admin/member regression passes with 123 mocked mutation
  attempts and zero unexpected errors/external requests. Evidence:
  `/tmp/immuvi-inspiration-recovery-regression/results.json`. A final Inspect-button
  styling correction reuses existing command styles and is rechecked by the focused flow.
- Migration `20260923030000` was applied only to QA project
  `entgcnlfsnysnwyadzzp`. This installs the function and permissions only; no existing
  user records were recovered or repaired. No commit, push, production deployment,
  production configuration change or worker enablement occurred.

## Batch 3 Progress: Source Ad-Type Sync And Batch Results

- The same-page Inspiration toolbar now has Import Results. It reads the full
  product-scoped result collection, previews the latest result per source, and
  allows an explicit selection of up to 50 eligible sources. Missing/queue-only
  records, active jobs, source mismatches, results older than a retry, already
  imported results and incomplete classifications/eight-section briefs are
  excluded with a reason. It never silently falls back from an incomplete latest
  result to an older complete one.
- Every selected import uses the existing QA mutation RPC, unchanged source,
  queue, linked-creative and result snapshots, and its own immutable receipt ID.
  Imports execute sequentially. Definite conflicts are reported per source while
  other items continue; uncertain acknowledgements stop the batch. Retrying
  recovers that same receipt before proceeding and does not replay confirmed
  imports. The outcome list retains imported/failed/remaining counts. Closing
  and reopening obtains fresh snapshots for definite conflicts.
- Imported format-name changes retain the existing linked creative/Action Plan
  propagation and QA ClickUp name pushes. A failed remote name push is reported
  separately and remains pending in Creative Tracker; it does not turn a saved
  classification into a failed import. No classifier or brief generator runs.
- Editing an inspiration ad type now attempts to update its stored
  `_sourceClickupId`, matching the legacy edit behavior. A missing session key or
  failed remote acknowledgement does not discard the successful local save.
  The drawer also has an explicit, confirmed Sync source ad type action for retry.
- The authenticated QA ClickUp route reads source identity/type from the scoped
  saved record, never from a caller-supplied task ID or value. It checks the exact
  QA Supabase client and test list, rejects foreign-product source provenance,
  validates the current field mapping and unambiguous dropdown option, rechecks
  the local source version before writing, and reads back the remote field before
  reporting success. Only dropdown/text fields are writable. Clearing the type
  is supported; there is no automatic remote write retry or new task creation.
- All 371 domain/service tests and the optimized build (including TypeScript)
  pass. Focused intercepted member browser verification passes with seven mocked
  database mutation attempts, zero unexpected errors/external requests,
  cancellation, selection eligibility, partial success, lost-ack exact replay,
  stale conflict/refreshed retry, local save without a key, explicit sync retry,
  automatic sync and 320/390/768/1440px dialog bounds. Desktop/mobile screenshots
  were inspected. Evidence: `/tmp/immuvi-inspiration-batch/results.json`.
- Full intercepted admin/member dashboard regression passes with 130 mocked
  database mutation attempts, zero unexpected browser errors and zero external
  requests. Evidence: `/tmp/immuvi-inspiration-batch-regression/results.json`.
  The first run exposed a null-ID match in the new test fixture's lost-response
  flag; that fixture condition was corrected before the successful full rerun.
- No database migration, existing-row repair, production change, commit, push,
  deployment or real ClickUp write was needed for this step. Remote acceptance
  remains open: mocked tests do not prove actual test-list field configuration or
  end-to-end ClickUp delivery. Remote/local writes are not one atomic transaction;
  concurrent source edits detected after a remote write require refresh and sync.

### Current Batch 3 Status

All three Inspiration batches are locally complete, including the final workflow
comparison and regression. **Zero local finish batches remain.** Isolated
classifier/brief/audio and live ClickUp acceptance remain open; classifier
execution stays blocked. User visual sign-off and full deployed RLS/security
acceptance belong to the release gates, not more local Inspiration batches.

Overall fully closed milestone count stays 6/13: Action Plan and Inspiration
retain external gates, and milestones 9-13 follow. Next implementation is the
Production tab, milestone 9. See `inspiration-acceptance.md` for deliberate legacy
differences and evidence. The entries below record each earlier batch's status.

## Batch 3 Progress: Legacy Audit, Reuse And Brief Recovery

- Restored Hypothesis, Notes, Ad Copy, Duration, Tags, Reuse and Actions columns,
  direct editor access, format-detail display/search, and structured stored brief
  and script tables. Text remains literal; unverified audio placeholders are
  suppressed without claiming the underlying media has been transcribed.
- Reuse reads actual copies in accessible products, counts each product once,
  follows live deletion, and does not trust legacy cross-import flags or write
  to source products. Accessible source briefs can be inherited read-only.
- Missing remote briefs have an explicit lookup/save command. The authenticated
  QA route derives task identity from saved provenance, verifies source access
  and QA list membership, and reads descriptions/custom fields/comments only.
  Comment history uses both pagination cursors. No ClickUp writes or classifier
  execution occur. The saved destination link uses version checks, a durable
  receipt, same-request recovery after lost responses and no-overwrite guards.
- Found and fixed a duplicate React key that duplicated brief controls after
  realtime refresh. Screenshot inspection also caught a mobile intrinsic-grid
  overflow; fixed it and strengthened section-level browser assertions.
- All 379 domain/service tests, TypeScript and optimized build pass. Focused
  intercepted browser checks pass at 320/390/768/1440px; screenshots inspected.
  Full intercepted admin/member regression passes with 132 mocked database
  mutation attempts, zero unexpected browser errors and zero external requests.
  Evidence: `/tmp/immuvi-inspiration-parity/results.json` and
  `/tmp/immuvi-inspiration-parity-regression/results.json`.
- Rollback-only QA SQL tests cover access, stale versions, unsafe links, receipt
  replay/collision, preserved content, existing primary/fallback links and anon
  denial. Migration `20260923040000` installs only the function/permissions in
  QA project `entgcnlfsnysnwyadzzp`; no existing records or workers were changed.
  Readback confirms migration registration, authenticated execution, anonymous
  denial and removal of both rollback fixture products.
- No commit, push, deployment or production change. This is not final pixel or
  functional parity sign-off. See [the acceptance audit](inspiration-acceptance.md).
  The two remaining sub-steps above and overall 6/13 completed count are unchanged.

## Batch 3 Progress: Inline Editing And Compact Table

- Restored compact legacy column order and default hidden long-text columns,
  including Source before Duration/Status. A column icon exposes detailed fields
  without adding another page. Filter icons/options, relative dates, queue summaries,
  duplicate-review entry and segmented usage match the legacy table's information
  hierarchy. Use/edit/delete actions open the existing guarded same-page controls.
- Inline editing covers format name, angle, persona, structure, hook, production,
  funnel, type, hypothesis, notes and attribution. Existing active product taxonomy,
  canonical options and saved custom values remain available. Custom angle/persona
  text stays local to the inspiration and does not create global taxonomy records.
- Format detail can be edited/cleared inline or in the full editor. The QA extension
  RPC reuses existing access, queue, rename/child-version and receipt safeguards in
  one transaction, preserving brief/provenance and unrelated fields. Simultaneous
  name/detail edits retain the new detail, including embedded delimiters.
- Modal and inline saves share the same local acknowledgement, linked-name push
  and source-type sync handling. Inline drafts retain their original version across
  refresh; stale saves are rejected without losing text. An edited row is retained
  if live changes filter/delete it, preserving the mounted editor and retry receipt.
  Uncertain acknowledgements retry the same request and lock draft changes.
- Deliberate interaction difference: explicit icon Save/Cancel instead of saving
  on blur. Enter submits, Shift+Enter retains multiline input, Escape cancels, and
  IME composition does not prematurely submit. No exact pixel-parity claim is made.
- 383 domain/service tests and optimized build including TypeScript pass. Focused
  inline/brief checks pass with 17 mocked attempts; full intercepted admin/member
  regression passes with 147, zero unexpected errors and zero external requests.
  Desktop/mobile table and drawer screenshots were inspected at
  320/390/768/1440px. Evidence: `/tmp/immuvi-inspiration-inline/results.json` and
  `/tmp/immuvi-inspiration-inline-regression/results.json`.
- Rollback-only QA SQL tests pass for access denial, stale parent/child versions,
  protected-field denial, combined rename/detail, receipt replay/collision, content
  preservation, detail clearing, active queue refusal and anonymous denial.
  Migration `20260923050000` was applied only to `entgcnlfsnysnwyadzzp`; no existing
  user records or worker settings changed. Readback confirms registration,
  authenticated-only execution and rollback fixture cleanup. No push, commit, deployment, environment
  change or production modification occurred.
- Inline/table implementation is complete for this batch. The existing local
  acceptance sub-step still needs the legacy taxonomy suggestion/remapping and
  duplicate-related navigation comparison; isolated live acceptance is separate.
  Overall remains 6/13 closed, 7 open. See the acceptance report for boundaries.

## Batch 3 Progress: Taxonomy Mapping And Duplicate Navigation

- Added same-page Angle/Persona mapping dialogs and scoped similarity suggestions.
  Choices are existing active taxonomy, custom inspiration-only label, and explicitly
  confirmed new product taxonomy entry. Cancel writes nothing; global promotion
  is never an automatic consequence of a regular inline custom-label edit.
- Mapping retains source and target snapshots, checks product access/queue state,
  rejects archived or concurrently changed targets and duplicate normalized names,
  clears review flags, and preserves unrelated source content. New taxonomy insert,
  inspiration save and durable receipt commit atomically. Lost acknowledgements
  retry the identical request; related creatives are not retagged.
- Duplicate detail links use current product-scoped creative metadata. Unavailable,
  foreign, deleted, quarantined, tombstoned and ambiguous references are disabled.
  Valid links open the existing Creative Tracker editor within `/`, with a second
  availability check on load. No external task changes or new pages are introduced.
- Added Tracker tombstone reads and live invalidation so a stale related link cannot
  reintroduce a deleted creative into the inventory. Browser checks cover a deletion
  between opening duplicate review and loading Tracker.
- 387 domain/service tests, TypeScript and optimized build pass. The focused browser
  run passes with five mocked attempts, zero unexpected errors/external requests.
  Mapping dialogs fit 320/390/768/1440px; mobile/desktop screenshots were inspected.
  Evidence: `/tmp/immuvi-inspiration-mapping/results.json` and adjacent images.
- The full intercepted admin/member regression passes with 152 mocked mutation
  attempts, zero unexpected browser errors and zero external requests. Updated
  the analytics test to assert the Angle select's value rather than the entire
  cell's accessible text after adding mapping controls. Added alias-collision
  coverage to prevent duplicate creative entries. Related-creative drawer bounds
  and screenshots also pass at 320/1440px. Full evidence:
  `/tmp/immuvi-inspiration-mapping-regression/results.json`.
- Rollback-only QA SQL tests pass for access, source/target versions, preserved
  content, custom-label isolation, new-entry atomicity, replay/collision, normalized
  duplicate/archived-name refusal, active queue refusal and anonymous denial.
  Migration `20260923060000` was applied only to `entgcnlfsnysnwyadzzp`; existing
  user data and worker settings were not changed. Readback confirms migration
  registration, authenticated execution, anonymous denial and fixture cleanup.
- At the end of this earlier batch, suggestion sort used similarity then name, not the legacy
  preferred-merge target and status/creative-count tie-breakers. Duplicate links
  resolve saved `_dupeSimilar` references; automatic recomputation remains to be
  migrated. These are now explicit within the existing local acceptance sub-step,
  not additional milestones. Isolated live acceptance remains separate.
- No push, commit, deployment or production modification. Overall remains 6/13
  fully closed, 7 open; see the acceptance report for the remaining gates.

## Batch 3 Progress: Live Ranking And Automatic Duplicates

- Restored similarity/status/root-creative-count ordering and the preferred merge
  target using current active-product data. Merge preference keeps the legacy
  status/count/name-length/creation-age rules. Active taxonomy and eligible creative
  boundaries are retained; no global taxonomy merge occurs as a side effect.
- Extracted automatic duplicate projection: angle/persona/funnel exact matches,
  angle/persona combinations, and shared hook/structure with either axis match.
  Legacy word overlap, four-link cap and winner/loser/tested priority are retained.
  Matching updates after source edits, imports/mapping, realtime creative changes,
  and tombstone changes. Blank axes, no matches and queued/failed/blocked sources
  clear stale display evidence. Foreign, deleted, hidden and quarantined rows do
  not participate. The source's legacy JSON remains untouched by reads.
- Explicit review now acknowledges an immutable evidence signature containing all
  matches, not just four visible links. Same-request receipt recovery survives lost
  acknowledgements; unchanged evidence stays reviewed after reload. Changed source
  fields, added/removed matches, names or outcomes invalidate the review. A new
  match arriving during confirmation remains unreviewed even if the old save succeeds.
- Deliberate safety differences: ID-stable ordering within match levels instead of
  fetch order, no persistence on load, and old dismissal flags do not acknowledge
  newly computed evidence. Active/blocked sources cannot show actionable matches.
- 395 domain/service tests, TypeScript and optimized build pass. Two tests execute
  the actual legacy matching/ranking functions against 84 comparable scenarios.
  Focused intercepted browser acceptance passes with 24 mocked mutation attempts,
  zero unexpected errors and zero external requests. It also reruns mapping and
  inline editing. 320/390/768/1440px drawer bounds pass; screenshots inspected.
  Evidence: `/tmp/immuvi-inspiration-duplicates/results.json` and adjacent images.
- Full intercepted admin/member regression passes with 156 mocked mutation
  attempts, zero unexpected browser errors and zero external requests. Evidence:
  `/tmp/immuvi-inspiration-duplicates-regression/results.json`.
- Rollback-only QA SQL tests pass for access, evidence identity, stale source,
  preserved content, receipt replay/collision, active queue refusal and anon denial.
  Migration `20260923070000` was applied only to `entgcnlfsnysnwyadzzp`; readback
  confirms registration, authenticated execution, anonymous denial and fixture
  cleanup. No existing user data or worker settings were changed.
- Both previously named local behavior gaps are complete. Final whole-feature
  comparison/sign-off and isolated live integration acceptance remain in the
  existing final Inspiration batch. Overall is still 6/13 fully closed, 7 open.
  No production modification, commit, push or deployment.

## Final Local Acceptance

- Completed the whole-feature legacy/backlog audit and recorded the workflow/test
  inventory and deliberate differences in `inspiration-acceptance.md`. In
  particular, explicit guarded result imports replace automatic legacy polling
  while classifier dispatch remains disabled; exact live lifecycle parity is not
  claimed. No pixel-exact or live-provider certification is claimed.
- Save/create receipts now verify requested fields/source URL before accepting
  success or pushing linked ClickUp changes. Uncertain responses retain the exact
  request and draft. A corrupted-response browser fixture proves recovery, delayed
  remote push and persistence on reload.
- Inherited context reads full source snapshots; current schema hard-deletes
  inspirations. A realtime source deletion removes inherited brief links/sections.
  Mapping ranking is memoized for unchanged inputs; no quantified UI speedup claim.
- 397 domain/service tests and optimized build including TypeScript pass.
  Final full intercepted regression passes with 158 mocked mutation attempts,
  no unexpected browser errors and no external requests. An initial sign-in
  actionability timeout did not reproduce in the full rerun. Final editor warning
  and retry bounds/screenshots pass at 320/1440px and were visually inspected.
  Evidence: `/tmp/immuvi-inspiration-final-regression/results.json` and adjacent
  screenshots; focused evidence: `/tmp/immuvi-inspiration-final/results.json`.
- No SQL migration, backend write, production change, commit, push or deployment
  in this final pass. Zero local Inspiration finish batches remain. Milestone 8
  stays open only for external/release acceptance; next implementation is step 9.
