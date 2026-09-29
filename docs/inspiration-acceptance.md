# Inspiration Acceptance Audit

Date: 2026-09-23. Branch: `qa`. Status: local QA acceptance complete;
live integration and user visual sign-off remain open. Not release approval.

## Scope And Evidence

Compared the legacy Inspiration renderer, reuse helpers and brief lookup with
the modular Next.js implementation at `/`, and reviewed the relevant backlog
contracts. No iframe or separate replacement dashboard was introduced.

397 domain/service tests and optimized build including TypeScript pass. Prior
rollback-only QA SQL tests remain the database evidence; no SQL changed in this
final pass. The full intercepted browser regression passes with 158 mocked
database mutation attempts, zero unexpected errors and zero external requests.
The focused inline/brief run passes with 17 mocked attempts. Focused checks include
320/390/768/1440px screenshots, table overflow and section-level drawer bounds.
Evidence is in:

- `/tmp/immuvi-inspiration-parity/results.json` and adjacent screenshots.
- `/tmp/immuvi-inspiration-parity-regression/results.json` and adjacent screenshots.
- `/tmp/immuvi-inspiration-inline/results.json` and adjacent screenshots.
- `/tmp/immuvi-inspiration-inline-regression/results.json` and adjacent screenshots.
- `/tmp/immuvi-inspiration-mapping/results.json` and adjacent screenshots: five
  mocked mapping attempts, no unexpected errors or external requests. Mapping
  dialogs fit 320/390/768/1440px; mobile and desktop screenshots were inspected.
- `/tmp/immuvi-inspiration-mapping-regression/results.json`: full admin/member
  regression, including the existing Action Plan and Inspiration flows. The Angle
  refresh assertion now checks its selected value, not the accessible text of a
  cell that also contains mapping controls. Related-creative drawer screenshots
  in the focused run fit 320/1440px and were inspected.
- `/tmp/immuvi-inspiration-duplicates/results.json`: ranking, automatic duplicate,
  mapping and inline checks pass with 24 mocked attempts, no unexpected errors or
  external requests. Duplicate drawers fit 320/390/768/1440px; mobile/desktop images
  were inspected. Direct tests compare 84 scenarios with the actual legacy matching
  and ranking functions, including both angle/persona ranking and outcome buckets.
- `/tmp/immuvi-inspiration-duplicates-regression/results.json`: full admin/member
  regression passes with 156 mocked mutation attempts and no unexpected browser
  errors or external requests.
- `/tmp/immuvi-inspiration-final/results.json`: focused final checks pass with two
  mocked attempts, no unexpected errors or external requests.
- `/tmp/immuvi-inspiration-final-regression/results.json`: final full admin/member
  regression passes with 158 mocked attempts and no unexpected errors/external
  requests. An earlier attempt stopped at a sign-in actionability timeout; the
  complete rerun passed without an authentication code change. Final warning/retry
  screenshots at 320/1440px pass bounds checks; mobile and desktop images inspected.

## Final Local Fixes

- Ordinary save/create acknowledgements now verify each requested field (and
  source URL), not just record/receipt identity. A mismatch preserves the exact
  retry and cannot trigger linked ClickUp pushes. The browser fixture corrupts
  one response after saving, then proves exact-request recovery and reload.
- Cross-product brief context reads complete source snapshots. This preserves
  the optional deletion metadata contract; current schema uses hard deletion,
  so no existing soft-delete leak is claimed. Removing an inherited brief's
  source removes both its link and stored sections after realtime refresh.
- Mapping cues memoize ranking for unchanged row/taxonomy/creative inputs. No
  whole-dashboard performance improvement is claimed without a UI benchmark.

## Covered Locally

- Product-scoped paginated rows, live queue truth, facets/search/sorting, details,
  creation/editing/approval/deletion, retries and explicit complete-result imports.
- Matrix placement, cross-product import, scoped insights/trends/Pulse, queue-only
  recovery, batch import and source ad-type synchronization contracts.
- Previously missing table fields: Hypothesis, Notes, Ad Copy, Duration, Tags,
  Reuse and Actions. The default view now follows the legacy compact column set
  and order; an icon toggle exposes the long-text/detail columns. Format detail
  is displayed, searchable and editable through a guarded QA extension RPC.
