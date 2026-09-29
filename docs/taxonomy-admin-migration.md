# Taxonomy And Administration Migration

Milestone 11 has four local batches. All four are locally complete; zero local
finish batches remain. User/integration approval gates are still open.
Batch 3 implementation is complete: product create/delete/unlink and field catalogs are now
implemented. Atomic user access/role controls and recoverable reset/activity/
deletion and account creation are implemented too. Guarded stale-ad cleanup is
implemented, along with pause-only worker controls. Final local layout,
field-description, product-prefix and bug-60 rename impact/provenance checks pass. See
[acceptance evidence](taxonomy-admin-acceptance.md).
Work stays on `qa` at `/` with internal tabs. No push or production deployment.
This milestone does not reopen completed Action Plan, Inspiration, Production
or HQ finish batches.

## Fixed Batch Plan

1. **Complete locally: complete taxonomy reads and relationships.** Paginated,
   product-scoped catalogs/creatives/tombstones, consistent relationship counts,
   live angle/persona/creative drill-downs and same-page Tracker handoff.
2. **Complete locally: atomic taxonomy changes and merging.** Versioned create/edit/rename,
   archive/restore/delete and confirmed merges; dependent creative, inspiration,
   action, Matrix and relationship updates; collision handling, lost-response
   recovery, draft retention and stale/deleted-product checks. SQL validated
   using rollback-only fixtures, then installed only in the approved QA project.
3. **Complete locally: administration and product/field controls.** Product create/delete/unlink,
   guarded cleanup, product-scoped field catalogs and ClickUp setup; user access,
   role/password/activity controls and worker operations. Destructive changes
   require scoped confirmations. Production destinations and launch/classifier
   dispatch remain blocked without an isolated test environment.
4. **Complete locally: final parity and acceptance.** Legacy layout/workflow comparison, mutation
   failure/concurrency tests, member/admin isolation, responsive/keyboard checks
   and full regression. Record external and user sign-off separately.

## Batch 1 Scope

- `taxonomy-workspace.js` provides the product/lifecycle snapshot and relationship
  calculations. The hook reads both catalogs, ads and tombstones with the existing
  500-row paginated reader rather than default catalog caps or a 3,000-ad limit.
- Commit only a complete, current read. Retain the last successful snapshot on
  refresh failure; initial failure is not shown as an empty catalog. Disable
  mutation buttons when initial data is missing, reads fail, or a write is busy.
- Reuse the existing realtime/focus/online polling lifecycle and product/tab/user
  remount boundaries. Catalog, creative and tombstone changes refresh the view.
- Relationship statistics count root creatives, matching legacy tracker intent.
  Child variations, deleted/quarantined records and tombstoned remote aliases are
  excluded. Opposite-axis aliases count once using the shared canonical key.
  Archived and uncataloged peers remain visible as historical relationships.
- Shared winner rules include Winner, Mild Winner and Scale. This resolves the
  legacy inconsistency where some popup counts used only Winner. Overall creative
  totals count unique IDs, avoiding double-counting across alias taxonomy rows;
  taxonomy row totals still reflect actual records, not a silent storage merge.
- Related peer details include notes, archive state and validated HTTP(S) source
  links. Text is rendered by React, never injected as HTML. A peer can narrow the
  creative list; creatives without an opposite tag remain in the full list.
- Creative links open the existing Tracker tab at `/`. The current relationship
  snapshot controls eligibility; stale/error data disables handoff, and Tracker
  re-resolves the target from its own product-scoped data. Tracker-hidden records
  can be inspected in the relationship list but do not get an enabled handoff.
- Dialogs use existing modal focus/escape/scroll-lock behavior. Parent drafts
  survive peer refreshes. Deleted selected records show an unavailable state.

## Batch 1 Verification

- 429 domain/service tests pass, including five new taxonomy workspace tests.
- Focused intercepted browser acceptance passes:
  `/tmp/immuvi-taxonomy-relationships/results.json`. Proves 501 catalog rows and
  506 related creatives across pages; aliases, lifecycle/product filtering, peer
  updates, safe links/literal text, draft retention, tombstone removal, same-page
  Tracker handoff, failures/retry and delayed previous-product responses.
