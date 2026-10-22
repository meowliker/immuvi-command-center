# Placement Catalog And Hidden-Task Search

## Findings

The prior browser-confirmation fix did not remove placement's ability to create
active master taxonomy and did not cover older tabs. New Astro Rekha categories
again carried placement-generated provenance. Existing archives were preserved;
these were new rows, not a stale unarchive.

The reported missing Winner and its Action Plan row were intact, with their
original matrix assignment. Its persona was archived in an earlier source-only
cleanup. Matrix search indexed its assignment but only searched rendered grid
cells, so the task could not be found without showing all archived columns.

## Prevention

- Inspiration placement now requires both categories to exist and be active.
  It never creates or restores master categories, even after a blanket confirm.
- `_ensureTaxonomyItem` requires explicit Add intent for a missing category.
  Inline custom Add retains this intent; retagging validates both categories
  before any mutation. Separate Add/Restore actions remain available.
- The additive database function update archives new legacy placement-provenance
  inserts even if an old tab sends approval=true. Existing UPSERT approval/archive
  preservation, explicit Restore and cross-product rejection remain intact.
  No existing record or role grant is modified by the migration itself.
- Matrix search now surfaces matching assigned tasks outside visible columns.
  It opens their existing cell without restoring taxonomy, creating an assignment
  or saving business data. Search-result opening is product/assignment guarded
  and uses a temporary lifetime view for that cell only, so date/status filters
  cannot conceal the requested Winner. Ordinary grid/filter behavior is unchanged.

## Approved Data Scope

The user authorized reversible archival of exactly 10 placement-added angles and
11 placement-added personas in Astro Rekha. Nine earlier active personas and 22
other active angles remain. The task, Winner status, creative labels, notes,
briefs, ClickUp links, parent relationships and all matrix assignments are kept.
Other products are outside the data repair scope. No reclassification, brief
creation, ClickUp write or restoration of an archived persona is performed.

The private operation defaulted to rollback and backed up selected categories,
the reported task/cell and the previous trigger definition. It applied the
migration twice for idempotency, ran synthetic insert/UPSERT/explicit Add/Restore/
wrong-product contracts with fixtures rolled back, then compared full row
fingerprints for 13 protected sets. Final apply changed only target archive and
automatic update timestamps; every protected fingerprint matched. Live IDs,
source links, evidence and backups remain outside this public repository.

## Regression Checks

Focused tests cover placement without category creation, explicit Add, retag
boundaries, hidden-result deduplication, deleted/foreign/quarantined exclusion,
stale callbacks, product switching, and opening a Winner without taxonomy
restoration. Desktop/mobile browser fixtures exercise the real search, cell
classification, lifetime and cell-filter functions. Search adds no polling,
realtime channel, remote call or background database write.

Verification completed: 385 Node tests and 104 Python tests passed, along with
desktop/mobile hidden-task search and the existing personal-worker browser
suite. The exact live Winner was independently found by the new search in an
isolated read-only context, with its original cell opened, persona still archived
and nine active personas retained. The production asset build and inline syntax
checks passed. Search opening skips status-history backfill and legacy saved-view
migration so it remains a lookup rather than a background business-data write.

For rollback, revert only this release's code after reviewing later work.
Selected category archives can be restored individually from the private backup
only after comparing current row versions. Do not bulk-restore taxonomy or task
tables. The database guard is additive and should remain unless deliberately
replaced with a reviewed equivalent.
