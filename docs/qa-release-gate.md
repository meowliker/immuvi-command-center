# QA Release Gate

Milestone 12's consolidated local/database pass is complete; live-integration
and acceptance gates remain open. This is a QA verification record, not approval
to push, deploy, change production, launch ads or start classifier workers.
The milestone numbers remain unchanged: 6/13 fully closed, five more locally
complete with acceptance gates, and milestones 12-13 not closed.

## Story And Boundaries

A signed-in QA user opens the single Next.js command center at `/`, uses its
internal tabs, and sends authorized product-scoped requests to the approved QA
Supabase project and explicitly guarded test-list workflows. Old bookmarks or
integration endpoints must not provide another route around those controls.

Fixed scope for milestone 12:

1. **Locally verified:** runtime destination/configuration isolation and the
   identified compatibility entry points. Hosting-layer inventory remains a
   deployment gate, not covered by this local result.
2. **Verified in hosted QA:** authentication, RLS, product boundaries and
   concurrent writes, including direct client requests and recoverable operations.
   Service-role/owner legacy processes remain outside this evidence.
3. **Consolidated local pass complete:** backlog-to-evidence review and
   cross-feature failure/deletion regression, plus responsive, accessible-label
   and 1,000-row performance smoke checks. This is not full WCAG certification,
   a production load benchmark or user visual sign-off.
4. Isolated live integration evidence and a consolidated go/no-go report. Missing
   worker/OneScale destinations remain explicit blockers, not simulated passes.

These are verification categories within milestone 12, not additional milestones
or feature finish batches. Milestone 13 remains QA cutover after sign-off.

## Isolation Findings And Fixes

The first review found two runtime boundary gaps. No production writes were
performed to demonstrate them; finding reachable code is not evidence it was used.

- The Next compatibility `/api/clickup` handler forwarded arbitrary ClickUp paths
  and methods through the production-style proxy. It bypassed the native QA
  product/list checks. It now returns a non-cacheable 503 for every exported
  method, regardless of credentials. The native `/api/clickup/qa` and
  `/api/clickup/qa-cleanup` workflows are retained.
- Legacy OneScale callback, installer, installer download and team-skill routes
  were still available. The callback/installer adapters could mutate process-wide
  Supabase settings and use legacy handlers. These routes now return the same
  disabled response without imports, filesystem reads, network requests or
  credential-dependent exceptions. No public enable switch has been added.
- All three legacy HTML bookmarks now return a temporary, non-cacheable redirect
  to `/`, with no executable legacy HTML body. Original HTML files remain intact
  for source comparisons. This closes the QA compatibility runtime, not a change
  to the deployed production HTML or its serverless handlers.
- Public configuration previously accepted arbitrary explicit QA URLs and could
  serialize an inappropriate key. It now requires every explicit QA URL to match
  `https://entgcnlfsnysnwyadzzp.supabase.co`. Generic production settings are ignored.
  Anonymous JWTs must claim the approved project and anonymous role; service,
  malformed and foreign JWTs are rejected with value-free errors. Public
  `sb_publishable_` keys are allowed, but their project ownership cannot be
  established from their opaque value; the host remains pinned to QA and Supabase
  validates the key. This is configuration validation, not JWT signature checking.

## Isolation Evidence

- 480 domain/service tests pass. Six new tests exercise generic production-env
  contamination, conflicting URL/key overrides, service-key rejection, populated
  server credentials, zero network calls/environment mutations on disabled routes,
  and redirect-only legacy bookmarks.
- Optimized Next.js build, including TypeScript, passes.
- `node scripts/check-qa-route-isolation.mjs` passes 17 loopback probes against
  `http://127.0.0.1:3001/`: three redirects, six blocked proxy methods, four blocked
  integration/download routes, two unauthenticated native API rejections, the
  root page and the unavailable legacy Strategist configuration API. The script
  refuses non-loopback targets and branches other than `qa`.
  These probes do not exercise authenticated database writes or real integrations.
- Native React code references the guarded QA ClickUp routes, not the disabled
  compatibility endpoints. Full intercepted browser regression passes 87 scenarios
  and 231 mocked mutation attempts, with no unexpected browser errors or external
  calls: `/tmp/immuvi-qa-isolation-regression/results.json`. These are mocked
  integration flows, not live worker/ClickUp acceptance.
- No SQL migration, existing-record mutation, production handler/HTML/worker edit,
  commit, push or deployment was performed in this portion.

## Database Findings And Fixes (2026-09-26)

The installed QA catalog still contained permissive legacy `open_all`/anonymous
policies, and four auxiliary tables had RLS disabled. UI guards did not prevent
direct access. This finding concerns QA; production was neither probed nor changed.

- QA-only migration `20260926010000_qa_product_rls.sql` replaces policies on
  24 application tables, revokes anonymous/public table grants and removes
  authenticated TRUNCATE privileges. Reads/writes use the existing active,
  password-cleared product-access helper. Product settings require an admin.
- Winner files, Drive cache and variation briefs derive access from their creative.
  Variation-brief queue rows require accessible parent/target creatives in the
  same product. Missing-parent and cross-product records are not exposed.
- The existing validated product-lock, Matrix-create and ClickUp-import RPCs use
  a restricted SECURITY DEFINER path so members retain legitimate workflows
  without blanket product-setting UPDATE access. Explicit identity/product/list
  checks remain in those functions. No worker execution was enabled.
- The migration changes policies/function privileges, not existing application
  records. All SQL fixtures roll back; live acceptance uses disposable identities
  and removes them. Migration history/readback confirms installation, zero public
  base tables with RLS disabled, and no remaining RLS/concurrency fixtures.
  RLS does not restrict database owners/service-role credentials.

## Consolidated Evidence (2026-09-26)