- Screenshots inspected at 320 and 1440px; dialog bounds checked at 320/390/768/1440.
- Focused run has zero database mutations, unexpected errors or external requests.
- Optimized Next.js build, including TypeScript, passes. Full intercepted browser
  regression passes: `/tmp/immuvi-taxonomy-relationships-regression/results.json`,
  178 mocked mutation attempts across existing workflows, zero unexpected browser
  errors or external requests. The new taxonomy scenario adds no mutations.
- Preview restarted on `http://127.0.0.1:3000/`. `agent-browser` is unavailable;
  the existing Playwright harness supplies browser, console and screenshot checks.

## Batch 2 Scope

- All taxonomy writes now use `qa_taxonomy_mutate`; the React hook no longer
  performs separate direct table mutations. Product access, password/access
  state, product locking, source/target versions and canonical name collisions
  are checked inside the database transaction. Archived aliases also count as
  name collisions. Both angles and personas use the same implementation.
- Rename, merge and delete update live creative tags and known JSON mirrors,
  inspiration data, action tag aliases, Matrix cells and relationship links
  atomically. Deletes clear dependent tags but do not delete creatives; archive
  and restore retain their tags. Foreign, deleted, tombstoned and quarantined
  creatives are excluded. Blank legacy names cannot capture untagged creatives.
- Matrix changes resolve legacy name keys to catalog IDs with real-ID precedence,
  union assignments and array metadata, and recursively preserve compatible
  metadata. Conflicting scalar metadata, action statuses or assignment/exclusion
  membership reject the whole transaction, including any earlier retags.
  Losing catalog notes and source-link provenance are retained on merge.
- Linked creative changes are marked pending for the existing Tracker push
  workflow. The RPC makes no ClickUp, classifier or OneScale requests.
- A same-page confirmation dialog offers explicit keep/source choices and
  suggested merges. Request snapshots are versioned; conflicts preserve choices.
  A verified receipt updates local catalog versions immediately, closing the
  save-then-merge race while shared live reads are paused for the write.
- Persist exact request identity in account/product/kind-scoped session storage
  before sending. An uncertain response disables new writes until the same
  request is retried; server receipts prevent duplicate application after reload.
  Definite rejection releases the pending request without clearing the draft.
- Drafts retain their original edit version across realtime updates. Explicit
  review is required before retrying against a changed version. Externally
  deleted entries retain a read-only draft until discarded, without recreating
  the entry. Ordinary unsent drafts remain component-local, not reload-persistent.

## Batch 2 Verification

- 434 domain/service tests pass. Optimized Next.js build, including TypeScript,
  passes. Request validation and scoped acknowledgement tests cover malformed
  replies, definite/uncertain failures and refusal of production URLs.
- Focused intercepted browser acceptance passes with 12 mocked mutation attempts,
  zero unexpected errors and no external requests:
  `/tmp/immuvi-taxonomy-mutations/results.json`. Covers exact-request create/merge
  replay across reload, stale draft rejection/review, immediate save-to-merge,
  retained deleted-entry drafts, cancellation, conflict, archive/restore/delete,
  pending/busy controls and late responses after a product switch.
- Merge dialog bounds and overflow pass at 320/390/768/1440px; 320px and 1440px
  screenshots inspected. Whole-tab legacy visual parity remains in batch 4.
- Full intercepted command-center regression passes with 190 mocked mutation
  attempts, zero unexpected browser errors and no external requests:
  `/tmp/immuvi-taxonomy-mutations-regression/results.json`. Existing Tracker,
  Matrix, Action Plan, Inspiration, Production, HQ and member/auth checks pass.
- Rollback-only SQL fixtures pass for both axes, dependency cascades, Matrix
  metadata preservation and rollback on conflict, canonical duplicates, replay,
  stale versions, real-ID/name collisions, blank names, product boundaries and
  permissions. These tests do not dispatch remote work.
- Migration `20260924030000_qa_taxonomy_mutations.sql` is installed only in
  `entgcnlfsnysnwyadzzp`. The runner refuses any other linked project. Existing
  catalog records were not rewritten by installation. Recovery receipts are
  RLS-protected and unavailable for direct anonymous/authenticated table reads;
  only authenticated callers can execute the access-checked mutation RPC.
- Read-only installation verification passes for migration history, RPC/helper
  execution grants, receipt-table RLS/direct-read restrictions and absence of the
  temporary test products/user. Re-run with
  `node scripts/check-qa-taxonomy-mutations.mjs --verify`.

## Batch 3 Product And Catalog Controls

