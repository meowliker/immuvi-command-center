# Strategist Inside Immuvi

## Architecture

`/strategist.html` is a normal Immuvi page. Its React interface is bundled with
esbuild; it does not require a second Next.js deployment, hostname, or iframe
containing the standalone app. The existing Strategist tab navigates to it.

The page calls `/api/strategist` on the same origin. The API reuses the existing
Immuvi Supabase login (`immuvi-auth`) and checks the active profile. There is no
separate shared-password login. Requests execute under the authenticated user's
database role, with product-level RLS, even though the backend connection can
perform administrative work outside a request.

The existing HTML app, APIs, inspiration queue, classifier worker, and existing
`strategist_memory`/`strategist_runs` functionality are not replaced.

## Features

The port includes Overview, Creatives, Formats, Keywords, Verification, Research,
and Hooks. Creative details retain media previews, timestamped transcripts,
research, and ClickUp-versus-observed field comparison. Product selection, search,
filters, sorting, copying, job history, and cancellation are included.

The original blind-analysis, deep-research, and verdict methods are retained.
Their source hashes are checked by `npm run test:strategist`. These methods use
sampled video frames plus transcripts, not frame-by-frame inspection of every
video frame. Existing imported analyses were not rerun or silently rewritten.

Long jobs run in a separate Mac worker because FFmpeg, Whisper, and lengthy model
calls are not implemented inside a short HTTP request. The browser/API can remain
hosted on Immuvi while this worker runs on a Mac. The Mac must be awake and online
to process new jobs. Reading the dashboard does not depend on an online worker.

| Action | Worker method |
| --- | --- |
| Sync ClickUp | Read the configured ClickUp lists into the prefixed task table |
| Watch | Download source media, probe it, transcribe, perform blind analysis |
| Enrich | Run the original deeper creative research method |
| Synthesize | Build the original product-level research synthesis |
| Snapshot | Export the same product-scoped read model used by the API |

The six source product/list mappings are preserved exactly in
`strategist/src/lib/products.ts`: Herbal Healing, ADHD, Canva Mastery, Instagram
Growth, Kids Mental Health, and Kids Life Skill. No additional products are
guessed or mapped by similar names. Immuvi permissions are resolved through the
existing product configuration's ClickUp list ID.

## Database Import

Imported on 2026-09-09 into Immuvi's production Supabase project
`hdniumnkprkadlrrataz`. The standalone source database was read only.

| Target Table | Imported Rows |
| --- | ---: |
| strategist_tasks | 1,402 |
| strategist_creatives | 239 |
| strategist_transcripts | 238 |
| strategist_frame_texts | 0 |
| strategist_observations | 239 |
| strategist_verdicts | 1,673 |
| strategist_keywords | 1,785 |
| strategist_sync_runs | 9 |
| strategist_research | 239 |
| strategist_synthesis | 2 |
| **Total** | **5,826** |

All ten imported tables were verified by canonical row-content SHA-256, not just
row count. IDs, links, relationships, timestamps, and analysis values are retained.
There were no stored thumbnail/frame-file paths to move; Drive references remain
unchanged. A separate new `strategist_jobs` table holds the worker queue.

Private migration backup and checksums:

`backups/strategist-migration-2026-09-09T11-33-59-505Z/`

The backup contains every source row, schema information, import checksums, and
an applied manifest. It is ignored by Git and deployment. Keep it for rollback;
do not publish it. Schema files are in `strategist/migrations/`. The importer
refuses to overwrite existing destination tables; do not rerun it for updates.

## Runtime Configuration

The private `.env.strategist.local` is configured locally. No credentials belong
in Git, the browser bundle, deployment logs, or this document.

Vercel API environment:

- `SUPABASE_URL`: existing Immuvi Supabase URL.
- `SUPABASE_ANON_KEY` (or existing `NEXT_PUBLIC_SUPABASE_ANON_KEY`): Immuvi public key.
- `SUPABASE_SERVICE_ROLE_KEY`: existing Immuvi server-only key.
- `STRATEGIST_DATABASE_URL`: **Immuvi** transaction-pooler connection, SSL enabled.

Worker environment additionally requires:

- `ANTHROPIC_API_KEY`.
- `CLICKUP_TOKEN` and `CLICKUP_TEAM_ID`.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: actual Google service-account JSON with read access
  to the source Drive files. The original OAuth refresh-token mode is also retained.
