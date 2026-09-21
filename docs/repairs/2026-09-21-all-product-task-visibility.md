# All-product task visibility repair

## Request and scope

The user reported CA-227-INS-054 after CA-225-INS-051 and explicitly requested
checking the same issue across every product. All 26 products, 6,775 AD records,
and 1,576 deletion markers were audited. No browser was used and no ClickUp task
was modified.

## Cause

Historical automatic duplicate retirement left shared ClickUp IDs on local
deleted ADs and their deletion markers. The app treats either as a task-wide
deletion, suppressing the live canonical task in multiple views. Some affected
canonical tasks additionally retained a different product's `_syncProductId`.
The prior narrow repairs did not backfill these historical records.

The write guard from commit 06458f9 is installed and remains enabled. This change
repairs verified historical data and adds repeatable audit/repair tooling.

## Applied and verified

- 212 confirmed tasks repaired across 10 products after live ClickUp verification.
- Product/list ownership checked by IDs, not names.
- 81 stale routing metadata pairs corrected to the verified owning product.
- One matrix reference remapped from a retired row to its existing canonical row.
- No manual action records changed; no statuses, briefs, angles, or personas changed.
- Reused short AD IDs in other products were preserved, not retired or rewritten.
- CA-227-INS-054 is a Canva Winner, ID `86d3gkeaw`, in
  Meme / Pattern-Interrupt Format x Content Creators 22-40.

Counts: Canva 63; Art Therapy 51; ADHD 70; Kids Mental Health 13; Patchwork 7;
PHONICS 3; Medical 2; Therapy 1; Sewing 1; Yoga Notes 1.

Validation: 21 unit tests; full production-data rehearsal rolled back; then the
same transaction committed with assertions preserving creative content and
deletion intent. A fresh read-only verification confirmed zero deletion or routing
blockers for all 212 repaired tasks and unchanged non-automatic deletion markers.

## Intentionally unresolved

The user explicitly selected **Preserve for review** for 23 ClickUp-accessible
tasks blocked by ambiguous self-heal deletion records. None was restored.

Four tasks with named user-deletion records also remain deleted. Three other
ClickUp tasks could not be accessed: PH-057-INS-009, PA-054-INS-076, KL-308-INS-044.
The first two also failed through the connected ClickUp tool.

`86d38zw5h` is KM-318-INS-069 - V3 - Text in ClickUp, but its database row currently
contains the original task's name and a different ClickUp ID (`86d30upwm`). It
was excluded from generic duplicate repair to avoid overwriting the wrong task.

## Reproducible tools

- `scripts/audit-duplicate-visibility.mjs`: read-only, privately saves the complete
  identity/deletion snapshot and throttled ClickUp verification. Supports resuming.
- `scripts/repair-duplicate-visibility.mjs --audit=<directory>`: read-only plan.
  Add `--rehearse` for an always-rolled-back rehearsal or `--apply` to commit.
  Requires fresh verification, unchanged eligibility and an installed write guard.
- `scripts/verify-duplicate-visibility.mjs --repair=<committed directory>`:
  fresh read-only checks and a complete private Markdown report.

Run with approved Immuvi environment variables; never store credentials in these
scripts. Backups and reports are excluded from Git.

## Backup and recovery

Audit directory:
`/Users/anaytripathy/CascadeProjects/immuvi-command-center/backups/duplicate-visibility-audit-2026-09-21T10-03-11.450Z/`

Committed repair subdirectory: `repair-2026-09-21T10-12-27.964Z/`.
It contains full `before.json`, `after.json`, `COMMITTED.json`, and `VERIFIED.json`.
The audit root contains `report.md`, identities, all deletion markers and ClickUp
verification. Directories use mode 0700 and files 0600.

Rollback requires explicit approval and a controlled transaction. Compare current
records with the saved after-state; abort on conflicting later edits. Restore only
changed fields for the recorded ADs, markers and single matrix cell, not whole
products. The AD normalization and deletion-marker guards intentionally prevent
restoring invalid shared IDs; an operator would need to temporarily disable those
two guards under transaction-held locks, restore the recorded fields, and re-enable
both before committing. This would reintroduce the visibility bug. A Git revert
alone does not revert database repairs.