- Command HQ now has same-page Add product, Manage field options, Disconnect
  ClickUp and Delete product dialogs, plus access to the existing shared QA
  ClickUp configuration. Controls are absent for members. No new feature route.
- `qa_product_mutate` checks active admin/password state, exact request identity,
  product version and typed destructive confirmation. Creation uses a stable
  request-derived ID and prevents canonical duplicate names through this path.
  Exact recovery requests survive reload; receipts remain after product deletion
  so a lost delete response is recoverable without repeating the cascade.
- Explicit disconnect removes only list/mapping/sync settings. It preserves
  unrelated product configuration and all imported creatives. Non-test list
  destinations and unresolved sending/uncertain/unlinked ClickUp creation outcomes
  block destructive operations. No remote task is changed or deleted.
- Delete preview counts all direct product-FK tables and fingerprints their
  records. Commit locks the product and dependent records, checks that fingerprint
  and rejects a stale preview. Pending/running queue/producer/strategist/research
  work blocks deletion. Product deletion and dependent FK cascades, its admin audit
  record and receipt commit together. This is not the stale-ad cleanup workflow.
- Three field catalogs are stored under the product's `config.field_options`:
  creative structure, hook type and production style. Explicit empty catalogs,
  names/descriptions and order are preserved. Saves reject duplicates, excessive
  lengths/counts and stale versions without replacing unrelated config.
- The catalog feeds HQ coverage and shared Tracker/Inspiration editor suggestions
  (including their reused editors). Existing values remain editable and used values
  remain in coverage even after removing an option. It does not rename existing
  creative values or modify ClickUp's remote dropdown schema.
- 439 domain/service tests and the optimized TypeScript/Next.js build pass.
  Focused browser acceptance passes with 8 mocked writes and zero unexpected
  errors/external calls: `/tmp/immuvi-product-admin/results.json`. Covers recovery,
  stale drafts, product isolation, same-page editor/HQ propagation, cancel, typed
  confirmation, blocked/stale delete previews and member restrictions. Dialog
  bounds/overflow checked at 320/390/768/1440px; screenshots inspected.
- Rollback-only database tests pass for create/replay/name collision, scoped field
  saves/config preservation, unchanged creative values, stale versions, explicit
  unlink, deletion cascade/replay, changed manifests, active work, uncertain
  ClickUp creation and member/password restrictions. Migration `20260924040000`
  is installed only in `entgcnlfsnysnwyadzzp`; installation does not rewrite any
  existing product. Receipts are private and helper functions are not callable
  by anonymous/authenticated clients.
- Read-back verification passes for migration history, execution/table grants,
  receipt RLS and fixture cleanup. Schema inspection found no product-scoped
  table without a product FK except the intentionally retained recovery receipts.
- Full intercepted regression passes with 198 mocked mutation attempts, zero
  unexpected browser errors and no external requests:
  `/tmp/immuvi-product-admin-regression/results.json`. The first run stopped at
  an Action Plan filter check during development; this did not reproduce in the
  complete rerun after app edits stopped. Final 320/1440px screenshots include
  corrected icon sizing and collapsed secondary catalogs.

### Batch 3 Scope (Completed Below)

- Account creation now uses the native QA journal and explicit profile/access
  provisioning described below. The inherited Admin adapter/global environment
  setup has been removed. Access/role and reset/activity/deletion are complete
  through their guarded QA paths.
- Guarded stale-ad cleanup is implemented below, with strict QA snapshots,
  protected local/variation/referenced/recent work, typed confirmation and atomic
  conflict-checked soft-deletion. Legacy taxonomy pruning and quarantine override
  are not enabled; those differences are explicit batch-4 acceptance decisions.
- Worker operations now enforce scoped authorization and safe pause behavior. Worker
  enabling/classifier dispatch remains blocked without an isolated destination.
- Batch 4 remains the existing final parity/acceptance batch, including default
  field descriptions, legacy product-prefix derivation, all field-control entry
  points and compact layout comparison. No extra milestone or finish batch added.

## Not Claimed Complete

- Atomicity covers this converted QA mutation path, not historical partial
  mutations or legacy/service-role writers that can reintroduce old names after
  a commit. No database redirect/tombstone trigger for those writers was added.
- Raw historical classification results and free-form brief prose are not
  rewritten. Matrix conflicts require explicit resolution, not silent overwrites.
