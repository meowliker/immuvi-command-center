# Command HQ Local Acceptance

2026-09-24, branch `qa`. Milestone 10: all three local batches complete.
Zero HQ local finish batches remain. This is not production release approval or
a claim that all legacy administration features have shipped.

## Verified Locally

| Area | Evidence |
| --- | --- |
| Legacy calculations and layout | Audited `process`, `deriveWinners`, `renderHQ`, `mono`, `esc` functions run with inert nodes, without legacy startup. Same fixture yields the same eight KPIs, five coverage lists, percentages and gap text. Computed padding, font sizes, grid gaps and card radii match. |
| Product data | Paginated reads beyond 500 rows, lifecycle/tombstone guards, archived/canonical axes, realtime refresh, last-good-data retention, initial failures and empty states. |
| Connection health | Shared controller and write lock; only the approved test list; persisted metadata including zero tasks; malformed schemas/counts rejected; explicit retry; key removal and auto-sync lifecycle. |
| List changes | Observed relink clears stale fields, input, notices and auto-sync. Pending client work is aborted/discarded, not represented as server rollback. |
| Access and activity | Assigned-product member view, admin-only configuration, late-response isolation, access revocation, paginated history failure/retry and foreign-event filtering. |
| Responsive and keyboard | Refresh from keyboard; compact product chips; 320/390/768/1440/1920px bounds; no overlapping product controls; long unbroken names wrap; literal HTML stays text. |

The reference harness executes only extracted audited functions with synthetic
data; no legacy integration, startup code or remote mutations run. Styling checks
cover concrete metrics, not a claim of pixel-identical whole-page screenshots.
Additional health/history sections are intentional. Existing taxonomy/lifecycle
correctness differences are documented in the migration report.

## Verification

- 424 domain/service tests pass.
- Focused HQ browser acceptance passes: `/tmp/immuvi-hq-final/results.json`.
  Zero unexpected browser errors/external requests and zero mocked DB mutations.
- Final optimized Next.js build, including TypeScript, passes.
- Full intercepted regression passes:
  `/tmp/immuvi-hq-acceptance-regression/results.json`, 178 mocked database mutation
  attempts, zero unexpected browser errors or external requests. This includes
  every existing tab/workflow scenario and the new final HQ acceptance checks.
- Normal mobile/desktop and pathological long-name screenshots inspected.
- No production changes, push, deployment, SQL or real external requests in this
  batch. Existing local preview stays at `http://127.0.0.1:3000/`.

## Remaining Boundaries

1. Milestone 11 owns add/delete product, unlink, Clean stale, product-scoped
   field catalogs, the Manage Fields editor, and remote field creation/setup.
   HQ Configure fields maps existing fields only. Browser-global custom options
   under `immuvi_field_options_v1` are not silently assigned to a product.
2. Historical bugs 35/36 are not fully closed: display isolation/deduplication
   does not repair wrongly assigned stored rows, enforce declared ClickUp Product
   on import, rewrite duplicate storage or prevent legacy writers.
3. Real QA-list integration, deployed authorization/RLS and user visual/workflow
   acceptance remain release gates. Mocked browser tests do not establish these.
4. No isolated OneScale/classifier destination is available; launching/dispatch
   stay disabled. No production merge or deployment without explicit approval.

Next implementation: milestone 11 taxonomy/admin, followed by milestone 12
QA/security and milestone 13 approved cutover. Overall count remains 6/13 fully
closed, 7 open: four local-complete milestones awaiting gates plus these three.
