# Art Therapy Winner Visibility

Verified ClickUp tasks:

- `AT-206-INS-121`: `86d3bxgpb`
- `AT-242-INS-133`: `86d3tv2f2`
- Both are Winners in Art Therapy list `901613534733`, mapped to Immuvi product `prod-1776760023723`.

## Cause

The database duplicate-collapse trigger retired `AD-208` but kept its shared
ClickUp ID on both the soft-deleted row and its deletion marker. The UI's
anti-resurrection rule therefore also hid the surviving canonical task.
The other task had two active rows, and the canonical record retained a stale
Quilting `_syncProductId` despite its Art Therapy row ownership and source list.

## Repair

Applied `20260910090000_scope_duplicate_ad_tombstones.sql` and the guarded
`scripts/repair-art-therapy-winners.mjs --apply` repair on 2026-09-10.

- Kept the canonical rows keyed by the two actual ClickUp IDs.
- Retired duplicate IDs remain soft-deleted and row-ID-tombstoned. Their old
  ClickUp identities are retained in `_supersededClickUpTaskId` for audit only,
  rather than treated as deletion of the surviving ClickUp task.
- Matrix assignments and manual-action source IDs follow the canonical record.
- A before-write guard normalizes the sync stamp only when the stored source
  list exactly matches the row's owning product. Foreign-list records remain
  blocked by the existing UI product-boundary checks.
- Stale saves cannot reattach a ClickUp deletion identity to a retired duplicate.
- Explicit user-deletion markers are not cleared or weakened.

No ClickUp writes, reclassification, brief regeneration, angle/persona changes,
or changes to the tasks' Winner status were made.

## Backup And Rollback

Private, Git-ignored checkpoint:

`backups/art-therapy-winner-visibility-2026-09-10T07-27-47.989Z/`

`before.json` contains all four original AD rows, the original deletion marker,
the related manual action and two matrix cells, the live ClickUp records used
for verification, and the previous database function/trigger definitions.
`after.json` captures the repaired records. `COMMITTED.json` confirms commit.

For a requested rollback, compare current rows with `after.json` first so later
user edits are not overwritten. Restore only the affected identity fields,
deletion markers, and remapped action/matrix references from `before.json` in a
transaction. Restore the previous duplicate-collapse function and remove the
new normalization trigger/function only after checking for later migrations.
Do not restore whole tables or alter the ClickUp tasks.

## Verification

`node tests/db/test_duplicate_ad_tombstones.mjs` exercises the real triggers in
a transaction that always rolls back, including schema changes and test rows.
It covers a live survivor, row-only deletion markers, stale-client writes,
matrix/action remapping, preservation of per-cell metadata, foreign-product
isolation, and genuine user deletion.

The live repair asserts exactly one active record per task, correct product
stamps, retained matrix assignments, no shared ClickUp deletion marker, and
unchanged creative fields and brief text.
