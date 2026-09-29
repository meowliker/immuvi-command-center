# Stage 5: consolidated shared QA installation

This replaces the initial-setup instructions in `docs/mac-mini-qa-handoff.md` for
the already enrolled mini. Do not enroll a new device, clone over the existing
checkout, or run the legacy installer. Stages 1-4 are combined into one release.

## Release boundary

- Repository: `https://github.com/meowliker/immuvi-command-center.git`, branch `qa`.
- Pin the exact 40-character release commit reported in the MacBook handoff.
  If the branch has moved, do not substitute a newer unreviewed commit.
- QA project: `entgcnlfsnysnwyadzzp`; product: `qa-sample-astrorekha`.
- ClickUp workspace `9016762494`, list `1301130000002447`, library
  `8cq1r3y-44896`, tracker page `8cq1r3y-118036`.
- Service: `com.immuvi.classify-worker.qa`; device:
  `7d23bf50-d0b6-4611-8b05-ecb6a9ab3b77` (Mac mini - QA).
- Checkout: `/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa`.
- Runtime: `~/Library/Application Support/Immuvi/Workers/qa-shared`.
- Preserve production project `hdniumnkprkadlrrataz`, service
  `com.immuvi.classify-worker`, its checkout/config/skills, and Anay's private
  `com.immuvi.personal-worker.qa` device. No ad launches or production deployment.

## Prompt for Codex on the Mac mini

Give Codex this document and the exact release commit from the MacBook response:

```text
Perform the consolidated Stage 5 shared QA installation described in
docs/mac-mini-stage5-install.md, at the exact release commit supplied with this
prompt. Read the file first. Preserve production and private workers. Do not
claim live acceptance from a heartbeat or mocked tests. Complete the safe install,
report non-secret evidence, and stop at the live acceptance checkpoint below.
Do not requeue historical failures, generate images/briefs, publish a release
approval manifest, reboot the whole mini, or change power settings as an install
side effect. Never print credentials or credential-bearing configuration/logs.
```

## 1. Inspect, pause and preserve

1. Inspect the existing checkout, branch, HEAD and dirty files. Preserve any local
   changes. Record QA and production service PIDs and plist hashes without
   printing environment variables or credential-bearing arguments.
2. Run the existing service-specific command from the QA checkout:

   ```sh
   node scripts/install-shared-qa-worker.mjs --pause
   ```

3. Confirm database `enabled=false` for the exact shared device, and wait for its
   current job to finish. Inspect only job IDs/statuses/lease times, never sealed
   tokens. Pending jobs stay queued; do not delete or mark them complete. If a
   running job has a stale lease, inspect retained evidence and stop for review
   rather than force-ending it to pass the gate.
4. Stop only the idle QA service with `--stop`. Back up its plist and current
   release-state/updates files in an owner-only runtime backup directory. Record
   the previous checkout commit. Retain device.json and all jobs/images/analysis/
   failed directories in place. Never copy these into Git or into production.

## 2. Install the pinned source and QA contracts

1. Fetch `origin qa` and verify the supplied commit is reachable from it, has the
   expected files and is a fast-forward from the current QA checkout. Use
   `git merge --ff-only <verified-release-sha>` on branch `qa`. No reset, force
   push or main merge. Stop if the checkout is dirty or divergent.
2. Install the locked Node dependencies with `npm ci --ignore-scripts --no-audit
   --no-fund`. Verify `sharp` imports successfully. Compare Python requirements
   with the previous release. Use the existing isolated Python and browser cache;
   do not upgrade global Python or installed legacy skills.
3. Verify Supabase CLI is linked to the exact QA project. Sign in locally if
   necessary, without posting tokens in chat. Run:

   ```sh
   node scripts/check-qa-shared-rollout.mjs
   node scripts/check-qa-shared-rollout.mjs --apply
   node scripts/check-qa-shared-rollout.mjs --installed
   node scripts/check-qa-shared-worker-api.mjs
   ```

   The first command rehearses all three migrations and real-schema fixtures in
   rollback transactions. `--apply` reruns them, requires paused shared workers
   and no active QA jobs, then commits only these reviewed versions:
   `20260929200000`, `20260929210000`, `20260930010000`.
   It refuses source/history mismatches and does not apply unrelated migrations.
   `--installed` verifies the installed functions without replaying migrations.
   The HTTP test creates and removes disposable auth/worker/inspiration records;
   it performs no AI calls or ClickUp writes. Rollback tests may leave harmless
   sequence-number gaps; do not reset the brief-number sequence.
4. Run the full JS and type checks plus the isolated Python checks:

   ```sh
   node --test tests/domain/*.test.js tests/services/*.test.js tests/components/*.test.cjs
   npm run typecheck
   "$HOME/Library/Application Support/Immuvi/Workers/qa-shared/python/bin/python" -m unittest discover -s tests -p test_facebook_snapshot.py
   "$HOME/Library/Application Support/Immuvi/Workers/qa-shared/python/bin/python" scripts/producer-contract.py --check
   ```

   Ensure the test process uses the isolated Python first in PATH for tests that
   invoke `python3`. Do not run the worker itself under a personal HOME.

