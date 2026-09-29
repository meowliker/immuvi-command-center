# Functional Parity Audit

Date: 2026-09-28. Scope: repository code comparison, not visual comparison.

Compared `immuvi-command-center.html`, legacy worker modules, native `app/`,
`lib/`, QA SQL migrations and worker scripts. No browser verification, provider
jobs, migrations, deployments or production changes were performed for this
audit. Repository legacy code is the reference; this does not establish that
every legacy feature is operational in its deployed environment. Existing
acceptance documents provide historical evidence, not a new passing test run.

## Confirmed Functional Gaps

| Area | Legacy behavior | Native behavior and evidence | Required work |
| --- | --- | --- | --- |
| Daily Strategist | `_queueDailyStrategistRun` at HTML line 15632, called on load/product change at 33565 and 33870, deduplicates a daily request. | `app/command-center/hooks/use-strategist.ts:74` only inserts manual requests. | Restore automatic daily scheduling with deduplication, scope checks and a verified QA consumer. |
| Strategist evidence | `_strategistStructuredBody` / `_strategistDimTable` expose dimension performance and evidence; legacy includes six summary metrics. | `components/strategist-memory.tsx:65` truncates arrays to eight entries. `structuredText` returns only a name/phrase for those records, dropping accompanying performance/evidence fields. `tabs/strategist-tab.tsx` shows fewer metrics. | Preserve complete results and the quantitative evidence; add pagination/expansion instead of silent truncation. |
| Competitor inspection | `_compOpenCreativesDrawer` at HTML line 19672 exposes researched creatives, previews/video, dates, variants, actions and expanded details. `_compEditBrand` edits existing brands. | `tabs/competitors-tab.tsx:112` displays only three text summaries per brand, without a full-results inspector. `hooks/use-competitors.ts` has add, approval, deletion and queueing but no existing-brand editor. | Add full creative inspection and brand editing. Preserve the distinction between observed provider data and LLM estimates. |
| Competitor job results | `_compRenderLiveActivity` includes recent completed/failed jobs and result information. | Native tab lists active jobs, not an equivalent recent outcome history. | Expose completion/failure details and actual recorded stages; do not copy legacy elapsed-time guesses as verified progress. |
| Winner-variation briefs | `_requestBriefIfNeeded` at HTML line 38332 queues missing briefs on winner marking/seeding. `_mxv3RequestBriefForVariation` also polls and patches the new ClickUp task with the resulting brief link. | Native code reads `variation_brief_queue` in `hooks/use-inspiration-activity.ts`, but has no equivalent queue insertion/automatic completion-to-task flow. | Implement idempotent brief requests, verified completion and recoverable task-link delivery. Displaying stored briefs does not replace generation. |
| Image worker routing | Legacy producer can target registered workers or choose any available worker. | `hooks/use-image-producer.ts:16`, `components/plan-producer-dialog.tsx:63` and `scripts/qa-image-worker.mjs:18` use `local-native`. SQL migration `20260928010000_qa_image_producer.sql:17` restricts the worker ID to that literal. | Add multiple registered worker identities, capability/health checks, targeting and claim ownership before offering Mac Mini selection. This is not just a missing dropdown option. |
| Image reference resolution | Legacy production workflow supports its Drive/ClickUp-based media path. | `scripts/qa-native-image-runner.mjs:49` requires public HTTPS images; lines 67-72 fetch candidate URLs directly and accept PNG/JPEG/WebP. Folder, social-ad and private attachment URLs are not resolved into image assets. | Add permission-scoped reference resolution and clear unsupported-reference validation. |
| Combined task monitor | Legacy worker services handle multiple types of background work. | `hooks/use-inspiration-activity.ts` monitors inspiration jobs, variation briefs and QA image runs, not Strategist or competitor research jobs. | Include the remaining queues if the panel is intended to show all background work. Estimates must remain labelled estimates. |

Native paths in the table are relative to `app/command-center/` unless otherwise
specified. These are confirmed gaps, not a claim that every possible edge case
in the application has been exhaustively enumerated.

## Implemented But Restricted Or Unverified

