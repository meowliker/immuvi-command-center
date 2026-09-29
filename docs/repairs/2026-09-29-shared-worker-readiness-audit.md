# Shared Mac mini worker readiness audit

Audit date: 2026-09-29. Local QA code: `88e8534`.

## Verdict

Not ready to declare complete legacy parity or unattended operation.
The shared QA service is an inspiration worker, not a replacement for every
legacy server workflow. Its healthy heartbeat does not certify missing workflows.
No production service, credential, migration, or paid generation was changed
during this audit.

## Verified inventory

| Area | Current new shared QA behavior | Remaining work |
| --- | --- | --- |
| Inspiration classification and full brief | Implemented; QAA-INS-006 completed end to end | Wider source/platform regression checks |
| ClickUp library delivery | Implemented with saved results and page receipts | QAA-INS-007 is still failed with an existing page; install verifier fix and complete delivery-only recovery |
| Shared images / Producer | Explicitly disabled | Shared authorization, dispatch, execution, upload receipts and recovery; real QA image acceptance test |
| Winner variation briefs | No dispatch path in shared runtime | Scoped legacy adapter and end-to-end test |
| Strategist | No dispatch path in shared runtime | Scoped legacy adapter, credentials/capability checks and end-to-end test |
| Private MacBook | Remains owner-only | Preserve isolation in every added shared workflow |
| Existing pending jobs | Persist in QA database; claimed when assigned worker returns | Test shutdown/restart with a populated queue |
| Interrupted running jobs | Expired leases become failed; receipts retained and encrypted delivery token cleared | Automatic stage-aware recovery with explicit duplicate prevention and bounded retries |
| New submission while offline | Dispatch service refuses an offline/paused selected classifier | Durable offline enqueue for an authorized enrolled device, if required |
| Software updates | Manual; no shared QA updater | Approved release discovery, staging, verification, draining, activation and rollback |
| Service restart | LaunchAgent RunAtLoad and KeepAlive | Reboot/login and sleep/wake acceptance tests; not a pre-login boot daemon |
| Production routing | QA-only product/list/library allowlists | Separate reviewed production enrollment and migration; never repoint QA implicitly |

Live QA heartbeat read showed Mac mini - QA enabled with classifier available
and generation unavailable. Anay's Mac was private with generation available.
The installed QA claim function still contains the interruption-review policy.
QAA-INS-007 retains generated content and page `8cq1r3y-118376`; it is not marked
complete merely because that page exists.

## Legacy comparison and evidence

- `team-skill/classify_worker.py:113`: automatic worker updates enabled by default,
  checked every 60 seconds. Its run loop stops taking new work and drains pools
  before re-execution. It fetches legacy production assets; the QA service must
  not reuse that destination.
- `team-skill/classify_worker.py:721`: stale inspiration claims return to pending
  after 10 minutes; unclaimed processing rows use a two-minute threshold.
- `team-skill/classify_worker.py:746`: abandoned Producer jobs return to pending
  after the configured timeout, 45 minutes by default. Separate timeout handling
  checks existing ClickUp attachments before reporting failure.
- `team-skill/classify_worker.py:769`: abandoned Strategist jobs become failed,
  not automatically resumed. Legacy does not resume every kind of task equally.
- `scripts/private-worker.mjs:60`: shared mode explicitly skips image capability.
- `supabase/migrations/20260929150000_qa_shared_worker.sql:82`: expired running
  inspiration jobs become failed; saved results/receipts remain, but the encrypted
  ClickUp token is cleared. Automatic recovery needs a deliberate credential
  lifecycle, not merely changing failed to pending.
- `scripts/install-shared-qa-worker.mjs:54`: account-login LaunchAgent with
  KeepAlive; `WORKER_AUTO_UPDATE=0`. `scripts/shared-worker-launch.mjs` has no
  release updater.
- `app/command-center/components/plan-producer-dialog.tsx:63`: image worker
  selection is currently fixed to the user's private worker.

The local legacy source is not a new remote inspection of the mini. Installation
details are grounded in the existing mini handoff and user-provided verification;
current capability and failure status were read directly from QA.

## Consolidated completion gate

1. Add an approved QA release channel, independent of production and ordinary
   unreviewed commits. Stage complete immutable releases and validate dependencies
   and database protocol compatibility before activation. Drain active work;
   retain the previous working release and automatically roll back a failed start.
2. Add durable recovery checkpoints for source extraction, generated result,
   each image, external delivery receipts and final publication. Check existing
   remote outputs before retrying ambiguous delivery. Resume from saved output
   instead of paying for generation again. Revalidate requester/product/device
   access, retain secrets only as required, bound retries, and expose actionable
   errors rather than claiming all failures are recoverable.
3. Implement the shared Producer, winning-variation and Strategist paths using
   the actual legacy workflow contracts. Keep QA destinations isolated and private
   devices owner-only. Check which engines are authenticated; do not advertise
   inactive Claude or unsupported workflows as available.
4. Install one consolidated service release on the mini, then verify each enabled
   workflow and failure boundary: shutdown before claim, during generation, after
   saving output, after external delivery, and before completion. Verify no lost
   queue entries, duplicate pages, duplicate uploads or duplicate generation.
5. Verify automatic update while idle and busy, a rejected/broken release,
   network outage, process crash, reboot followed by account login, and sleep/wake.
   A powered-off, sleeping or logged-out machine cannot be promised to process jobs.
6. Only then declare unattended QA complete. Production remains a separate
   explicit rollout with its own destination and permission verification.

The operating goal is no manual pulls for routine fixes, not a promise that
hardware failure, revoked authentication, OS changes or external-provider failures
can never require access to the machine. Physical access is not available from
this chat, so installation and machine-level acceptance remain unverified until
performed on the mini.