## 3. Enable the stable launcher and verify while paused

1. Inspect the existing QA plist. Its ProgramArguments must run Node and this
   checkout's `scripts/shared-worker-launch.mjs` with the existing device.json.
   It must use isolated HOME and CODEX_HOME from the runtime, owner-only paths,
   RunAtLoad/KeepAlive, and the isolated Python first in PATH. If it differs,
   repair only the stopped QA plist after preserving it; do not run --prepare
   over an existing plist or replace the enrolled identity.
2. Verify Codex login using the configured binary under the isolated runtime
   HOME/CODEX_HOME. Ask the user to sign in there only if required. Never copy
   personal/production auth stores. Claude is not enrolled by this runtime;
   Codex supplies text analysis. Native image capability must pass separately.
3. Inspect any existing managed-release pointer. An old pointer overrides the
   bootstrap checkout. Do not silently reuse it or discard it: preserve the
   stopped state, verify its identity, and select this reviewed bootstrap for
   first installation. No approval manifest should be published yet.
4. Run:

   ```sh
   node scripts/install-shared-qa-worker.mjs --enable-updates
   node scripts/install-shared-qa-worker.mjs --start
   node scripts/install-shared-qa-worker.mjs --status
   ```

5. Keep claims paused while checking launcher/child startup, fresh heartbeat,
   recovery protocol 2, image protocol 1, analysis protocol 1, Codex login,
   classifier capability and native image availability. Report each individually.
   A missing native tool is a blocker for Producer, not a passed image test.
   Verify production plist/config hashes and service health are unchanged.
6. Report the installed commit, service state, protocols, capabilities and test
   evidence to Anay. Stop here for coordinated live acceptance. Do not call
   Stage 5 complete. Keep claims paused until the live test inputs are approved.

## 4. Coordinated live acceptance

Continue only with approved QA test inputs and explicit permission for generated
outputs. Use the app's selected shared worker and the user's existing ClickUp key;
never request the key in chat. Resume the exact QA service for these checks.

1. Inspiration: select an authorized source; verify queue, classification, all
   eight brief sections, ClickUp page readback, single tracker entry and app link.
   Review QAA-INS-007's retained result/receipt before any historical retry;
   recover delivery only when possible, never regenerate just to clear Failed.
2. Producer: use a disposable approved-list task and one image first. Verify
   actual native generation, storage, matching ClickUp attachment bytes, summary
   comment, and Ready to Launch in both systems. No campaign launch.
3. Winner brief: use a specifically approved winning Drive file and target.
   Verify one winner page, saved variation_briefs row and Action Plan Brief link.
4. Strategist: run against the approved test list. Verify judged-task selection,
   cached unchanged tasks, structured memory, narrative and app readback.
5. Recovery: separately exercise offline enqueue and restart before claim, after
   accepted output, after delivery but before completion, and network loss.
   Check same run IDs, preserved outputs and no duplicate pages/attachments.
   A generation interrupted without completed output must stop for review,
   not silently make another paid request. Use fixtures for this unknown-outcome
   case before deliberately interrupting any paid live call.
6. Test a second permitted user's shared access and denial of Anay's private
   device. Repeat the real HTTP authorization fixture after installation.
7. Reboot/login and sleep/wake affect production too. Schedule those with the
   machine owner; do not perform them implicitly. Record reconnect and recovery.
   This is a LaunchAgent: no work runs while powered off/asleep or before login.

## 5. Approved updates and final sign-off

After the installed bootstrap and live workflows pass, the MacBook release owner
publishes `worker-releases/qa.json` pointing to a later reviewed, tested QA commit.
Ordinary code pushes are not activation approval. Observe busy deferral and idle
activation, candidate verification and readiness; run unhealthy-candidate rollback
using the local supervisor fixture, never a deliberately broken public manifest.

Acceptance report must list each workflow, job/run ID, output links, recovery and
access checks, installed/active SHA, rollback evidence and outstanding limitations.
Only passed real checks may be called complete. Routine approved worker-code
updates then require no manual pull on the mini. Database/runtime dependencies,
expired login, hardware or power problems may still need planned intervention.
QA installation does not promote the app or worker to production.

## Rollback

Pause and drain, then stop only shared QA. Preserve receipts, checkpoints and the
current state. Disable update discovery before restoring the recorded QA bootstrap
or known-good release pointer and QA plist. Do not drop migrations or delete jobs.
An old runtime does not support the new job protocols; keep those jobs paused for
review. Confirm private/production services remain unchanged. Never use a global
pkill, force-reset a dirty checkout, or roll back production for this QA release.
