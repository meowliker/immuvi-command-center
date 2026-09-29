# Inspiration Worker Audit

Checked 2026-09-28 against the repository's legacy worker and the QA application.

## Execution Status

- Legacy `team-skill/classify_worker.py` handles inspiration classification and variation briefs through separate queues. Classification completion verifies classification/brief output; variation-brief completion verifies stored markdown and the ClickUp document page.
- QA inspiration mutations explicitly require `dispatchEnabled: false` (`lib/services/inspiration-mutations.js`). The isolated mutation migrations block newly queued jobs from production workers. A queued QA row is not evidence that classification or brief generation ran.
- Saved-result import, queue inspection/recovery, and brief lookup are implemented separately from worker execution. They do not enable the classifier.
- The native QA image worker is a separate implementation (`scripts/qa-image-worker.mjs`) using `qa_image_runs` and QA Supabase output storage. This UI change does not modify its execution or upload destination.
- Inspiration and variation-brief execution in the new QA application is **not end-to-end verified or enabled**. Full legacy execution parity must not be claimed.

## Mac Mini QA Setup Boundary

Repository inspection confirms the legacy worker reads
`~/.classify-inspiration.env`, registers in Supabase `worker_registry`, sends
heartbeats and polls the inspiration/brief queues. The dashboard does not
connect to the Mac mini by SSH or IP. The unresolved `.local` hostname blocks
remote shell administration from this machine, not this polling architecture.

The user selected Anurags-Mac-mini.local, which already runs production. Do not
rerun `team-skill/setup-mac-worker.sh`: it uses the production LaunchAgent name
`com.immuvi.classify-worker` and replaces the existing worker process. QA needs
separate configuration, runtime/skill paths, worker identity and service label.
The installed legacy classification skill includes production-specific paths
and destinations; repointing only SUPABASE_URL is not sufficient isolation.

The user's latest delivery requirement supersedes Supabase-only output delivery:
final generated assets must reach the approved ClickUp test list, and QA briefs
must be ClickUp Docs named `test immuvi brief-1`, `test immuvi brief-2`, etc.
This is a requested contract, not a verified capability: the current QA image
worker still stores outputs in QA Supabase, and classification/brief dispatch
remains blocked. Production configuration and services were not modified.

## Activity Display

- The right-side panel reads inspiration queue rows, variation-brief queue rows, QA image runs, and worker heartbeats. Inspiration/image rows are product scoped; both variation parent and target must belong to the active product.
- Stages reflect persisted worker statuses, not simulated progress. The legacy worker does not report granular download, analysis, or brief-writing steps.
- Estimates use recent completed runs with valid start/end timestamps. When inspiration timing history is absent, the legacy 90-second heuristic is explicitly labelled. Brief/image estimates without samples are unavailable.
- Blocked jobs and jobs without a healthy eligible worker receive no fabricated ETA. Classification completion does not imply that a brief is available.
- Per-source read failures are visible; previously loaded task rows are retained. Non-product queue events invalidate data, but subsequent reads still enforce product scope.

## Verification

Domain and browser tests cover source scoping, completion/brief distinctions, timing fallbacks, blocked/offline states, live updates, retained rows on read failure, idle state, desktop/mobile panel bounds, outside dismissal, and anchored menu placement. Browser tests use isolated fixtures. No real classifier dispatch, brief generation, or production ClickUp write was performed for this change.
