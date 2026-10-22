# Normal Cell Restoration

The reported creative and Action Plan entry retained the same saved angle,
persona, Winner status and matrix assignment. The angle was active, but the
exact persona had been archived during an earlier source-taxonomy cleanup.
The search fallback exposed the task without returning it to the ordinary grid.

The user requested normal placement, not another display workaround. Restore
only that exact existing persona with an explicit approved update. Do not create
or rename a category, guess a broader persona, retag the creative, duplicate a
brief, reclassify it, or restore unrelated archived categories. The existing cell
contains two already-assigned creatives; restoring its column makes both visible
without modifying either record. Action Plan labels already agree with the
creative and require no update.

The private repair first ran with rollback, backed up the exact selected rows,
then restored one persona. Active personas increased from nine to ten; no active
placement-added persona returned. Full-row fingerprints for 13 protected data
sets matched before and after. All other persona rows, task records, matrix
assignments, Action Plan entries, inspirations, jobs and product records were
unchanged. No ClickUp write or application runtime change was made. QA was not
edited. Private identifiers and backups remain outside this public repository.

Regression coverage checks that an explicitly restored master row returns its
existing task to ordinary grid search with no outside-grid duplicate, while
preserving Action Plan identity, task status, assignments and other archives.
The database contract also checks that a stale UPSERT cannot rearchive an
explicitly restored row. Placement still cannot create or restore categories.

Verification: 387 Node tests and 104 Python tests passed. The production render
functions were exercised against a read-only live-data snapshot in isolated
desktop and mobile browsers: the normal cell exists, contains the Winner, search
reports one matching cell with the fallback hidden, and Action Plan resolves the
same angle/persona. This is not verification of an authenticated user's tab or
their personal filter settings. A page refresh loads the restored master row.

Rollback must compare the selected persona's current version with its private
backup before archiving that one row again. Do not restore whole tables or revert
the placement-creation guard.
