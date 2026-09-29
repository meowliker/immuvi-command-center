# Shared Mac mini completion plan

The existing QA service is an inspiration worker, not full legacy parity.
Keep QA, production, and Anay's owner-only MacBook separate throughout this plan.
Do not ask for another mini installation for each stage. Prepare and verify the
combined release here, then perform one coordinated machine installation and
acceptance pass. Physical installation and paid/output-producing acceptance tests
are not complete until actually performed.

## 1. Approved automatic updates

Local implementation and regression gate complete on 2026-09-29. Opt-in remains
disabled; nothing from this stage is installed or activated on the mini yet.

Completed substeps:

1. Restrict approval to the fixed QA manifest and an exact reviewed commit.
2. Stage and verify releases separately from the running checkout.
3. Switch only while idle, require startup readiness, and roll back failed starts.
4. Stop an orphaned worker on supervisor disconnect and reject interrupted
   activation. Recheck runtime compatibility even for previously staged code.
5. Run local regression checks and preserve machine-level acceptance for stage 5.

Implementation:

- A stable launcher supervises an isolated worker child.
- Only `worker-releases/qa.json` on the repository's QA branch approves a release.
  Ordinary code pushes do not activate anything. No approval manifest is published
  yet. The fixed HTTPS GitHub repository and an exact 40-character commit are used.
- Polls at most once a minute while idle; failed checks back off five minutes.
- Stages code and locked Node dependencies in an owner-only release directory.
  Package lifecycle scripts are disabled. Worker/service tests and the Facebook
  regression suite must pass before the release pointer changes.
- Protocol and Python requirements must match the bootstrap runtime. Database
  migrations and Python/system dependency upgrades never run automatically.
- The candidate must report classifier readiness before the supervisor allows
  it to claim any work. Failed startup returns to the previous installed version
  (or bootstrap) and rejects that commit until another release is approved.
- Active jobs are never interrupted for an update. The existing private MacBook
  and production services do not opt in to this mechanism.
- If the launcher disappears, its worker aborts processing and stops new claims.
  Recovery of an interrupted task is separate stage 2 work; this shutdown check
  does not itself make interrupted tasks resumable.

Tests cover bad manifests, pinned sources, staging order, network failure,
concurrent checks, startup timeout/crash, previous-version fallback, and real IPC
activation gating. Additional checks cover busy-worker deferral, shutdown while
staging, pointer-save failures, cached runtime drift, staging cleanup on failed
verification, and real child-process shutdown after launcher disconnect.

Local verification:

- All 18 updater/supervisor tests passed. Git/install/test failure paths use
  injected commands and temporary directories; activation/disconnect tests also
  use real Node child processes.
- Full domain/service/component JavaScript suite passed.
- `npm run typecheck` passed.
- All 7 Python Facebook snapshot regression tests passed.
- No release approval manifest was published, no live job was retried, and no
  database, ClickUp content, worker configuration or service was changed.

Actual download/installation on the mini, QA service restart, and live busy/idle
update acceptance remain part of stage 5. Passing local tests is not deployment
verification.

Limits: bootstrap changes or new Python/system dependencies can still require a
planned runtime upgrade. Auth expiry/hardware failure is not solved by code updates.
Startup rollback does not promise detection of every later semantic bug.

Next checkpoint after stage 1: durable task recovery, below.

## 2. Durable task recovery

Local implementation complete; migration and worker deployment are deferred to
stage 5. The installed mini continues using its existing behavior until then.

Completed substeps:

1. Offline enqueue for an enabled, enrolled shared device that has advertised
   recovery protocol 2. Legacy/private devices still require their existing
   online capability checks. No automatic fallback to another user's machine.
2. Version-gated claim/checkpoint rules revalidate requester, product, source
   version, approved library and credentials. Old binaries cannot claim or fail
   protocol-2 jobs. Expired old running attempts still require review because
   they never recorded a generation-start boundary.
3. Stable owner-only job directories preserve source evidence, CLI last-message
   output and validated results. Database results and ClickUp receipts survive
   retries. An uncertain create is resolved by existing page identity; absent or
   ambiguous receipts never trigger a blind duplicate POST.