- Storage deduplication, contaminated rows, declared ClickUp Product enforcement,
  stale legacy writers and the rest of bugs 35/36 remain open. Read-time filtering
  is not a production data repair.
- Full taxonomy row/toolbar visual parity is part of the mutation/final acceptance
  work; these relationship dialogs restore functionality using the shared React
  dialog rather than executing legacy popup code.
- No production backend, legacy HTML or production API handlers changed. No
  existing user records changed, push or deployment. The rest of batch 3 and the final
  acceptance batch remain, followed by QA/security and approved cutover.

Overall: 6/13 milestones fully closed, 7 open. Four are locally complete with
acceptance gates; milestone 11 is in progress, followed by 12 QA/security and
13 approved cutover.

## Batch 3 User Access And Roles

- User lists use an active-admin/password-gated RPC with 500-row keyset pages;
  products are also paginated. The client no longer reads the owner-privileged
  `profiles_with_products` view; anonymous/authenticated grants on it are removed
  in QA. Failed reads retain the previous snapshot and disable new mutations.
- Product assignments and role changes use `qa_admin_access_mutate`. Target
  access snapshots include role, activity/password state and assignments. Exact
  request identity, target locking, product existence, stale snapshots, duplicate
  products and self-role changes are checked before changes commit with their
  audit and receipt. A different eligible caller must survive every demotion.
- Uncertain acknowledgements retain the exact account-scoped request in session
  storage. Recovery across reload returns the original private receipt without
  reapplying or adding another audit. Pending recovery blocks other Admin-tab
  mutations. Verified receipts update local versions immediately during paused
  reads. Unsent access selections retain their original version across refresh;
  stale selections need explicit review of current assignments before saving.
- Direct client role/identity/activity edits, profile creation/deletion, product
  assignment mutations and audit forging are restricted. Signup role/password
  flags come from server-owned app metadata, never user-owned signup metadata.
  Existing SQL fixtures now use privileged app metadata to seed test accounts.
  Existing production migration files and legacy API implementation are unchanged.
- The QA Next route rejects the four old unversioned access endpoints and refuses
  any explicit non-QA URL. The later account-operation portion below replaces
  reset/activity/deletion and creation, removing the inherited adapter/global
  environment setup. This is not a claim that the entire API/database is hardened.
- The later account portion closes direct self `must_change_password` completion
  with an Auth trigger. Broader legacy RLS/service-role writer gates remain
  milestone 12. Do not deploy this intermediate QA state to production.
- Last recorded sign-in is visible; unrecorded timestamps say so. Temporary
  password inputs are masked. No account credentials are persisted in receipts,
  audit metadata or browser recovery storage by this new access workflow.
- 445 domain/service tests, TypeScript and optimized Next.js build pass. Focused
  intercepted browser acceptance has six mocked mutations, zero unexpected
  errors/external calls, retained stale selections, replay across reload,
  immediate role toggles and self-role/member restrictions. Layout overflow was
  checked at 320/390/768/1440px and screenshots inspected:
  `/tmp/immuvi-admin-access/results.json`.
- Rollback-only SQL tests pass for access/role commits, exact replay, conflict,
  missing/duplicate products, audit-failure rollback, member/password/anonymous
  restrictions, direct-write and signup escalation prevention, preserved personal
  preferences and more than 500 users. Five existing database workflows also
  pass under the new controls: products, taxonomy, Tracker, Action Plan layouts
  and Production intake. No real user's access/password was changed by tests.
- This closes only the access/role part of batch 3. Two fixed batches remain
  unfinished: the rest of administration/cleanup/worker controls, then final
  parity/acceptance. Overall remains 6/13 fully closed, with 7 open.
- Full intercepted regression passes: 81 scenarios, 204 mocked mutation
  attempts, zero unexpected errors and zero external requests. Evidence:
  `/tmp/immuvi-admin-access-regression/results.json`.
- Migration `20260924050000_qa_admin_access.sql` is installed only in
  `entgcnlfsnysnwyadzzp`. Read-back checks pass for migration history, private
  receipt RLS, function/table grants, retired view access and fixture cleanup.
  Installation rewrites no existing user or product record. No push/deployment.
  Recheck with `node scripts/check-qa-admin-access.mjs --verify`.

## Batch 3 Account Operations And History

