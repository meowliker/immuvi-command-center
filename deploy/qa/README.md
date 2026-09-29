# QA Cutover Preparation

Status: **local release artifact, browser smoke and same-artifact restart verified**
on 2026-09-26. The earlier disk-space blocker is resolved. Packaging still requires
2 GiB free before creating a snapshot; do not delete user files to satisfy it.
Actual hosting, deployed checks and previous-version rollback remain unverified.

## Verified Local Candidate

- Output: `/var/folders/vf/w_h9vtlx0gdg2b011wt0zd1r0000gn/T/immuvi-qa-release-wZBqGg`.
  Temporary evidence may be removed by the operating system; rebuild before use
  if it is missing or source changes have been made.
- Optimized Next build and TypeScript passed. The manifest records 280 source
  files, 1,344 artifact files and the exact 15-entry internal route inventory.
- Startup and same-artifact restart each passed 26 route probes and 10 static
  asset requests. All artifact hashes remained unchanged after both shutdowns.
- The packaged app passed 44 tab/viewport label and page-overflow checks with
  zero unexpected browser errors, external requests or mocked mutations.
  Its intercepted 1,000-row Tracker refresh took 906 ms in the final run. This
  is a local smoke measurement, not a production performance guarantee.
- Evidence: `manifest.json`, `rehearsal.json`, `browser/release-audit.json` and
  screenshots within that output directory. Desktop/mobile images were inspected.
- All 486 domain/service tests pass. The unchanged, configured QA server on port
  3001 separately passed its original 17 route-isolation probes.
- The credential-free rehearsal explicitly expects cleanup's 503 configuration
  response; the configured-server check still requires 401 for anonymous access.

## Boundaries

- Work stays on `qa`; nothing is committed, pushed, deployed or promoted.
- Production `vercel.json`, HTML, serverless handlers and databases are unchanged.
- Live ClickUp acceptance is **skipped for now at the user's request**. This is
  not acceptance of a passing result. Worker/OneScale execution remains disabled.
- This is a **local Next.js standalone Node release rehearsal**, not a Vercel
  deployment or Build Output API artifact. It does not choose/change hosting.
  A separate QA hosting project and its final adapter/routing still need review.
- Do not upload this repository with its production `vercel.json`; its root
  rewrite conflicts with the native Next root and its legacy entry points need
  isolation. Never connect QA to the production Vercel project or domain.

## Build And Check

With at least 2 GiB free, from the repository on `qa`:

```sh
node scripts/build-qa-release.mjs
```

The builder creates a new temporary directory and copies only the app, libraries,
font assets, lockfile/config and the read-only Drive handler required by the Next
route. It does not copy `.env*`, `.git`, `.vercel`, workers, SQL migrations, legacy
HTML/static Strategist pages or unrelated root API handlers. It supplies a clean
build environment with the pinned QA URL and no server credentials. The Drive
source dependency is bundled privately by Next, not exposed as a root API file.

The source snapshot uses the existing Next configuration plus the standalone
override here. The original config is not edited. Installed dependencies are
copied for this offline/local rehearsal; this is not a reproducible clean-install
or cross-platform release certification. Rebuild with `npm ci` on the chosen
hosting OS before actual deployment.

The generated manifest records the exact source/artifact SHA-256 hashes, reviewed
routes, source commit, uncommitted-work flag, OS/architecture and lack of deployment
approval. Hashes detect accidental changes; the manifest is not a signed artifact.

Pass the resulting directory to:

```sh
node scripts/rehearse-qa-release.mjs /absolute/path/to/immuvi-qa-release-OUTPUT
```

Add `--browser` with `PLAYWRIGHT_MODULE` pointing to the installed Playwright
module for the intercepted 44-screen/1,000-row smoke audit. The rehearsal starts
only its own temporary loopback server, checks the built root/static assets and
route isolation, stops it, restarts the same artifact and repeats the checks.
It verifies hashes before execution and after shutdown and leaves a receipt next
to the manifest. It never replaces or stops the existing QA server on port 3001.

No credentials are supplied during rehearsal: account admin and public Drive
listing must return an unavailable response; browser backend calls are mocked.
This does not replace real authenticated or external-service acceptance.

## Runtime And Rollback Gates

Any future QA host must use only Supabase `entgcnlfsnysnwyadzzp`, with explicit
QA-scoped server credentials supplied securely at runtime. Account recovery also
needs a stable `QA_ACCOUNT_ENCRYPTION_KEY` across restarts/releases; do not rotate
it casually while encrypted operation journals need recovery. ClickUp keys stay
session-only. Do not inherit production Drive/worker/OneScale credentials.

Before an actual cutover:

1. Complete the [user acceptance checklist](../../docs/qa-user-acceptance.md)
   and obtain visual/workflow approval, including retained taxonomy and disabled
   integrations. Skipped tests remain listed in the release decision.
2. Select and verify a separate QA hosting project, environment and domain.
3. Build/verify on that target and run deployed root, auth, routing and asset checks.
4. Record the previous known-good QA artifact, configuration and secure key version.
5. Rehearse restoring that prior QA release before changing the QA alias.

The local same-artifact restart is **not** a previous-version or hosted-alias
rollback. Application rollback must not restore permissive RLS, resurrect deleted
data, remove durable recovery journals, or repoint QA to production. The native
runtime expects the installed QA migrations through `20260926010000`; an older
candidate must be tested for schema compatibility before restoration. Stop and
investigate instead of weakening database permissions to make an old build work.

Actual deployment, alias changes and production release still require explicit
approval. Official references: [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
and [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).
