# Mac mini shared QA worker — installation and verification

Starting checkout: `qa` at `ac62a47111b4284b0d585a67f75a9e81b4195bab`.
Implementation branch: `codex/mac-mini-shared-qa`. Production was neither deployed
nor migrated; nothing was merged into main.

## Installed legacy service (read-only inspection)

- Label: `com.immuvi.classify-worker`; original PID 1786 remained running.
- Checkout: `/Users/anuragpataila/Documents/Claude/immuvi-command-center`, branch
  `main`, HEAD `0c4104abd79cceb2700e7e61924cdf4fd5a8bb34`.
- Entry: `tools/classify_worker.py`; interpreter `/opt/homebrew/bin/python3.14`.
- Plist: `~/Library/LaunchAgents/com.immuvi.classify-worker.plist`.
  SHA256 `2b30f25368510ec7dc7f1cbc9ba784a1eb213dbabf691a5f5be8acfdcafff6a3`.
- Configuration paths: `~/.classify-inspiration.env` and
  `~/.classify-inspiration-worker.json`. Their contents/credentials were not copied.
- Worker identity: `gp-mac-mini`; configured poll interval 15 seconds;
  `auto_pause_when_claude_idle=false`. Heartbeat interval in code: 30 seconds.
- Installed defaults: 3 classification slots, 10 producer slots. Auto-update is
  enabled by default, checks production assets every 60 seconds, and can replace
  worker, strategist, producer and skill files. These settings were untouched.
- Codex is available and its existing login-status command succeeded. Claude
  exists at `~/.local/bin/claude`; its auth-status command returned failure.
  No legacy authentication was repaired or reused for the new runtime.
- Machine: 10 CPUs, 16 GiB RAM; initial load averages approximately 2–3.
  The new worker is restricted to **one** inspiration job.
- The installed worker and checkout skill differ from the handoff repository.
  The active `~/.codex/skills/classify-inspiration` and Claude skill agree. Their
  actual Step 3 media script, downloader helper and eight-section page template
  match the handoff repository byte for byte. The checkout's older Drive-specific
  implementation is not the active skill's pipeline.
- Shared QA content instructions are frozen in `team-skill/shared-qa-contract.json`,
  extracted without executing the installed worker or its update code. Provenance
  hashes are included. The installed skill supports No Brief mode; this QA path
  explicitly uses full-brief mode. Existing private prompts remain unchanged.

## New service and isolation

- Name: **Mac mini - QA**.
- Label: `com.immuvi.classify-worker.qa`.
- Device: `7d23bf50-d0b6-4611-8b05-ecb6a9ab3b77`.
- Administrator: `likermeow@gmail.com`, QA auth ID
  `4a1fddd5-a422-4c7a-9bf3-e87185610fc4`.
- Checkout: `/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa`.
- Runtime root: `~/Library/Application Support/Immuvi/Workers/qa-shared`.
- Device configuration: `<runtime root>/device.json`, mode 0600. No service-role
  credential or administrator password/session is saved in it.
- Runtime HOME: `<runtime root>/home`; Codex home: `<runtime root>/home/.codex`.
  The user signed in directly into this isolated Codex home.
- Python: `<runtime root>/python/bin/python` (separate Python 3.13 venv).
  Playwright Chromium: `<runtime root>/python/browsers`.
  Whisper models/cache: `<runtime root>/python/cache`.
  Dependencies pinned in `scripts/shared-qa-requirements.txt`.
- Node dependencies belong to this checkout. Supabase CLI, browser verification
  CLI and local PostgreSQL fixture engine are in `<runtime root>/tooling`.
  Existing ffmpeg/ffprobe executables are used read-only; no global packages were
  installed, upgraded or removed.
- Log: `<runtime root>/worker.log`; retained failures: `<runtime root>/failed/<job>`.
- LaunchAgent starts at account login and stays alive. It is not a boot daemon.
  Read-only `pmset` verification found AC `sleep=0`, `standby=0`, and
  `autorestart=1`. macOS power settings were not changed; keep this account logged
  in and the machine online for polling. No IP exposure or SSH tunnel is required.