- Reset, deactivate, reactivate and delete now use a native Node Next.js API
  restricted to the approved QA host and an explicit QA service key. JWT and
  active-admin/password checks precede changes; responses use `no-store`.
  These operations do not mutate process-global environment configuration.
- Private operation journals reserve the exact request before an Auth write.
  Profile access is restricted first and remains fail-closed during uncertainty.
  Only the first reservation can dispatch. Recovery reconciles trusted Auth
  markers, password fingerprints, ban state or account absence; it never blindly
  repeats a reset/delete. Profile confirmation, audit and receipt commit together.
  This is recoverable coordination, not a single Auth/database transaction.
- Definite rejection restores prior flags. Self operations, stale versions,
  pending target/access changes and removal of a pending request's administrator
  are blocked server-side. A different eligible administrator survives each
  operation. Deletion requires the exact email and retains product content.
- Reset credentials are AES-GCM encrypted with request-bound authentication.
  Plaintext is never stored in browser recovery data or audit records. Recovery
  returns the original credential only while its password fingerprint and reset
  requirement still match. After a real password change, obsolete credentials
  are suppressed. `QA_ACCOUNT_ENCRYPTION_KEY` can provide a stable server-only
  encryption key; otherwise the QA service key is used. Preserve the original
  encryption key when rotating credentials if old resets still need recovery.
- The forced-password form updates Auth and confirms the backend-cleared flag.
  Direct client changes to that flag are blocked. Shared QA `is_admin` and
  `has_product` checks require password completion. Future Auth sign-in timestamp
  updates populate last login; historical user rows are not rewritten.
- Admin-tab recovery survives reload without storing passwords. A typed delete
  dialog preserves stale/cancelled drafts. Account activity uses guarded 50-row
  keyset pages, text-only whitelisted fields, live refresh and Load earlier.
  The command center stays at `/`; no separate account page or legacy HTML embed.
- A crash after reservation but before dispatch, or an Auth result that cannot
  be proved, can leave a restricted pending account. This requires operator
  reconciliation; the UI does not offer an unsafe resend or silently report
  success. Cross-system crash recovery is not claimed complete for every outcome.

### Verification

- 452 domain/service tests and optimized Next.js/TypeScript build pass. Tests
  include encryption binding, lost Auth/local acknowledgements, no second Auth
  write on replay, definite rejection, credential suppression, malformed replies,
  fixed-QA routing, JWT/profile gates and no-store responses.
- Focused intercepted browser acceptance passes: ten mocked mutations, no
  unexpected errors/external calls, reload recovery, self guards, stale typed
  deletion, audit pagination and 320/390/768/1440px dialog bounds. Desktop/mobile
  screenshots were inspected. Evidence: `/tmp/immuvi-account-operations/results.json`.
- Full intercepted regression passes: 82 scenarios, 213 mocked mutations, zero
  unexpected errors/external calls:
  `/tmp/immuvi-account-operations-regression/results.json`. The configured preview
  also passes focused browser verification at port 3001:
  `/tmp/immuvi-account-operations-configured/results.json`.
- Rollback-only account SQL and six previous database workflows pass. Coverage
  includes target/actor guards, revision/replay identity, audit-failure rollback,
  direct flag bypass, real password hash changes, sign-in timestamps, ban/unban,
  deletion cascades, preserved products, pagination and execution permissions.
- Migration `20260925010000_qa_account_operations.sql` is installed only in
  `entgcnlfsnysnwyadzzp`; history, permissions/RLS and fixture cleanup pass read-back.
  Recheck with `node scripts/check-qa-account-operations.mjs --verify`.
- Live QA Auth acceptance through the Next API passes: reset and exact replay,
  temporary sign-in, forced password change, obsolete credential suppression,
  deactivate/banned login/reactivate, deletion and replay, one audit per operation.
  Two random disposable users and their journals/audit rows were removed.
  Existing users were not modified. Rerun explicitly with
  `node --env-file=.env.local scripts/check-qa-account-auth.mjs --run --cli-key --base-url http://127.0.0.1:3001/`.
- Separate configured preview is running at `http://127.0.0.1:3001/`; the prior
  server was left alone. `scripts/start-qa-dev.mjs` refuses non-QA branches/projects,
  finds a free loopback port and holds the QA key in process memory only. Its
  optional isolated build directory does not change the default Next build path.
  No production backend/legacy HTML/production API changes, push or deployment.

