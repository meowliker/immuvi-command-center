# Next.js Migration Progress

This is the current milestone tracker for the QA migration. Keep milestone
numbers stable and update the completed/remaining counts after each step.

## Status

- Current handoff: [user acceptance checklist](qa-user-acceptance.md).
  Local implementation/release verification is complete for the documented scope;
  no additional feature batch has been opened. User review and the separate QA
  hosting decision remain pending, with no push/deployment authorization.
- Completed: 6 of 13 milestones in the remaining-work plan.
- Remaining: 7 milestones.
- Current verification: Step 12's consolidated local/database pass is complete.
  Two main stages still have gates: Step 12 live integrations/user acceptance,
  then Step 13 reviewed QA cutover/rollback. No new Action Plan feature batches.
  Runtime isolation and real hosted-QA permission/concurrency checks pass.
  Found and fixed legacy open-access database policies with QA-only migration
  `20260926010000`: 24 tables now have scoped policies; all 30 SQL suites pass
  before and after installation. Real Auth/account and two-session edit/replay
  tests pass, with disposable fixture cleanup verified. Existing records were not
  changed. Also passing: 480 domain/service tests, optimized build/TypeScript,
  17 loopback probes, 87 full browser scenarios/231 mocked mutation attempts,
  and 44 final tab/viewport label/overflow checks. The 1,000-row mocked Tracker
  refresh smoke took 1,223 ms; this is not a production load benchmark.
  See [QA release gate](qa-release-gate.md) and [backlog evidence](qa-backlog-evidence.md)
  for results, deliberate differences and unverified external/legacy behavior.
  No production change, commit, push or deployment. Workers/launching stay blocked.
- Latest continuation: user explicitly skipped live ClickUp testing for now.
  Step 13's local release build/restart verification is now complete, without
  closing Step 12 acceptance or claiming an actual deployment. Disk space was
  available on retry; the isolated optimized build and TypeScript passed.
  The allowlisted standalone artifact passed 26 route probes and 10 asset requests
  on both initial startup and same-artifact restart, retaining all 1,344 file
  hashes. Its intercepted browser smoke passed all 44 tab/viewport checks with
  zero unexpected errors/external requests/mutations; the final 1,000-row Tracker
  refresh took 906 ms (not a production benchmark). All 486 domain/service tests
  pass, and the existing QA server separately passed its 17 isolation probes.
  Receipt and screenshots: `/var/folders/vf/w_h9vtlx0gdg2b011wt0zd1r0000gn/T/immuvi-qa-release-wZBqGg`.
  Remaining: user visual/workflow acceptance and a separately approved QA host,
  target build/deployed checks and previous-version rollback. The local restart
  does not verify hosted rollback. See [QA cutover preparation](../deploy/qa/README.md).
  Existing QA/production servers, `vercel.json`, credentials and databases were
  not changed. No commits, pushes or deployments were made.
- Step 11, taxonomy and administration, is locally complete.
  All four local batches are complete; user/integration acceptance remains open.
  Current main stage: Step 12, cross-application QA and regression.
  Implemented: complete reads/relationships and atomic taxonomy
  create/save/rename/archive/restore/delete/merge, versioned dependent cascades,
  Matrix collision handling, retained drafts and same-request recovery across
  reload. Batch 3 implementation is locally complete: same-page product create/delete/unlink and
  product-scoped field catalogs are implemented with versioned receipts, typed
  confirmation, guarded deletion previews and editor/HQ propagation. User lists
  are now paginated/access-gated; product-access replacement and role changes
  are atomic, versioned, audited and recoverable across reload. Direct role and
  assignment writes and signup-metadata role escalation are restricted in QA.
  Reset/deactivate/reactivate/delete now use a native QA account service with a
  durable operation journal, encrypted reset credentials, same-request recovery,
  self/eligible-surviving-admin guards and typed deletion confirmation. Password
  completion is verified by an Auth database trigger, not a client profile patch;
  paginated account activity and future sign-in timestamps are implemented.
  Recoverable account creation is now native too: encrypted custom/generated
  credentials, one reserved Auth dispatch, restricted pre-provisioning profiles,
  atomic role/assignments/audit completion and exact recovery across reload. No
  legacy handler or process-global environment mutation remains in the QA Admin
  API. Guarded stale-ad cleanup is now implemented: complete active/archived QA
  ClickUp reads, private ten-minute previews, typed confirmation, a fresh remote
  snapshot and local-reference/version checks, atomic soft-delete/tombstone/audit
  receipts and exact recovery after reload. Taxonomy and quarantined/referenced
  work are deliberately preserved; legacy pruning differences remain a batch-4
  parity decision. Worker controls now provide paginated admin presence,
  heartbeat/status/capability detail, authorized pause-only mutations and exact
  request recovery across Admin/Inspiration and reload. In-flight jobs are not
  cancelled and Resume remains blocked in the database. Batch 4 is locally complete:
  compact legacy taxonomy/Admin layouts, original field descriptions and legacy
  product initials are restored and verified. Bug 60's rename confirmation now
  shows database-calculated affected counts, checks a locked content revision
  at commit, and atomically records before/after names, affected IDs and counts.
  Cancel/failed previews send no mutation; audit failure rolls back the rename;
  lost acknowledgements recover with one audit and the same request. Cleanup pruning remains a
  user acceptance decision; the safer implementation is retained meanwhile.
  See [Taxonomy/admin acceptance](taxonomy-admin-acceptance.md) for evidence and
  the remaining approval/integration gates. Latest checks pass 474 domain/service tests,
  optimized build, focused intercepted browser acceptance and rollback-only SQL.
  Full intercepted regression passes 87 scenarios/231 mocked mutation attempts,
  with no unexpected browser errors or external requests.
  QA-only rename migration `20260925060000` is installed; history, installed
  guard/audit markers, permissions and fixture cleanup pass read-back checks.
  Existing records were not renamed and no remote work was dispatched.
  QA-only migration `20260925050000` restores initials for new products without
  rewriting existing prefixes or historical receipts; read-back checks pass.
  Unprovable Auth outcomes require operator reconciliation, not
  automatic resend. This intermediate QA state is not ready for production.
  Latest creation verification: 457 domain/service tests, optimized build,
  rollback-only SQL plus seven prior database workflows and focused browser
  acceptance with six mocked writes and no unexpected errors/external calls.
  Full intercepted regression passes 83 scenarios/219 mocked mutations with no
  unexpected browser errors or external calls.
  Real QA Auth acceptance through the local Next API also passes: reset/replay,
  forced password change, suppression of obsolete reset credentials, ban/unban,
  deletion/replay and one audit per operation. Disposable accounts and their
  journals/audit fixtures were removed; existing users were not changed.
  Live member/custom-password and admin/generated-password creation through the
  local Next API also pass, including duplicate-email refusal, exact replay,
  product/role gates before and after password change, suppressed old credentials
  and one audit per creation. All three disposable users and the test product,
  journals and audit entries were removed; existing accounts were not changed.
  Latest cleanup checks: 464 domain/service tests, optimized build, rollback-only
  SQL safety/rollback/replay tests plus five existing database workflows, and
  focused desktop/mobile browser acceptance with three mocked commits/retries,
  zero unexpected errors/external calls. Full intercepted regression passes 84
  scenarios/222 mocked mutation attempts, with no unexpected errors/external calls.
  No real ClickUp-backed cleanup has been executed on existing QA records. The
  cleanup migration installs its schema/functions without running cleanup.
  Migrations `20260924050000`, `20260925010000`, `20260925020000` and
  `20260925030000` are QA-only,
  with history, permissions and fixture cleanup verified by read-back.
  Latest worker checks: 468 domain/service tests, optimized build, rollback-only
  SQL and five prior database workflows pass. Focused desktop/mobile browser
  acceptance passes with four mocked pause/recovery attempts, no unexpected
  errors or external calls. Full intercepted regression passes 85 scenarios and
  226 mocked mutation attempts, with no unexpected errors or external calls.
  The QA registry was empty before installation;
  migration `20260925040000` adds pause-only controls without starting, resuming
  or pausing any worker. Installation, permissions and fixture cleanup passed
  read-back verification. Actual worker acknowledgement is untested because no
  isolated worker destination exists. Legacy worker enable checks can fail open;
  the pause flag must never be represented as guaranteed process termination.
  Configured QA preview: `http://127.0.0.1:3001/`. Its service key stays in process
  memory; no credentials were added to repository files or production settings.
  The earlier product/catalog portion passes 439 domain/service tests, optimized build, rollback-only
  SQL and focused mocked browser checks. Migration `20260924040000` is QA-only.
  Its installation, permissions and fixture cleanup pass read-back verification.
  Full regression passes with 198 mocked mutation attempts, zero unexpected
  browser errors and no external requests.
  434 domain/service tests, optimized build, rollback-only SQL and focused browser
  checks pass (12 mocked mutations, zero unexpected browser errors/external calls).
  Full intercepted regression passes with 190 mocked mutation attempts, zero
  unexpected errors and no external requests. QA installation, permissions and
  rollback-fixture cleanup were verified by read-back.
  Migration `20260924030000` is installed only in the approved QA Supabase project.
  See [Taxonomy/admin migration](taxonomy-admin-migration.md) for scope, remaining
  sub-steps and verification. No production changes or push; automatic remote
  delivery stays disabled, and old legacy-writer ordering remains a release gate.
  Step 10, Command HQ,
  has completed all three local batches; zero local finish batches remain.
  Eight KPIs, five coverage groups, gap analysis, safe live reads, shared QA
  connection controls, sync health and product activity pass focused acceptance.
  Final parity restores legacy chip/coverage styling, rejects malformed options,
  clears stale relink state and fixes long-product-name header overflow.
  424 domain/service tests, optimized build and full intercepted regression pass
  (178 mocked mutation attempts, zero unexpected errors/external requests).
  Final verification and open integration/user
  gates are recorded in [Command HQ acceptance](command-hq-acceptance.md).
  Destructive product operations and the field-catalog editor remain explicitly
  in milestone 11 and are now locally complete there. Five local-complete milestones
  still have acceptance gates, plus two main QA/release milestones;
  this is why the fully-closed count remains 6/13.
  Step 9, Production, is locally complete: all three batches closed, zero local
  finish batches remaining. Compact legacy board/card treatment, preserved Format
  templates separate from Ad type, keyboard/modal focus, mutation recovery and
  final failure/concurrency/responsive acceptance pass. 409 domain/service tests,
  optimized build, rollback-only SQL tests and full intercepted regression
  (178 mocked mutation attempts, no unexpected errors/external requests) pass.
  Functions are installed only in the approved QA Supabase project, with verified
  permissions and fixture cleanup. No production change, push or deployment.
  Real ClickUp delivery, deployed security acceptance and user sign-off remain
  separate gates. See [Production acceptance](production-acceptance.md).
  Step 8, Inspiration, is locally complete with zero local finish batches remaining.
  Its Matrix
  placement, cross-product import, insights/trends/Pulse, queue-only recovery,
  source-task ad-type sync, batch imports, accessible-product reuse, restored
  table fields and guarded brief recovery are implemented. Inline editing,
  editable format detail and the compact legacy table/filter layout are now
  implemented too. Explicit taxonomy mapping/promotion and same-page duplicate
  navigation now pass local checks. Legacy preferred-target ranking and automatic
  duplicate recomputation now pass direct legacy comparisons and focused browser
  tests. Final whole-feature local comparison and regression now pass. Isolated
  live integration and user visual/behavioral sign-off remain open. Step 7 local
  acceptance is complete; its external integration gate remains open.
  Implemented Action Plan scope: table/filter/bulk workflow, per-task
  assignments/custom-field editing, saved column layouts, inline renaming,
  canonical creative-detail editing, pipeline/current-week views, date windows,
  30-day trends/win rate, age/checkpoint/attention indicators, and guarded
  testing-review decisions/snooze, linked-production completion lookup, and
  consistent status timestamps across age/date/week/trend views, and the pulse
  strip with tile filters, period selection, removable filter chips, and a
  sortable/saved Age-in-status column, paginated task/product history, and
  multi-select facet filters with shared anomaly badges/filtering, personal
  hide/restore, deleted/quarantined record suppression, and read-only automatic
  adoption with guarded promotion on explicit mutations, and confirmed creative
  deletion with optional QA ClickUp deletion/retry, and guarded ClickUp
  recreation/relinking implemented. Read-only OneScale launch readiness is
  implemented; actual handoff/callback is pending an isolated test environment.
  Show Selected is implemented as a session-only narrowing control for Table,
  Cards, and Pipeline, preserving filter and bulk-selection safeguards.
  The dedicated Variations overview now groups all product variations by parent,
  with legacy win rates, axis totals, and guarded task-detail links.
  Variation Lab now shares its template/advanced editor across Tracker, Matrix,
  and Action Plan, with breakdown popovers and independent Matrix creation.
  The Pulse period control now uses the legacy calendar-button popover, eight
  quick presets, and inline custom dates instead of a select and modal.
  Facet menus now anchor to their own triggers on desktop/mobile, flip upward
  when needed, fit the viewport, and preserve option scrolling and keyboard access.
  The toolbar date filter now uses the legacy two-column presets and inline
  custom dates with Activity/Created segments; validated apply/cancel is retained.
  The Action Plan navigation badge now counts eligible saved records across tabs;
  header totals explicitly use the task-list clock and distinguish initial loading.
- Visual parity: shared typography/reset, compact tab navigation, and Action
  Plan density/pulse styling restored. Task details now use a legacy-style
  overlay drawer. The layout switcher, unified filter band, and bulk-bar search
  now follow the legacy arrangement. Local responsive/behavioral acceptance
  passes; live user sign-off and external integration acceptance remain pending.
- Branch: `qa`. Code remains unpushed; production release requires approval.
- UI: one command center at `/`, with internal tabs.

## Action Plan Finish Batches

All four local Action Plan acceptance batches are complete; zero local finish
batches remain. These are sub-batches of milestone 7, not new milestones.

1. **Complete: drawer and cards.** Buyer and
   Strategist detail views, source/brief links, assignments, winner artifacts,
   same-page Matrix navigation, and compact cards with the existing mutations.
2. **Complete: Variation Lab.** Shared chip/popover, template, and
   advanced-creation flows across Tracker, Matrix, and Action Plan.
3. **Complete: Pulse period picker.** Legacy calendar popover, quick presets,
   and inline validated dates with preserved filters and selections.
4. **Complete: final local Action Plan acceptance.** Populated/empty/error,
   responsive, workflow, and simulated concurrent-user checks pass. See the
   [acceptance report](action-plan-acceptance.md) for fixes, backlog coverage,
   evidence, and the distinction between local and live acceptance.

Separate external blocker: real OneScale handoff/callback requires an isolated
test destination. None is available, so external launching stays disabled.

## Inspiration Batches

1. **Complete: library and details.** Paginated library, filters/sorting, scoped
   usage, live detail drawer, queue-state reconciliation and local acceptance.
2. **Complete locally: intake and mutations.** URL/manual creation, editing/rename, approval,
   duplicate review/deletion, retry/repost, classification import and worker guards.
3. **Complete locally: placement/imports and acceptance.** Matrix placement, cross-product
   imports, insights/trends/Pulse, recovery and synchronization controls implemented.
   The legacy audit restored missing fields, reuse context and stored/remote briefs;
   inline editing, compact table/filter treatment, explicit taxonomy mapping and
   guarded duplicate-to-Tracker navigation now pass focused checks. Preferred-merge
   ranking and automatic duplicates are implemented and tested against the legacy
   functions. Final local workflow comparison and full regression pass. Live
   integration and user sign-off remain open, with deliberate differences recorded.

