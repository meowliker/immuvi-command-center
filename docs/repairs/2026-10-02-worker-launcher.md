# Classification worker launcher recovery

## Evidence

- Requested inspiration: C-INS-150, Canva.
- Existing queue reported `agent infrastructure failure: no usable agent CLI found`, zero content attempts, no claimant and no classification result.
- The production Mac mini heartbeated but advertised both Codex and Claude unavailable.
- The old resolver omitted the current ChatGPT app's `Resources/codex-cli/bin/codex` layout. The new layout was confirmed locally; the Mac mini's adoption must be checked through its registry heartbeat, not assumed from deployment.

## Scope and safeguards

- Main only. No browser, QA changes, taxonomy changes, migrations or content deletion.
- Update the three published worker mirrors and matching installer discovery paths.
- Rediscover agent availability on heartbeat, refuse claims without an agent, and retain content retry credit on infrastructure failure.
- The recovery script backs up and conditionally updates only the existing queue row. It refuses saved results, identity mismatches, claimed jobs, explicit assignments and workers without the new healthy revision.
- Private pre-recovery snapshot: `/Users/anaytripathy/.codex/backups/immuvi-worker-20261002/C-INS-150-before/`.

## Verification

- 25 Python tests pass: launcher discovery, queue guards, no-brief mode and taxonomy-review worker contracts.
- 195 focused Node regression tests pass across product boundaries, taxonomy creation, inspiration identity, auth, notes, parent links, deletion safeguards, matrix search and rendering.
- Installer shell syntax checks pass.
- Code fix `261f0e8` deployed READY; the public worker asset matched the tested local file byte-for-byte.
- Production `gp-mac-mini` self-updated and reported `agent_launcher_revision: codex-bundle-v2`, Codex available, and a fresh heartbeat at 07:18:26 UTC.
- The guarded recovery requeued only C-INS-150. It was claimed by `gp-mac-mini` at 07:19:06 UTC and finished `classified` at 07:27:39 UTC, on one content attempt, with no remaining error.
- Final read-back confirmed exactly one saved result, all ten required classification/brief fields, and unchanged product, source URL, inspiration ID and brief mode.
- Private recovery and verified completion snapshots: `/Users/anaytripathy/.codex/backups/immuvi-worker-20261002/C-INS-150-retry/`.

## Rollback

- Pre-change main checkpoint: `7cdb4634771291d9b4390c3e410fe15472f81f0d`.
- Revert the worker change commit to restore code. Do not restore a stale queue snapshot over an active or completed job.
- No schema changes are part of this fix. Keep private snapshots outside Git.
