# Production Migration

Milestone 9 of the existing 13-step plan. Branch: `qa`. The Production tab stays
inside the command center at `/`. This work is not a production deployment.

## Three Batches

1. **Complete locally: board and workflow foundation.** Complete reads, lifecycle guards, canonical
   display, status/drag transitions, due-date editing, safe links and local tests.
2. **Complete locally: task management.** Persistent creation, detailed editing, assignments, explicit
   removal/deletion choices, and guarded QA ClickUp synchronization/retry. Reuse
   the existing Action Plan/Tracker services and editors wherever applicable.
3. **Complete locally: final local acceptance.** Compared reachable legacy controls, restored compact
   card/board visual parity, keyboard/mobile checks, failure/concurrency coverage,
   backlog audit and full regression. Record live-service gates separately.

These are sub-batches, not new milestones. All three are locally complete; zero
local Production batches remain. Live integration/user sign-off remains open.
No OneScale launch or classifier dispatch is enabled. Real ClickUp acceptance is
limited to the approved QA list `901616718146`; mocks do not prove remote delivery.

## Legacy Audit

- `renderProduction` derives the three columns from resolved manual actions.
  `rebuildProdFromManual` and the renderer disagree on Mild Winner; the new board
  consistently treats Mild Winner and Killed as terminal, matching Action Plan.
- Dragging maps columns to Untested, In Production and Complete. The new board
  deliberately does nothing when dropped within its current column, preserving
  Testing/Winner/Approved rather than downgrading them to a column default.
- Legacy add/edit/delete helpers mutate `PROD`, while the renderer immediately
  rebuilds that array from `MANUAL_ACTIONS`. This is not a durable creation contract.
  Batch 2 persists canonical tasks instead of copying this defect.
- The initial Next.js board capped actions at 500 and ads at 3000, filtered deleted
  ads before lifecycle resolution, omitted tombstones, and discarded versions from
  successful status responses. It had no due-date editor.

## Batch 1 Implementation

- Paginated product-scoped actions, ads and deletion tombstones through the shared
  reader; shared lifecycle rules exclude deleted, quarantined and tombstoned links.
  Reads never create/adopt tasks. Standalone saved actions remain visible.
- Realtime tombstone/deletion refresh, retained rows on read failure, distinct
  initial loading/error/empty states, and isolation from late previous-product reads.
- Status and date saves reuse the guarded QA Action Plan workflow. Returned action
  and creative versions are retained for subsequent edits. Unverified responses
  cannot update the displayed value or trigger linked ClickUp pushes.
- Drag-start snapshots preserve the versions the user saw. Realtime changes during
  a drag cannot silently bless a stale move. Status selects provide a keyboard and
  touch alternative. Only known columns can map to a target status.
- Date dialogs keep drafts through realtime changes, stale conflicts and source
  deletion; Save/Clear/Cancel are explicit. Linked and standalone tasks share date
  validation and persistence; no date writes go to Matrix metadata.
- Fixed shared due-date display: an explicit linked creative date, including a
  clear, overrides the manual-action snapshot and its timestamp. Missing linked
  metadata still falls back to the action. Both Action Plan and Production use it.
- Existing HTTP(S) URL validation now guards board links. Date controls use shared
  modal/form styling; status controls have enough width on mobile.

## Backlog Boundaries

- Bug 47: canonical date display, explicit clear, shared workflow saves and reload
  tested locally. Actual ClickUp delivery requires the live QA integration gate.
- Bug 51: tombstone and quarantine suppression tested; no read-side resurrection.
  Batch 2 adds durable deletion controls and remote-deletion recovery after reload.
- Shared field/realtime issues: current-product status/date updates and stale-read
  isolation tested. Multi-user deployed RLS/security acceptance remains milestone 12.
- Source-description and field/assignee flows reuse the guarded creation/sync
  services. Batch 2 tests local brief preservation, native assignees, reviewer and
  zero-valued fields; actual ClickUp delivery still requires live QA acceptance.
  Switching frameworks alone does not fix these bugs.

## Safety

No database migration, real backend mutation, commit, push, deployment or production
configuration change in batch 1. QA saves reuse already-installed guarded RPCs.
Only intercepted browser fixtures were mutated during testing.

## Batch 1 Verification

- 402 domain/service tests pass, including terminal buckets, no-op same-column
  moves, linked due-date precedence, explicit clearing and missing-data fallback.
- Optimized Next.js build including TypeScript passes.
- Focused browser checks pass with 10 mocked mutation attempts, no unexpected
  errors and no external requests. Cover >500 tasks, canonical dates, lifecycle
  guards, stale drag/date conflicts, retained drafts, sequential versioned saves,
  standalone saves, unverified receipts, deletion during editing, reload, failed
  reads/retry, initial failure versus empty state and late-product response isolation.
  Evidence: `/tmp/immuvi-production-board/results.json`.
- Board/dialog bounds pass at 320/390/768/1440px. Mobile/desktop screenshots were
  inspected and date/status controls adjusted to fit. The native drag test targets
  the title, not the status dropdown; interactive controls deliberately cannot
  start a card drag. No exact visual-parity certification in this foundation batch.
- Full intercepted admin/member regression passes with 168 mocked mutation
  attempts, no unexpected browser errors and no external requests, including all
  prior Action Plan/Inspiration flows and the shared date-resolution change.
  Evidence: `/tmp/immuvi-production-regression/results.json`. An earlier run used
  the old card-center drag selector and timed out; the complete final rerun uses
  the title handle and passes. No application drag safeguards were bypassed.
