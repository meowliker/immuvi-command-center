# Creative deletion transport

## Evidence

The screenshot reports `TypeError: Failed to fetch`. The previous delete helper
sent a cross-origin PATCH directly from the browser to Supabase, before any
ClickUp deletion. The target AR-385-INS-245 (`AD-1790594115417`) was still active
in production during the read-only check. Server database access succeeded.
This identifies the failed transport path, not the exact browser/network cause:
no user's browser or network trace was inspected.

## Repair

- Same-origin POST `/api/delete-creative`, forwarding the user's Supabase JWT.
  The service-role credential is not used as the caller's authorization.
- Additive `delete_creative` security-invoker RPC checks active product access,
  locks the exact creative, and atomically soft-deletes it, writes the explicit
  deletion marker, and removes only action records directly owned by it.
- No cascade to variations, source inspirations, taxonomy, or another product.
  Retired duplicates, shared task IDs, changed task identity, and foreign
  deletion markers fail closed. Repeated confirmed deletions are idempotent.
- Read-after-commit verifies the deletion before UI removal or ClickUp deletion.
  A failed/unknown result preserves local state and asks the user to check again.
- Single-flight clicks, bounded auth retry, captured ClickUp credentials, and
  product/generation guards protect delayed responses and queued saves.
- Existing one-minute refresh behavior and explicit deletion semantics remain.

## Verification

276 Node tests pass, including both HTML entry points, API mocks, existing
taxonomy, inspiration identity, refresh, notes, and variation-link regressions.
13 database checks passed with synthetic fixtures and an authenticated member
role; the entire fixture transaction was rolled back. No real ClickUp task was
deleted and no signed-in browser deletion was performed.

Migration `20261007000100` was installed and recorded in migration history.
Permissions checked: anonymous execution denied, authenticated execution allowed,
security invoker retained. The migration does not update any existing data rows.

## Backup

Pre-change code: `1a76195333f6e75f687b8d3be4e03a7765f50d49`.
Private schema backup and installation record:
`backups/delete-creative-2026-10-07T05-37-59.324Z/` in the main worktree.
No prior `delete_creative` function existed. Roll back the frontend/API together
if needed; the unused additive function can remain or be removed separately.
Never roll back legitimate user deletions by restoring whole product snapshots.
QA was not modified.