- Runtime uses an allowlisted subprocess environment. Media extraction has a
  per-job HOME without personal browser profiles. AI has the isolated Codex home,
  read-only sandbox, disabled shell tools and no Supabase/ClickUp secrets.
- No production installer, global worker kill, skill update, env-file loader,
  production ClickUp library discovery, producer or ad-launch loop runs here.

## Database and application changes

QA only: `entgcnlfsnysnwyadzzp`. Target product `qa-sample-astrorekha`, workspace
`9016762494`, list `1301130000002447`, library `8cq1r3y-44896`, tracker
`8cq1r3y-118036`. Product settings and ClickUp list/pages were read back before
writes. The ClickUp key is provided in the app and RSA-encrypted for the selected
worker; only the worker decrypts it during delivery.

Three applied migrations:

1. `20260929150000_qa_shared_worker`: explicit shared scope, product authorization,
   scoped enrollment and one-slot shared claims.
2. `20260929160000_qa_shared_worker_visibility`: permitted shared activity visibility,
   requester-only controls and device-scoped local pause/resume.
3. `20260929170000_qa_shared_queue_priority`: shared Run next ordering across users'
   waiting jobs, with private ordering unchanged.

Existing devices default to `scope=private`. `qa_private_workers_list` and private
image routing still expose only the owner's private devices. A distinct
`qa_inspiration_workers_list(product)` returns owned private workers and permitted
shared workers. The browser explicitly selects a destination and never falls back
from an unavailable selected worker to another machine. The selected ID is stored
per signed-in user/product. The server and database each verify access.

A single assigned-job table retains the cross-destination active-job unique index,
source/version checks, saved results, brief number and ClickUp receipts. Shared
credentials cannot claim private jobs, and private credentials cannot claim shared
jobs. The legacy queue remains a blocked display mirror, never an executable
second copy. Claims and priority use the same worker advisory lock. Leases renew
with heartbeats; interrupted work fails with receipts retained instead of replaying
AI work automatically. Shared and private library delivery share the existing
lease-backed serialization lock.

Brief names remain `test immuvi brief-N`. Numbers are never reset or reassigned.
Rollback-only database fixtures consume sequence values, so numbering has gaps.

## Workflow inventory

| Workflow | Installed legacy code | New shared QA service |
| --- | --- | --- |
| Inspiration classification + full brief | Supported | Enabled; see live verification below |
| Winning variation briefs | Separate claim/execution path | Not enabled or live-tested by this setup |
| Strategist | Separate queue/modules | Not enabled or live-tested; requires scoped QA adapter and destination audit |
| Producer/native images | Separate producer pool and attachment recovery | Disabled; no paid images or ad launches enabled |
| Anay's private images/inspirations | Separate new-app private service | Remains private; regression checks preserved |

## Verification

- Local PostgreSQL fixtures pass for shared/member authorization, outsider denial,
  private-device invisibility/control denial, exact dispatch, idempotent requests,
  priority across requesters, one-slot shared claims, leases and receipt recovery.
- Real QA rollback fixtures pass, including the existing private inspiration,
  delivery recovery, library and two-slot queue suites.
- Real QA HTTP/Auth fixtures use disposable signed-in accounts and clean up their
  records: second-user shared dispatch succeeds; Anay's/other private devices are
  not visible or controllable; outsider access, raw credential reads and private
  dispatch are denied. Shared activity is visible without granting control over
  another requester's job. No AI or ClickUp writes occur in these fixtures.
- 679 domain/service/component tests and TypeScript checks passed before the final
  live run. Browser verification confirmed the QA login and worker selector; the
  app displayed the shared job as Classifying.
- Facebook `28600691682877002`: real app dispatch created `QAA-INS-005`, job
  `a028a93d-6d1d-4e25-9bde-24177f09bcc3`, brief reservation 62. Shared claim succeeded.
  The legacy downloader could not find public media. Failure/evidence retained;
  no generated result, ClickUp page or false Classified status was created.