- Local QA preview: `http://127.0.0.1:3000/`. Overall remains 6/13 fully closed,
  7 open; Production has two local batches left.

## Next Implementation

Move to milestone 10, Command HQ. Do not create another Production finish batch.
The [acceptance report](production-acceptance.md) records the complete legacy-control
audit, intentional differences, test evidence and separate live-service/user gates.

## Batch 2 Implementation

- Add task creates a canonical creative and linked Action Plan task in one
  transaction. The guarded `qa_production_create` RPC records a per-user/product
  request receipt; retrying after a lost response cannot create a second pair.
  Failed staging rolls back the creative. Historical receipts never recreate
  removed/deleted rows. Creation does not create Matrix assignments or ClickUp tasks.
- Creation drafts and request identity survive close/reopen and page reload in
  user/product-scoped session storage. Uncertain saves freeze the original request
  for recovery. Definitive validation failures allow correction. Form reads can
  be retried; all new controls have stable accessible names.
- Detailed editing and assignments reuse `PlanCreativeDialog`, `PlanFieldsDialog`
  and the existing versioned QA RPCs. Successful rows are checked for exact source,
  product, remote identity and requested field values before closing or pushing.
  Conflicts/unverified receipts preserve the draft and cannot trigger a remote push.
- Native assignees, reviewer/custom fields and optional linked-task pushes are
  available from each card. Failed ClickUp delivery preserves the local save and
  exposes an explicit retry. Uncertain ClickUp creation locks edits until recovery;
  the existing durable creation workflow prevents a second external create POST.
- Removing a board task preserves the creative, Matrix assignments and ClickUp
  task. Deleting its creative is a separate confirmed operation, with an optional
  remote deletion. The deleted-creatives list supports remote retry after reload.
  Link repair/recreation reuses the existing guarded dialog and service.
- Standalone legacy tasks retain rename, due-date, status and removal controls;
  linked-creative-only controls are not offered for unresolved sources.

## Batch 2 Verification

- 407 domain/service tests pass; optimized Next.js build and TypeScript pass.
- Focused intercepted browser workflow passes: creation recovery across reload,
  no automatic remote creation, uncertain ClickUp recovery without duplicate POST,
  detailed edits, assignments, local save/remote failure/retry, stale and unverified
  receipts, link repair, confirmed remove versus delete, remote deletion retry after
  reload and standalone rename. No unexpected browser errors/external requests.
  Evidence: `/tmp/immuvi-production-tasks/results.json`.
- Board and assignment-dialog bounds pass at 320/390/768/1440px; mobile screenshots
  inspected. Exact legacy visual parity is still batch 3, not claimed here.
  The Production toolbar now keeps equal-width counts and a separate action row
  on narrow screens instead of stretching Add task into a summary column.
  During testing, fixed populated textarea/select accessible labels. The delete
  test initially opened before the repair refresh completed, correctly receiving
  a stale-write rejection; the passing test waits for the actual refresh response.
- Full intercepted admin/member regression passes with 175 mocked mutation
  attempts, no unexpected browser errors and no external requests. Includes all
  prior Action Plan/Inspiration flows and both Production batches. Evidence:
  `/tmp/immuvi-production-task-regression/results.json`.
- Rollback-only SQL tests pass before and after installation: access denial,
  taxonomy/protected-field/date validation, exact-once replay, changed-request and
  other-user rejection, deleted-row non-resurrection and atomic staging failure.
- Applied only `20260924010000_qa_production_creation` to the approved QA project
  `entgcnlfsnysnwyadzzp`. Readback confirms migration registration, RLS, authenticated
  execution, anonymous denial, no direct receipt access and no leftover fixtures
  or test triggers. No existing user records or worker settings were changed.
- No production database/configuration/legacy HTML changes, commits, pushes or
  deployments. OneScale and classifier dispatch remain disabled.

## Batch 3: Final Local Acceptance

- Restored the compact Production Board header, three-column layout, header counts,
  card typography/padding/colors/left border, Format/Funnel/AI Rec tags and due-date
  line. Removed duplicate KPI and loaded/list metadata bands. Editing controls stay
  accessible in a per-card disclosure, with visible uncertain-ClickUp warning.
- Found and fixed a missed legacy distinction: the ten named Format templates are
  not Ad type. Creation and guarded format editing now persist `payload.format`
  independently, including clear/reload and exact old-request compatibility.
- Installed only `20260924020000_qa_production_formats` in QA after rollback tests.
  Permission/readback and cleanup checks pass. No existing user data was changed.
- Keyboard testing exposed Tab leaving the native modal boundary. The shared
  modal hook now wraps forward/reverse focus and preserves nested-dialog handling,
  Escape and opener restoration.
- 409 domain/service tests, optimized build, all three focused Production browser
  suites (20 mocked mutation attempts) and full intercepted admin/member regression
  (178 attempts) pass. No unexpected browser errors or external requests.
- Direct legacy CSS metrics and template options agree. Inspected responsive
  screenshots; long titles, hidden/expanded controls and dialogs fit. Intentional
  safety/accessibility differences are documented, not claimed pixel-identical.
- Backlog coverage and live boundaries are in the acceptance report. No production
  changes, commit, push or deployment. Next: Command HQ; zero local Production
  batches remain. Overall stays 6/13 fully closed, with seven milestones open.