Zero local finish batches remain within milestone 8; no new milestones were added.
See [Inspiration migration](inspiration-migration.md) for scope and evidence.
The [Inspiration acceptance audit](inspiration-acceptance.md) records deliberate
differences and separates local coverage from unverified live worker behavior.

Latest batch: final local Inspiration acceptance. Save/create acknowledgements
verify requested fields before linked remote pushes; exact-request retry and
inherited-brief deletion refresh are covered. Mapping ranking is memoized for
unchanged inputs. 397 domain/service tests, optimized build including TypeScript
and the full intercepted browser regression pass (158 mocked mutation attempts,
zero unexpected errors/external requests). An initial sign-in timeout did not
reproduce in the full rerun. Final warning/retry screenshots inspected at
320/1440px. No SQL or backend changes were required in this pass.
Evidence: `/tmp/immuvi-inspiration-final-regression/results.json`.

Prior batch: live legacy ranking and automatic duplicate detection/review.
395 domain/service tests, optimized build including TypeScript, rollback-only QA
SQL tests and intercepted browser checks passed (24 focused mocked attempts and
156 in the full regression, zero unexpected errors/external requests). The QA-only duplicate-review migration
`20260923070000` is installed; permissions and fixture cleanup were read back.
No existing user data, production configuration, commits, pushes or deployments
were changed. Evidence and known parity gaps are recorded in the acceptance audit.

Batch 2 verification: 334 domain/service tests, TypeScript, optimized build,
rolled-back QA SQL fixtures and the full intercepted browser regression pass
(110 mocked mutation attempts, no unexpected errors/external requests). The
tested migration `20260922010000` is applied only to QA Supabase; permissions
were read back. Intake/retry remain non-claimable without an isolated classifier.
No production change, commit, push or deployment. Queue-only recovery and the
remaining legacy/integration parity checks are tracked in the final batch.

Batch 3 first sub-step: suggested/custom Matrix placement now lives in the
Inspiration drawer and reuses guarded Matrix creation, with acknowledged
assignment, same-request retry, duplicate suppression and active product/axis
checks. Blocked Inspiration/queue states are rejected in both entry points.
341 domain/service tests, build and focused browser/rolled-back SQL tests pass.
The full intercepted regression passes with 114 mocked mutation attempts and no
unexpected errors/external requests. Migration `20260923010000` is applied only
to QA; no production change, commit, push or deployment.

Batch 3 second sub-step: the same-page Other Products picker now imports both
Inspirations and root Winning Formats with source provenance and stored briefs.
The QA-only atomic RPC validates access/version/lifecycle, skips duplicates and
recovers lost replies using the same request. Source records stay unchanged;
no external work is dispatched. All 347 domain/service tests, TypeScript/build,
focused mocked browser and rolled-back QA SQL checks pass. Source reuse-count
parity and missing remote briefs are explicitly retained as acceptance limits.
The full intercepted regression passes with 118 mocked mutation attempts and no
unexpected errors/external requests. Migration `20260923020000` is installed only
in QA; no existing source records, production changes, pushes or deployments.
Batch 3 third sub-step: same-page Pulse, Trends and Insights are implemented with
shared counters/filter predicates, preserved search and dates, live updates,
local-day charts, scoped outcome groups and the unused-inspiration drawer. The
legacy classified counter/filter mismatch is corrected; linked creative counts
remain distinct from source-row counts. All 356 domain/service tests, TypeScript,
optimized build and focused mocked browser checks pass. Full intercepted regression
also passes with the unchanged 118 mocked mutation attempts and no unexpected
errors/external calls; exact-rate ranking has an additional targeted regression.
No backend write, migration or external dispatch was needed for analytics.

Batch 3 fourth sub-step: queue-only recovery now restores a missing library record
through an explicit same-page confirmation. Source identity, saved results, retry
history and downstream creatives are preserved; the original queue state is retained
for audit and processing remains blocked in QA. Active jobs, stale snapshots, source
conflicts and recorded deletions are rejected. All 360 domain/service tests, build,
focused mocked browser checks and rollback-only QA SQL workflow tests pass.
Full intercepted regression passes with 123 mocked mutation attempts and no
unexpected errors/external requests. Migration `20260923030000` is installed only
in QA; no existing user records were repaired and nothing was pushed or deployed.

Batch 3 fifth sub-step: source-task ad-type sync and batch result imports are
implemented in the same Inspiration tab. Batch selection checks completeness,
source/queue chronology and prior imports, then uses existing per-source receipts
with partial outcomes and safe lost-ack retry. Ad-type edits push only to a verified
QA source task, with local-save preservation and an explicit drawer retry action.
Foreign-product/production destinations are rejected and remote values read back.
All 371 domain/service tests, optimized build/TypeScript and focused intercepted
member browser checks pass (seven mocked database mutation attempts, no unexpected
errors/external requests, desktop/mobile screenshots inspected). The full intercepted
admin/member dashboard regression also passes with 130 mocked database mutation
attempts and no unexpected errors or external requests. No migration,
real ClickUp write, production change, commit, push or deployment occurred.
See the Inspiration report for the two remaining sub-steps: final legacy/backlog
parity and isolated live integration acceptance. The main milestone count remains
6/13 complete.

## Milestones

1. **Complete: split the Next.js monolith.** Extract tab views, feature state
   hooks, shared types, normalization helpers, authentication, Supabase client
   setup, ClickUp requests, and shared action persistence.
2. **Complete: realtime synchronization.** Add subscriptions, cross-tab refresh,
   stale-write protection, product isolation, and flicker-free merging.
3. **Complete: ClickUp integration.** Finish list linking, field configuration, imports,
   updates, tombstones, product boundaries, and sync controls.
4. **Complete: Creative Tracker.** Complete creation, editing, deletion, variations,
   funnel expansion, winner artifacts, custom fields, and ClickUp actions.
5. **Complete: Creative Matrix.** Complete filters, date scopes, density, sorting,
   editing, variations, and creation from Tracker, Inspiration, or blank.
6. **Complete: Matrix to Action Plan to ClickUp.** Preserve descriptions, fields, source
   identity, product, and due dates; recover from failed requests.
7. **Local acceptance complete; external gate open: Action Plan.** Bulk operations,
   pushing, assignments, saved views, columns, pipeline/week/trend/Variations,
   history and local legacy visual/state checks pass. Live integration acceptance
   and isolated OneScale handoff/callback verification remain outstanding.
8. **Local acceptance complete; external gate open: Inspiration.** Intake,
   retry/repost, guarded result imports, editing, approval, duplicates, briefs,
   Matrix usage, deletion, imports and analytics pass local checks. Actual
   classifier/audio lifecycle, live ClickUp delivery and user sign-off remain.
9. **Local acceptance complete; external gate open: Production.** All three local
   batches complete: board/workflow, task management and final legacy/keyboard/
   mobile/failure/concurrency/backlog acceptance. Real test-list delivery and user
   sign-off remain; no further local Production finish batches are planned.
10. **Local acceptance complete; external gate open: Command HQ.** All three
    local batches complete: KPIs, coverage, gaps, shared QA controls, health,
    history and final parity/failure/access/responsive checks. User/integration
    acceptance and milestone 11 product/catalog dependencies remain explicit.
11. **Locally complete; acceptance gates open: taxonomy and administration.**
    Complete reads/relationships and atomic taxonomy mutations/merging are
    implemented. Batch 3 product create/delete/unlink and field catalogs are
    implemented, including user administration, guarded cleanup and pause-only
    worker controls. Batch 4 local parity/rename safeguards and regression pass;
    zero local finish batches remain. Cleanup behavior approval, user sign-off
    and live integration acceptance remain explicit gates.
12. **In progress: QA and regression gate.** Runtime isolation fixes are implemented;
    see [QA release gate](qa-release-gate.md) for evidence and remaining categories.
    Verify worker workflows, authenticated access,
    RLS, product isolation, historical bugs, concurrent writes, deletion,
    responsive layouts, and accessibility.
13. **QA cutover.** Run realistic user acceptance testing, retire legacy
    routes after sign-off, verify deployment/rollback, and obtain explicit
    approval before a production merge or deployment.

## Step 1 Structure

`app/command-center-client.tsx` now composes authentication screens, product
selection, and tabs. It is 211 lines, down from 2,987 lines at the start of
this step. The extracted modules are all under 250 lines.

- `app/command-center/tabs/`: ten view components serving eleven tabs;
  Angles and Personas share the taxonomy component.
- `app/command-center/hooks/`: tab state, derived state, queries, and event
  handlers, plus the authentication/product/navigation hook.
- `app/command-center/services/`: browser Supabase client, session loading,
  shared action mutations, and ClickUp requests.
- `app/command-center/helpers/`: normalization, action resolution, workflow
  statuses, dates, and status presentation.
- `app/command-center/components/`: filter control and strategist memory views.
- `app/command-center/types.ts`: shared TypeScript models.
- `app/command-center/navigation.ts`: tab definitions and persistence keys.

Existing `lib/domain/` modules remain the source of reusable domain rules.
Server-side services remain in `lib/services/`. The browser services above
use the existing authenticated client and API routes. Styling remains in
the existing CSS module, so extraction does not change class names.

New tab behavior belongs in its feature hook and view. Shared persistence
belongs in services; reusable pure rules belong in domain modules/helpers.
Do not import tab components from services or helpers. Step 2 extends
these hooks for realtime behavior; Step 1 preserved their existing behavior.

## Step 1 Verification

- TypeScript check and optimized Next.js build passed.
- All 49 domain tests and 19 service tests passed.
- Source comparison confirmed the bodies of 57 existing functions,
  statement order in extracted hooks, and all tab JSX were preserved.
- Browser verification uses intercepted, synthetic QA responses. It checks
  rendering and interactions without writing to Supabase or ClickUp.
- Browser checks passed for all eleven admin tabs, all ten member tabs on
  mobile, product persistence, sign-out, forced password change, Action Plan
  status/due-date edits, Matrix inspection, competitor creation, and structured
  strategist memory. No browser console errors were recorded.
- Real backend authorization, worker execution, and full feature parity
  still require the later milestones above.

## Step 2 Implementation

- Shared Supabase subscriptions invalidate only the affected active views.
  Database event payloads are never merged directly into trusted UI data;
  each view re-reads with its existing RLS and product filters.
- Events are batched over 150 ms. Refreshes also run on connection/database
  readiness, window focus, network recovery, and every 30 seconds while visible.
- Stale requests are aborted and cannot commit even if cancellation is ignored.
  Feature state is keyed by account, product, and tab to prevent old-product
  rows or drafts from appearing in the new product.
- Local writes pause related refreshes. Completion invalidates mounted views
  and other browser tabs. Overlapping local writes report a busy error.
- Row reconciliation preserves unchanged objects; background refreshes retain
  data on failure and preserve filters, inspectors, unsaved drafts, and focus.
- Action Plan JSON and Matrix assignment writes read the latest row and use
  an `updated_at` precondition, so concurrent changes produce a conflict instead
  of silently replacing newer JSON. Multi-row writes are still not a database
  transaction; atomic workflow recovery remains part of Step 6.
- Product/profile/access changes refresh the shell, including removed product
  access and admin permissions. Auth changes dispose the previous data scope.

## Step 2 QA Database

Migration `20260917020000_enable_command_center_realtime.sql` was applied and
recorded only in QA project `entgcnlfsnysnwyadzzp`. All 17 tables observed by
the React client are now in `supabase_realtime`; existing publication members,
RLS policies, and grants were preserved. Production was not changed.

The migration was executed through the CLI Management API. Direct database
authentication for the history-repair command was unavailable, so its exact
statement and version were recorded through the same QA Management API.

## Step 2 Verification

- 55 domain tests and 36 service tests pass, including stale-response rejection,
  cancellation, event batching, mutation gating, subscription cleanup, draft
  preservation, product boundaries, and optimistic concurrency conflicts.
- TypeScript and the optimized Next.js build pass.
- `tests/browser/command-center-live.cjs` verifies the UI using intercepted HTTP
  and WebSocket responses, including a delayed old-product request and two
  browser tabs. No browser console errors were recorded.
- A live QA service-role transport check received INSERT and DELETE events for
  a temporary product. The temporary record was removed. This confirms the
  publication and event transport, not end-user RLS, which remains in Step 12.

Reference: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Step 3 Implementation

- Added expandable ClickUp connection controls inside the existing command center
  at `/`. No feature pages, redirects, or changes to the legacy HTML were added.
- The Next.js integration uses an authenticated QA-only API, explicit active-user
  and product-access checks, and a fixed allowlist containing only test list
  `901616718146`. It does not use generic/production Supabase environment secrets.
- API keys are scoped to the QA account in browser session storage. The legacy
  global `immuvi_api_key` is ignored. Keys are removed by Forget key or sign-out;
  they are never persisted to Supabase, configuration, or logs.
- Administrators can verify the list, inspect its field types/options, and save
  list-scoped field mappings. Versioned database writes preserve other settings
  and reject linking the same list to a second product.
- Manual sync and opt-in one-minute visible-tab polling fetch every task page,
  including closed tasks and subtasks. Repeated pages, malformed responses,
  timeouts, rate limits, foreign-list tasks, and failed tombstone reads stop the
  import. A 20,000-task safety ceiling errors rather than silently truncating.
- Pure normalization supports dropdown index zero, string indexes/option IDs,
  labels, users, dates, explicit field clears, native assignees, due dates,
  descriptions, hypothesis, parent/variation fields, and production tags.
- Existing creative IDs, local notes, source/provenance, and winner metadata are
  retained. New IDs include the product. Missing tasks are not deleted or marked
  as ghosts. Ambiguous duplicate links stop the sync for manual resolution.
- Ads and linked Action Plan updates commit together in one transaction. Local
  edits made during the fetch reject the whole batch. Durable tombstones and
  soft-deletes are checked at commit; recent status/due edits get an in-flight
  push grace period. ISO values target timestamptz columns; status-change epochs
  remain numeric for the actual bigint column. This addresses the Bug 2 class of
  timestamp mismatch in the new import path, not every legacy persistence path.
- Existing Action Plan status/due pushes and Strategist task creation now use
  the QA API. Native updates verify both local product ownership and the remote
  task's list before writing. External write failures remain visible as warnings.

## Step 3 QA Database And Verification

- Migration `20260917030000_qa_clickup_sync.sql` was applied and recorded only in
  QA project `entgcnlfsnysnwyadzzp`. It adds `apply_qa_clickup_sync` and
  `save_qa_clickup_link`; existing policies, data, and production were not changed.
- `node scripts/check-qa-clickup-migration.mjs` runs authenticated database
  transaction tests and rolls back all synthetic rows. Coverage includes actual
  inserts/defaults, metadata, stale-write rollback, tombstones, product settings,
  duplicate list linking, non-QA lists, and rejected unauthorized users.
- 69 domain tests and 47 service tests pass. TypeScript and the optimized Next.js
  build pass. The browser regression suite passes with no console errors or
  external requests, including the new connection controls at desktop/mobile sizes.
- The live QA Immuvi product was confirmed to already reference the test list.
  No real ClickUp task was created or changed. ClickUp transport was verified
  using injected responses, not a real API key. Live authenticated ClickUp
  acceptance testing remains part of Step 12.

## Step 3 Scope Boundaries

The shared integration infrastructure is complete, not the whole migration.
Tracker custom-field editing/push controls belong to Step 4; taxonomy discovery
and Matrix assignment reconciliation belong to Steps 5/11; complete task-creation
payloads and recovery from successful remote creation followed by failed local
linking belong to Step 6. The existing short push grace window does not replace
a durable retry/outbox workflow. Worker APIs and legacy compatibility routes
still require the broader Step 12 security and regression audit.

