# Matrix Placement Category Approval

## Cause

The earlier archive and sync guards remained active. A different path,
`_prepareInspirationCell`, treated placing an inspiration as implicit approval to
create its missing angle or persona as active product-wide taxonomy. Repeated
placements therefore expanded the persona list without an explicit category
creation decision. Classification alone did not create these rows.

## Prevention

Both app entry points now validate both categories first, then list all missing
categories and the destination product in one confirmation. Declining exits
before taxonomy, inspiration scope, creatives, matrix assignments or saves are
changed. Approving creates the exact categories once. Placement into existing
active categories is unchanged. Archived, deleted and foreign categories remain
unavailable; ordinary sync still cannot discover master taxonomy.

No worker, API, permission, database schema, classifier or refresh cadence change.
The root and published HTML remain identical apart from their existing module
path difference.

## Scoped Data Repair

The user authorized archiving only seven placement-added Astro Rekha personas,
keeping nine earlier active personas, including explicitly restored categories.
Archive is reversible. No creative, label, brief, task status or matrix assignment
is remapped or deleted. Archived columns remain available through Show archived.
Other products and angles are outside the repair scope.

The private operation defaults to rollback, checks exact IDs, names, placement
provenance and expected active counts, backs up selected rows, and compares full
row fingerprints across protected business tables and private jobs. Only target
archive timestamps and their automatic update timestamps may change. No ClickUp
writes are performed. Live IDs, backups and source evidence stay outside this
public repository.

## Regression Coverage

Tests cover one confirmation for two missing categories, decline with no partial
creation or creative placement, case-insensitive reuse without repeat prompts,
unchanged existing-category placement, archived/deleted/foreign rejection, and
the same behavior across products and both HTML entry points. Existing taxonomy
creation, stale-snapshot, product-boundary and deletion tests remain required.

The approved data repair completed with 16 to 9 active personas and all 13
protected record sets unchanged. Its first apply attempt stopped before writes
on a Date-versus-JSON backup comparison; after representation normalization, the
rollback rehearsal and final apply passed without weakening row checks. All 374
Node and 104 Python regression tests, both entry points' inline syntax, native
desktop/mobile accept/cancel checks and the production asset build passed.
