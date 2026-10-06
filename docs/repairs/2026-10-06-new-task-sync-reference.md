# New-task sync stopped by an out-of-scope product variable

## Cause

The new-task import pass in `pollFullSync` used `_importProduct`, a variable
declared locally in the separate `importTasksFromClickUp` function. Whenever
a ClickUp response contained an eligible task not already in ADS, evaluating
that argument threw a ReferenceError before importing the task. Existing-task
updates and empty-list tests did not exercise this branch.

The October 6 error-handling change exposed this as a local merge error:
"This page could not finish syncing." Earlier production 401 observations
were a separate failure mode and did not establish the cause of this screenshot.

## Fix and scope

Use `activeProd`, already captured at the start of this refresh and already
used by its parsing pass. Apply the same one-line correction in the source
and public HTML. Product/generation checks, list checks, quarantine, deletion
tombstones, action ownership, and manual read-only behavior remain unchanged.
No database migration, production data repair, credential change, ClickUp write,
or taxonomy change was performed. QA was not modified.

## Verification

- Before the fix, four new regression cases failed with the same local-merge
  failure category (both HTML copies); the two stale-product cases passed.
- After the fix, all 265 Node tests passed.
- New-task scenarios cover manual and automatic refresh for Quilting, Astro
  Rekha, Phonics, and an arbitrary product identity using synthetic fixtures.
  Actual boundary-stamping functions are exercised; external services and
  downstream rendering are mocked. This is not a live signed-in browser test.
- Repeated imports remain idempotent. Missing existing creatives and shared
  notes survive. Local and cloud deletion markers and action-owned task IDs
  are respected. Switching products during the tombstone read prevents import.
- Manual refresh issues no save or broadcast. Automatic import saves once and
  an unchanged follow-up does not save again. Approved taxonomy is unchanged.

## Rollback

Pre-fix main: `b171d21336810cdcd577762c7e5c1d18dddde264`. Revert only this repair
commit if necessary; do not reset database state or revert unrelated fixes.