4. Maximum five automatic attempts with 30s/120s/10m/30m retry delays. Encrypted
   delivery authorization expires after seven days and is cleared on terminal
   completion/failure/cancellation. Expired authorization is cleared during the
   next status read or worker claim; there is no offline wall-clock deletion job.
   Requeue renews credentials through the app without exposing them to users or
   writing them into local media checkpoints.
5. Requester-only cancellation revokes the job lease and preserves output. An
   in-flight external call may still finish, so a cancelled delivery retains its
   fence until the old lease expires. Cancellation is shown separately from
   failure. The activity panel distinguishes scheduled recovery, generation and
   saved-brief delivery; expired running leases display as waiting for recovery.
6. A local lease watchdog aborts processing before the 120-second database lease
   expires, even if all heartbeat calls fail. CLI cancellation escalates to a
   forced stop after five seconds if graceful termination is ignored.

Important boundary: a completed generated result is resumed, not regenerated.
If generation started but neither a database result nor a valid local completed
result exists, recovery stops for review. Resuming an arbitrary half-written AI
generation without risking duplicate generation is not supported. Cancellation
does not delete an external page or undo an already-submitted provider request.

Verification includes a local PostgreSQL fixture using the real migration
functions (minimal auth/base-schema fixtures), local filesystem/process tests,
mocked ClickUp failure/reconciliation tests, component interaction tests, the full
JavaScript suite, TypeScript and Facebook regressions. No remote database,
credentials, services or ClickUp documents are changed by the local harness.
Actual QA-schema/RLS integration and machine restart acceptance remain stage 5
gates, not claims made by these local fixtures.

Run the local database gate with:

```sh
QA_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/check-qa-shared-recovery.mjs
```

Next checkpoint: stage 3, shared image generation / Producer.

## 3. Shared image generation / Producer

Local implementation complete for the approved QA destination. Not installed or
enabled on the mini. The live paid/output-producing acceptance remains stage 5.

Completed substeps:

1. Explicit private/shared image selector, capability probe, offline shared queue,
   owner-only private routing and approved QA list/task checks. No automatic
   fallback between devices. A fresh worker without native images cannot accept
   new generation. Old binaries cannot claim shared image jobs.
2. Read the task, custom fields, paginated comments, linked QA-library brief pages,
   reference media and both JSON/markdown Strategist memory. The parent worker
   fetches service data and holds credentials; the model receives creative data.
3. Reuse legacy skill creative sections verbatim and a checked AST snapshot of
   the legacy worker's detailed anatomy/quality instructions. Keep its GPT-5.5 /
   medium runtime settings, native image tool, sequential variations, reference
   fidelity, product directives and quality checks. No fallback renderer.
4. Persist each accepted image before delivery. Names are Task Name-1.png,
   Task Name-2.png, etc.; private QA storage keys remain run-id/1.png, etc.
   Upload each accepted variation before generating the next, as in legacy.
5. Record attachment intent and receipts, verify downloaded attachment hashes,
   reconcile uncertain uploads without another POST, and add one marked summary
   comment. Only verified complete delivery advances ClickUp and the Immuvi
   creative to Ready to Launch. It does not launch an ad campaign.
6. Bound retries and expiring encrypted authorization; retain accepted variations
   across process/network interruptions. A requester can use Resume saved run to
   renew authorization without creating another run. Native CLI cancellation is
   forcibly completed after five seconds if SIGTERM is ignored.

Recovery limits are deliberate: a started generation without a verified saved
output stops for review instead of risking another paid generation. An uncertain
attachment/comment create is reconciled by receipts; absent or ambiguous evidence
also stops for review. Missing local context after generation needs review.
External writes already submitted cannot be undone by stopping the worker.

QA differences from unrestricted legacy remain intentional: only the approved
test list and library, no inherited browser cookies, no production service key,
and no agent-issued service writes or self-updates. Sources must be public social
media or downloadable PNG/JPEG/WebP files, including Drive file links. A Drive
folder must be replaced by a specific image file. Authenticated/private media and
arbitrary ClickUp libraries are not silently fetched with broader credentials.
This is not a claim of support for every possible legacy input URL.

