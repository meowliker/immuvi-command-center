# One-Minute Background Refresh

## Cause

Several independent client paths bypassed the nominal 60-second ClickUp poll:

- Supabase notifications caused full product loads after 350 ms.
- Peer `sync-needed` messages independently loaded the same tables after 150 ms.
- Focus/watchdog kicks could poll ClickUp every five seconds.
- Imported ClickUp fields were rebroadcast as though they were user edits.
- Save completion broadcast success even after failed/partial saves.
- Worker and classification UI polling added 6/15/20-second requests.
- A missing task in a ClickUp list response could be removed locally, then
  restored by the next database merge, producing another changed snapshot.

These are confirmed code paths, not a measurement of total production traffic.

## Changes

- Coalesce incoming notifications into fixed one-minute windows. Do not reset
  the deadline on every event. Pause background reads while hidden or saving.
- Put automatic ClickUp/classification/pipeline refreshes in the same queue.
- One ClickUp request chain at a time, at least 60 seconds between automatic
  starts, with bounded exponential cooldown after errors.
- Manual refresh reads into the invoking client's view, without snapshot writes,
  product metadata writes, imported-field broadcasts, or link-repair writes.
  Previously queued user edits are still allowed to finish saving first.
- Keep explicit edits immediate. Peers receive them on their next background
  cycle. Reject old product-generation callbacks and stale deferred field values.
- Reuse the existing protected union merge for database and peer notifications.
- Do not repaint identical snapshots or animate background refreshes.
- Notify peers only after confirmed successful persistence. Avoid duplicate
  backfill flushes and speculative task removal from incomplete list responses.
- Preserve taxonomy approval, explicit deletion, provenance, notes, and pending
  local-record protections. No new table, migration, credential, or external
  service is introduced.

## Verification And Rollback

`tests/refresh-budget.test.mjs` exercises fake-clock cadence, continuous bursts,
two-client isolation, single-flight requests, failure cooldown, pending saves,
product switches, no-op rendering, failed-save notifications, and read-only
manual refresh with changed creative data. Existing relevant backlog suites are
also run. No live creative records are mutated as part of this repair.

Pre-change main commit: `b3d28483aca08655748187f21daef8ff163cc3b0`.
Local source/test backup: `/private/tmp/immuvi-before-refresh-fix-20261002.tgz`.
Rollback by reverting the refresh-fix commit only; preserve the earlier
classification audit commit. QA and the pending creative audit are untouched.

Open tabs need one reload to receive the new code. Do not broadcast a forced
reload. Browser-level production behavior and aggregate infrastructure usage
still require observation after rollout; unit tests cannot guarantee that every
unrelated backlog bug is impossible.
