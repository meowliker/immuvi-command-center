# Classification Working Directory

## Cause

HAH-INS-017 through HAH-INS-020 all stopped before source analysis with the same
Codex launcher error: getcwd/chdir returned Operation not permitted. Queue rows
had zero content attempts and no results. This is a worker process-directory
failure, not evidence that the four Instagram links or narration are invalid.

## Fix And Scope

Classification and winner-brief agent subprocesses now run in separate private
temporary directories. Each child receives a matching PWD, without the parent's
OLDPWD. The threaded worker never changes its own process-wide directory.
Codex explicitly permits the non-repository job directory. Credentials, chosen
agent, prompt, timeout, evidence verification and brief mode remain unchanged.
The three published worker copies are identical and advertise
classification_workspace=isolated-cwd-v1 for deployment verification.

No frontend, database schema, taxonomy, deletion, refresh or product-routing
logic changes. No special filesystem permissions are requested or disabled.

## Tests And Recovery

63 unittest tests and 328 application tests pass. New tests execute real
parallel subprocesses, simulate an inaccessible inherited directory, check
0700 workspace permissions and ensure cleanup on failure/timeout without
changing the parent's environment. Published worker mirrors are checked.
The optional pytest suite could not run because pytest is not installed.

Private before-repair snapshots are retained at:
/Users/anaytripathy/.codex/backups/immuvi-hah-workspace-20261016.

Only the four exact blocked queue UUIDs may be requeued after a fresh Mac mini
heartbeat reports the new workspace revision. Recovery refuses saved results,
claims, changed source URLs, different brief modes or non-infrastructure errors.
It preserves every inspiration and all links, IDs, content and brief settings.
Completion must be verified from persisted results, not just a cleared badge.

## Live Recovery Verification

Main repair b227607 deployed READY. The Mac mini operator confirmed a graceful
worker-only restart, with both pools drained and no reset, permission change,
reinstall or manual data changes. Installed worker SHA-256 matched the deployed
asset: b1f9c4d308a69847c82c619cb545902af1cfbe9293e66977e29d7efb24542720.
A fresh Supabase heartbeat independently confirmed isolated-cwd-v1.

The guarded recovery requeued only the four requested HAH queue UUIDs. All four
finished classified on their first content attempt, with no remaining queue
error. At 12:17 UTC on October 16, completion readback verified one result per
inspiration, original product/source/ID/brief mode, original added-by/time and
existing usage. Independent ClickUp GETs verified each page belongs to the
selected product library, identifies its inspiration and contains all eight
sections. Each saved inspiration has three structured next-ad scripts.

Unrelated inspirations in the product were byte-for-byte unchanged. No existing
creatives, angle rows or persona rows disappeared. Taxonomy differences were
updated_at only: IDs, names and other content remained unchanged. During the
wait, browser-tagged Action Plan activity added HA-035-INS-017 and a due date on
one existing creative, with client stamps/timestamps updated. These concurrent
changes were preserved, not overwritten by restoring the baseline.

The initial aggregate audit found eight getcwd-blocked jobs across four
products. This recovery deliberately retried only the four requested HAH jobs;
other blocked jobs were not changed. The worker report also noted pre-existing
updater 404 warnings for three strategist/producer support assets. Those are
outside this launcher repair and were not changed.

Private completed snapshots, per-job retry journal and independent brief
verification hashes are in the backup directory above. QA remains untouched.

## Rollback

Pre-change main commit: 3e44cab3d22f72fe65523361770433bfca7ff73b.
Revert the worker repair commit to roll back code. Never restore stale queue
snapshots over active/completed jobs. QA is not modified.

## Recovery Completion Checklist

A deployed launcher fix does not reset existing blocked queue rows. Distinguish
code deployment, worker adoption and queue recovery in every completion report.

1. Inventory the exact infrastructure-error cohort across all products before
   retrying. Do not treat unrelated source, audio, permission or identity blocks
   as the same failure.
2. Require a fresh enabled worker heartbeat advertising the repaired capability.
   Preserve source/product identity and brief mode; never interrupt active jobs.
3. Back up each authorized recovery scope privately. Retry only matching,
   unclaimed rows with unchanged identity and no completed result to overwrite.
4. Verify saved classifications and readable product-library briefs, then
   compare pre-existing records against the backup. Preserve concurrent edits.
5. Recount the exact error cohort across all products. Explicitly report any
   rows outside the authorized recovery scope instead of calling recovery
   complete merely because the worker is fixed or one product succeeded.

Keep live source identifiers, media and credentials out of public repair notes.