Local checks cover real PNG decoding, ordered recovery, lost storage/upload/comment
acknowledgments, duplicate prevention, exact legacy prompt snapshots, real child
termination, scoped API authorization, and the SQL state machine against the
actual image/worker migrations in local PostgreSQL. Browser fixtures exercise
private/shared selection, offline shared queue, previews and 320-1440px layouts,
with all provider calls mocked. No live image was generated or attached.

Latest local gate: 741 JavaScript tests, TypeScript, 7 Facebook snapshot tests,
the Producer prompt snapshot check and the local PostgreSQL recovery/Producer
fixtures passed. Browser tests passed with no console errors or unmocked external
requests. The shared run resume check retained the same run ID.

```sh
QA_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/check-qa-shared-recovery.mjs --images
python3 scripts/producer-contract.py --check
```

Next checkpoint: stage 4, variation briefs and Strategist.

## 4. Variation briefs and Strategist

Local implementation and mocked acceptance complete. No live generation, remote
migration, release activation or mini installation was performed in this stage.

Completed substeps:

1. Separate, version-gated shared analysis jobs with explicit device selection,
   encrypted seven-day ClickUp authorization, requester-only same-run resume and
   single-slot exclusion with inspiration and Producer. Browser access to secret
   job rows is denied; status RPCs expose only display fields. Legacy output tables
   remain readable but browser-generated results/direct queue inserts are revoked.
2. Winner briefs use the actual legacy worker's winner-specific creative prompt
   extracted by AST, plus the existing canonical classification and eight-section
   brief contract. The filename comes from the winning artifact, avoiding the
   legacy function's uninitialised `winner_label`. Public Drive video extraction
   uses the existing QA/legacy media adapter; named PNG/JPEG/WebP winning files
   use the public-file image downloader and real image decoding. No inherited
   Google credential is used; folders/authenticated files remain unsupported.
3. Winner pages use the approved QA library, legacy winner title, durable create
   intent and receipt, and markdown readback. Ambiguous creates are reconciled
   only by matching identity/content; they are never blindly repeated. Verified
   completion upserts `variation_briefs`, closes its queue mirror, and publishes
   the target's winner brief link to the Action Plan Brief column. Later ClickUp
   task creation includes that link. Posting the optional legacy task comment is
   not enabled; no extra external writes are needed for a complete brief.
4. Winner brief controls are available in Winning files from Action Plan,
   Creative Tracker and Matrix. Strategist has a shared worker selector and Run
   Strategist / Resume saved run. The activity panel includes both workflows and
   suppresses duplicate legacy queue mirrors. No automatic private-device fallback.
5. Strategist reuses the legacy Python taxonomy, canonical field extraction,
   content hash, synthesis prompt, aggregate/ROI calculation and memo prompt
   directly. It scans judged tasks in the approved list including closed tasks,
   reads their descriptions/fields and latest 30 comments, reuses unchanged
   cached task briefs and excludes absent/unjudged tasks from new memory. The
   legacy pipeline's linked-doc-text field is also unchanged (not fetched).
6. Source snapshots, per-task synthesis, aggregates and narrative are checkpointed
   independently. Completed CLI output can be recovered without another model
   call, including a lost database acknowledgment. JSON key order changes do not
   invalidate saved work. Final structured memory, narrative, processed cache and
   run status are committed atomically to the legacy tables used by the app and
   image Producer. Retained runtime checkpoints replace legacy repo snapshot files.
7. Shared text analysis uses authenticated Codex in the isolated runtime; login
   status is rechecked while idle. Claude is not enrolled or advertised by this
   runtime. The legacy mini supports its Codex fallback, so Claude is not needed
   for these workflows. No permission-bypass or model-held service key is used.

Deliberate recovery differences: legacy Strategist abandons stale runs and may
publish cached/partial memory after a per-task synthesis or renderer failure.
QA instead retains prior memory until the full requested analysis succeeds.
An interrupted generation with no completed result stops for review, not a blind
paid replay. Resume preserves the same input snapshot and model-call boundaries.
Source-only reads can safely be retried. Scheduled daily runs, recommendation
generation and broader production destinations are not added by this stage;
this connects the legacy worker's manual product-memory pipeline.