- `node scripts/check-qa-database-suite.mjs`: **30/30** rollback suites passed
  with the candidate rules. `--apply` reran all suites before QA installation;
  `--installed` then passed all 30 against installed functions, without replaying
  older migrations. Coverage includes Tracker, Matrix, Action Plan, Inspiration,
  Production, taxonomy, accounts, cleanup and worker controls.
- `node scripts/check-qa-live-boundaries.mjs --run --cli-key`: actual hosted
  Auth/JWT checks pass for anonymous, assigned/unassigned member, admin,
  forced-password and inactive users. Direct foreign reads/writes/artifact access
  and member product-setting edits are blocked. Five two-session Tracker edit
  races each produce one success/one stale rejection with consistent Action Plan
  data. Simultaneous Matrix requests return one creative. Deactivation immediately
  removes access from both existing sessions. All four users and both products
  were removed, including their creative fixtures.
- Existing live account-operation and account-creation runners pass through the
  local Next API on port 3001: reset/replay, password completion, ban/unban,
  delete/replay, custom/generated credentials, duplicate refusal, access gates,
  obsolete-credential suppression and one audit per operation. Their disposable
  accounts, products, journals and application audit fixtures were removed.
- **480/480** domain/service tests, optimized build/TypeScript and all **17**
  loopback isolation probes pass. Full intercepted regression passes **87**
  scenarios and **231** mocked mutation attempts, with no unexpected errors or
  external requests: `/tmp/immuvi-qa-final-regression/results.json`.
- The additional visible-control audit found missing Tracker filter labels and
  a narrow Competitors toolbar overflow. Labels and scoped mobile grid sizing
  were fixed without redesigning the interface. The subsequent focused audit
  passes all **44** combinations of 11 tabs at 320/390/768/1440px, with zero
  unnamed visible controls, page overflow, unexpected errors or external calls.
  Evidence: `/tmp/immuvi-qa-release-audit/release-audit.json`. The full 87-scenario
  run preceded these final small UI fixes; the 44-screen audit and build followed
  them. Existing feature browser suites cover keyboard/modal/failure states;
  this additional label heuristic is not a complete accessibility assessment.
- A mocked 1,000-row Tracker refresh became visible in **1,223 ms** on the warm
  local dev server. An earlier 10-second measurement was dominated by a broad
  accessibility-tree locator; the corrected check waits for the actual row.
  No pagination/redesign was introduced. This does not measure remote latency,
  production bundle performance or larger real-world datasets.
- [Backlog evidence](qa-backlog-evidence.md) maps every present backlog ID to
  native evidence, external dependencies or deliberate parity differences.
  It does not mark worker/provider issues fixed merely by adopting Next.js.

## Remaining Gates

- **Stage 12, acceptance:** real ClickUp test-list delivery/readback/recovery is
  **skipped for now at the user's explicit request**, not marked as passed;
  isolated worker/OneScale lifecycle evidence, and user visual/workflow approval.
  No further Action Plan feature batches are planned. Missing safe integration
  destinations remain blocked, not additional speculative coding steps.
- **Stage 13, QA cutover:** reviewed QA deployment routing/configuration,
  deployed smoke/security checks and rollback rehearsal, then explicit sign-off.
  No push/deployment or production release is authorized by this report.
  **Local release verification now passes**; the earlier disk-space blocker is
  resolved. See [QA cutover preparation](../deploy/qa/README.md). Optimized build
  and TypeScript succeeded in the credential-free standalone snapshot. Initial
  startup and same-artifact restart each passed 26 route probes and 10 static
  asset requests; all 1,344 artifact hashes remained intact. The packaged browser
  audit passed 44 tab/viewport checks with zero unexpected errors, external calls
  or mutations; the final mocked 1,000-row refresh took 906 ms, not a production
  benchmark. All 486 domain/service tests pass, and the unchanged running QA
  server separately passed its 17 configured-service isolation probes.
  Evidence: `/var/folders/vf/w_h9vtlx0gdg2b011wt0zd1r0000gn/T/immuvi-qa-release-wZBqGg/rehearsal.json`
  and adjacent manifest/browser reports and inspected screenshots.
  Hosted routing and previous-version rollback remain unverified. This is local
  Node verification, not a completed Vercel configuration or platform deployment.
- Cleanup deliberately preserves unused taxonomy, quarantined work and references;
  user approval of that parity difference remains open. Visual/workflow sign-off
  for milestones 7-11 is separate from automated checks.
- No isolated worker or non-launching OneScale destination exists. Installer,
  callback and external execution stay disabled; real lifecycle acceptance is not
  claimed. Never test these against production as a workaround.
- **Deployment routing is not ready.** The unchanged `vercel.json` still rewrites
  `/` to `/immuvi-command-center.html`. That conflicts with the QA root redirect
  and can produce a redirect loop under those deployment rules. It also contains
  legacy installer rewrites. Local Next dev/build checks do not exercise Vercel's
  routing layer. Prepare a separate reviewed QA deployment configuration and
  verify its routes/rollback during milestone 13 before deploying anything.
- The pre-existing `public/strategist.html` and bundle remain unchanged. They are
  not used by the native Strategist tab and depend on `/api/strategist?op=config`,
  which returns 404 in local Next. Include those static assets and all root
  `api/` serverless files in the deployment-route inventory; do not assume a
  hosting platform exposes the same routes as local Next.
- Database owner/service-role bypasses, actual legacy processes, existing data
  contamination and unrelated historical bugs remain release risks until tested
  or accepted. Native/direct-client RLS and two-session REST concurrency are now
  verified; real websocket reconnects and legacy service-role writer ordering
  are not. No assertion is made that moving to Next.js fixes all backlog bugs.

Current release decision: **No-go for production**. Local QA work can continue.
