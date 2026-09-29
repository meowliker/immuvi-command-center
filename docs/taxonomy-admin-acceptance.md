# Taxonomy And Admin Acceptance

Milestone 11's four local implementation/verification batches are complete.
Cleanup behavior approval, user sign-off and live integration acceptance remain
open; the milestone is not fully closed. Overall count stays 6/13 closed and 7 open. Work remains on
`qa`, in the single command center at `/`; no push or production deployment.

## Verified In This Portion

- Angles and Personas use the compact legacy seven-column layout, plain summary
  counters, status rails and compact row controls. All/Active/Archived filtering,
  explicit save, conflict recovery and retained drafts remain in React.
- Admin creation is above the user list, with dense, unframed sections and
  responsive controls. Existing services, authorization and receipts are reused.
- All 33 default creative-structure, hook-type and production-style descriptions
  match the actual legacy constants. Shared editor fields expose their selected
  description through `aria-describedby`. Explicit saved catalogs, including
  empty values, still override defaults.
- New product inspiration prefixes use the original word-initial rule: Astro
  Rekha becomes AR, Immuvi becomes I, and QA Test Product becomes QTP. The form
  previews it; the database derives it independently. Existing prefixes and
  historical request receipts are not rewritten.
- Rename confirmation now shows database-calculated creative/task, inspiration
  and Action Plan counts. Failed/unverifiable previews send no mutation; cancel
  retains the draft. A preview arriving after product/tab exit cannot prompt or
  save in the old scope.
- Commit requires the confirmed revision and rechecks a locked snapshot of the
  product's taxonomy, ads/tombstones, inspirations, actions, Matrix and links.
  Changes in contents or identities invalidate confirmation even if counts stay
  unchanged. The transaction also compares actual cascade counts with the preview.
- One atomic admin audit stores actor, request/product/kind, source ID/version,
  before/after names, after version, affected IDs, counts and pending remote count.
  A receipt contains verifiable rename evidence, without exposing the affected-ID
  arrays. Exact replay returns the original acknowledgement without another audit.
  Audit insertion failure rolls back catalog/cascades/receipt together. Historical
  receipts remain replayable; new unconfirmed rename requests are rejected.

## Evidence

- 470 domain/service tests and optimized Next.js build, including TypeScript,
  pass. The new domain tests compare defaults directly with legacy literal data,
  rather than a second manually maintained expected list.
- Focused intercepted browser acceptance passes one scenario and one mocked
  write, with no unexpected errors or external calls. It compares inert legacy
  render output for labels, counts, seven-column headers and font metrics;
  verifies seventh-column action alignment; checks safe links and literal text;
  and exercises draft retention, keyboard dismissal, field descriptions and
  product-prefix preview. The legacy app startup script is never executed.
- Angles, Personas and Admin are checked at 320, 390, 768, 1100, 1440 and 1920px.
  Desktop/mobile screenshots were inspected. Evidence:
  `/tmp/immuvi-taxonomy-admin-final/results.json`.
- Full intercepted browser regression passes 86 scenarios and 227 mocked
  mutation attempts, with no unexpected browser errors or external requests:
  `/tmp/immuvi-taxonomy-admin-final-regression/results.json`.
- Rollback-only SQL verifies prefix derivation, exact replay, preserved historical
  receipts, one creation audit and private-helper permissions. Two prior product
  administration/cleanup database workflows also pass; all fixtures roll back.
- `20260925050000_qa_product_prefix_parity.sql` is installed only in QA project
  `entgcnlfsnysnwyadzzp`. Installation, history, permissions and fixture absence
  pass read-back verification through
  `node scripts/check-qa-product-prefix-parity.mjs --verify`.

## Remaining Acceptance Gates

1. **Cleanup parity decision.** QA deliberately preserves unused taxonomy,
   quarantined work and referenced records. Legacy cleanup can remove taxonomy
   and override quarantine protection. The user was asked which behavior to
   accept; no approval to broaden deletion has been received. Retain safe QA
   behavior until that decision is made.
2. **User sign-off.** Local final regression passes. Record user visual/workflow
   approval separately. Automated
   layout comparisons are not a claim of whole-dashboard pixel identity.

No additional local finish batch is planned for milestone 11. The next main
stage is milestone 12, cross-application QA and regression, followed by milestone
13, QA cutover only after sign-off. Earlier feature integration gates remain open.

## Rename Verification

- 474 domain/service tests and optimized Next.js/TypeScript build pass. Service
  tests reject foreign/malformed/stale previews and missing or mismatched rename
  evidence, preserving uncertain requests for exact recovery.
- Rollback-only QA SQL and the prior taxonomy workflow pass. Coverage includes
  canonical aliases, child/mirror records, protected/foreign records, both axes,
  missing/stale confirmation, source versions, replay, affected-ID audit evidence,
  synthetic audit rollback, active-product/password gates and private permissions.
  Fixtures roll back; no existing taxonomy is renamed by the tests.
- Focused intercepted browser acceptance passes one scenario/four mocked writes,
  with no unexpected errors or external calls: cancel, unverified preview, same-
  count changed-data rejection, retained drafts, reload recovery, one audit,
  mobile persona rename and late-product cancellation. Evidence:
  `/tmp/immuvi-taxonomy-rename/results.json`.
- Full intercepted regression passes 87 scenarios and 231 mocked mutation
  attempts, with no unexpected browser errors or external requests:
  `/tmp/immuvi-taxonomy-rename-regression/results.json`.
- Migration `20260925060000_qa_taxonomy_rename_preview.sql` is installed only in
  QA project `entgcnlfsnysnwyadzzp`. Read-back verifies history, installed guard
  and audit markers, private-helper/receipt permissions and fixture absence:
  `node scripts/check-qa-taxonomy-rename.mjs --verify`. Installation does not
  rename existing records, backfill historical audits or dispatch remote work.
- The underlying cascade/merge/delete implementation is unchanged. This adds a
  guard and provenance to the existing transaction, not a second retagging writer.
- The snapshot is deliberately conservative: unrelated changes in these product
  tables can require a fresh confirmation. Large-product performance and real
  concurrent legacy writers remain milestone-12 checks. Direct legacy writers
  can bypass the QA RPC; the safeguard is not a claim to control every writer.

## External And Release Gates

- Real isolated ClickUp delivery/cleanup and deployed authorization acceptance
  remain separate from intercepted HTTP tests and rollback-only SQL checks.
- No isolated worker or OneScale destination exists. Resume, classifier dispatch
  and real ad launches stay disabled. Pause is cooperative, not a guaranteed
  process stop; actual worker acknowledgement remains untested.
- Older writers, historical data contamination and unrelated backlog bugs remain
  release risks. This portion does not claim that a framework migration fixes
  every bug or repairs existing production data.
- QA preview remains `http://127.0.0.1:3001/`. No production data, deployed service,
  legacy HTML or worker executable was changed in this portion.
