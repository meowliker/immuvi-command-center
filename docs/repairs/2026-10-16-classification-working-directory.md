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

## Rollback

Pre-change main commit: 3e44cab3d22f72fe65523361770433bfca7ff73b.
Revert the worker repair commit to roll back code. Never restore stale queue
snapshots over active/completed jobs. QA is not modified.