- **Inspiration processing:** library editing, imports, placement, saved-result
  handling and recovery exist. Automatic classification is deliberately blocked:
  `lib/services/inspiration-mutations.js` verifies `dispatchEnabled:false`;
  `20260922010000_qa_inspiration_mutations.sql` writes blocked queue entries with
  `worker_assignment='blocked:qa-isolation'`. Process All cannot currently execute
  the legacy end-to-end classifier/brief pipeline.
- **Worker controls:** `components/worker-controls.tsx` supports cooperative pause;
  resume is disabled. Legacy worker/installer code existing in the repository does
  not mean the native QA environment has a safely configured running consumer.
- **Competitor and Strategist execution:** their hooks insert pending work into
  `competitor_research_queue` and `strategist_runs`. Queue insertion is implemented;
  actual QA worker consumption and provider completion are not certified here.
- **Image generation:** a native Codex image-generation runner and private
  Supabase output persistence do exist. See `scripts/qa-image-worker.mjs` and
  `lib/services/qa-image-generation.js`. `docs/qa-image-producer.md` records a prior
  real image smoke test. No generation was run during this audit. Supabase-only
  delivery is the user's requested current behavior, not a defect. Legacy ClickUp
  attachment/status delivery is not yet connected to this new pipeline.
- **OneScale:** `lib/services/action-plan-onescale.js:41` explicitly returns
  `externalLaunchEnabled:false`. Readiness review exists, but external launch and
  the callback route are disabled. A successful review is not a launched ad.
- **ClickUp:** identity lookup, connection/schema mapping, synchronization and
  task mutation services exist. QA list restrictions remain. Historical release
  notes explicitly mark real ClickUp acceptance as skipped, not passed.
- **Data:** QA sample data is not a complete production migration. Different
  creative counts, fewer winner suggestions and empty period summaries do not by
  themselves demonstrate missing functionality. Dates and source records matter.
- **Deployment:** root `vercel.json` still routes to legacy HTML. The native QA
  standalone release preparation does not replace production routing. See
  `deploy/qa/README.md`; its old build evidence must be regenerated after changes.

## Header And Core Workflows Already Present

The native code contains product-scoped login/access, taxonomy editing, Tracker
editing/linking, Matrix placement/inspection, Action Plan views and bulk actions,
Production workflows, manual Inspiration handling and administration. Presence
of these paths is not a blanket claim of complete parity or passing live tests.

Header implementation is in `components/workspace-session.tsx`,
`hooks/use-clickup-connection.ts` and `hooks/use-workspace-presence.ts`:

- ClickUp key verification reads the ClickUp account; app login/role remains the
  authority for permissions. A ClickUp key must not grant admin access.
- Live ClickUp polling is 60 seconds foreground / 5 minutes background, enabled
  after successful sync and paused on errors, not a sync every few seconds.
- Notifications, account details/sign-out and online-user presence exist.
- Admin-confirmed force reload is QA-wide, not a broadcast to legacy production
  users. Members cannot trigger it. Deployment-change notices are separate.

## Inputs Needed From The User

1. Keep external testing on the approved disposable ClickUp list `1301130000002447` (Immuvi Test 1, replacing `901616718146` at the user's request).
   An authorized account must have access, the intended product must be mapped to
   that list, and required fields must exist. Enter keys only in the app/secure
   configuration, never in chat. Legacy Setup Fields was a manual setup helper,
   not automatic field creation.
2. Confirm which Mac Mini should host the QA workers and make it available for
   setup. Engineering must first provide QA-isolated configuration and complete
   multi-worker routing. Do not repoint the existing production worker to QA or
   share its production queues/credentials.
3. Provide authorized test media/reference access when private Drive/ClickUp
   resolution is implemented. Keep output delivery in Supabase as requested.
4. Provide a safe OneScale test destination and explicit approval before testing
   external launch behavior, if launch parity is required now.
5. Choose a separate QA hosting target when ready. Production rollout needs a
   separate approved data-migration, credential, routing and rollback plan.

The missing implementation is engineering work, not something the user can fix
by changing dropdowns or supplying a key. Complete the gaps, then verify real QA
flows for classify -> brief -> placement -> task sync, winner -> variation brief,
image generation -> Supabase, and research -> Strategist recommendations before
calling the app a production-ready functional replacement.