This completes reset/activity/deletion/password-completion/history, not all of
batch 3. The creation portion below leaves stale-ad cleanup and guarded worker controls;
then fixed batch 4 parity/acceptance. Worker enabling remains blocked without an
isolated classifier. Overall remains 6/13 closed and 7 open.

## Batch 3 Recoverable Account Creation

- The QA Admin API no longer imports the production legacy handler or changes
  process-global Supabase variables. Creation uses explicit QA clients with the
  same authenticated active-administrator/password gate and `no-store` responses.
  The production `api/admin/[op].js` implementation is unchanged.
- A private journal reserves a server-chosen Auth UUID, email, exact request,
  encrypted password and send token before any Auth write. Only its first caller
  can send. Replays reconcile that UUID plus its trusted creation marker and
  verified email/password state, without creating or resetting another account.
  Duplicate existing emails/usernames and competing pending requests are rejected
  before dispatch. Reserved usernames cannot be claimed by another profile.
  Missing/duplicate products and malformed requests are also rejected.
- Hosted Auth installs app metadata after its initial INSERT trigger. Reserved
  UUIDs therefore create inactive member profiles with password change required,
  independent of metadata timing. Role, names, creator, product assignments,
  activation, password requirement, audit and receipt then commit together. An
  audit failure rolls all those local changes back, leaving access restricted.
- Pending creation blocks changes/deletion of its target or owning administrator
  and deletion of reserved products. Guards cover existing access/role and account
  operations. Completed creation no longer blocks normal administration. This
  coordination is not one transaction spanning Auth and Postgres.
- Custom passwords remain supported, without trimming their contents; blank input
  generates a random password. Validation requires 8-72 UTF-8 bytes. Recovery
  storage excludes plaintext, and custom-password identity uses a keyed digest.
  The encrypted original can be recovered after reload; it is not returned after
  password change, deactivation or deletion. No invite/confirmation email is sent.
- The same-page form retains drafts on definite rejection, locks while recovery
  is pending and uses a fresh session token. Recovery reports verified completion
  before clearing the form. It cannot create another request while one is pending.
- An interrupted reservation before dispatch or unprovable Auth outcome still
  requires operator reconciliation. There is deliberately no blind resend,
  reassignment to another administrator or automatic destructive compensation.
  Preserve the original encryption key for outstanding credential recovery.

### Creation Verification

- 457 domain/service tests and optimized Next.js/TypeScript build pass. New tests
  cover validation, custom/generated secrets, encrypted journal inputs, lost Auth
  and local responses, original-credential replay, definite rejection, uncertainty,
  malformed acknowledgement and production-host refusal.
- Focused browser acceptance passes with six mocked mutation attempts and no
  unexpected errors/external calls. Covers reload recovery with no stored password,
  one Auth create, duplicate-email draft retention, custom/generated passwords,
  member/admin assignments, member UI isolation and 320/390/768/1440px bounds.
  Evidence: `/tmp/immuvi-account-creation/results.json`; screenshots inspected.
- Full intercepted regression passes 83 scenarios and 219 mocked mutation
  attempts, zero unexpected errors or external requests:
  `/tmp/immuvi-account-creation-regression/results.json`.
- Rollback-only SQL tests cover permission boundaries, missing/duplicate pending
  identities, email/product reservations, pending actor/target guards, absent/wrong
  Auth markers, audit rollback, atomic assignment/profile completion, exact replay,
  custom-password identity, definite rejection and old/deleted credential suppression.
  Seven prior database workflows pass under the new guards.
- Migration `20260925020000_qa_account_creation.sql` is installed only in
  `entgcnlfsnysnwyadzzp`; permission/history/RLS and fixture cleanup checks pass.
  Recheck using `node scripts/check-qa-account-creation.mjs --verify`.
- Real QA Auth acceptance passes through the local Next API for member/custom and
  admin/generated creation, replay, duplicate email/username, forced password change,
  product and admin authorization before/after completion, obsolete password
  suppression and one audit per creation. The disposable administrator, two new
  accounts, product, journals and audit fixtures were removed. Existing users
  and products were not changed. Explicit rerun:
  `node --env-file=.env.local scripts/check-qa-account-creation-auth.mjs --run --cli-key --base-url http://127.0.0.1:3001/`.

The subsequent stale-ad portion below leaves worker controls, then existing batch
4 final parity/acceptance. Two fixed batches remain unfinished; 6/13 milestones
are closed, 7 open. No push, deployment or production changes.

