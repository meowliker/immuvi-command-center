# Personal Mac Classification Worker

## First Setup

1. Install Homebrew from https://brew.sh and install/sign in to an eligible Codex
   or Claude Code account. No Immuvi repository checkout is needed.
2. In Immuvi, enter your own ClickUp personal key. Open Inspiration > My Mac >
   Mac setup, copy the Codex setup prompt, and paste it into Codex running locally
   on the target Mac. The prompt directs Codex to inspect an existing setup,
   diagnose errors, and use the official personal-worker installer without a
   repository checkout. The app no longer exposes a Terminal command box or an
   installer-download button. For manual troubleshooting, the installer remains
   available directly:

   ```bash
   curl --fail --proto '=https' --tlsv1.2 https://immuvi-command-center.vercel.app/personal-worker/install.sh -o /tmp/immuvi-personal-worker-install.sh
   bash /tmp/immuvi-personal-worker-install.sh
   ```

3. The installer reuses working Python 3.12 and ffmpeg/ffprobe, without upgrading
   them just because newer versions exist. yt-dlp is installed only inside the
   private worker environment, not through a global Homebrew/Python upgrade.
   Missing Python/ffmpeg may still require their normal Homebrew dependencies;
   automatic Homebrew updates and cleanup are disabled for this installer.
   It creates a private Python environment, installs local media/audio
   dependencies, downloads baseline audio models, and checks the AI login. Codex
   gets a separate worker profile and may request a one-time sign-in. It does not
   copy or modify your ordinary Codex configuration or MCP connections.
   If installation stops, it reports the failed stage. Do not force Homebrew
   symlink overwrites or paste a pairing code at the normal shell prompt.
4. When Terminal asks for a pairing code, generate one in My Mac. Paste the code
   and the same personal ClickUp key into the hidden Terminal prompts. Codes
   expire in ten minutes and work once. Do not send keys/codes to a chat.
5. Refresh My Mac, choose Use this Mac, and add one inspiration link. Confirm its
   result and, unless No Brief is selected, open its complete brief. Repeat the
   same installation and pairing process on another colleague's Mac.

My Mac > Mac setup includes one copyable Codex setup prompt covering first-time
setup and interrupted-pairing recovery. It never includes the user's API key,
pairing code, device token, or live product data. Codex must request user input
through hidden Terminal prompts and preserve existing worker state. The web app
cannot silently run a shell command or install a background service. Codex still
needs local permissions, dependency downloads and user-completed sign-in; the
prompt is guided setup, not a bypass for download or operating-system failures.

The selected personal Mac is remembered in this browser across reloads and new
tabs. The preference stores only a device ID under a SHA-256-scoped key derived
from the app-user and personal ClickUp identity; it adds no raw API key, device
token, Mac name or pairing code to browser storage. Another ClickUp key or app
account has a separate preference. Auto/shared selection clears only the current
identity's choice. Clearing browser storage or changing browsers requires a new
selection, not another worker installation. Offline/unavailable selections do
not silently fall back to the shared queue. No storage-event broadcast or extra
refresh timer is added.

The Mac must be awake, online and logged in. The LaunchAgent starts after login.
One job runs at a time. Idle claims poll every 15 seconds; heartbeats write at
most once per 55 seconds. There is no guaranteed instant classification: source
availability, video length, local hardware and provider quota still apply.
An offline personal assignment waits; it never falls back to the shared worker.
New personal submissions enqueue only the just-added inspiration, not everybody
else's queued links. Existing shared assignments cannot be stolen by this path.
Use My Mac > Retry for a blocked personal job. A publishing exception requires
review rather than an automatic second brief creation. My Mac > Verify existing
brief reads only the exact recorded page and finishes the retained result after
verification; it cannot create a new ClickUp page or run classification again.
Old jobs without a recorded receipt need explicit, content-verified recovery.

Brief verification parses CommonMark/GFM content, accepting harmless bullet,
escape and table-formatting changes while retaining text, word boundaries,
links, table cells and script structure. An unverified created-page receipt is
stored separately from verified-page state before readback. A receipt alone
cannot authorize a commit, and a concurrent completion cannot create a second
page or cancel an in-flight publisher.