Local checks: 763 JavaScript tests, service and scoped API fixtures, actual migration functions in local
PostgreSQL, the complete JavaScript suite, TypeScript, Facebook regressions, and
isolated desktop/mobile browser tests. All provider requests in tests are mocked.
Physical restart, authentication, live Drive/ClickUp delivery and model acceptance
remain stage 5 gates. No claim of full deployed-server parity is made here.

```sh
QA_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/check-qa-shared-recovery.mjs --analysis
node --test tests/services/shared-analysis*.test.js
```

Next checkpoint: stage 5, the consolidated release/install and live acceptance.

## 5. Consolidated install and acceptance

2026-09-30: local release verification passed. The combined migrations
passed rollback-only rehearsal against the actual hosted QA schema (recovery,
Producer and analysis), not just the local minimal-schema fixtures. The optimized
credential-free app package and its browser/route restart rehearsal passed.
The real HTTP/Auth fixture also passed with disposable users: shared dispatch,
one-slot claims, outsider denial and private-device isolation. Its records were
removed, with no AI calls or ClickUp writes. Local and hosted rehearsals exposed
test-only gaps (abbreviated brief data and assertions spanning real workers);
fixtures now use complete briefs and only their own worker IDs.
Final local gate: 767 JS tests, TypeScript, 7 Facebook tests, legacy Producer
snapshot, local PostgreSQL fixtures, 44 packaged tab/viewport checks, and 29 route
probes plus 10 static assets both before and after same-artifact restart passed.
Focused shared-analysis and Producer browser flows also passed with no unexpected
errors or external requests; generation/delivery in those browser tests is mocked.
No migration was committed or mini/private/production service restarted here.
Use [the consolidated mini handoff](mac-mini-stage5-install.md); do not repeat the
historical initial installer. Physical installation and live acceptance below
remain required before this stage is complete.

Only after stages 1-4 are implemented and verified locally:

1. Inspect/preserve the mini checkout and runtime. Pause claims and drain active
   work; do not kill production or change its credentials/configuration.
   Verify and apply the pending QA-only recovery migration
   `20260929200000_qa_shared_recovery.sql` and
   `20260929210000_qa_shared_images.sql`, and
   `20260930010000_qa_shared_analysis.sql` against the actual QA schema before
   starting the new worker. Repeat auth/RLS fixtures in a rollback transaction.
   A new shared runtime refuses startup without all three database contracts.
2. Install the tested bootstrap/runtime and enable approved QA updates using
   `scripts/install-shared-qa-worker.mjs --enable-updates`, then restart only the
   shared QA LaunchAgent while idle. Resume claims and verify health.
3. Exercise every enabled workflow and interruption point: before claim, during
   generation, after saved output, after external delivery, before completion.
4. Publish a tested manifest pointing at a later verified QA commit, observe its
   automatic idle activation, and test rejection/rollback of an unhealthy fixture
   release without publishing broken code as a real approved release.
5. Test network loss, process exit, reboot followed by login, and sleep/wake.
   LaunchAgent starts at account login, not pre-login boot. Processing while the
   machine is powered off or asleep is impossible.
6. Confirm no duplicate paid generations, ClickUp pages or attachments and no
   private-worker access by other users. Only then sign off unattended QA.

Production promotion is separate. It needs approved destinations, scoped
enrollment and production acceptance; no QA config is silently repointed.

## Release promotion after the gate

Run the complete tests and review the exact candidate commit. It must contain
`worker-releases/contract.json` with the compatible entry/protocol, and the pinned
Python runtime must remain compatible. Then add/update the approval manifest in
a separate QA commit with this shape (replace COMMIT with the verified SHA):

```json
{"schema":1,"environment":"qa","protocol":1,"commit":"COMMIT"}
```

The manifest location is `worker-releases/qa.json`. Never use a branch name,
production URL, arbitrary download URL, or an unreviewed moving target in it.
The updater never pushes Git, edits the bootstrap checkout, applies migrations,
copies installed legacy skills, or writes a production service configuration.