- `STRATEGIST_WHISPER_PYTHON`: Python executable with Whisper installed, or
  `STRATEGIST_WHISPER_BIN`: Whisper CLI executable.
- FFmpeg and FFprobe on `PATH`.

The original RTF's `GOOGLE_SERVICE_ACCOUNT_JSON` value was a duplicated database
URL. It was replaced privately with the supplied service-account JSON on
2026-09-09. The database, ClickUp team access, both configured Anthropic models,
and a full source-video download were verified. The downloaded sample,
`CA-204-INS-025`, was probed as a 1080x1920 video of approximately 5.39 seconds;
the temporary download was removed. No paid reanalysis was launched.

The repo's existing `supabase/.temp/pooler-url` points at another project. It was
not changed or used for this import. The Strategist database guard rejects a
connection whose project does not match `SUPABASE_URL`.

## Run And Deploy

From the Immuvi repository on `main`:

```sh
npm ci
npm run build:strategist
npm run dev:strategist
```

The local server prints its URL (default port 8099). Sign into the existing
Immuvi app in that browser/origin before opening Strategist. The verification
screenshots use isolated test sessions and do not create a production login.

Check worker credentials, then start it:

```sh
node scripts/strategist-preflight.mjs --video
npm run worker:strategist
```

For persistent operation on this Mac:

```sh
node tools/setup-strategist-worker.mjs
```

This installs only `com.immuvi.strategist-app-worker`; it does not replace the
existing classifier worker. Logs are under `backups/strategist-worker/`.
The worker was installed and verified idle on this Mac during the integration,
then restarted successfully after the valid Drive credential was configured.
Rerun the setup command after updating the private env file so it picks up the
new values. To replace the Drive key without printing it or editing JSON by hand:

```sh
node scripts/set-strategist-drive-credentials.mjs /absolute/path/to/service-account.json
node scripts/strategist-preflight.mjs --video
node tools/setup-strategist-worker.mjs
```

The credential setter backs up the previous configuration under the ignored
`backups/strategist-credentials/` directory and preserves other env values.
Claims, heartbeat leases, duplicate-action protection, and cancellation are stored
in the new queue. A stale job is retried up to three claims. Completed analyses
are retained and skipped by subsequent work; partial per-creative writes are
transactional. Source ClickUp and Drive APIs remain read only.

For production, configure the four Vercel API environment variables above and
deploy `main`. `vercel.json` builds the page/API bundle while preserving the
existing root route and skill-download routes. No new hosting URL is required.
Do not change the Vercel project to a Next.js framework preset.

## Verification

```sh
npm run build:strategist
npx tsc -p strategist/tsconfig.json
npx vitest run strategist/tests
npm run test:strategist
npx tsx scripts/verify-strategist.ts
npx tsx scripts/verify-strategist-worker.ts
```

The live database/API verification checks every source product and all active
member permission boundaries, plus the imported checksums. Only its auth-user
lookup is replaced in the test process; product access, profile checks, queries,
RLS, and imported data are live. The worker test uses temporary jobs and removes
only its own jobs afterward. Run it only when the new queue is idle.

Browser verification uses permission-checked live data captured into private
fixtures and mocked queue actions/Drive preview. Desktop, 390px mobile, product
switching, modal scrolling, transcript access, and queue/cancel controls are
checked. A separate live preflight downloaded and probed an actual Drive video
after the correct credential was supplied. Browser playback under a real user's
Drive session and paid AI reanalysis were not part of these checks.

Private reports/screenshots are under `backups/strategist-verification/`.

## Rollback

The least risky rollback leaves the imported data intact:

1. Stop only `com.immuvi.strategist-app-worker` if installed, and cancel its active
   job before a rollback. Do not stop the existing inspiration classifier.
2. Redeploy the prior Immuvi version. Restore the original Strategist tab handler
   and prior build configuration with a targeted commit on `main`.
3. Retain all newly prefixed tables and migration backups. They do not affect the
   prior app, and retaining them makes restoration straightforward.

Baseline main commit before this addition: `b551a57`. Do not reset unrelated work
or the preserved QA stash. No preexisting Immuvi table rows or source Supabase
rows need restoring from this migration because none were modified.

If full database cleanup is later requested, first export any new Strategist
work, then review the exact table/enum list from the migration manifest. Never
drop tables using a `strategist_*` wildcard: Immuvi already had other tables with
that prefix before this integration.