ClickUp references: [Get Tasks](https://developer.clickup.com/reference/gettasks),
[Custom Fields](https://developer.clickup.com/docs/customfields).

## Step 4 Implementation

- Tracker now has a dense table, inline axis/type/funnel/status controls, and
  modular React dialogs for creation, editing, deletion, variations, and winning
  files. Everything stays inside the existing tab at `/`; no new feature pages
  or embedded legacy HTML were introduced.
- Editable fields include links, taxonomy, hypothesis, USP, notes, winning
  element, and due date. The ClickUp schema drives dropdowns, labels, users,
  checkboxes, dates, numeric fields, and text controls. Native task assignees
  use add/remove differences; unsupported custom field types remain read-only.
- Database functions check active user/product access, serialize product-level
  writes, and use exact row versions for edits, deletion, and spawning. JSON
  patches preserve unrelated metadata and explicit clears. Linked Action Plan
  fields update only when that field changed and task identity agrees.
- Deletion atomically soft-deletes, records a durable tombstone, removes matching
  Action Plan/matrix references, and resets the last linked inspiration where
  applicable. Independent variations are retained. Deleting a remote test-list
  task requires an explicit checkbox; remote failure does not undo the tombstone.
- Winner variations retain provenance and optional winning-file references but
  do not inherit the parent's ClickUp identity or output links. IDs skip live
  and tombstoned variations. Per-row briefs, change axes, hypotheses, due dates,
  editors, reviewers, and assignment defaults are supported. Missing funnel
  stages are created without duplicating existing stages. Child rows and matrix
  assignments are one transaction.
- Winner files use the durable `task_video_winners` table with an atomic metadata
  mirror. Users can paste a Drive URL, browse an existing public Drive folder,
  preview/open a selected file, remove it, or explicitly post it to ClickUp.
- Linked task edits persist a pending-field map before remote writes. Imports
  preserve unacknowledged Tracker edits beyond the previous short grace period.
  Partial failures remain visible; only successful values are acknowledged,
  and acknowledging an old value cannot erase a newer local pending value.
  Hypothesis updates preserve the rest of the remote description.
- Pagination is shared without importing server integration code into the client.
  Lucide icons provide accessible action buttons. Filter controls and dialogs
  were checked at 1440px and 390px widths; the wide table scrolls within its region.

## Step 4 QA Database And Verification

- Migration `20260917040000_qa_tracker_mutations.sql` was applied and recorded
  only in QA project `entgcnlfsnysnwyadzzp`. No production data, environment files,
  legacy HTML, or deployment configuration were changed. Nothing was pushed.
- `node scripts/check-qa-tracker-migration.mjs` verifies real SQL mutations with
  rollback-only fixtures: defaults, metadata/clears, stale writes, pending-field
  acknowledgement, winner persistence/removal, variation IDs and assignments,
  funnel deduplication, deletion cleanup, and assigned/unassigned member access.
  All test rows and the synthetic member were rolled back.
- 73 domain and 54 service tests pass (127 total). TypeScript, optimized Next.js
  build, and `git diff --check` pass.
- The browser regression suite passes for all eleven admin tabs and ten member
  tabs, including Tracker create/edit, custom zero/boolean fields, draft retention,
  inline status, winner add/remove, variation/funnel creation, and independent
  deletion. No browser console errors or external requests were recorded.
- Browser and ClickUp transport tests use synthetic responses. No real ClickUp
  tasks or Drive files were changed; real authenticated transport/acceptance
  testing remains in Step 12. Visual checks are not full legacy pixel-parity
  certification, which remains part of acceptance.

## Step 4 Release Boundaries

- Creating new ClickUp tasks and complete Matrix/Action Plan payloads/recovery
  remain Step 6. Spawning here intentionally does not auto-push new tasks.
  Multi-client remote-write ordering still needs the later outbox/recovery work.
- Existing QA tables still have broad legacy policies (including `ads_open_all`
  and `products_open_all`); the RPC access checks do not secure direct table access.
  Broader RLS, legacy APIs, Drive access, and workers must pass Step 12 before release.
- `npm audit --omit=dev` reports one moderate transitive
  `baseline-browser-mapping` advisory. Dependency remediation remains part of
  the release gate; no unrelated dependency upgrade was applied in this step.

## Step 5 Implementation

- Matrix now uses separate React controls, grid, inspector, source picker,
  preference hook, and pure domain rules. It remains a tab at `/`; no new
  feature routes or legacy HTML embedding were added.
- Active product taxonomy supplies the axes. Explicit assignments and canonical
  creative tags are reconciled together, with ClickUp alias support, duplicate
  suppression, ambiguous-reference detection, and deleted/quarantined row guards.
  Unresolved references are reported separately rather than inflating totals.
- Filters include source, funnel, type, status, angle, persona, stale cells,
  and dates. Scope mode rebases counts; lifetime/highlight mode preserves totals.
  Custom date ranges include the entire last day and reject reversed dates.
  Date basis, ten sorts, three densities, manual drag/keyboard ordering, and
  per-product saved preferences are supported.
- Cell dialogs support search, status/lifetime views, insights, inline status
  and due dates, full Tracker editing, variations/funnel expansion, winner files,
  and pending updates for existing linked ClickUp tasks. Dialogs lock background
  scrolling and preserve source selections during realtime refreshes.
- Tracker, classified Inspiration, and blank briefs create independent production
  creatives in the chosen cell. Source briefs, provenance, and winning-file
  references are retained; output Drive links, remote task IDs, assignments,
  and due dates are not accidentally inherited. Pending/failed inspirations
  cannot be used as classified sources.
- QA RPCs check active user/product access, lock the product, verify source/cell
  versions, and commit creatives and assignments atomically. Request IDs support
  retries; repeated sources in the same cell reuse their production creative.
  Unlinking a cell preserves the creative and Action Plan record and writes an
  exclusion so canonical fallback cannot silently re-add it. Restore is explicit.
- Generated Tracker/Inspiration names follow the legacy product-prefix pattern.
  A product-scoped database high-water counter prevents reuse after deletion
  and continues beyond the legacy 999 cap. Internal creative IDs are UUID-based.
- A shared save race discovered by browser tests was fixed: the returned row
  version is committed immediately before a subsequent inline edit can start.

## Step 5 QA Database And Verification

- Migration `20260918010000_qa_matrix_mutations.sql` was applied and recorded
  only in QA project `entgcnlfsnysnwyadzzp`. Production, environment files,
  deployment settings, and legacy HTML were not changed. Nothing was pushed.
- `node scripts/check-qa-matrix-migration.mjs` passes rollback-only authenticated
  SQL tests covering source fields, winning-file references, blank output links,
  atomic batches, idempotent retries, naming, cell identity, stale sources/cells,
  pending inspirations, unlink/restore, and assigned/unassigned product access.
  Synthetic users and products are rolled back.
- All 135 domain/service tests pass, as do TypeScript, optimized Next.js build,
  and `git diff --check`.
- The full browser regression suite passes using intercepted QA HTTP/WebSocket
  responses. Matrix coverage includes date scope/highlight, persisted sorting
  and density, source selections across refresh, all three creation paths,
  editing, spawning, unlink/restore, reload, and 1440px/390px layouts. A focused
  rerun also verifies that date inputs fit within their mobile field labels.
  No browser console errors or external requests were recorded.

## Step 5 Scope Boundaries

Creating Action Plan entries and new remote ClickUp tasks, preserving their full
payloads, and recovering from partial external failures are Step 6. Matrix
creation intentionally does not auto-push tasks yet. No real ClickUp or Drive
write was made during verification. Existing broad RLS policies still require
Step 12; these RPC checks alone do not secure direct table access. Full legacy
pixel parity and live authenticated workflow acceptance remain release gates.

## Step 6 Implementation

- Matrix cell creatives now have explicit Add to Action Plan and Push to ClickUp
  controls. Action Plan cards expose the same push/recovery workflow. Everything
  remains inside the existing tabs at `/`; no feature routes were added.
- Staging uses authoritative product/creative IDs, exact row versions, and a
  product lock. Repeated staging returns the existing card. Conflicting or
  duplicate links stop the operation; task names are never used to select a
  creation source. Action Plan reads are now paginated instead of truncating
  at 160 cards or 3,000 creatives.
- Creation reads the current destination-list schema, validates mappings and
  custom task-type applicability, and builds the description and custom fields
  before sending. The payload carries product, current cell axes, source and
  winner references, hypothesis, notes, variation brief/from/to, native assignees,
  reviewer/custom fields, tags, and date-only due dates. Zero, false, dropdown
  index zero, labels, and people fields retain their types. Blank production
  output links do not inherit the source's Drive folder. Approved/launch dates
  and final video IDs are not seeded onto new tasks.
- Status selection uses only the current list's confirmed statuses, including
  legacy aliases for simpler operational lists. No unconfirmed status is sent.
  Missing list schemas or invalid field options stop before task creation.
- `qa_clickup_creations` stores an immutable in-flight request, stable marker,
  remote task ID, result state, and a two-minute ownership lease. API keys are
  not stored. The table has active-user/product read policies and no direct
  authenticated write grant; guarded RPCs manage its transitions.
- A create request is sent once per claimed attempt. Explicit validation/auth
  rejections permit a corrected retry. Timeouts, 5xx responses, lost responses,
  and malformed success responses become uncertain outcomes. Recovery scans
  active and archived tasks for the exact request marker, or verifies a supplied
  task ID against that marker and QA list. It never uses fuzzy name matching.
- Remote task identity is persisted before field verification/local linking.
  Missing native fields, assignees, tags, or custom fields are repaired on that
  same task, then re-read. The creative and Action Plan card are linked together
  in one transaction only after confirmation. A failed local finalize remains
  recoverable; repeated finalize does not duplicate activity events.
- Source edits/deletion are blocked while creation is unresolved, including
  direct legacy table writes. This prevents a stale create snapshot from erasing
  newer edits. Imports defer marked-but-unlinked tasks instead of making a second
  local creative while finalization is pending.
- Linked Action Plan status/due-date edits now use one transaction for the card
  and creative, with source/version checks and durable pending ClickUp fields.
  Remote update failures retain the local edit and report the pending work.

## Step 6 Verification

- Migration `20260918020000_qa_creation_workflow.sql` was applied and recorded
  only in QA project `entgcnlfsnysnwyadzzp`. No production database, environment,
  deployment settings, or legacy HTML changed. Nothing was pushed.
- `node scripts/check-qa-creation-migration.mjs` passes rollback-only SQL tests
  for staging idempotency, payload retention, source/action versions, overlapping
  claims, stale lease rejection, edit/deletion guards, uncertain recovery,
  tombstones, atomic finalization, activity deduplication, linked edits/due clears,
  pending fields, direct outbox write rejection, and unauthorized product reads.
- Existing ClickUp, Tracker, and Matrix SQL suites pass with the new migration
  installed. Synthetic rows/users are rolled back; no test products remain.
- All 153 domain/service tests, TypeScript, optimized Next.js build, and
  `git diff --check` pass. Failure injection covers a lost create response,
  successful remote creation with failed local persistence/finalization, field
  write failures/ignored writes, missing/duplicate markers, and rejected creates.
- The full intercepted browser suite passes with no console errors or external
  requests. It verifies Matrix staging, brief/due-date retention in Action Plan,
  an uncertain push surviving reload, disabled edits while unresolved, recovery
  with one simulated create request, stable links back in Matrix, subsequent
  linked status/due edits, and 1440px/390px layouts.

## Step 6 Recovery And Release Boundaries

- An unresolved request with no visible marked task is deliberately not resent.
  It remains blocked for manual investigation or later recovery; absence from a
  list response is not proof that the original request did not create a task.
  Removed markers, moved/deleted tasks, or duplicate marked tasks require review.
  This is not a claim of distributed exactly-once delivery from ClickUp.
- Recovery may need to wait for the two-minute lease after a disconnected client
  or failed remote-ID save. Confirmed field/link failures release ownership for
  another recovery attempt. No automatic external background writer was added.
- No real ClickUp task or Drive file was created/changed during verification.
  Live authenticated transport and user acceptance remain Step 12/13. The new
  workflow covers Matrix/Action Plan creation, not the separate legacy/Strategist
  creation paths. Bulk operations/assignments remain Step 7, list provisioning
  remains Step 11, and wider RLS/worker/remote-update ordering audits remain Step 12.
- Full legacy visual parity is not certified by these screenshots.

API references: [Create Task](https://developer.clickup.com/reference/createtask),
[List Custom Fields](https://developer.clickup.com/reference/getaccessiblecustomfields),
[Custom Fields](https://developer.clickup.com/docs/customfields).

## Step 7, Part 1: Action Plan Table And Bulk Workflow

- Action Plan now opens as a compact table within the existing `/` tab, with
  task-detail access and the existing card layout available through a layout
  toggle. No temporary feature pages or embedded legacy HTML were introduced.
- Added search, status, angle, persona, funnel, source, and due-date filters;
  sortable table headers; per-row selection; and select-all-visible. Filters,
  sorting, and selection remain stable during background refreshes. Layout and
  filter persistence/saved views are not part of this completed portion.
- Bulk status, due-date set/clear, and removal use `qa_plan_batch`. The database
  verifies active product access and the displayed action/creative versions,
  checks explicit source identities, and commits the whole local batch with
  activity events or rejects it. Batches are capped at 100 tasks. Missing,
  stale, duplicate, foreign-product, quarantined, tombstoned, or unresolved
  creation sources cannot be silently changed. Single plan removal also uses
  this versioned transaction now.
- Removal means removal from the plan only. It preserves the creative and its
  ClickUp task and writes no deletion tombstone. Destructive deletion parity,
  hidden/adopted cards, and broader lifecycle controls still need review.
- Only selected **visible** rows are operated on. Hidden selections are counted
  explicitly and excluded. Successful tasks are deselected; failed/pending
  tasks remain selected. A per-task result list distinguishes local saves from
  remote failures. This list is session UI, not a persistent batch job log.
- Bulk pushes run sequentially, using the existing durable create/recovery
  workflow for new tasks and durable pending-field updates for linked tasks.
  There are no automatic create retries. A stop control prevents later remote
  requests after the in-flight request finishes. Leaving the tab/product also
  stops subsequent requests; a committed local batch is not undone.
- Linked pushes re-check the current product-scoped action/source/task identity
  on the server. Local saves survive failed remote writes; those fields stay
  pending for an explicit later push. Unlinked standalone actions can be edited
  locally but need a creative before pushing; linked standalone actions without
  a resolved creative are rejected by bulk editing.

### Verification

- Migration `20260918030000_qa_action_plan_batch.sql` applied and recorded only
  in QA project `entgcnlfsnysnwyadzzp`. Production, legacy HTML, environment files,
  and deployment configuration were not changed. Nothing was pushed.
- `node scripts/check-qa-action-plan-migration.mjs` passes rollback-only SQL
  tests for access checks, stale snapshots, all-or-nothing edits/removals,
  duplicate selections, invalid values, source identity, unresolved creation,
  status/milestone/due mirrors, pending fields, and atomic activity. The prior
  creation-workflow SQL suite also passes; synthetic records are rolled back.
- All 160 domain/service tests, TypeScript, optimized Next.js build, and
  `git diff --check` pass.
- Full intercepted browser regression passes, including table/filter/sort,
  hidden-selection exclusion, bulk status/date changes, remote failure with a
  retained local save, explicit retry, stopping, nondestructive removal,
  reload, and desktop/mobile layouts. No console errors or external requests
  were recorded. Real ClickUp writes were not performed.

### Remaining Within Step 7

- Remaining inline/canonical creative editing parity (per-task assignments and
  noncanonical custom-field editing are covered by Part 2 below).
- Per-user saved views and column visibility/order/width persistence are now
  covered by Part 3 below; unsupported legacy columns still need parity review.
- Pipeline, week, trend/date-window views and remaining legacy filters/pulse.
- Complete paginated task history, adopted/hidden cards, and deletion parity.
- QA-safe OneScale launch and callback workflow. The legacy production callback
  was identified during comparison but was neither called nor changed.
- Live acceptance of these workflows and exact legacy visual comparison remain
  release gates. Step 7 is **not complete**; the total stays 6/13 completed and
  7 milestones remaining (Steps 7 through 13).

## Step 7, Part 2: Assignments And Custom Fields

- Added Editor and Reviewer columns and a field editor reachable from the table
  and task drawer, all within the existing Action Plan tab at `/`. Editor uses
  native ClickUp task assignees; Reviewer uses the list's people custom field.
  Both support multiple selections and explicit clearing. Unknown existing
  members remain selected even when omitted from list membership responses.
- Reused the Tracker's schema-driven controls and typed field validation.
  Noncanonical custom fields preserve numbers, zero, false, dates, dropdowns,
  labels, and people arrays; unsupported types remain read-only. Canonical
  taxonomy and configured mapped fields are excluded to avoid bypassing the
  creative editor's identity/mirroring path. Wider inline editing parity remains.
- Dialogs keep a snapshot of the selected action and creative. Realtime
  refreshes do not reset drafts. Saves use both displayed row versions and
  explicit source/task identities; stale saves retain the editor and report a
  conflict. Closing during schema loading aborts the request; missing connection
  keys or failed schema loads offer retry without replacing the dashboard.
- `qa_plan_fields` checks active product access, versions, source identity,
  tombstones, quarantine, and unresolved creation state. It saves creative and
  action mirrors with per-field activity in one transaction. Canonical mapped
  fields and malformed people assignments are rejected; empty updates emit no
  duplicate activity. Unrelated brief and metadata values are preserved.
- Linked tasks can be saved locally only, or saved and pushed through the
  existing QA-only pending-field workflow. Failed pushes retain local changes
  and pending fields; they do not report remote success. Reloaded table labels
  use current member data and do not prefer an old cached assignment name.
- Table columns now have stable widths and horizontal scrolling on narrow
  screens so added people columns do not collapse other cells into tall rows.

### Part 2 Verification

- Migration `20260918040000_qa_action_plan_fields.sql` applied and recorded only
  in QA project `entgcnlfsnysnwyadzzp`. Production, legacy HTML, environment files,
  and deployment settings were unchanged; nothing was pushed.
- `node scripts/check-qa-plan-fields-migration.mjs` passes authenticated,
  rollback-only database tests for stale rows, unauthorized products, invalid
  people/canonical fields, mirrored assignments and clears, typed zero/false,
  preserved metadata, pending fields, no-op/history behavior, and unresolved
  creation guards. All synthetic data is rolled back.
- All 164 domain/service tests, TypeScript, optimized build, and diff checks
  pass. Full intercepted browser regression passes with no console errors or
  external requests; focused coverage includes missing-key retry, unknown member
  retention, live-refresh drafts, local save with failed remote push, local-only
  saves, clearing/reloading assignments, and desktop/mobile dialogs.
- No real ClickUp assignment or custom field was changed in verification.
  Live acceptance, complete history, saved views/columns, pipeline/week/trends,
  lifecycle controls, OneScale, and full legacy visual parity remain outstanding.
  Step 7 remains in progress: 6/13 milestones complete, 7 remaining.

## Step 7, Part 3: Saved Views And Columns

- Added named column layouts inside Action Plan at `/`: create, rename, switch,
  reset, and delete views; show/hide columns, reorder them, and set bounded
  widths. Task and selection columns remain visible. Custom fields present on
  linked tasks can be enabled as additional sortable columns, including zero.
- Preferences belong to the signed-in user and persist across reloads, products,
  and browser tabs. Layouts store columns only; filters, sort, and card/table mode
  are not part of this persistence. No separate feature page was introduced.
- Added `profiles.ap_col_state` in QA and the authenticated
  `qa_plan_preferences` transaction. Saves lock the caller's profile, check
  active access and the expected prior namespace, and validate bounded layouts.
  Conflicts report that another tab changed preferences instead of overwriting
  them. Open manager drafts retain their snapshot during background updates.
- QA layouts use the `qa_next` namespace, preserving existing legacy preference
  keys and views. Supported legacy column definitions seed initial layouts;
  unsupported legacy columns remain in the original JSON, not in the QA table.
  Legacy writers still replace their whole JSON value, so using both UIs to edit
  preferences against one database is not a supported coexistence guarantee.
- Column settings wait for the initial task load so custom columns are available
  when opening the manager. Desktop and mobile widths/scrolling were checked.

### Part 3 Verification

- Migration `20260918050000_qa_action_plan_preferences.sql` applied and recorded
  only in QA project `entgcnlfsnysnwyadzzp`. Rollback-only authenticated SQL tests
  pass for per-user isolation, legacy preservation, stale-save rejection,
  required columns, bounds, invalid active views, and inactive callers. No
  synthetic users remain.
- All 168 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. Full intercepted browser regression passes with no console errors
  or external requests. Saved-layout coverage includes create/rename/delete,
  visibility/order/width, custom columns, reload, cross-product persistence,
  cross-tab updates, retained drafts, and responsive controls.
- Production, legacy HTML, environment files, and deployment configuration were
  unchanged. Nothing was pushed, and verification made no real ClickUp writes.
- Next within Step 7: remaining canonical/inline editing, pipeline/week/trend
  views and filters, full history, hidden/adopted/deletion lifecycle, QA-safe
  OneScale, and live/visual acceptance. Step 7 remains in progress: 6/13 milestones
  complete, 7 remaining.

## Step 7, Part 4: Task Names And Creative Details

- Added inline task-name editing with explicit save/cancel and validation.
  Linked names update the creative and action together. Standalone actions can
  rename locally; ambiguous heuristic links and unresolved remote-only actions
  cannot accidentally update a different creative.
- Added a creative-details dialog from the Action Plan table and task drawer,
  reusing Tracker controls for name, angle/persona, ad type, funnel, links, hook,
  structure, production style, USP, winning element, hypothesis, and notes.
  All controls stay in the single dashboard at `/`. No new feature route or
  embedded legacy HTML was added.
- The editor loads the exact product-scoped creative and product taxonomy, then
  keeps a snapshot. Loading errors offer retry; later refreshes do not replace
  drafts. Saves check the original action and creative versions and preserve
  drafts on rejected writes. Status/due dates retain their existing dedicated
  milestone-aware controls; assignments/custom fields retain Part 2's editor.
- `qa_plan_creative` validates active product access, explicit source/task
  identities, stale versions, tombstones/quarantine, unresolved creation,
  supported fields, and existing product taxonomy before reusing the Tracker
  transaction. Creative values, selected action mirrors, pending remote fields,
  and per-field activity commit together. Repeated identical saves emit no new
  activity. Clearing fields preserves unrelated metadata and existing briefs.
- Explicit Matrix assignments remain unchanged, matching the existing Tracker
  editor behavior. This does not move a creative between assigned Matrix cells.
  Notes/hypothesis are editable creative fields, not a replacement for the
  separately stored action description.
- Linked edits optionally push through the QA-only pending-field workflow.
  Remote failures retain local changes and report pending fields; inline rename
  uses the same path. No real ClickUp writes were used for verification.

### Part 4 Verification

- Migration `20260918060000_qa_action_plan_creative.sql` applied and recorded only
  in QA project `entgcnlfsnysnwyadzzp`. Authenticated rollback-only SQL coverage
  passes for stale action/creative versions, foreign-product access, identity
  mismatches, invalid URLs/taxonomy/metadata, workflow-bypass rejection, mirrors,
  explicit clears, metadata preservation, pending fields, history/no-op behavior,
  standalone renaming, and unresolved-creation rejection. Prior Tracker and
  Action Plan field SQL suites also pass with fixtures rolled back.
- All 171 domain/service tests, TypeScript, optimized build, and diff checks
  pass. Full intercepted browser regression passes with no console errors or
  external requests, including inline validation/cancel, local-only saves,
  remote failure retention, draft preservation, reload, and mobile/desktop
  creative editors.
- Work remains local on `qa`; nothing was pushed. Production, legacy HTML,
  environment files, and deployment configuration were unchanged.
- Step 7 still needs pipeline/week/trend/date views, remaining legacy filters
  and inline interaction parity, full history, hidden/adopted/deletion lifecycle,
  QA-safe OneScale, and live/visual acceptance. Overall: 6/13 milestones complete,
  7 remaining (Steps 7 through 13).

## Step 7, Part 5: Pipeline And Week Views

- Added Pipeline and Week to the Action Plan layout controls at `/`. Both reuse
  existing filtered product data; switching layouts keeps search, filters, sort,
  and selected tasks in the current tab session. Layout mode is not persisted
  across reloads and is separate from saved column layouts.
- Pipeline groups tasks by status, including custom statuses and blank-status
  fallback. Case-only status differences share a column. QA ClickUp status
  ordering and empty configured columns load through the authenticated,
  QA-list-bound `plan-statuses` read operation. Unknown local statuses are
  appended rather than dropping tasks. Missing keys or failed reads retain a
  local fallback and offer explicit retry; changing product aborts pending reads.
- Pipeline task selection reuses existing visible-only bulk operations. Opening
  a card switches to the table and existing task inspector without changing
  filters or column preferences. There is no drag/drop status mutation, matching
  the inspected legacy pipeline's click-to-table behavior. Age/checkpoint badges
  and exact legacy visual treatment still belong to the remaining parity work.
- Week shows the current local Monday-Sunday period with Created, Launched, and
  Decided counts, not a due-date calendar. Like legacy, Created uses creation
  time; Launched/Decided use the latest status-change time and current status
  (`testing|live` and `winner|loser`). These are snapshot-derived counts, not a
  historical event ledger. Future days are marked upcoming. Counts use current
  filters and update with realtime data. Local calendar boundaries handle
  daylight-saving transitions; a clock refresh handles day/week rollover.
- Week is a read-only summary. Bulk controls and table column preferences are
  hidden there to avoid presenting aggregate totals as selectable task rows;
  switching back retains the existing selection. Pipeline scrolls horizontally
  on narrow screens, while the week grid reflows without page overflow.

### Part 5 Verification

- All 177 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. New coverage includes configured/custom/empty status groups,
  case normalization, filter retention, Monday/Sunday boundaries, invalid and
  future timestamps, week rollover, spring/fall daylight-saving boundaries, and
  read-only status loading restricted to the QA ClickUp list.
- Full intercepted browser regression passes with no console errors or external
  requests. Focused coverage verifies missing-key fallback/retry, configured
  order, custom statuses, task-detail navigation, hidden selection exclusion,
  weekly counts and filters, realtime updates, product isolation, and
  desktop/mobile layouts. The focused new-view test makes zero database writes.
- Restarted and browser-verified the local QA dev server at
  `http://127.0.0.1:3000`. No database migrations, production changes, real ClickUp
  writes, environment changes, or pushes were made in this part.
- Next: trends/date windows and remaining filters/pulse, followed by complete
  history, hidden/adopted/deletion lifecycle, QA-safe OneScale, and live/visual
  acceptance. Step 7 remains in progress: 6/13 milestones complete, 7 remaining.

## Step 7, Part 6: Date Windows And Trends

- Added all legacy date presets and a validated custom range inside the Action
  Plan tab at `/`. Date basis switches between creation time and latest status
  change time, matching legacy lifetime/window behavior. These filters compose
  with existing facets and apply to table, cards, pipeline, and week views.
- Date bounds use local calendar days, including the entire final day with an
  exclusive next-day boundary. Invalid/reversed dates cannot apply. Custom
  edits remain drafts until applied; cancel preserves the previous range.
  A shared clock refreshes date filters, week counts, and trends on minute ticks,
  focus, and visibility changes, with listener cleanup on unmount.
- Added 30-day Created, Launched, and Decided charts, all-time current-status
  win rate, winner/loser totals, and an accessible daily totals table. Like the
  legacy view, Trends uses all resolved product actions rather than the active
  filters. Launch/decision counts use current status and latest status-change
  time, not historical event counts. No decisions shows 0% win rate.
- Trends hides task filters, bulk mutation controls, and the task inspector.
  Returning to the table restores filters, selection, and the selected task.
  An already-running bulk operation retains its stop control in Week/Trends.
  Charts reflow to one column on narrow screens without page overflow.
- The legacy "Stuck right now" KPI is not yet migrated. It depends on the
  remaining age/checkpoint and pulse logic; overdue counts are not a substitute.
  Full legacy visual parity is also still pending.

### Part 6 Verification

- All 183 domain/service tests, TypeScript through the optimized Next.js build,
  and diff checks pass. Date tests cover every preset, leap years, invalid and
  reversed ranges, final-day milliseconds, missing timestamps, date-basis
  differences, filter composition, and spring/fall daylight-saving boundaries.
- Full intercepted browser regression passes with no console errors or external
  requests. New coverage checks custom apply/cancel, hidden selection exclusion,
  aggregate scope, chart values/daily totals, realtime updates, day rollover,
  product isolation, inspector restoration, and desktop/mobile layouts. Focused
  date/trend checks make zero database writes. Additional bulk coverage verifies
  that stop remains available after switching to Week and Trends.
- Local QA server is available at `http://127.0.0.1:3000`. Work remains on `qa`;
  no push, deployment, database migration, real ClickUp write, or production
  change was made. Legacy HTML, environment files, and deployment configuration
  remain unchanged.
- Next within Step 7: age/checkpoints and pulse/attention/hygiene, remaining
  filters and interaction parity, complete paginated history,
  hidden/adopted/deletion lifecycle, QA-safe OneScale, and live/visual acceptance.
  Overall remains 6/13 milestones complete, 7 remaining (Steps 7 through 13).

## Step 7, Part 7: Age And Attention Indicators

- Added a shared, read-only age projection for status badges in the table,
  cards, pipeline, and task inspector. It preserves legacy status thresholds,
  production's exact past-due override, neutral terminal statuses, Day-7 testing
  review, Day-14 final review, and existing seven-day snooze grace/expiry.
  Checkpoints use elapsed time, not local calendar-day counts.
- Age clocks use the latest reliable status/launch/approved/creation timestamp,
  capped at now. The legacy shared-baseline heuristic ignores a status timestamp
  repeated across five or more ads in the same product. Detection includes all
  loaded product ads, not just visible cards, and excludes foreign products.
  This is a display projection only; source timestamps are not rewritten.
- Reads and validates existing product-specific `ap.ageThresholds.overrides`
  preferences without writing them. Invalid JSON, malformed thresholds, and
  foreign-product preferences cannot change the active product's rules. Storage
  and focus events refresh preferences; existing clock/realtime updates refresh
  task age and checkpoint state.
- Shared the existing QA ClickUp status reader between pipeline and attention
  views so configured `done`/`closed` statuses stay neutral in every layout.
  Missing credentials or failed reads explicitly show fallback to default
  status rules with retry. Reads retain QA-list enforcement and abort on unmount.
- Added a Needs attention checkbox and full-product count/status breakdown.
  It composes with existing filters and visible-only bulk operations; reset
  clears it, while switching layouts retains it. Trends now includes the
  full-product Stuck right now count from the same red-state projection,
  independent of active row filters. It is not an overdue count.
- This portion does not add snooze writes or a checkpoint decision dialog.
  Those need guarded persistence and stale-write tests. Linked production
  `date_done` lookup/cache is also still pending: Ready to Launch currently uses
  its reliable status/approved/creation fallback. Corrected age timestamps are
  not yet substituted into the date filters or week/trend event counts.
  Dedicated sortable/saved Age column placement, full pulse tiles/custom pulse
  ranges, remaining filters, and exact visual parity remain acceptance work.

### Part 7 Verification

- All 192 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. New tests cover thresholds, missing/future timestamps, exact
  Day-7/Day-14/snooze boundaries, terminal/custom-closed states, production due
  overrides, timestamp repair, product isolation, preference validation,
  filter composition, and immutable source data.
- Focused intercepted browser checks pass with zero database writes, console
  errors, or external requests. They cover missing-key recovery, closed-status
  metadata, badges across layouts, hidden selection exclusion, all-product
  counts, preference refresh/corruption, realtime status changes, snooze expiry,
  product switching, and desktop/mobile layouts. Screenshots were inspected.
- Full intercepted browser regression also passes with no console errors or
  external requests. The creative-editing test now distinguishes the new
  read-only status reload from remote writes; local-only saves still issue no
  ClickUp writes.
- No migrations, production changes, real ClickUp writes, environment changes,
  commits, or pushes were made. QA remains available at `http://127.0.0.1:3000`.
- Next within Step 7: guarded checkpoint decisions/snooze, linked-production
  age lookup and timestamp consistency, full pulse/filter interactions, complete
  paginated history, hidden/adopted/deletion lifecycle, QA-safe OneScale, and
  live/visual acceptance. Overall remains 6/13 complete, 7 milestones remaining.

## Step 7, Part 8: Testing Reviews And Snooze

- Due testing badges now open a review dialog from the table, cards, pipeline,
  or inspector within the same command center at `/`. It offers Winner,
  Mild Winner, Scale, and Loser. The first unused review also offers seven more
  days of testing. Final reviews never offer snooze. Unresolved/unlinked tasks,
  quarantined/deleted creatives, and locked creation jobs are not reviewable.
- The dialog captures action/creative versions when opened. Realtime refreshes
  do not replace the selected decision or silently update the write snapshot.
  Rejected writes retain the selection and show an error; reopening loads the
  current task. Saving disables decisions, submit, and close. Cancel makes no
  changes. Mobile and desktop screenshots were checked.
- Added `qa_plan_checkpoint`: active product access, version/identity checks,
  row locks, tombstone/quarantine/duplicate-link checks, and unresolved-creation
  guards precede any write. The database calculates the current checkpoint from
  its own clock and stored timestamps, including shared-baseline repair and
  launch-date fallback. Client clock changes cannot grant snooze eligibility.
- Snoozing is permitted only once, during the first review. It stores the
  deferred timestamp/count and metadata mirrors, preserves the original Testing
  timestamp and unrelated metadata, and records an activity event atomically.
  Snoozing never sends a ClickUp write. Retry with an old snapshot is rejected;
  a fresh retry during snooze is also rejected, without another activity event.
- Decisions reuse the existing transactional status/milestone/history workflow
  and pending-field tracking. An optional ClickUp push follows the local commit;
  failure keeps the local decision and pending status and reports it clearly.
  The existing Push control can retry pending remote fields.
- A QA database trigger clears both column and metadata snooze state when a
  creative genuinely enters or leaves Testing, and stamps the new transition.
  Same-status edits, including case-only changes, preserve the current cycle.
  This applies to the existing Tracker/Action Plan status paths as well.

### Part 8 Verification

- Migration `20260919010000_qa_plan_checkpoints.sql` applied and recorded only in
  QA. Follow-up checks confirm the RPC and cycle-reset trigger are installed and
  the synthetic checkpoint user was rolled back.
- All 198 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. Full intercepted browser regression passes with no unexpected
  console errors or external requests. Two deliberate HTTP 409 responses test
  stale-version rejection and a first review that becomes final while open.
- Authenticated rollback-only SQL suites pass for checkpoints, Tracker, bulk
  Action Plan edits, and creative-detail edits with the new trigger installed.
  Coverage includes all four decisions, snooze history/preservation, early and
  repeated attempts, final-review limits, stale rows, foreign/inactive access,
  identity conflicts, duplicates, quarantine/deletion, unresolved creation,
  launch-date/shared-baseline clocks, same-status preservation, and cycle reset.
- The migration runner refuses any linked project other than QA
  `entgcnlfsnysnwyadzzp`; synthetic data is rolled back. No real ClickUp writes,
  production changes, environment changes, commits, or pushes were made.
- Next within Step 7: linked-production age lookup and timestamp consistency,
  full pulse/filter interactions, sortable/saved Age column, complete paginated
  history, hidden/adopted/deletion lifecycle, QA-safe OneScale, and live/visual
  acceptance. Overall remains 6/13 complete, 7 milestones remaining.

## Step 7, Part 9: Linked Completion Dates And Shared Timestamps

- Ready-to-launch tasks with explicit, versioned creative links now look up the
  first non-self linked ClickUp task's completion date, matching the legacy
  selection rule. Reads use the authenticated QA endpoint and product access
  checks. Both remote task identities and their QA list membership are verified
  before a completion date is accepted. Missing, deleted, quarantined, foreign,
  or non-ready creatives cannot supply a date; local tombstones are checked.
- The read-only service accepts at most 20 creative IDs per batch. Per-task
  failures retain successful results; rate limiting stops further batch reads.
  Cancellation propagates without turning an aborted lookup into a cached error.
  The operation does not update either Supabase or ClickUp.
- The component-scoped cache separates products, lists, task IDs, and source
  versions. Results, including no-completion results and failures, expire after
  five minutes and are reconsidered by the existing minute/focus clock. Source
  changes invalidate the corresponding entries. An explicit refresh control
  retries immediately; fallback/error and loading states remain visible.
  Product switches/unmounts cancel in-flight work. No persistent global cache
  or credentials are introduced.
- A read-only health projection now supplies the same resolved status timestamp
  to age badges, filters/sorting, Week, and Trends. It preserves the legacy
  approved/created/launch fallbacks, polluted-baseline detection, newer raw
  transitions, and future-date cap. Source records, versions, and write payloads
  remain unchanged. Selected tasks remain selected when their dates move them
  into or out of the visible filter.

### Part 9 Verification

- All 211 domain/service tests pass, including QA-list/identity enforcement,
  member-readable integration dispatch, product-scoped local reads, metadata
  fallbacks, tombstones, malformed dates, no-link results, partial failures,
  throttling, cancellation, and shared age/date/week/trend calculations.
- TypeScript and the optimized Next.js build pass. Full intercepted browser
  regression passes with no unexpected console errors or external requests.
  New browser coverage verifies missing-key recovery, manual refresh, date
  filtering with retained selection, stale response rejection, negative caching,
  TTL expiry, realtime version invalidation, and product-change cancellation.
  The focused linked-completion flow performs zero database mutations.
- Desktop/mobile screenshots were inspected and document overflow checks pass.
  This verifies the current migrated layout, not final legacy visual parity.
  Real linked-task acceptance testing remains part of Step 7's live QA gate.
- No migrations, live backend writes, production changes, environment changes,
  commits, or pushes were made in this part. Work remains on `qa`; the local
  command center is available at `http://127.0.0.1:3000/`.
- Next within Step 7: full pulse/filter interactions, sortable/saved Age column,
  complete paginated history, hidden/adopted/deletion lifecycle, QA-safe OneScale,
  and live/visual acceptance. Overall remains 6/13 complete, 7 milestones remaining.

## Step 7, Part 10: Pulse Strip And Filter Interactions

- Added Today and period pulse sections directly inside the root command center.
  They show the legacy metric groups, equal-length previous-period deltas, and
  activity distributions from all resolved product tasks, independent of table
  filters. Initial counters wait for the first data load; realtime changes and
  the shared minute/focus clock update them without clearing filters or selection.
- Tiles are keyboard-accessible toggle buttons. Multiple non-created metrics
  form a status union; the last remaining selected scope controls the date window.
  Created-only selections use creation time, mixed selections use status time.
  Explicit period ranges retain their dates when tiles toggle or the last tile
  is removed. Ordinary status/date controls clear tile selections they supersede.
- Counter and filter status rules are shared. This deliberately fixes legacy
  disagreements for statuses such as Mild Winner, Scale, Complete, and In Progress,
  and prevents a zero-match tile from falling back to all statuses. Date windows
  use the existing inclusive calendar-day rules, so counters and clicked results
  agree at midnight and across DST. Deltas compare the immediately preceding
  equal-duration window; they are not historical transition-event counts.
- Reused the validated date dialog for the period picker. Presets/custom ranges
  also filter the task list; invalid or cancelled drafts leave the live range
  unchanged. Reset returns the pulse to its default week and removes the date
  restriction. The Today section retains its own calendar-day counters.
- Added removable chips for search, status, taxonomy, funnel, ad type, source,
  due date, date range, attention, and selected tiles, plus a clear-all command.
  Added the ad-type selector. Existing visible-only bulk safeguards continue to
  exclude hidden selections. Trends hides the pulse and filters and restores
  their state when returning to task views. Product switches start fresh.
- Components and pure pulse rules are separate modules; no new pages, database
  schema, API routes, remote requests, or credential storage were introduced.

### Part 10 Remaining Work

- Next: sortable/saved Age column. Step 7 also retains multi-select facet/anomaly
  filter parity, complete paginated history, hidden/adopted/deletion lifecycle,
  QA-safe OneScale, and live/visual acceptance. The new pulse does not complete
  the whole Action Plan milestone or establish exact legacy visual parity.
- Overall remains 6/13 complete, 7 milestones remaining (Steps 7 through 13).

### Part 10 Verification

- All 216 domain/service tests pass. New pure tests cover tile/counter agreement,
  zero matches, aliases, mixed-scope unions, created/status basis, explicit-range
  preservation, invalid inputs, immutable state, equal-duration deltas, final-day
  milliseconds, and spring/fall DST boundaries.
- TypeScript and the optimized Next.js build pass. Full intercepted browser
  regression passes with no unexpected console errors or external requests.
  The focused pulse flow records zero writes and verifies keyboard toggles,
  removable chips, period validation/cancel/reset, search/type composition,
  selection preservation, realtime updates, clock rollover, and product isolation.
- Desktop/mobile screenshots were inspected; mobile document overflow checks
  pass. Final exact visual parity and realistic live acceptance remain pending.
- No production changes, live backend writes, migrations, environment changes,
  commits, or pushes were made. Work remains on `qa`; the server remains at
  `http://127.0.0.1:3000/`.

## Step 7, Part 11: Sortable And Saved Age Column

- Added a separate `Age in status` column, matching the legacy table structure.
  New default layouts place it after Status. Existing layouts gain the column
  without reordering their saved columns; explicit legacy Age visibility, order,
  and width are retained subject to normal width limits.
- The existing layout manager can show/hide, reorder, resize, and save Age in
  Default or named layouts. It uses the existing guarded QA preferences workflow;
  no database migration is required. As before, layouts save columns, not the
  current sort direction or task filters.
- The table renders age/checkpoint badges only in the Age cell, not duplicated
  below Status. Review buttons remain usable with Status hidden. Hiding Age
  removes it from the table; cards, pipeline, and inspector badges are unchanged.
- Sorting consumes exact elapsed milliseconds from the same health calculation
  as the badge. It does not sort rounded day labels or review text. Missing ages
  stay last in either direction, equal values have stable task-ID ordering, and
  future dates are zero-aged. Terminal/snoozed tasks retain their true duration.
  Linked-completion corrections, fallback dates, and realtime changes update
  ordering without discarding selected tasks or mutating source records.
- Next: complete paginated history. Step 7 still also needs multi-select
  facet/anomaly filter parity, hidden/adopted/deletion lifecycle, QA-safe OneScale,
  and live/visual acceptance. Overall remains 6/13 complete, 7 milestones remaining.

### Part 11 Verification

- All 220 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. Full intercepted browser regression passes with no unexpected
  console errors or external requests.
- Focused coverage verifies exact sorting for equal-looking rounded labels,
  both directions, missing-last behavior, stable ties, future dates, fallback
  clocks, snoozed/terminal ages, and linked-production corrections. Browser
  checks verify realtime reorder with selection retained, clickable checkpoints
  with Status hidden, saved width/order/visibility, reload, and layout switching.
- Desktop and mobile screenshots were inspected. The wide table scrolls within
  its existing container, with no document overflow. The focused browser flow
  permits only mocked preference writes, not task or remote mutations.
- No migrations, live backend writes, production/environment changes, commits,
  or pushes were made. The QA server remains at `http://127.0.0.1:3000/`.
  Exact legacy visual parity and realistic live acceptance remain pending.

## Step 7, Part 12: Paginated Task And Product History

- Replaced the inspector's filter over the latest 40 product events with a
  dedicated product-scoped query matching action ID, linked ClickUp task ID, or
  an explicitly linked creative's metadata ID. Unrelated recent events cannot
  displace the selected task's history. The Cards summary has its own paginated
  product feed. Neither history feed blocks loading the main task list.
- Added a read-only service with 40-row pages and a one-row lookahead. Descending
  timestamp/ID cursors retain original timestamp precision and handle ties;
  there is no fixed total-history cutoff. Query literals are escaped, identity
  predicates are grouped with cursor predicates, and returned product/task
  boundaries are checked before committing a page.
- Load older, refresh, loading/error, retry, and end-of-history states are
  available in place. Failed page loads preserve the last successful timeline.
  Realtime/focus refreshes re-read the loaded page depth and commit it atomically;
  task/product switches cancel old queries and cannot display late responses.
  History is loaded only while its task inspector or Cards feed is mounted.
- The timeline also displays every retained payload `_history` entry rather
  than the legacy drawer's first 20. Adoption milestones require the actual
  adopted origin; push/adoption fallbacks are suppressed when known events exist.
  Recorded events, legacy records, and saved milestones retain distinct source
  labels. Old/new values, actor, task links as text, and timestamps are shown;
  malformed legacy dates remain visibly undated and all details render as text.
- History is contained in a keyboard-focusable scrolling region, including on
  mobile. It does not change task records, schema, routes, credentials, or
  production files. Events already discarded by legacy's 50-entry payload cap
  cannot be recovered unless they were separately recorded in activity_events.

### Part 12 Verification

- All 229 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. Full intercepted browser regression passes with no unexpected
  console errors or external requests. The focused history flow performs no writes.
- Tests cover tied timestamps across multiple pages, microsecond cursor precision,
  inserts between pages, quote/punctuation escaping, malformed/foreign/duplicate
  responses, cancellation, legacy entries, milestone suppression, safe text,
  and preservation of database ordering within a JavaScript millisecond.
- Browser fixtures verify 87 matching task events despite 120 newer unrelated
  events, 50 retained legacy entries, failed-page retry without losing loaded
  rows, realtime additions, delayed old-task responses, independent Cards history,
  product isolation, and desktop/mobile scrolling without document overflow.
- No live backend writes, migrations, production/environment changes, commits,
  or pushes were made. Live acceptance and exact visual parity remain pending.
- Next: multi-select facet/anomaly filter parity, followed by hidden/adopted/
  deletion lifecycle, QA-safe OneScale, and live/visual acceptance within Step 7.
  Overall remains 6/13 complete, 7 milestones remaining (Steps 7 through 13).

## Step 7, Part 13: Multi-Select Facets And Anomalies

- Replaced the six single-choice facet selectors with checkbox menus for status,
  angle, persona, funnel, ad type, and source. Selections are ORed within each
  category and ANDed across categories. Status matching/deduplication is
  case-insensitive, matching legacy behavior; other facets remain exact.
- Each selected value has a removable chip, with per-facet and all-filter reset.
  Selected options remain available even when a refresh removes their last
  matching task. A filter cannot silently widen itself because data changed.
  Direct status selections clear pulse tiles, and pulse tiles clear manual status
  selections. Search, date windows, attention, due dates, and hidden bulk-selection
  exclusion continue to compose with the new filters.
- Added a shared, read-only anomaly calculation for deleted ClickUp tasks,
  production-tag removal within 14 days, current adoption, and re-links within
  24 hours. Adoption uses origin/virtual identity, not `_adoptedAt` alone.
  Tag-removal indicators require a linked ad, recorded ClickUp identity, and a
  non-production task type. Invalid/future dates are ignored instead of leaving
  erroneous recent-event badges. Boundaries are strict and use the shared clock.
- Table titles, cards, pipeline cards, and task details use the same badges as
  the Anomalies-only filter. Its count represents tasks with at least one anomaly,
  independently of other active filters. Realtime updates and clock expiry update
  both badges and results. This does not yet synthesize or manage adopted tasks;
  that lifecycle work remains the next part.
- Menus support native checkbox keyboard interaction, label clicks, Escape with
  focus restoration, outside-click/focus dismissal, and bounded scrolling.
  Placement stays inside desktop/tablet/mobile viewport edges. All interactions
  stay inside the existing command center at `/`; no new routes were added.

### Part 13 Verification

- All 236 domain/service tests, TypeScript, and the optimized Next.js build pass.
  Focused intercepted browser coverage passes without writes, external requests,
  or console errors. It covers combinations, empty results, retained selections,
  chips/resets, pulse interaction, anomaly/attention composition, expiry, realtime,
  layout/product isolation, hidden bulk selections, and keyboard/label controls.
- Desktop, tablet (768px), and mobile (390px) menu bounds are checked. Desktop
  and mobile screenshots were inspected; a tablet dropdown overflow found during
  testing was corrected. Full intercepted browser regression passes across all
  admin/member tabs and previously migrated workflows, with no unexpected console
  errors or external requests. Its existing mutation checks use synthetic fixtures.
- No live backend writes, migrations, production/environment changes, commits,
  or pushes were made. Exact legacy visual parity and live acceptance remain
  pending. QA server: `http://127.0.0.1:3000/`.
- Next: hidden/adopted/deletion lifecycle, followed by QA-safe OneScale and live/
  visual acceptance within Step 7. Overall remains 6/13 complete, 7 milestones
  remaining: Action Plan, Inspiration, Production, Command HQ, taxonomy/admin,
  regression/security, and acceptance/approved cutover.

## Step 7, Part 14: Personal Visibility And Deletion Guards

- Added per-user Hide/Restore controls in the task table, cards, pipeline, and
  inspector. These use the existing `profiles.ap_dismissed_ad_ids` field and do
  not remove manual actions, creatives, or ClickUp tasks. As in legacy, hiding
  is keyed by linked creative; unlinked manual tasks do not get a hide control.
  Existing Remove-from-plan remains a separate, confirmed operation.
- Show hidden reveals hidden tasks alongside ordinary results, with a removable
  chip and a count of distinct hidden creatives in the current product. Search,
  facets, dates, and other filters still apply. Hidden selections remain selected
  but are excluded from bulk actions unless explicitly revealed. All-product
  summary/pulse/trend counters are unchanged by a personal visibility preference.
- Preferences load from the authenticated profile, not unscoped local storage.
  Initial loading/failure does not briefly reveal hidden rows. Last-good state
  survives refresh/save failures, with an explicit retry control. Realtime,
  focus, and cross-tab invalidation re-read preferences; switching products
  resets Show hidden and computes only that product's hidden count.
- The service is restricted to the configured QA project. It validates the
  signed-in, active, non-reset-required profile and the selected product creative.
  A save changes only the dismissal column, preserving other product IDs and
  unrelated preferences. Compare-and-swap writes merge concurrent changes with
  at most three conflict attempts; network failures are not blindly retried.
  The UI updates only after a verified save acknowledgment.
- Action Plan now reads/subscribes to product-scoped `deleted_ads`. Deleted and
  quarantined ad identities, including ClickUp aliases, are retained as exclusion
  evidence before candidate filtering. Referencing actions cannot fall through
  to a same-title replacement creative. Deleted/quarantined actions and reimported
  tombstoned creatives are excluded; linked resolution is product scoped. Health
  calculations use the same eligible creative set. New tombstones remove stale
  rows/inspectors after the scoped refresh, even with Show hidden enabled.
- Remote `_clickupTaskDeleted` alone remains a visible anomaly, not an instruction
  to delete the local action. This part does not recreate remote tasks, synthesize
  adopted rows, or promote virtual rows. Those lifecycle paths remain pending.

### Part 14 Verification

- All 246 domain/service tests, TypeScript, optimized Next.js build, and diff
  checks pass. Focused intercepted browser checks pass with preferences-only
  mocked writes and no console errors or external requests.
- Coverage includes idempotent hide/restore, preserving unrelated preference
  fields/IDs, conflict retries/exhaustion, null/malformed preferences, invalid
  acknowledgments, unavailable creatives, account restrictions, QA-only access,
  product-scoped tombstones, quarantine, and retained remote-deletion anomalies.
- Browser checks cover reload, chips/search, selection exclusion, failed-save
  preservation/retry, cross-tab and realtime updates, cards/pipeline/table controls,
  product isolation, initial preference-load failure/recovery, and new tombstone
  cleanup of an open inspector. Desktop/mobile screenshots were inspected and
  document overflow checks pass. Full intercepted admin/member browser regression
  also passes with no unexpected console errors or external requests; all of its
  mutation scenarios use synthetic fixtures, not a live database.
- No live backend writes, new migrations, production/environment changes, commits,
  or pushes were made. Existing schema/policies still need realistic QA acceptance;
  exact legacy visual parity is not claimed. Server: `http://127.0.0.1:3000/`.
- Next: automatic adoption/guarded promotion and remaining deletion/recreation
  lifecycle, then QA-safe OneScale and live/visual acceptance for Step 7. Overall
  remains 6/13 complete, 7 milestones remaining (Steps 7 through 13).

## Step 7, Part 15: Automatic Adoption And Guarded Promotion

- Eligible creatives without a saved Action Plan record now appear as virtual
  tasks across statuses, including terminal and app-created creatives. Explicit
  source IDs, resolved links, and ClickUp IDs prevent duplicate adoption within
  the product. Deleted, quarantined, tombstoned, ambiguously duplicated ClickUp
  identities, and explicitly removed creatives are excluded.
- Loading, filtering, opening details, cancelling edits, and personal Hide/Restore
  do not stage a task or write creative/action rows. The Auto-adopt toggle is a
  reversible view filter with a chip and virtual-task count. Hidden selections
  stay selected but cannot enter filtered bulk operations. Product-wide counters
  remain independent of this view filter, consistent with the other filters.
- Status/date changes, title/detail edits, assignments/custom fields, testing
  reviews, bulk editing, and ClickUp pushes promote virtual tasks only after an
  explicit mutation. The existing `qa_plan_stage` RPC supplies authorization,
  product/creative locks, source/task conflict checks, timestamps, tombstone
  checks, and reuse of an existing saved action. No new RPC/schema is required.
  The client additionally enforces the QA URL and verifies the returned product,
  source, task identity, saved ID, and action version before the actual edit.
- Stale snapshots and unverifiable acknowledgments do not trigger the requested
  edit or a blind retry. Successful promotion is a separate transaction from the
  edit: if the edit fails, the saved action remains and can be retried. Bulk
  staging is serial; if later staging fails, earlier staged records remain, but
  the requested batch edit has not run. Remote pushes retain their existing
  explicit pending/error and creation-recovery behavior.
- Stable linked-creative render keys preserve rename drafts through ID changes.
  Selection and the open inspector remap to the saved database ID, including
  when realtime reveals promotion by another tab. Ambiguous links are not
  remapped. Virtual history uses creative/ClickUp identity, never a synthetic
  `va:` ID in the UUID action filter.
- Persisted Remove-from-plan stays separate from Hide. Virtual tasks offer Hide,
  not saved-record removal. A product-scoped, fully paginated read of
  `removed_from_plan` events prevents automatic resurrection after removal/reload.
  Invalid reads retain the previous snapshot and report an error; task/product
  history pagination is still independent of the task load.
- Unlike the legacy renderer, app-created records are not automatically written
  merely because the tab renders. Staging currently retains the existing RPC's
  generic `added_to_plan` event and `Added from Matrix` reason; dedicated adoption
  provenance remains an acceptance follow-up. Remote-deletion markers remain
  visible anomalies and cannot silently promote/recreate a remote task.

### Part 15 Verification

- All 256 domain/service tests, TypeScript, and the optimized Next.js build pass.
  Focused intercepted browser checks cover read-only browsing, toggle/chips,
  hide/restore, status/date/title/fields/detail/checkpoint/bulk/push promotion,
  failed-save draft retention, stale rejection, concurrent saved-row reuse,
  selection/inspector remapping, and removal across reloads.
- Desktop/mobile screenshots were inspected and document-overflow checks pass.
  Browser mutations use synthetic fixtures, not live Supabase or ClickUp data.
  Full intercepted admin/member regression also passes with no unexpected console
  errors or external requests (80 mocked mutations across the complete suite).
- No live backend writes, new migrations, production/environment changes,
  commits, or pushes were made. The legacy production HTML and deployment
  configuration remain unchanged. QA server: `http://127.0.0.1:3000/`.
- Next: remaining deletion/recreation lifecycle, then QA-safe OneScale and
  live/visual acceptance for Step 7. Exact legacy visual parity and realistic
  authorization/concurrency acceptance are still pending. Overall remains 6/13
  complete, 7 milestones remaining (Steps 7 through 13).

## Step 7, Part 16: Confirmed Creative Deletion

- Added a separate Delete creative action in the Action Plan inspector, available
  from table/cards/pipeline details for explicit, versioned creative links.
  Hide remains a personal preference; Remove from Action Plan remains a saved-row
  removal that preserves the creative and ClickUp task. Standalone/fuzzy-linked
  actions do not gain a destructive creative-deletion shortcut. Unresolved
  creation jobs and conflicting task identities block deletion.
- The confirmation names the creative and scope. ClickUp deletion is optional
  and unchecked initially. Cancel/Escape is read-only; confirmation, close, and
  checkbox controls are locked during a save. Virtual tasks delete their explicit
  creative without first creating a manual action.
- Reuses the existing `qa_tracker_delete` transaction: active product access,
  creative version check, soft-delete/tombstone, matching plan-entry removal,
  Matrix assignment/metadata cleanup, and last-use Inspiration reset. Independent
  variations and source files are preserved. The existing creation guard blocks
  deletion during uncertain/in-flight creation. No schema changes were added.
- Client deletion is QA-project-only and verifies the returned product, creative,
  task identity, and deletion state before any remote request. A stale/failed or
  unverified acknowledgment keeps the confirmation open and never sends a remote
  delete. An explicit retry can resolve a committed-but-unacknowledged deletion
  through the existing idempotent RPC behavior.
- Added a QA-only `delete-plan-task` operation behind the existing authenticated
  API and test-list allowlist. It requires the exact deleted creative/task and
  matching product tombstone, checks all pages of current product references,
  rejects active references/unresolved creation, and uses the existing ClickUp
  client to verify list membership. Confirmed missing tasks are idempotent; other
  errors propagate without blind retry. The existing Tracker endpoint is unchanged.
- A failed remote delete reports that local deletion succeeded and leaves an
  explicit retry confirmation. The collapsed Deleted creatives section is built
  from product-scoped soft-deletes plus matching tombstones, so remote deletion
  can also be requested after reload, including for local-only deletions. Each
  attempt requires confirmation; opening the list does not query or mutate
  ClickUp. Remote-success labels last for the current mounted view only, not as
  a permanent claim about current remote state.
- New behavior stays in separate domain/service/hook/dialog modules, using the
  existing mutation lock, realtime refresh, and root tabbed command center.
  Previously deleted records stay excluded from auto-adoption after reload.

### Part 16 Verification

- All 264 domain/service tests, TypeScript, optimized build, and diff checks pass.
  Focused intercepted browser tests pass without unexpected console errors or
  external requests. They cover cancel, busy controls, local/optional remote
  deletion, preserved variations, Matrix cleanup, virtual tasks without promotion,
  stale snapshots, lost acknowledgments, failed remote deletion and retry across
  reloads, and product isolation. Desktop/mobile screenshots were inspected.
- The local server was restarted and its sign-in page checked with agent-browser;
  it renders without reported browser errors at `http://127.0.0.1:3000/`.
  Full intercepted admin/member regression also passes with no unexpected console
  errors or external requests (86 mocked mutations across the complete suite).
- No live Supabase/ClickUp writes, migrations, production/environment changes,
  commits, or pushes were made. Existing SQL deletion semantics were reviewed,
  but real database/RLS/concurrent-user acceptance was not rerun in this part.
- Next: guarded recreation/relinking of remotely deleted ClickUp tasks. It must
  distinguish confirmed absence from failed lookup, avoid legacy fuzzy-name
  relinking, and reuse durable creation recovery. Then OneScale and live/visual
  acceptance remain in Step 7. Overall: 6/13 complete, 7 milestones remain.

## Step 7, Part 17: Guarded ClickUp Repair

- Added Repair ClickUp link to the existing Action Plan inspector, shared by
  table/cards/pipeline. Confirmation is read-only until submitted, names the
  creative and linked task, and locks closing/submission while saving. The root
  tabbed command center remains unchanged; no temporary pages were added.
- The authenticated QA API verifies the exact linked task in the allowlisted
  test list. An existing task restores the local link without a remote write.
  Only a confirmed 404 permits a complete active/archived list scan. Failed
  lookups, incomplete scans, ambiguous markers, and unmarked same-name tasks
  stop repair. No fuzzy-name relinking or blind replacement is used.
- A unique prior creation marker can recover an existing task. Otherwise the
  new `qa_plan_repair` transaction checks access, source/task ownership, versions,
  tombstones, and the prior job before clearing stale links and claiming a new
  durable generation. Virtual rows are staged only on explicit repair. Previous
  generations are archived in activity history, and a task-only tombstone keeps
  the old remote ID from being reimported without deleting the active creative.
- Replacement uses the shared creation/recovery engine after verifying the
  complete claimed payload. Briefs, local assignments, notes, and Matrix
  placement are retained. Lost remote responses or local finalization failures
  recover the same generation instead of issuing another uncertain POST.
- A lost preparation acknowledgment before any remote POST intentionally fails
  closed. If no marked task exists, recovery needs manual review; it does not
  reset the generation or automatically create again. This is a remaining
  operational limitation, not a claim of automatic recovery in every failure.

### Part 17 Verification

- All 275 domain/service tests, TypeScript, and the optimized Next.js build pass.
  Focused intercepted browser coverage includes confirmation/cancel, busy locks,
  existing/marked links, replacement, stale/failed saves, virtual promotion,
  recovery after reload, product isolation, and cards/pipeline access.
  Desktop/mobile dialog screenshots were inspected; dialog overflow checks pass.
- The full intercepted admin/member browser regression also passes, including
  all tabs and prior migration workflows, with no unexpected console errors or
  external requests (86 mocked mutations counted by the shared harness).
- Applied only migration `20260921010000_qa_plan_repair` to the guarded QA
  project `entgcnlfsnysnwyadzzp`. Transaction tests cover repair, existing
  creation, and checkpoints; fixture writes are rolled back. No real ClickUp
  tasks were created, modified, or deleted by verification.
- Production HTML, environment/deployment configuration, and production
  Supabase were not changed. No commits or pushes. Real multi-user/live ClickUp
  acceptance and exact legacy visual parity remain unverified.
- Next: QA-safe OneScale integration, then live/visual acceptance for Step 7.
  Overall remains 6/13 complete, with 7 milestones remaining (Steps 7-13).

## Step 7, Part 18: OneScale Launch Readiness (Read-Only)

- The user confirmed there is no isolated OneScale test environment, store ID,
  or product profile ID. Actual launch/handoff and callback migration are NOT
  complete. External launch remains unconditionally disabled; no production
  store mappings, legacy URL overrides, or production callback fallbacks are used.
- Added Review OneScale launch to the existing Action Plan bulk toolbar, without
  another page. Only selected, visible Ready to Launch tasks enter the review;
  hidden and non-ready selections are excluded. The dialog names the selected
  tasks and explains the missing environment. Opening/canceling is read-only.
- Verify selected tasks uses the existing authenticated QA API and session-only
  ClickUp key. It checks explicit versioned source links, product scope, all
  ClickUp aliases, both saved statuses, tombstones, duplicate task ownership,
  unresolved creation jobs, and the exact task/list/remote status. Local reads
  are paginated. Failed or incomplete reads stop the entire review; virtual
  creatives are not promoted or written.
- Results are a point-in-time readiness check, not a launch authorization.
  No handoff URL, callback credential, or reusable launch token is returned.
  The UI rejects unexpected response identities or an enabled-launch response.
  Existing callback handlers and all production code/configuration are unchanged.
- Added domain/service tests for ready/virtual targets, stale/conflicting links,
  foreign products, deletions, uncertain creation, pagination, remote failure,
  archived/non-ready tasks, cancellation, and unconditional launch blocking.
  All 285 domain/service tests, TypeScript, and the optimized build pass.
- Focused intercepted browser checks pass with no writes or external requests:
  hidden/non-ready selection exclusion, cancel, missing key, failed/stale review,
  unexpected enabled response rejection, busy closing guards, virtual rows,
  product switching, and disabled launching. Desktop/mobile screenshots were
  inspected and dialog overflow checks pass.
- The full intercepted admin/member browser regression passes, with no
  unexpected console errors or external requests (86 mocked mutations across
  the existing suite; the new OneScale review adds no mutations).
- No new migration, live backend writes, external OneScale requests, commits,
  or pushes were made. The QA server remains at `http://127.0.0.1:3000/`.
- Next unblocked work: legacy UI parity and remaining Action Plan acceptance.
  OneScale handoff/callback requires a confirmed isolated test destination and
  callback contract before implementation and live verification. Step 7 remains
  in progress: 6/13 milestones complete, 7 remaining (Steps 7-13).

## Step 7, Part 19: Legacy Typography and Layout Density

- Found that the Next.js root did not load any global font/reset stylesheet,
  leaving most text in the browser's default serif font and adding browser
  margins on top of component spacing. Added a small global stylesheet with
  Satoshi, border-box sizing, zero body margin, explicit heading/paragraph
  margins, form-font inheritance, focus indicators, and reduced-motion support.
- Self-hosted unmodified official Satoshi regular/medium/bold and JetBrains Mono
  bold assets. License/source notices are under `public/fonts/`. Font rendering
  no longer requires external font requests at runtime or during builds.
- Restored the compact brand heading, legacy gradient underline, single-line
  uppercase tab labels, product controls, and user controls. Navigation remains
  inside `/`; a small `CommandNavigation` component keeps the selected tab
  visible on resize without scrolling the page vertically. Tabs stay sticky.
- Scoped Action Plan density changes to its existing tab: compact summary,
  reduced duplicate vertical gaps, aligned pulse periods, 76px tiles, legacy
  metric colors/monospaced counts, segmented view buttons, dark bulk toolbar,
  tighter table cells, and compact filters/metadata. Existing data and mutation
  logic is unchanged. No temporary pages or legacy HTML embedding were added.
- Added a read-only visual test that parses the actual legacy stylesheet and
  two pure pulse-render functions into an isolated reference document. It does
  not execute legacy startup code or connect the legacy app to a backend.
  Checks compare computed font families, heading size, and tile height; they
  also cover font loading, period alignment, table placement, sticky tabs,
  active-tab visibility, dialog Escape dismissal, and no document/tile overflow
  at 320, 390, 768, and 1920px. Focused visual and pulse interaction tests pass;
  desktop/mobile screenshots were inspected. These are not pixel-diff approval.
- TypeScript, the optimized build, and the full intercepted admin/member browser
  regression pass, with no unexpected console errors or external requests
  (86 mocked mutations from the existing suite; the visual checks add no writes).
- All 285 domain/service tests pass. Production HTML, environment/deployment
  configuration, and callback handlers are unchanged. No database migrations,
  live backend writes, commits, or pushes were made.
- Still pending: exact header/control placement, tab counts, filter/view-control
  arrangement, inspector/drawer/card parity, all populated/empty/error states,
  and realistic concurrent-user acceptance. OneScale handoff/callback remains
  pending an isolated environment. Overall remains 6/13 complete, 7 milestones
  remaining (Steps 7-13); this part does not complete Step 7.

## Step 7, Part 20: Task Detail Drawer

- Replaced the table-squeezing, two-column Action Plan inspector with a native
  modal drawer inside the existing root command center. It matches the legacy
  540px desktop panel and dimmed backdrop, with source/title/cell identity and
  compact status/age/funnel/type/due facts. Small screens use full viewport width
  to preserve usable fields. The table keeps its width and state underneath.
- Existing assignments, workflow edits, creative editing, history, link repair,
  hiding, removal, and deletion remain connected to the same guarded handlers.
  Feedback appears inside the drawer while it is open, including hide failures
  and retry. No new page, embedded HTML, or backend mutation path was added.
- Added Escape/backdrop dismissal, busy closing guards, keyboard focus wrapping
  and restoration, and a shared modal lifecycle for nested editors. Reference-
  counted scroll locks release correctly even when realtime deletion removes
  the drawer before its editor. Stable creative identity preserves the drawer
  during adopted-task promotion. A short fade avoids the mobile clipping caused
  by autofocus during a sliding transform.
- Hiding a task now clears its drawer selection: restoring it from another tab
  cannot unexpectedly reopen a dismissed modal. The visibility regression also
  covers failed hiding, in-drawer error/retry, and subsequent cross-tab restore.
- Read-only drawer browser checks cover desktop/mobile bounds, unchanged table
  width, visible icons, focus, dismissal, nested editor cancellation, and task
  deletion beneath an open editor. Screenshots at 320, 390, 768, and desktop
  widths were inspected. Existing browser workflows now explicitly close the
  modal before navigating the background and scope nested-dialog controls.
- All 285 domain/service tests, TypeScript, and the optimized build pass. The
  full intercepted admin/member browser regression passes with zero unexpected
  console errors/external requests and 86 mocked mutations. New drawer checks
  add no writes. No live backend writes, migrations, commits, or pushes.
- Production HTML, environment/deployment configuration, and callbacks remain
  unchanged. OneScale launching is still disabled without an isolated test
  destination. The QA server remains at `http://127.0.0.1:3000/`.
- Next: header/filter/view-control arrangement, then remaining drawer content
  organization and card parity. Full visual/state coverage and realistic
  concurrent-user acceptance remain pending. Overall: 6/13 complete, 7 remaining
  (Steps 7-13); this part does not complete Step 7.

## Step 7, Part 21: Header, Filters, and View Controls

- Moved the five existing layout modes into a compact switcher directly below
  the pulse strip, alongside summary counts and refresh. Consolidated date,
  facets, task group, due date, attention, saved views, columns, and result count
  into one filter band. Search now sits inside the dark bulk-action bar for
  Table, Cards, and Pipeline. Week keeps search; Trends keeps its full-product
  scope. No new pages or embedded legacy HTML were introduced.
- Bulk mutation controls appear only while selections or an active operation
  exist. Selected counts, read-only OneScale review, hidden-selection exclusion,
  batch limits, cancellation, and results remain intact. Filtering does not
  silently clear selections or permit bulk changes to hidden rows.
- Added facet icons and reserved count space; compact desktop controls wrap at
  narrow widths. Scoped toolbar styles away from nested dialogs and saved-view
  manager contents. Existing persistence and backend mutation paths are unchanged.
- Extended read-only browser coverage for control ordering, search placement,
  saved-view placement, filtered counts, bucket/search combinations, reset,
  hidden selections, conditional bulk controls, and control bounds/non-overlap
  at 320, 390, 768, and 1920px. Desktop/mobile screenshots were inspected.
- All 285 domain/service tests, TypeScript, focused visual/filter checks, and
  the optimized build pass. The full intercepted admin/member browser suite
  passes with no unexpected console errors or external requests and 86 mocked
  mutations from existing workflows. New layout checks add no writes.
- Remaining legacy gaps are explicit: Show Selected, the dedicated Variations
  view, exact date/menu interactions (including mobile facet-menu placement),
  header/tab counts, drawer content organization, cards, and full populated,
  empty, error, and concurrent-user acceptance. OneScale handoff/callback still
  requires an isolated environment; external launching remains disabled.
- Production HTML, environment/deployment configuration, and callbacks remain
  unchanged. No live backend writes, migrations, commits, or pushes were made.
  QA remains at `http://127.0.0.1:3000/`. Overall: 6/13 complete, 7 milestones
  remaining (Steps 7-13); this part does not complete Step 7.

## Step 7, Part 22: Show Selected

- Added the legacy checkbox beside search in the existing Action Plan bulk
  toolbar. It narrows the already-filtered Table, Cards, and Pipeline rows;
  search, dates, facets, task groups, personal hiding, adoption preferences,
  and other eligibility rules are not bypassed. Counts and bulk targets use
  the same visible rows. Week and Trends do not inherit an invisible filter.
- Kept selection IDs and selected-only mode together in the existing bulk hook.
  Explicit clear exits the mode; filter reset exits it without discarding task
  selections. Individual deselection can leave an empty selected-only view,
  with both the checkbox and clear control still available. Bulk completion
  exits only when no selections remain; failed, skipped, and filtered-out
  selections stay available for retry. The toggle is disabled while busy.
- Adopted-to-saved ID replacements preserve mode and selection, including
  realtime promotion by another session. Deleted or hidden tasks cannot become
  bulk targets through a stale selection. The mode is not saved to preferences
  or column layouts and resets on product changes, tab remounts, and reloads.
- Added read-only intercepted browser coverage for keyboard activation, empty
  state recovery, filter/reset combinations, personal hiding, all five layouts,
  realtime deletion, product/reload isolation, and desktop/320/390px bounds.
  Inspected selected-state desktop/mobile screenshots. Extended existing bulk
  and adoption tests to exercise retries, cancellation, completion, and identity
  replacement with Show Selected enabled, without adding backend operations.
- All 285 domain/service tests, TypeScript, the optimized build, and focused
  selection, bulk, and adoption browser checks pass.
- The full intercepted admin/member browser regression passes with zero
  unexpected console errors or external requests and 86 mocked mutations from
  existing workflows; the new selection-only flow adds no writes.
- No live backend writes, migrations, commits, or pushes. Production HTML,
  environment/deployment configuration, and callback handlers remain unchanged.
  OneScale launching remains disabled. QA stays at `http://127.0.0.1:3000/`.
- Next: dedicated Action Plan Variations view, then remaining date/menu,
  header/tab-count, drawer/card, and full visual/state acceptance. Realistic
  concurrent-user acceptance and isolated OneScale handoff/callback remain
  pending. Overall: 6/13 complete, 7 remaining (Steps 7-13); this part does not
  complete Step 7.

## Step 7, Part 23: Dedicated Variations View

- Added Variations to the existing root command-center layout switcher, with a
  separate React component and pure domain grouping module. Reuses the current
  paginated, realtime, lifecycle-filtered creative snapshot; no additional
  query, schema, mutation, page, or embedded HTML was introduced.
- Matches the legacy read-only overview: parents sorted by direct-child count,
  children by variation number, parent winner marker, variation totals, win
  percentage, per-axis totals, status, editor, due date, and ClickUp links.
  Preserves the legacy Winner/Scale numerator and all-child denominator;
  descendants form their own parent groups rather than being counted twice.
  Axis labels are safely rendered and malformed/duplicate axes are normalized.
- Uses all product variations, independently of table search, filters, adoption
  and selection settings. Inapplicable filters, pulse controls, and bulk actions
  are omitted in this view; returning to the table restores their state.
  An already-running bulk operation still exposes cancellation and results.
- Linked names open the existing keyboard-accessible task drawer without a
  route change or record creation. Only unique explicit same-product links are
  eligible. Personally hidden tasks remain in this all-product overview but
  are marked and have no drawer opener. Deleted, quarantined, and foreign
  records are excluded; orphan groups are omitted as in legacy. Independent
  child records are not deleted when their parent disappears.
- Compact group headers and six-column tables follow the legacy structure;
  narrow screens scroll tables locally. The six-mode switcher uses two rows on
  mobile. Inspected screenshots at desktop and 320px; automated bounds cover
  320, 390, 768, and 1440px. Empty and unavailable states are distinct.
- Added five domain tests for grouping/order, exact win-rate rules, custom axes,
  lifecycle/product boundaries, unique task identity, personal hiding, and
  normalized assignments/due dates/encoded links. All 290 domain/service tests,
  TypeScript, the optimized build, and focused intercepted browser checks pass.
  Browser checks cover realtime stats/deletion, focus restoration, filtered
  table-state preservation, product switching, and responsive layouts with no
  writes or external requests.
- The full intercepted admin/member browser regression passes with zero
  unexpected console errors/external requests and 86 mocked mutations from
  existing workflows. A further focused run verifies failed-read recovery
  without falsely showing an empty dataset. Bulk cancellation remains usable
  after switching into Variations; no new mutation operations were added.
- This completes the dedicated overview, not every Variation Lab interaction:
  legacy chip/popover and quick-template/advanced spawning UI parity still
  needs comparison with the migrated Tracker/Matrix creation controls. Next is
  remaining drawer/card and date/menu parity, followed by full visual/state and
  realistic concurrent-user acceptance. OneScale handoff/callback remains
  pending an isolated test environment; launching stays disabled.
- No live backend writes, migrations, commits, or pushes. Production HTML,
  environment/deployment configuration, and callback handlers are unchanged.
  QA remains at `http://127.0.0.1:3000/`. Overall: 6/13 complete, 7 milestones
  remaining (Steps 7-13); this part does not complete Step 7.

## Step 7, Part 24: Anchored Facet Menus

- Corrected the mobile menu anchor: each of the six facet menus now opens from
  its own trigger instead of the bottom of the entire wrapped filter band.
  A dedicated positioning hook fits the menu inside the viewport, chooses
  above/below placement, follows page scrolling and resizing, and closes it
  when its trigger leaves the viewport. Menus remain above sticky navigation.
- Kept the existing checkbox/filter behavior and DOM focus order. Enter opens,
  Tab reaches options, Space selects, and Escape closes and restores trigger
  focus. Outside clicks and focus leaving the facet close it. No portal, native
  popover dependency, new route, backend request, or mutation was introduced.
- Capped long lists with an internal scroller and retained its scroll position
  during repositioning. Long unbroken values wrap. Realtime updates preserve
  selected values that disappear from the current dataset; empty facets remain
  explicit. Product switching and switching to another facet dismiss old menus.
- Added an intercepted browser regression covering all six facets, above/below
  placement at 320/390/768/1440px, a 240px-high viewport, sticky-navigation hit
  testing, resize/scroll following, scroll retention, long text, keyboard/focus
  dismissal, realtime options, and empty state. Desktop/mobile screenshots were
  inspected. Focused checks, all 290 domain/service tests, and TypeScript pass.
- The optimized build and full intercepted admin/member browser regression
  also pass: zero unexpected browser errors or external requests, with the
  existing 86 mocked mutations. New menu checks add no writes.
- Remaining Action Plan parity: exact date controls, header/tab counts,
  drawer/card content, Variation Lab chip/template/advanced-spawn interactions,
  and full populated/empty/error/concurrent-user acceptance. OneScale handoff
  and callback still need an isolated environment; launching remains disabled.
- No live backend writes, migrations, commits, or pushes. Production HTML,
  environment/deployment configuration, and callback handlers remain unchanged.
  Overall: 6/13 complete, 7 milestones remaining (Steps 7-13). This part does
  not complete Step 7. Local QA remains at `http://127.0.0.1:3000/`.

## Step 7, Part 25: Toolbar Date Dropdown

- Replaced the toolbar's select and separate radio controls with a compact Date
  trigger, the legacy two-column preset order, and Activity/Created segments
  inside an anchored dropdown. Custom dates are edited inside the dropdown
  rather than in a separate modal. No additional page or HTML embedding.
- Retained the migrated explicit Apply/Cancel behavior intentionally: selecting
  Custom or editing a draft does not commit an incomplete range. Missing,
  invalid, and reversed dates show an error without changing the active range.
  Escape, Cancel, outside clicks, focus exit, and product changes discard drafts.
  Valid apply and preset selection close the dropdown and restore trigger focus.
- Reused the tested date-domain rules, inclusive local-day boundaries, selected
  task safeguards, filter chips, and pulse/date-basis interactions. Realtime
  creative updates preserve an unfinished custom-date draft. The separate Pulse
  period select and custom-range dialog retain their existing behavior; exact
  legacy Pulse-period UI parity remains pending.
- Extended the facet-positioning hook for a 340px date menu and dynamically
  growing contents. The dropdown fits narrow/short viewports with internal
  scrolling. Removed obsolete toolbar radio styles and checked selected-preset
  contrast, including hover. Inspected desktop and mobile screenshots of both
  the preset grid and scrolled custom-date/basis controls.
- Added a read-only browser flow comparing preset order with the audited pure
  legacy renderer, and checking every preset, keyboard entry/focus restoration,
  validation/cancel, realtime draft retention, selection preservation, all four
  viewport widths (320/390/768/1440px), a 260px-high viewport, mutual facet
  dismissal, and product reset. Updated date/trends, linked-completion, and Pulse
  browser checks to interact with the replacement controls.
- Focused date-menu, date/trends, and Pulse checks pass. All 290 domain/service
  tests and the optimized build (including TypeScript) pass.
- The full intercepted admin/member browser regression passes with zero
  unexpected browser errors or external requests and the existing 86 mocked
  mutations. This includes regression coverage for the shared facet-positioning
  hook; the new date-menu flow adds no writes.
- Next: header/tab counts, then remaining drawer/card content, Variation Lab
  chip/template/advanced-spawn and Pulse-period UI parity, followed by complete
  populated/empty/error/concurrent-user acceptance. OneScale launching remains
  disabled until an isolated test destination is available.
- No live backend writes, migrations, commits, or pushes. Production HTML,
  environment/deployment configuration, and callback handlers remain unchanged.
  Overall: 6/13 complete, 7 milestones remaining (Steps 7-13); this part does
  not complete Step 7. Local QA remains at `http://127.0.0.1:3000/`.

## Step 7, Part 26: Action Plan Navigation Count and Header Totals

- Restored the Action Plan navigation badge using the legacy saved-record scope,
  independent of table filters, selected-only mode, personal hiding, auto-adopt,
  and the current internal view. Unsaved adoptable creatives do not inflate it.
  Existing lifecycle guards exclude deleted/quarantined records and references
  blocked by creative or remote-task tombstones. Other tabs' badges remain part
  of their respective migration/visual acceptance work.
- Added a small pure counter, a projected/paginated read service, and a live hook
  using existing authenticated RLS reads, product filters, shared realtime
  subscriptions, local-write invalidation, cross-tab refresh, and stale-response
  cancellation. Reads remain active on other tabs. Navigation is keyed by user
  and product, so a previous product's count cannot flash as the next one's.
- Loading shows an ellipsis, a failed/incomplete read shows an unavailable
  indicator, and a verified empty result shows zero. Selecting Action Plan
  retries a failed count; focus/online/periodic refresh also use existing hooks.
  Accessible button names remain stable and the badge adds a count description.
  Active-tab visibility is rechecked when badge size changes.
- Preserved the existing all-eligible-task header summary, including adopted
  and personally hidden tasks. It now derives explicitly from the same resolved
  records and clock as the list, with scope tooltips and initial loading/error
  states instead of premature zero totals. Midnight behavior is regression
  tested; this makes the clock dependency explicit, not a claim that the prior
  parent-driven periodic rerender was absent.
- Added eight domain/service tests for saved/adopted separation, lifecycle and
  product boundaries, duplicate IDs, midnight/terminal status handling, 501-row
  pagination, projected reads, cancellation, failed/incomplete reads, and the
  unchanged full-row default for existing `readProductRows` callers.
- Added a read-only browser flow covering inactive-tab updates, primary-key-only
  deletion, tombstone restoration, filter/hiding/adoption independence, midnight
  header updates, failed-read retry, pagination, late responses after switching
  products, sign-out cleanup, and active-tab visibility at 320/390/768/1440px.
  The existing Matrix creation flow now verifies the badge after its existing
  saved-action mutation. No new mutation operation was added. Desktop/mobile
  screenshots were inspected; focused checks and all 298 domain/service tests
  pass, as does the optimized build including TypeScript.
- The full intercepted admin/member browser regression passes with zero
  unexpected browser errors or external requests and the existing 86 mocked
  mutations. Existing ClickUp connection, product switching, and shared realtime
  batching checks also pass with the navigation count mounted.
- Next: drawer/card content, then remaining Variation Lab chip/template/advanced
  spawning and Pulse-period UI parity, followed by full visual/state and
  concurrent-user acceptance. OneScale launching stays disabled without an
  isolated test destination.
- No live backend writes, migrations, commits, or pushes. Production HTML,
  environment/deployment configuration, and callbacks are unchanged. Overall:
  6/13 complete, 7 milestones remaining (Steps 7-13); Step 7 remains in progress.
  Local QA remains at `http://127.0.0.1:3000/`.

## Action Plan Finish Batch 1: Drawer and Cards

- Extracted `PlanTaskDetail` and `PlanCards` from the Action Plan tab. The
  command center still uses internal tabs at `/`; no embedded legacy HTML or
  additional pages were introduced.
- Restored Media Buyer and Strategist drawer modes, source indicators, decision
  warning, assignment/approved/created facts, strategy/USP/notes/provenance,
  reference links, and header actions. Existing rename, creative/assignment
  editors, history, checkpoint, hide, repair, and deletion flows are retained.
- Winning files load from `task_video_winners`, not stale metadata. The drawer
  reuses Tracker's file editor and guarded save/remove/share operations, scoped
  to the linked product/creative. Preview rendering and paginated file reads are
  shared with Tracker. Ambiguous action links cannot edit winner files.
- Open in Matrix switches the internal tab and selects a unique active cell
  after its taxonomy loads. Missing, archived, or ambiguous cells show an error;
  navigation cannot create a cell or write data. The target is user/product scoped.
- Cards now span the workspace, retain brief text, show provenance/brief/reference
  links and status borders, separate completed tasks, and expose status, due,
  visibility, detail, remove, and guarded ClickUp controls. Unconfirmed creation
  uses recovery, deleted tasks use repair, and linked tasks open ClickUp. Filters
  and selected-only eligibility remain upstream. Summary/history stay mounted
  below the cards, avoiding drawer-induced reflow.
- Fixed a discovered quick-action bug: successful status/due mutations now keep
  returned action/creative versions locally, so an immediate subsequent removal
  does not send the previous version. Concurrent changes still fail version checks.
- Focused browser acceptance covers both modes, live field changes, canonical
  winner save/remove/preview, Matrix navigation/missing cells, completed grouping,
  quick status/due/remove, and 320/390/768px layouts. Existing drawer focus,
  backdrop/Escape, nested editor, and scroll-lock tests also pass. Screenshots
  were inspected. All 304 domain/service tests and TypeScript checks pass.
- Full intercepted admin/member browser regression passes with zero unexpected
  errors/external requests and 91 mocked writes (five added by this batch).
  The optimized local build also passes. The linked-completion cancellation test
  now waits for the mock request handshake rather than assuming loading UI means
  the request has already reached the mock server.
- No live backend writes, migrations, commits, pushes, or deployments. Production
  HTML, environment/deployment configuration, and OneScale callback files remain
  unchanged. Overall milestone 7 remains in progress; its remaining batches are
  Variation Lab, Pulse period UI, and final whole-feature acceptance. Real
  OneScale launching stays disabled without an isolated destination.

## Action Plan Finish Batch 2: Variation Lab

- Reused the guarded `qa_tracker_spawn` RPC from the same-page Action Plan,
  alongside Tracker and Matrix. Parent loading checks product, lifecycle, winner
  eligibility, and canonical winning files. The opening version stays fixed
  during editing so concurrent parent changes are rejected without losing drafts.
- Shared creation includes all five legacy templates, compact rows, advanced
  controls, custom axes, From/To and single-note modes, hypotheses, editor briefs,
  global assignments/due dates, per-row overrides, and winning-file references.
  Add/remove/toggle operations retain other drafts; template replacement confirms
  before discarding edited rows and preserves assignment defaults. Invalid axes,
  dates, assignees, and batch sizes are rejected before sending a request.
- Custom axis storage remains compatible with the legacy `varlab.customAxes`
  key and ignores malformed data. Missing selected member IDs remain visible.
- Parent chips and anchored breakdowns are available in Tracker, Matrix, and
  Action Plan Table/Cards/Variations. Counts retain the legacy direct-child
  denominator and outcome buckets, including Complete under losers and
  production/ready-to-launch under testing. Hidden, ambiguous, deleted,
  quarantined, orphaned, and foreign-product rows retain existing safeguards.
- Popovers fit narrow viewports, flip above their anchor, close on outside
  interaction, and restore trigger focus on Escape. Escape inside a Matrix
  popover does not close the containing cell inspector. Child navigation remains
  within the command center; no new pages or embedded HTML were added.
- Variations remain independent creatives assigned to the parent's Matrix cell.
  Creation does not stage Action Plan records, create ClickUp tasks, or launch
  ads automatically. No automatic retry of the creation RPC was introduced.
- Focused mocked browser checks cover templates, defaults/overrides, draft
  preservation, custom-axis persistence, note-mode payloads, winner references,
  concurrent-parent rejection, cross-view chips, modal focus, and product
  boundaries. The existing overview acceptance covers loading failure/recovery,
  grouping, realtime updates, hiding, deletion, and 320/390/768/1440px layouts.
  Fixed the new winner selector's intrinsic-grid overflow found at 320px.
- All 309 domain/service tests and the optimized Next.js build (including
  TypeScript) pass. Browser screenshots were inspected. The full intercepted
  admin/member regression passes with zero unexpected browser errors/external
  requests and 93 mocked mutation attempts (including the new stale-parent
  rejection). No live database test or external write was performed in this batch.
  Evidence: `/tmp/immuvi-varlab-regression/results.json` and adjacent screenshots.
- No live backend writes, migrations, commits, pushes, or deployments. Production
  HTML, environment/deployment configuration, and OneScale callbacks are unchanged.
  Milestone 7 remains in progress. The two subsequent Action Plan batches are
  Pulse period UI and final whole-feature acceptance; real OneScale remains
  separately blocked until an isolated destination is available.

## Action Plan Finish Batch 3: Pulse Period Picker

- Replaced the Pulse select/custom-date modal with a compact calendar trigger,
  active-period label, and anchored popover. Presets match the legacy picker:
  Today, Yesterday, This Week, Last 7d, Last 14d, Last 30d, This month, Last month.
  From/To fields, Apply, Reset to default, and close are in the same popover.
- Extracted the picker and its small pure state helpers. The toolbar continues
  using its existing independent date menu; the obsolete date-control wrapper,
  modal implementation, and unused styles were removed. No new page was added.
- Presets/custom dates retain the existing propagation to the table date filter
  and preserve tile selections, date basis, search, facets, and bulk selections.
  Reset clears Pulse/date state without clearing unrelated filters or selections.
  Counts and prior-period deltas still use the existing shared date calculation.
- Draft fields initialize from local day boundaries for the active period, stay
  intact during realtime refresh, and are discarded on cancellation. Empty,
  invalid, or reversed ranges cannot commit. Last-month dates use the shared
  calendar helper, avoiding the legacy March-31-to-February rollover issue.
- The popover follows the existing menu-position helper: viewport clamping,
  upward placement, short-height scrolling, Escape/focus restoration, outside
  dismissal, and focus exit. Product changes discard the previous product's draft.
- New focused browser acceptance covers all eight presets, inline validation,
  retained filters/selections, cancelled/live drafts, month boundaries, keyboard,
  toolbar-menu interaction, product reset, 320/390/768/1440px layouts, and short
  viewports. The existing Pulse count/tile/filter/realtime/clock workflow also
  passes with the new control. Screenshots were inspected; neither focused test
  makes any mutation or external request.
- All 312 domain/service tests and the optimized Next.js build including
  TypeScript pass. The full intercepted admin/member browser regression passes
  with zero unexpected errors/external requests and the unchanged 93 mocked
  mutation attempts. Evidence: `/tmp/immuvi-pulse-period-regression/results.json`
  and adjacent screenshots. No live backend test was needed for this UI-only batch.
- Work remains local on `qa`. No backend writes, migrations, pushes, commits,
  deployments, or production configuration changes. After this batch, final
  whole-feature Action Plan acceptance is the only finish batch remaining.
  Real OneScale launching remains separately disabled without a test destination.

## Action Plan Finish Batch 4: Final Local Acceptance

- Audited the legacy/backlog contracts and exercised the complete local browser
  regression. Fixed quick-edit concurrency: displayed row versions now reach
  the existing RPC rather than being replaced with fresh pre-save versions.
- Standalone quick edits now use the existing atomic workflow/history RPC;
  removed the unused linked-edit helper and the history query that never executed.
  Strict save acknowledgement checks precede local success and remote pushing.
- Ambiguous Action Plan variation creation keeps the draft and blocks another
  submission until it is closed and the resulting records inspected. No durable
  exactly-once guarantee is claimed; the existing RPC has no idempotency key.
- Restored missing Angle/Persona fallback from legacy custom-field mirrors,
  markdown/labeled briefs, and ClickUp table embeds without mutating source data.
- 319 domain/service tests, TypeScript, and the optimized Next.js build pass.
  Full intercepted admin/member browser regression passes with zero unexpected
  errors/external requests and 99 mocked mutation attempts. Desktop/mobile and
  uncertain-response screenshots were inspected.
  Evidence: `/tmp/immuvi-plan-final-regression/results.json` and adjacent images.
- Work remains local on `qa`: no live backend writes, schema changes, environment
  edits, commits, pushes, or deployments. Production HTML/deployment config and
  OneScale callbacks are unchanged. See [the acceptance report](action-plan-acceptance.md).
- **Remaining local Action Plan finish batches: 0.** Next implementation is
  milestone 8, Inspiration. Overall fully closed milestones remain 6/13 because
  milestone 7 still has external acceptance gates. OneScale launch stays disabled
  until an isolated destination exists; realistic QA Supabase/ClickUp acceptance
  and later migration/release gates are not replaced by mocked tests.
