# Action Plan Local Acceptance

Date: 2026-09-22. Branch: `qa`. Scope: the Next.js Action Plan at `/`,
including its Tracker/Matrix/ClickUp boundaries. This is not a production
release approval or acceptance of the entire command center migration.

## Fixes In This Pass

- Quick linked status/due edits now submit the versions displayed to the user.
  They no longer fetch fresh versions immediately before saving and thereby
  bypass stale-screen conflict detection.
- Standalone quick edits now use the existing `qa_plan_batch` transaction to
  save workflow changes and history together. The previous unawaited history
  insert was a lazy query that never executed.
- Both paths validate the acknowledgement's product, record/source identity,
  versions, remote-task identity, lifecycle, and applied value before reporting
  success or pushing to ClickUp. An unverifiable response requires refresh.
- Action Plan Variation Lab retains the draft and blocks repeat submission
  after an ambiguous RPC response. A definite database rejection remains
  retryable; a successful acknowledgement closes the editor normally. The
  disabled state no longer displays an ongoing creation after the request ends.
- Restored the legacy drawer/table/card cell-identity fallback from custom-field
  mirrors, markdown brief tables, labeled lines, and ClickUp table embeds.
  Existing action snapshots and typed creative fields retain precedence. The
  fallback is read-only and does not change Matrix assignments or database rows.

No new SQL migration, page, external launch, or automatic creation retry was added.

## Acceptance Coverage

The full intercepted browser runner is `tests/browser/command-center-live.cjs`.
Its Action Plan flows cover:

| Area | Checks |
| --- | --- |
| Workspaces | Table, Cards, Pipeline, Week, Trends, Variations; populated/empty states; same-page navigation |
| Selection | Search/facets, date windows, Show Selected, bulk status/due/remove, hidden/adopted rows |
| Persistence | Saved columns/layouts, inline rename, assignments/custom fields, canonical creative editing |
| Details | Buyer/Strategist drawer, provenance, source briefs, winning files, exact Matrix navigation |
| Operational state | Pulse periods/tiles, age sorting, checkpoints/snooze, linked-production completion, history |
| Lifecycle | Hide/restore, adoption/promotion, deletion/tombstones, ClickUp repair and recreation |
| Variations | Overview/chips, templates, advanced rows, assignments/dates, draft retention, stale-parent rejection |
| Failure handling | Stale quick edits, unverifiable saves, pending remote changes, uncertain variation acknowledgement |
| Live state | Realtime updates/reconnects, cross-tab invalidation, product switching, preserved drafts/scroll |
| Access/layout | Admin/member navigation, product restrictions, forced password change, desktop/mobile controls |

The new `action-plan-acceptance-flow.cjs` specifically simulates a concurrent
creative update and rejects the stale save, retries after refresh, verifies
standalone status/due/history and clearing, rejects a missing save acknowledgement,
and simulates a variation committed in the fixture but missing its acknowledgement.
The latter preserves the draft, disables repeat submission, and reconciles via
refresh. Every backend request is intercepted; none of these are live DB tests.

## Backlog Traceability

These are covered invariants, not blanket claims that every historical bug is fixed.

| Backlog | QA coverage |
| --- | --- |
| 1.2 | Inclusive local end dates and same-day ranges, including DST tests |
| 5, 10, 15, 20, 47, 48, 52, 53 | Creation/status/field/description/due-date contracts, pending pushes, product/list identity and missing-schema guards |
| 7, 12, 41, 42, 44 | Realtime lifecycle, no-op merging, scroll and draft preservation |
| 19 | Cell-identity fallback tests plus drawer/provenance/Matrix navigation browser acceptance |
| 22, 29, 34 | Product/list boundaries, duplicate and conflicting identity rejection, adoption safeguards |
| 51 | Tombstone/deleted/quarantined record suppression; no automatic resurrection |

The browser mocks do not prove real ClickUp list configuration, deployed SQL,
RLS, worker behavior, or existing production-data cleanliness. Inspiration
classification/media/script formatting, Production, taxonomy cleanup, and Command
HQ backlog items remain in their own migration milestones. Moving to Next.js
does not itself fix those bugs.

## Verification

- 319 domain/service tests pass.
- Optimized Next.js build, including TypeScript, passes.
- Focused final acceptance and drawer/cards browser checks pass.
- Full browser regression passes: zero unexpected browser errors/external
  requests and 99 mocked mutation attempts. Evidence:
  `/tmp/immuvi-plan-final-regression/results.json` and adjacent screenshots.
- Screenshots of the uncertain-creation state were inspected; responsive checks
  sample supported layouts, not a claim of pixel-identical rendering everywhere.
- `git diff --check` passes. Legacy HTML, deployment configuration and OneScale
  callback files are unchanged. No environment edits, remote writes, commits,
  pushes, deployments or schema changes were performed in this acceptance pass.

## Remaining Gates

1. Run realistic acceptance against the isolated QA Supabase and test ClickUp
   list, including SQL/RLS and concurrent authenticated users, before cutover.
2. OneScale handoff/callback remains blocked: no isolated non-launching test
   destination exists. External launching stays disabled.
3. Complete migration milestones 8-13, user sign-off, and explicit release approval.

Variation creation still has no durable idempotency key. The new guard prevents
repeating the same uncertain open draft; it does not promise exactly-once behavior
after closing/reopening or across devices. Inspect refreshed records before
creating another batch after an uncertain result.

Production release remains **NO GO**. Local feature acceptance and external
integration/release acceptance are deliberately separate.

All four local Action Plan finish batches are complete. No local finish batch
remains; milestone 7 retains its external integration gate. Next implementation
work is milestone 8, Inspiration. The overall tracker remains 6/13 fully closed
milestones, with 7 not fully closed including that gate.