- Inline name, angle/persona, structure, hook, production, funnel, type, hypothesis,
  notes and attribution edits. Active product taxonomy and saved custom values
  remain selectable; custom labels are inspiration-local, not promoted globally.
  Drafts use the displayed row version and survive refresh, filtering caused by
  live changes and deletion. Uncertain responses keep the same receipt for retry.
- Relative timestamps, duplicate-review entry, segmented usage, queue summaries,
  source/brief links, icon filters and direct use/edit/delete entry points.
- Canonical reuse context from actual accessible-product copies. Distinct product
  totals change after copy deletion and exclude inaccessible products. This is
  deliberately not the legacy sum of local creatives and stale import flags.
- Stored classification sections and next-ad script tables rendered as plain text.
  Wide breakdowns scroll locally; surrounding mobile text remains within the drawer.
- Existing/inherited brief links and explicit missing-link recovery. Source task
  links are labeled separately from documents. QA membership/access/version guards
  precede lookup; the save preserves content and cannot overwrite an existing link.
- Lost save responses retry the same receipt. No classifier, ClickUp document
  generator or external mutation is triggered by brief recovery.
- Angle/persona mapping supports active same-product suggestions, an existing
  target, a custom inspiration-only label, or explicitly confirmed promotion to
  the product taxonomy. Source/target versions and queue guards are checked;
  archived targets and duplicate names are rejected. Lost acknowledgements replay
  the same receipt without creating a second taxonomy entry. Related creatives
  are not retagged by mapping.
- Suggestions now use legacy similarity/status/creative-count ranking and the
  preferred merge target, including status, count, name length and creation age.
  Performance comes from eligible same-product root creatives, not stored taxonomy
  status or stale saved suggestion arrays. Opening the dialog freezes its target
  snapshot; the table suggestions continue to reflect current data.
- Duplicate evidence is recomputed after relevant inspiration/creative changes,
  not read from stale `_dupeSimilar` labels. Exact angle/persona/funnel, combination,
  and hook/structure matches retain legacy word overlap and winner/loser/tested
  priority. Only four related links are shown; review signatures cover all matches.
  Missing, foreign, ambiguous, deleted, quarantined, hidden or tombstoned targets
  cannot be opened. Valid links switch to Creative Tracker and its editor within
  `/`; Tracker rechecks availability after loading, including deletion races.
- Reads/realtime refreshes never persist computed duplicate data. Explicit review
  saves an evidence signature through the guarded QA RPC, with durable same-request
  retry. Refresh/reload preserves a review for unchanged evidence; new matches,
  relevant field edits, renamed matches and changed outcomes require review again.
  A new match arriving while review is open is not hidden by the old confirmation.
  Clearing both axes, removing matches or entering a blocked/active queue state
  removes stale duplicate warnings. Legacy stored evidence is retained, not repaired.

