# QA Backlog Evidence

This audit maps the entries actually present in `bugs-backlog.md` to migration
evidence. Historical "done" labels are not proof of a fix in the new application
or in production. Bug 1 has four numbered subentries, Bug 9 has a continuation,
and there is no Bug 4 heading. No backlog statuses or production data were changed.

Paths in the evidence column are relative to `tests/` unless stated otherwise.
"Local" includes intercepted browser tests; these do not demonstrate delivery to
ClickUp, execution by workers, real ad launching, or pixel-exact visual parity.

| Backlog IDs | Evidence in the migrated application | Remaining limitation |
| --- | --- | --- |
| 1.1-1.4, 3, 6, 8, 20, 30, 38, 43 | `domain/creative-matrix.test.js`, `browser/matrix-flow.cjs`, `database/matrix-mutations.sql`, `database/inspiration-placement.sql`: date scope/highlight, same-day bounds, retained modal state, independent cell creation, canonical membership and archived-axis filtering. Live two-session Matrix replay also passes. | User visual acceptance; external writers can still need reconciliation. Generated historical taxonomy is not automatically repaired. |
| 2, 9 (both entries), 10, 18, 40 | `domain/clickup-sync.test.js`, `domain/clickup-creation.test.js`, `services/tracker-clickup.test.js`, `database/clickup-sync.sql`: ISO timestamps, additive imports, tombstones, pending edits, native status mapping, shared sync state. | Actual test-list status/field delivery and poll ordering against remote edits. |
| 5, 15-17, 23, 24, 47, 48, 52, 53 | `domain/clickup-creation.test.js`, `services/clickup-creation.test.js`, `domain/action-plan-cell.test.js`, `database/creation-workflow.sql`, `browser/production-tasks-flow.cjs`: preserved brief, current cell, source links, custom-field zero/false, assignments, due dates, schema-scoped status and durable creation recovery. | Real ClickUp description/table rendering, Product field, status schema, date/custom-field readback; worker-origin Script Bank approvals are not certified by native payload tests. |
| 7, 12, 41, 42, 44 | `services/live-sync.test.js`, `services/live-query.test.js`, `browser/command-center-live.cjs`: event bursts, fallback refresh, no-op state preservation, cross-tab notifications and stale-product response rejection. | Real hosted websocket disconnection/reconnection and legacy-writer contention were not exercised. Real REST concurrency is separate evidence, not a websocket test. |
| 11, 33, 36, 60 | `domain/taxonomy*.test.js`, `database/taxonomy-mutations.sql`, `database/taxonomy-rename.sql`, `browser/taxonomy-rename-flow.cjs`: normalization, merge/archive, confirmed rename impacts, locked revision and atomic audit/replay. | Historical stale caches and production repairs remain outside this run; no existing taxonomy was renamed. |
| 13 | `database/product-administration.sql`, `database/product-prefix-parity.sql`, `browser/product-administration-flow.cjs`: atomic create/delete/unlink, protected manifests, receipts and preserved config. | User approval of destructive-product UX and deployed verification. |
| 14, 21, 37 | Worker downloader/skill/runtime issues, not frontend responsibilities. No worker execution was enabled by this migration. | Isolated worker/runtime acceptance required. Changing to Next.js does not fix these issues. |
| 19 | `domain/action-plan-cell.test.js`, `browser/action-plan-drawer-flow.cjs`: cell identity fallbacks and drawer presentation. | User visual/workflow sign-off. |
| 22, 29, 35, 49 | Product-scoped service/domain tests, `database/product-rls.sql`, `scripts/check-qa-live-boundaries.mjs` and late-response browser scenarios. Actual anonymous, foreign-product, inactive and forced-password access checks pass in QA. | Incorrect historical content inside an otherwise correctly scoped row still requires a data audit/repair. No production repair was performed. |
| 25-28 | `database/stale-ad-cleanup.sql`, `services/stale-ad-cleanup.test.js`, `browser/stale-ad-cleanup-flow.cjs`: complete snapshots, previews, confirmation, protected references, atomic tombstones and recovery. | Deliberate difference: unused taxonomy and quarantined/referenced work are preserved. Destructive legacy pruning is not implemented or silently approved. No live cleanup against existing records was run. |
| 31, 32, 39, 45, 46 | Inspiration domain/service suites, `database/inspiration-recovery.sql`, `database/worker-controls.sql` and corresponding browser flows: factual queue states, rendered rows, pending-media suppression, versioned recovery and blocked enable/dispatch. | Actual classification, media detection, claim/retry and worker acknowledgement require an isolated worker. Pause is not process termination. |
| 34, 51 | Identity/tombstone domain tests, `database/tracker-mutations.sql`, `database/action-plan-repair.sql`, browser deletion/adoption/recovery flows: duplicate identities rejected, local deletion retained, replay cannot recreate deleted work. | Real test-list deletion/recovery and legacy service-role writers remain unverified. |
| 50, 54-59, 61 | Inspiration presentation/import validation tests preserve literal copy, structured tables, complete-result contracts and absent VO placeholders. See `inspiration-acceptance.md`. | Downloads, speech versus ambient audio, transcription, skill freshness, generation quality and remote eight-section briefs remain worker/provider acceptance, not frontend fixes. |

## Release Meaning

The local tests support the specific contracts listed above. They do not establish
that every historical bug is fixed. The real QA permission/concurrency suite now
adds evidence beyond mocked interfaces, while live integrations, historical data,
visual acceptance and deployment routing remain explicit release gates in
`qa-release-gate.md`. Those are gates within the existing final two stages, not
new feature milestones.