ClickUp's import can also convert a paragraph plus its following horizontal
divider into a level-two heading. That exact transformation is accepted when
all inline content is unchanged; it does not require a separate user review.
Other heading changes, missing words, altered links, tables and scripts still
fail verification. Existing saved results can finish through their recorded
brief without analysis or page creation being repeated.

`20261021000200_personal_worker_publishing.sql` adds only private publishing
state and a service-only dispatcher wrapper. Its application helper defaults to
rollback, checks existing public/private row digests, and is idempotent. The
one-job recovery helper also defaults to rollback, performs only ClickUp GETs,
requires exactly one existing matching brief with verified complete content,
backs up the selected records privately when configured, and compares every
unrelated business/private-job row before committing. Never put live recovery
IDs, source URLs, artifacts or credentials in this public repository.

## Privacy And Scope

- Browser management requires both the app login and server-verified ClickUp
  identity. A shared Immuvi login alone cannot list/assign/revoke another person's
  personal worker. Anyone possessing that person's ClickUp key can impersonate
  that secondary identity; use separate keys and rotate exposed ones.
- Personal devices/jobs live in an unexposed, access-restricted database schema,
  not the shared worker registry, online counts or realtime channels. Shared
  inspiration rows/results remain visible to colleagues who already have product
  access; this is private worker routing, not private business records.
- The client receives only an assigned source and minimal selected-product
  context. It has no Supabase admin key, database password, repository checkout,
  Producer/Strategist dispatcher or access to the global job pool.
- Device and ClickUp credentials use the Mac login Keychain. Pairing/device
  secrets are hashed on the server. Agent subprocesses do not inherit them.
- Source frames/text still go to the chosen AI provider. This is not an offline
  AI model or a guarantee against every local-machine/provider risk. Audio
  verification stays local; remote audio analyzers and browser-cookie extraction
  are disabled in this worker contract.
- No Brief cannot create briefs/scripts or alter existing brief links/scripts.
  Existing notes, locked categories, creative lifecycle status, unrelated record
  fields and other products are preserved. New taxonomy stays inspiration-local.
- Full briefs create a new page only in the configured product library; they do
  not overwrite an older page by task number. Ambiguous publication is retained
  for review. Library setup is required before publishing, not silently repaired
  through broad product-config edits.

## Revoke And Maintain

My Mac > Revoke invalidates only that device. Pending/running jobs stop accepting
results; no inspirations, creatives or existing briefs are deleted. Never reuse
the shared Mac mini installer or supply a Supabase key to a personal worker.

If initial setup completed login and pairing but stopped with a Keychain-save
error before starting the service, download the latest installer and run:

```bash
bash /tmp/immuvi-personal-worker-install.sh --resume-pairing
```

This verifies the downloaded files, reads the saved credentials from Keychain,
checks that the device token is still valid, and starts only this personal
worker. It does not reinstall dependencies, request another key/code, or replace
an installed service. The earlier Keychain utility exit-command bug could report
failure after credentials were saved. If credentials are genuinely missing or
the pairing was revoked, resume stops with guidance instead of storing secrets
in a file or weakening Keychain security.

An installed personal service can be updated with the official installer's
explicit `--repair` mode, available through the Codex prompt in My Mac. It stages
and checks assets, validates the exact personal LaunchAgent, sends SIGTERM and
waits for graceful exit before replacing files. It never force-kills analysis,
revokes pairing, deletes retained results or changes the shared/team worker.
Pending results are uploaded before any new claim after restart. On a repair
failure the previous worker assets and same service are restored. Dependency
changes are restricted to this private environment; working Homebrew tools are
reused. This is a supervised update, not unattended executable replacement.

## Personal Runtime Health

The `personal-runtime-v1` client probes its actual private Python environment
before claiming work, then caches that check for five minutes. Explicit private
Python/tool paths are provided to the isolated classification agent in
`runtime.json`; it must not use a system interpreter by accident. Standard
Homebrew executable directories are included in the child-only PATH. Optional
audio imports are diagnosed without making them a new prerequisite for text,
image or No Brief classification. No source, credential or raw error text is
included in runtime telemetry.

A missing core tool pauses claims without consuming content attempts or
changing queued inspirations. The existing minute heartbeat carries only the
version, readiness and allowlisted codes. Private runtime metadata updates only
when changed. My Mac displays Needs repair and concrete failed checks only to
the device's existing app/ClickUp owner. Legacy clients remain compatible but
must be updated once to receive the new runtime checks.