- Instagram `Dc-ful0RLPe`: the user's approved URL completed through the app's
  shared selector as **QAA-INS-006**, job
  `1d502f6c-9b3d-4426-a10b-f8db3b96b249`, at `2026-09-29T11:50:08Z`.
  The legacy pipeline downloaded a 12-second video, extracted four frames and
  audio, and returned the format **Devotional Caption Reveal**. The app showed
  **Classified** with the saved Brief link.
  [test immuvi brief-79](https://app.clickup.com/9016762494/docs/8cq1r3y-44896/8cq1r3y-118356)
  was independently read back through ClickUp: all eight sections and three
  complete scripts passed validation, and parsed content exactly matched the
  saved generated markdown. The Master Tracker contains QAA-INS-006 exactly once
  and retains QAA-INS-001 through QAA-INS-004. Only one brief-79 page exists.
- Pausing new claims during that live job allowed the active job to complete.
  The shared worker was then resumed and its enabled state, classifier
  availability and fresh heartbeat verified. The legacy PID 1786 and plist hash
  above remained unchanged; Anay's worker still reports `scope=private`.
- Submitting the same Instagram URL again through the app returned “This source
  URL already exists in this product. Open the existing inspiration.” There is
  still exactly one job for QAA-INS-006. Saved-result/receipt recovery, priority
  and concurrent-claim limits were verified with fixtures; no artificial live
  ClickUp failure was injected into the completed brief.

## Remaining limits

The shared inspiration workflow has no remaining installation or credential
blocker. Facebook ad 28600691682877002 remains genuinely failed because its media
was not available to the public downloader; its row and evidence are retained.
Winning variations, strategist and producer workflows require separate scoped
QA implementation and verification before being enabled. These are not covered
by the successful inspiration test. The MacBook still needs the app changes
below; this mini's diagnostic localhost server does not update another machine.

## Manage only the new QA service

Run from any working directory:

```sh
# Status (prints only non-secret service metadata)
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --status

# Gracefully pause claims; active work finishes
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --pause

# Resume this device
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --resume

# Stop this exact LaunchAgent (pause and drain active jobs first)
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --stop

# Start after stopping
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --start

# Restart only this service; use while idle, otherwise active leases fail safely
node "/Users/anuragpataila/Documents/Projects/immuvi-command-center-qa/scripts/install-shared-qa-worker.mjs" --restart
```

Rollback: pause, wait for active jobs to finish, stop, then move only this plist
out of LaunchAgents. Keep device configuration, job receipts and logs for recovery:

```sh
mv "$HOME/Library/LaunchAgents/com.immuvi.classify-worker.qa.plist" \
   "$HOME/Library/Application Support/Immuvi/Workers/qa-shared/com.immuvi.classify-worker.qa.plist.disabled"
```

Do not drop shared tables/migrations while jobs or receipts exist. Do not unload
`com.immuvi.classify-worker` or `com.immuvi.personal-worker.qa`, and do not use pkill.

## Coordinated MacBook update

The MacBook's localhost app has not been modified remotely. Transfer the reviewed
commit(s) on `codex/mac-mini-shared-qa` onto its QA checkout, preserving local/newer
work. Required files include the worker selector/intake service, inspiration API
route, shared activity projection and associated tests. All three SQL migrations
are already applied to QA; the MacBook must not reapply them blindly or target
production. The guarded checker can verify the installed state:

```sh
node scripts/check-qa-shared-worker.mjs --test-applied
```

Restart the MacBook QA Next.js server after integrating the changes. Select
**Mac mini - QA (shared)** in Inspiration's Run on control. Existing private work
remains on its assigned worker; saved-delivery retries keep that original identity.
The handover bundle is `/tmp/immuvi-shared-qa.bundle`; copy that file to the MacBook.
It contains this implementation branch's commit after `ac62a47`, without runtime
credentials, dependencies, browser profiles or logs. On a clean MacBook QA
checkout, inspect and apply the transferred commit without resetting newer work:

```sh
git fetch /path/to/immuvi-shared-qa.bundle codex/mac-mini-shared-qa
git show --stat FETCH_HEAD
git cherry-pick FETCH_HEAD
npm ci
npm run typecheck
```

Resolve any conflicts against the MacBook's current QA work; do not merge into
main or deploy production. The existing shared service remains on this mini;
do not run its prepare/enrollment scripts on Anay's Mac. The commit hash is
reported in the final handover message.
