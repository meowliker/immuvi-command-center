# Inspiration Identity Recovery

## Verified Cause

86 Phonics inspirations were stored under Kids Life Skill despite exact-source
queue records identifying Phonics. Product-local browser counters then reused
globally unique inspiration IDs. Three new sources overwrote existing records;
existing creative links caused the new sources to inherit Testing status.
Phonics and Pharmacology also share prefix P, and imports used unprefixed INS IDs.
Prefix ownership is not a safe database identity or authorization boundary.

## Recovery Applied

- Restored 86 existing records to Phonics using exact source URL + queue ownership.
- Restored P-INS-004, P-INS-005, P-INS-009 from the September 28 snapshot.
- Renumbered six September 29 additions from P-INS-004..009 to P-INS-141..146.
- Moved each new source's queue/results with its new ID and invalidated stale reviews.
- Phonics now has 98 inspirations. Total inspirations increased from 1964 to 1967.
- P-INS-006..008 are retired IDs, not lost sources: their complete rows now use
  P-INS-143..145. No intentionally deleted inspirations were resurrected.
- All 6906 ads, 3535 Action Plan rows, 3001 matrix cells, and 1586 deletion markers
  were unchanged in the post-repair comparison. Taxonomy rows were unchanged.

Three old ClickUp brief pages had already been overwritten by the classifier.
Their current contents were backed up. The old restored inspirations retain the
previous URL in `_recoveryPreviousBriefUrl`, with `_briefRecoveryNeedsReview=true`,
but no longer expose the wrong creative's brief link. Original full page text is
not present in the database snapshot; this is not claimed as recovered.

## Prevention

- All five creation paths use a product-authorized database RPC, never a browser count.
- Global per-prefix allocation considers saved identities, queue and result history.
  Prefix sharing is safe; deleted IDs remain reserved permanently.
- Immutable product/source identity guards cover worker and browser writes.
- Queue/results must reference the exact saved product, ID, and source URL.
- Browser saves write only changed rows and require the revision actually loaded.
  Stale updates and old clients fail closed rather than overwriting newer data.
- Product switching during asynchronous creation/import cannot append to another product.
- Inspiration reads are paginated and use authoritative product_id, not prefix guesses.
- Worker verifies source identity before model/brief work. Skill requires exact source
  verification before updating an existing ClickUp page, not just matching a page name.
- Database history records subsequent inserts, updates and deletes, inaccessible to
  anonymous/authenticated clients.

## Verification And Scope

110 JavaScript regression tests cover persistence, no-brief mode, taxonomy isolation,
UI loading, matrix search, deletion retry, and duplicate-visibility safeguards.
Database tests use transactions that roll back all test records and verify allocation,
idempotency, stale saves, cross-product/source rejection, queue guards, deletion
reservations, and audit isolation. The recovery itself first passed a rollback-only
dry run with before/after record assertions.

All 27 products were scanned. Thirteen older queue/current-source discrepancies
remain for review, including four cross-product conflicts. Some may be changed URLs
or historical imports/deletions; they are not sufficient evidence for automatically
moving or reconstructing additional records. Their source records remain in queue
history and in the private snapshots. This repair does not claim to resolve every
unrelated backlog issue.

## Rollback

Code baseline: `709cceed994475089802a18970361072d81ded3a`.
Local tag: `backup/inspirations-before-20260929`.
Private backup directory: `/private/tmp/immuvi-inspiration-recovery-20260929/`.
Durable private copy: `/Users/anaytripathy/.codex/backups/immuvi-inspiration-recovery-20260929/`.
Contains main-before.bundle, before/pre-repair/after table snapshots, recovery-plan,
transaction-after, taxonomy review snapshot and affected ClickUp page snapshots.
Earlier source snapshot: `/private/tmp/immuvi-taxonomy-backup-20260928/after/`.
The six new ClickUp page names were corrected to P-INS-141..146 with name-only
updates. Their contents were not replaced and the pre-rename pages were backed up.

Do not replay a full snapshot over live data. Reverse only the recovery-plan IDs
after checking their current revisions and saving another snapshot. Preserve later
user edits. Reverting frontend code alone intentionally leaves database safeguards
active, so old browser writes will be rejected; coordinate any rollback with the
database migration rather than disabling protection casually. Retain identity/history
tables even if application code is rolled back. QA was not edited.