## Batch 3 Guarded Stale-Ad Cleanup

- Command HQ has a same-page Clean stale ads dialog for administrators. Preview
  shows candidate names/IDs, current remote count and protected-row counts. An
  exact typed product name is required; Cancel performs no cleanup. No new page.
- The dedicated QA API verifies the JWT and current active-admin/password state
  and uses an explicit QA service key. Only service-role RPCs can record trusted
  remote snapshots or commit cleanup; browser callers cannot supply task-ID lists
  directly to the database. Preview/receipt tables have RLS and no client grants.
- Remote inspection is restricted to list `901616718146`. Fetches include closed
  tasks, subtasks and both archived states, require explicit pagination completion
  and reject repeated page identities, foreign-list tasks and failed pages.
  Empty snapshots, counts below half the last sync, more than 500 candidates,
  products over 5000 ads, active queued/running work and deletion above 80 percent
  of active local creatives block the operation. These checks have no override.
- Only explicit ClickUp imports with a recorded source list and an unambiguous
  remote identity can qualify. Preserve current-list tasks, local/New Find work,
  variations and their parents, winners/files, variation briefs/queues, pending
  edits, app-created markers, quarantined records, undated records and rows created
  or updated within five minutes. Product-owned JSON references, including object
  keys and Matrix composite keys, are checked conservatively. Extra matches keep
  work rather than deleting it. Existing tombstones are not rewritten.
- Preview stores its actor/product/version, exact remote IDs, full product-FK
  manifest and candidate/protection snapshot for ten minutes. Commit re-fetches
  ClickUp, verifies the exact preview and request, locks product-owned records and
  rejects changed local work, settings, references or remote membership. Winner
  and variation-artifact tables lack product FKs, so short database-only shared
  table locks protect their reference checks. No lock spans a ClickUp request.
- Candidate soft-deletion, tombstones, audit and receipt commit in one transaction.
  Failures roll all of them back. Recovery first checks the original receipt and
  can confirm a completed operation without a ClickUp key or another remote read.
  A pending confirmation survives reload without storing credentials. A definitive
  conflict clears the pending request and requires a new preview; uncertain
  responses retain the exact identity. Switching products cannot commit a late
  response into the newly selected UI.
- No ClickUp task is changed/deleted and no worker/OneScale dispatch occurs.
  Taxonomy is retained, and quarantine does not override user-work protections.
  The legacy tool's automatic taxonomy pruning and quarantine deletion are not
  claimed migrated by this safer flow. Decide those differences in existing batch
  4; do not count this as production data repair or silently delete taxonomy.
- Remote APIs cannot provide a transaction spanning ClickUp and Postgres. Changes
  after the final remote read and historical writers that bypass the QA locking
  paths remain integration/release risks. A persistently unreachable remote source
  may require operator reconciliation of an unconfirmed request. Preview retention
  and realistic live ClickUp acceptance remain operational QA gates.

### Cleanup Verification

- 464 domain/service tests and optimized Next.js/TypeScript build pass. Coverage
  includes strict active/archived pagination, empty/foreign/failed snapshots,
  missing configuration, admin/member/password isolation, production-host refusal,
  fresh reads before commit, exact receipt verification and lost-ack recovery.
- Focused intercepted browser acceptance passes with three mocked commit attempts,
  no unexpected errors or external requests: empty-snapshot denial, typed
  confirmation, cancellation, concurrent-reference rejection, original-request
  recovery across reload, retained taxonomy/references, member restrictions and
  dialog bounds at 320/390/768/1440px. Screenshots inspected:
  `/tmp/immuvi-stale-cleanup/results.json`.
- Full intercepted regression passes 84 scenarios and 222 mocked mutation
  attempts, with no unexpected browser errors or external requests:
  `/tmp/immuvi-stale-cleanup-regression/results.json`.
- Rollback-only QA SQL verifies protected categories, empty/low/high-risk counts,
  foreign lists, actor restrictions, new local references and winner artifacts,
  remote changes, expiry, typed confirmation, audit-failure rollback, atomic
  tombstones, one audit/receipt on replay and service-only execution. Five earlier
  database workflows pass with this migration. All SQL fixture changes rolled back.
- Migration `20260925030000_qa_stale_ad_cleanup.sql` is installed only in the
  approved QA project. It did not run cleanup or rewrite any existing creative.
  Installation/history/RLS/grants/fixture cleanup passed read-back verification;
  recheck using
  `node scripts/check-qa-stale-ad-cleanup.mjs --verify`.
