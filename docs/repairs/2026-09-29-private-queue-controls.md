# Private Queue Controls

- Failed and Blocked badges retain their small anchored error message box, with
  a Requeue action for one inspiration. The detail drawer uses the same action.
- Retry reads current owner-scoped job status. A saved brief resumes delivery on
  its original worker; a failure without a saved result can rerun classification.
  Active/published work and uncertain delivery receipts cannot trigger duplicate
  generation. Repeated clicks are locked, and ambiguous requests reuse their ID.
- Queued private inspirations expose Run next, Move up and Move down icon buttons.
  Order persists in QA, applies within the active product and assigned worker,
  and is enforced at claim time under the same database lock used for reordering.
  Running tasks are never interrupted by priority changes.
- Anay's Mac supports two concurrent inspiration jobs. Each has a separate
  working directory, abort signal and renewed lease. Image generation remains
  exclusive. Pausing stops new claims while current jobs finish.
- ClickUp library delivery is serialized by a database-backed lease across
  worker processes. Parallel classifications cannot overwrite the shared tracker
  through simultaneous read/modify/write delivery.

## Verification

Migration `20260929120000_qa_private_queue_controls` was applied only to QA
`entgcnlfsnysnwyadzzp`. Rollback-only database tests passed before and after
installation: queue ordering, owner isolation, two-job limit, duplicate claims,
image exclusion, delivery serialization, forged leases and running-task guards.
The idle `com.immuvi.personal-worker.qa` service was restarted after installation.

Component and domain tests cover retry routing, ambiguous responses, double
clicks, error messages, pending-only priority controls and FIFO tie-breaking.
Worker pool tests demonstrate overlapping jobs and recovery of capacity after
success/failure. All 675 domain, service and component tests and TypeScript
checks passed. Anay's Mac reported an active classifier and a fresh heartbeat
after restart. No additional live AI generations or ClickUp pages were created
for these tests. Production and the shared legacy worker were not changed.