Task comments are read in 25-item pages using both `start` and `start_id`, following
the [ClickUp pagination contract](https://developer.clickup.com/docs/task-comments-pagination).
This finds links stored in task text/fields/comments; it does not claim to enumerate
every attached Doc or verify a linked document's contents or readability.

## Workflow Coverage Map

The following files in `tests/browser/` run together in the intercepted dashboard
regression. They exercise the modular app at `/`, not the legacy HTML runtime.

| Workflow | Browser coverage |
| --- | --- |
| Library, queue truth, filters, sorting, details, product changes | `inspiration-library-flow.cjs` |
| Intake, edits, approval, delete, retry/repost and result import | `inspiration-mutations-flow.cjs` |
| Suggested/custom Matrix use and cross-product copies | `inspiration-placement-flow.cjs`, `inspiration-cross-import-flow.cjs` |
| Insights, trends and Pulse | `inspiration-analytics-flow.cjs` |
| Queue-only recovery, batch results and source-type sync | `inspiration-recovery-flow.cjs`, `inspiration-batch-flow.cjs` |
| Table/reuse/brief presentation, recovery and inline edits | `inspiration-parity-flow.cjs`, `inspiration-inline-flow.cjs` |
| Mapping, promotion, suggestions and duplicate review/navigation | `inspiration-mapping-flow.cjs`, `inspiration-duplicates-flow.cjs` |
| Deleted inherited brief, inconsistent save acknowledgement and retry | `inspiration-final-flow.cjs` |

## Deliberate Differences

- Legacy polling automatically imports classification results; QA uses explicit,
  guarded single/batch imports and does not dispatch a classifier. The live worker
  lifecycle is not exact behavioral parity and remains an external acceptance gate.
- Inline edits use Save/Cancel instead of blur. Suggestion clicks open confirmation;
  creating taxonomy entries requires explicit promotion rather than typing a label.
- Duplicate ordering is stable by ID within match levels, not fetch order.
  Read-only recomputation replaces save-on-load; review applies to identical current
  evidence, not a historical dismissal flag. Unavailable Tracker rows are excluded.
- Reuse totals count actual accessible-product copies, not stale import flags.
  Manual intake uses a form instead of browser prompts. Approval and Matrix placement
  are explicit actions in the same drawer.

These differences need user acceptance before cutover. Responsive checks and legacy
function comparisons are not pixel-exact certification.

## Backlog Boundaries

| Backlog | Local migration coverage | Still not proved |
| --- | --- | --- |
| 31, 32 | Shared queue status projection and rendered-row regression | Real worker completion and legacy data repair |
| 39 | Pending media display and stored factual-media correction contracts | Actual download/media detection |
| 45, 46 | Versioned retry/recovery, retained audit and blocked dispatch | Isolated worker claim/retry lifecycle |
| 49 | Scoped reads/writes, source access and late-product response guards | Full deployed RLS/security acceptance |
| 50, 56, 57, 61 | Placeholder suppression, literal copy with normalized line breaks, no fabricated VO | Speech versus ambient audio, platform download/transcription, generated CTA correctness |
| 54, 55, 58, 59 | Complete-result import validation and stored structured script tables | Worker skill freshness, generation quality, persisted eight-section remote brief |
| 14, 21 | No new worker execution enabled | Worker/runtime integration acceptance |

Changing frameworks does not fix classifier/audio/provider bugs by itself. Existing
backlog statuses describe earlier work; this audit does not certify those fixes in
the migrated app or rewrite production records.

## Remaining Acceptance

Local workflow comparison and the final regression are complete for the documented
QA scope. **Zero local Inspiration finish batches remain.** Next implementation:
milestone 9, the Production tab (not a production deployment).

1. Live QA ClickUp: actual test-list brief discovery/readability, linked-name and
   source-type delivery. Mocked successes do not prove remote configuration.
2. Isolated classifier: claim/retry lifecycle, downloads, audio/transcription and
   complete generated eight-section briefs. Dispatch stays disabled until safe.
3. Release acceptance: user visual/behavioral sign-off on the differences above,
   plus deployed multi-user RLS/security checks in milestone 12. No pixel-exact
   certification is claimed. OneScale remains a separate blocked Action Plan gate.

These are existing external/release gates, not new local feature batches.
Overall: 6/13 milestones fully closed, 7 open. No commits, pushes, deployments,
database changes or production modifications in the final local pass.

## Prior QA Database Evidence

QA migration `20260923040000` adds the guarded link-save
function and permissions only; rollback fixtures leave no user records behind.
Migration `20260923050000` adds the format-detail wrapper around the existing
mutation RPC: existing access, queue, child-version, rename and receipt guards are
reused in the same transaction. It does not change any existing inspiration data.
Migration `20260923060000` adds guarded mapping and taxonomy promotion in the same
transaction as the existing inspiration mutation. It was installed only in QA;
rollback tests cover access, stale source/target versions, receipt replay/collision,
archived/duplicate names, queue refusal, preserved data and anonymous denial.
Readback confirms migration registration, authenticated execution, anonymous denial
and removal of the rollback fixture products.
Migration `20260923070000` installs only the duplicate-review acknowledgement
wrapper in QA. It stores the explicitly reviewed evidence, not a server-certified
classification result. Existing access/source-version/queue/receipt guards are
reused; source data is preserved. Rollback tests and readback confirm access denial,
stale-source and foreign-evidence rejection, replay/collision behavior, active-worker refusal,
authenticated-only execution, migration registration and fixture cleanup.