- No live ClickUp-backed deletion of existing QA records was executed. Mocked
  HTTP/browser checks and real rollback-only database checks are distinct from
  live integration acceptance. Production HTML/API/data and deployed services are
  untouched; no push or deployment. Preview remains at `http://127.0.0.1:3001/`.

The worker-control portion below completes batch 3. Fixed batch 4 still includes
the cleanup parity differences above.

## Batch 3 Worker Controls

- The shared React worker pool lives in Admin and the existing Inspiration Queue
  view at `/`. No new page or legacy HTML bridge. Members keep read-only presence;
  only active, password-cleared administrators can access the control RPCs.
- Admin worker reads are keyset-paginated in 200-row pages, verified before
  replacing the view and refreshed by realtime, focus/online and 30-second
  polling. Failed refreshes retain the prior view and disable new pause actions.
  Heartbeat age updates independently every 15 seconds. The view includes host,
  reported status, current/last job, totals, capabilities and classifier contract.
- Confirmed Pause changes only `enabled=false`. It preserves reported status,
  current job and queues. A control revision changes with enablement, not every
  heartbeat. Concurrent control changes and deleted/replaced identities reject
  new stale requests. A private receipt and admin audit entry commit atomically;
  an audit failure rolls the pause back.
- Account-scoped session recovery retains the original request on uncertain
  responses. It works after reload, between Admin and Inspiration, and when the
  original worker row has disappeared. Receipt replay never pauses a replacement
  row or adds another audit. The shared write coordinator blocks overlapping
  in-page mutations. Recovery data contains no credentials.
- The QA registry now defaults new workers to disabled. A database trigger blocks
  enabled insertion and re-enabling, including ordinary service-role writes.
  Anonymous registry access and direct authenticated registry writes are revoked;
  verified active accounts retain read-only presence. Existing worker flags are
  not rewritten. The registry was empty before this installation.

### Worker Verification And Limits

- 468 domain/service tests and the optimized Next.js/TypeScript build pass.
  New tests cover bounded request identities, forbidden enable fields, production
  refusal, exact acknowledgements, error classification and pagination failures.
- Rollback-only QA SQL covers multi-page reads, admin/member/inactive/password/
  anonymous gates, direct-write denial, blocked enabling, heartbeat-only updates,
  stale/replaced workers, exact replay, one audit, preserved in-flight state and
  synthetic audit rollback. Five prior database workflows pass unchanged.
- Focused intercepted browser acceptance passes four mocked mutation attempts:
  cancel, disabled Resume, heartbeat during confirmation, lost acknowledgement,
  deleted-worker recovery in the other tab after reload, stale rejection,
  failed-read retention/retry, member restriction and 320/390/768/1440px bounds.
  Desktop/mobile screenshots inspected in `/tmp/immuvi-worker-controls/`;
  machine-readable results: `/tmp/immuvi-worker-controls/results.json`.
- Full intercepted regression passes 85 scenarios and 226 mocked mutation
  attempts, with no unexpected browser errors or external calls:
  `/tmp/immuvi-worker-controls-regression/results.json`.
- Migration `20260925040000_qa_worker_controls.sql` is installed only in the
  approved QA project; history, permissions and fixture cleanup passed read-back
  verification with `node scripts/check-qa-worker-controls.mjs --verify`.
  No existing worker was started, resumed or paused. Production
  HTML/API/data, worker scripts and deployed services remain untouched. No push.
- A pause flag is cooperative, not an emergency stop. The existing Python worker
  can fail open when its enablement read fails; in-flight jobs and other legacy
  paths may continue. No worker was launched to test acknowledgement because no
  isolated destination exists. Service owners can bypass triggers, so these
  controls are not a substitute for external credential/network isolation.
- Resume, live classifier/OneScale execution and worker lifecycle acceptance
  remain external gates. The read-only member presence view retains its earlier
  loading path; full layout/entry-point parity belongs to the fixed final batch.

All four local milestone-11 batches are complete. Compact layouts, field
descriptions, product-prefix parity and rename impact/provenance are verified.
Cleanup differences, user sign-off and live integration gates remain open.
Overall remains 6/13 closed and 7 open pending
acceptance/integration gates; no new finish batch has been added.