An agent-reported local-tool failure gets at most one clean invocation retry
using the same exact source/product/brief mode, within the original analysis
deadline. It cannot install software, switch to remote analyzers, publish a
brief or call services. Source, provider, evidence and publishing failures do
not enter this recovery path. Persistent failure reports a sanitized diagnostic
and opens a local circuit breaker, preventing later inspirations from repeatedly
failing on that Mac. Supervised repair checks the full dependencies/models, then
runs `diagnose --resume` to clear only that circuit breaker. The normal
blocked/retry safeguards remain. No automatic bulk requeue or
fallback to another person's worker is performed.

`worker.py diagnose` runs without reading Keychain or contacting app/ClickUp
services. It outputs only the readiness contract and allowlisted check codes.
The runtime migration adds nullable metadata only in `personal_workers`, and
delegates existing ownership, fenced leases, publication and commits to the
preserved dispatcher. `scripts/apply-personal-runtime-migration.mjs` defaults to
a rollback-only, twice-applied migration test with business/private-row digest
checks; `--apply` commits it. No existing job is retried by this migration.

Local state is under `~/Library/Application Support/Immuvi Personal Worker`.
`review-*.json` contains retained analysis after a rejected upload. It is private
source material, not a file to attach to public issues. Credentials are not in it.

Codex CLI login/profile behavior follows the [official authentication guidance](https://learn.chatgpt.com/docs/auth).

## Release And Rollback

### Cancellation And Parallel Jobs

Updated `personal-parallel-v1` Macs run two independent analysis slots below
16 GB RAM and three at or above 16 GB, with a hard server limit of three. Older
clients retain one slot. Each slot has separate retained result/failure journals;
slot zero continues to drain legacy journals. All retained slots are drained
even if a Mac's capacity later decreases. The service still has one minute
heartbeat; a single control thread checks up to three active leases every
15 seconds. These checks do not refresh the browser or broadcast app saves.
The personal classifier bundle provides a cross-process audio inference lock;
the agent must hold it around local model loading/inference to avoid parallel
large audio models exhausting a small Mac. Frame/creative analysis remains
parallel. Graceful updates stop new claims and retain/drain all slots.

Deleting a private inspiration first sends an app-JWT plus verified-ClickUp
cancellation for that exact product/source. Another ClickUp user's assignment
cannot be cancelled. Only after success does the browser delete the selected
product's rows; a failure stays visible, and no bulk save can resurrect it.
An old browser's uncoordinated deletion is rejected before the inspiration is
removed. Shared deletions need no personal key or worker cancellation.

Cancelled analyses release server capacity immediately. The updated client
stops only the cancelled job's process group on the next successful lease poll;
late results acknowledge cancellation without publication. Already reserved
publishing is fenced with `cancel_requested`: saved analysis and any late page
receipt are retained, but no classification is committed or replacement brief
created. A ClickUp create already in flight cannot be recalled; its receipt must
remain recorded for review. Never delete that page automatically.

Claims/status checks cancel only their own device's active jobs whose exact
source row is already missing, and remove only those orphan private queue
markers. `scripts/recover-personal-orphan.mjs` provides a rollback-first,
single-job repair for historical orphan leases with no artifact/brief, private
backups and unrelated-row digest checks. The parallel migration itself rewrites
no existing business data and does not retry any inspiration.

Apply `20261021000100_personal_classification_workers.sql` before enabling the UI.
The migration script first compares counts/digests for all existing rows in nine
content tables inside a repeatable-read transaction; it aborts on a difference.
The script defaults to rollback-only and needs `--apply` to commit.

The pre-feature main bundle is stored privately outside the public repository.
Rollback the feature code without dropping the private schema/jobs or resetting
any product records. Revoke/drain enrolled devices before disabling the API.
Keep retained artifacts/pages for review; do not blindly drop tables containing
submissions made after launch. QA is not part of this release.

Automated checks cover API/result validation, rollback-only database isolation,
lease fencing, No Brief/manual data preservation, provider credential isolation,
and desktop/mobile setup-dialog behavior. A fresh colleague Mac installation and
its first real creative still require operational verification on that Mac.
No test suite can guarantee that every unrelated backlog bug or future external
provider/source failure is impossible.
