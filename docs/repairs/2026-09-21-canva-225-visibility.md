# CA-225-INS-051 visibility repair

## Confirmed identity

- Product: Canva (`prod-1776684457079`).
- ClickUp script-bank task: `86d3f25z1`, CA-225-INS-051, Winner.
- ClickUp list: Canva Mastery - Scripts (`901613035012`).
- A different task with the same title exists in Production Queue; it was not modified.
- Retired local duplicate: `AD-1781785866609`.
- Existing matrix cell: Meme / Pattern-Interrupt Format x Content Creators 22-40.

## Cause

The September 8 automatic duplicate cleanup retired the local AD row but left
the surviving task's ClickUp ID on both that row and its deletion marker.
The frontend collects task-wide deletion IDs from both sources, hiding the
canonical Winner even though the canonical record and matrix assignment exist.

The September 10 migration corrected future duplicate cleanup and protected
retired AD-row writes, but did not backfill every historical marker. It also
did not guard writes to the deletion-marker table itself.

## Applied changes

`scripts/repair-canva-225-visibility.mjs` defaults to read-only preflight.
With `--apply`, it backs up all affected records and prior schema definitions,
installs the schema-only marker guard, and repairs only this task's retired
duplicate and automatic deletion marker in one transaction.

The duplicate remains deleted. Its shared ClickUp ID is cleared and retained in
supersession metadata. The automatic marker is row-scoped. The live Winner,
matrix cells, and action-plan records are asserted unchanged. No ClickUp writes.

`20260921090000_guard_duplicate_deletion_markers.sql` prevents automatic cleanup
markers from carrying task-wide deletion IDs. Self-healing a known retired
duplicate follows the same rule. Automated upserts cannot replace deliberate
deletions; normal user deletion semantics remain intact. No historical bulk
updates are included in this migration.

## Verification

- 11 rollback-only guard checks passed before and after installation.
- Existing duplicate-retirement regression suite passed with all writes rolled back.
- Fresh post-commit database read: canonical Winner unchanged, zero deletion
  blockers, existing matrix membership present, guard enabled.
- Browser/UI testing was not performed, per the user's browser restriction.

## Recovery

Private backup directory on the repair machine:
`/Users/anaytripathy/CascadeProjects/immuvi-command-center/backups/canva-225-visibility-2026-09-21T09-44-31.926Z/`

`before.json` contains full scoped records and previous function/trigger definitions;
`after.json` contains repaired rows; `COMMITTED.json` confirms completion.
Backups are outside version control with directory mode 0700 and file mode 0600.

To roll back, first compare current records with `after.json` to avoid overwriting
subsequent edits. In a transaction, remove the new guard (or restore its prior
definition), then restore only the duplicate's link/metadata and its marker from
`before.json`. Do not overwrite the live Winner, cells, or action-plan records.
Restoring the shared deletion IDs will intentionally reintroduce the visibility bug.

## Wider historical audit

A read-only audit found 220 automatic markers with shared ClickUp IDs across
10 products. This is not a count of confirmed missing tasks. Some have no live
survivor or coexist with other deletion reasons. Cross-product historical repair
is pending explicit user approval; none was performed in this change.
