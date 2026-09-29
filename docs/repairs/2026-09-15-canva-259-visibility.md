# Canva Winner Visibility Repair

Task: CA-259-INS-085
Product: Canva (`prod-1776684457079`)
ClickUp and canonical AD ID: `86d3zdxfq`
Retired duplicate: `AD-1785216614574`

## Evidence

- ClickUp verified the task in Canva Mastery - Scripts (`901613035012`) as Winner.
- The canonical database row was live and already assigned to the matrix.
- The older duplicate was retired on September 9 by `trigger:collapse_local_dup_on_sync`.
- Both the retired AD and its deletion marker retained `86d3zdxfq`. Client deletion caches therefore suppressed the surviving task by its shared ClickUp ID.
- This was an automatic duplicate retirement, not a user-requested deletion.

## Repair

Applied `scripts/repair-canva-259-visibility.mjs --apply` on September 15, 2026.
The script defaults to read-only preflight and requires exact identity, status,
deletion-reason, and stale-client-guard assertions before modifying anything.

- Cleared the obsolete ClickUp link on the retired duplicate and its deletion marker.
- Recorded `_supersededByAdId` and `_supersededClickUpTaskId` on the duplicate for audit and the existing database stale-client guard.
- Kept the duplicate deleted, with its original deletion timestamp.
- Asserted the entire canonical AD record was unchanged.
- The existing matrix already referenced the canonical ID; no task move was needed.
- No ClickUp task, brief, status, angle, persona, or variation was edited.

## Recovery Record

Private, gitignored backup:
`backups/canva-259-visibility-2026-09-15T11-15-36.708Z/`

`before.json` contains the original AD rows, deletion markers, matching matrix
cells, and matching actions. `after.json` contains post-repair AD rows and the
empty blocking-marker result. `COMMITTED.json` records the completed transaction.
Files are mode 0600 inside a mode 0700 directory.

For a requested rollback, compare current rows against this backup first and
restore only the changed identity metadata and deletion links in a reviewed
transaction. The stale-client guard deliberately prevents blindly putting a
shared ClickUp ID back on a retired duplicate. Do not restore complete product
snapshots or overwrite later user changes. Reinstating the old deletion link
would make the winner invisible again.

The user's browser was not accessed. Reload Immuvi to refresh its deletion caches.
