# Personal Mac Classification Worker

## First Setup

1. Install Homebrew from https://brew.sh and install/sign in to an eligible Codex
   or Claude Code account. No Immuvi repository checkout is needed.
2. In Immuvi, enter your own ClickUp personal key. Open Inspiration > My Mac and
   download the Mac installer. Run the downloaded file with Bash in Terminal.
   Alternatively download the same installer explicitly:

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

The Mac must be awake, online and logged in. The LaunchAgent starts after login.
One job runs at a time. Idle claims poll every 15 seconds; heartbeats write at
most once per 55 seconds. There is no guaranteed instant classification: source
availability, video length, local hardware and provider quota still apply.
An offline personal assignment waits; it never falls back to the shared worker.
New personal submissions enqueue only the just-added inspiration, not everybody
else's queued links. Existing shared assignments cannot be stolen by this path.
Use My Mac > Retry for a blocked personal job. A publishing exception requires
review rather than an automatic second brief creation.

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
The installer currently refuses to replace an already installed worker while
it might be processing. Updates should be supervised and drained first; there
is deliberately no unattended code replacement during an active job.

Local state is under `~/Library/Application Support/Immuvi Personal Worker`.
`review-*.json` contains retained analysis after a rejected upload. It is private
source material, not a file to attach to public issues. Credentials are not in it.

Codex CLI login/profile behavior follows the [official authentication guidance](https://learn.chatgpt.com/docs/auth).

## Release And Rollback

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
