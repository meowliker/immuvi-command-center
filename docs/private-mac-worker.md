# Personal Mac Worker

This is a persistent, private worker, not a temporary test process. It starts at
macOS login and launchd restarts it after failure. Closing the app or terminal
does not stop it. The Mac must remain logged in, awake, and connected to the
internet. Sleep pauses availability; it does not keep the machine awake for you.

## Current Pairing

- Environment: QA Supabase `entgcnlfsnysnwyadzzp` only.
- Owner: `likermeow`, auth ID `4a1fddd5-a422-4c7a-9bf3-e87185610fc4`.
- Device: `1a26b623-bcd7-4db1-8e53-ca3996352f55`.
- Name: **Anay's Mac**. The compact worker panel shows online state, Codex and
  Claude availability, and Pause/Resume. Claude is not installed on this Mac.
- Agent: `com.immuvi.personal-worker.qa`.
- Runtime: `scripts/private-worker.mjs` in this repository. Keep the checkout and
  its Node dependencies in place; the installer can update its path after a move.
- Private settings and log: `~/Library/Application Support/Immuvi/Workers/qa-personal/`.
- Settings are mode 0600, enclosing directory 0700. Never share `device.json`.

## Access Boundary

The worker uses a random device credential, stored only as a hash in QA, plus a
public Supabase key. It does not hold a Supabase service-role key. Enrollment is
the only step that uses an administrator credential.

Authenticated enqueue binds requester identity from `auth.uid()` and selects
only that account's healthy private device. No user-supplied owner ID is trusted.
Other users, including other app admins, cannot list, pause, resume or send jobs
to this device. Claims check both the owner and assigned device again. Legacy,
unassigned and shared Auto jobs are never consumed. No inbound port or remote
desktop/shell service is opened.

Upload permission is limited to the claimed run, current lease, expected PNG
filenames and QA output bucket. Finalization is idempotent. Interrupted paid
generation is failed for review, never automatically replayed. Pausing stops new
claims; in-flight work can finish. Disabling the owner invalidates its device.

This is an app-level ownership boundary, not protection from the Mac's OS
administrator, the Supabase project administrator or someone using your login.
Generated results remain subject to normal product-sharing permissions.

## Controls

Inspiration queue: **My private workers** provides owner-only Pause/Resume.
Action Plan > Generate Ad Images uses **My private worker** automatically.

From this repository:

```sh
node scripts/install-private-worker.mjs --status
node scripts/install-private-worker.mjs --stop
node scripts/install-private-worker.mjs --start
```

`--stop` unloads just this agent until manually started or the next macOS login.
Use the in-app Pause switch to keep it paused across logins. Reinstalling with
`--owner=likermeow` preserves its pairing and pause setting. To revoke a lost
device, delete its `qa_private_workers` row through an authorized administrator;
the token immediately stops working. Never delete/reassign the production worker.

## Inspiration And Briefs

In Inspiration, **Add to Queue** saves the public ad URL and automatically submits
that saved inspiration to the owner's private worker. Its display moves from
Queued to Classifying, then Classified after verified brief delivery. **Process
All with Codex** remains available for existing undispatched rows and retries.
Offline/paused workers or missing ClickUp access leave the saved row Blocked,
with a retry notice; they are not mislabeled Ready or falsely acknowledged Queued.
Manual inspiration creation and ordinary field edits do not trigger classification.
Public Google Drive video file links are supported alongside social ad URLs.
The app and worker share the same URL validation: Drive `/file/d/...`, `open?id=`,
`uc?id=` and download links go through the unchanged legacy generic `yt-dlp`
pipeline, followed by frame extraction, transcription and the same brief prompts.
Drive folders and Google Docs are not video sources. Files must be viewable and
downloadable without signing in; the worker never borrows personal Google cookies
or changes file-sharing permissions. Retry an existing blocked row with **Process
All with Codex** rather than adding the source again.
Only inspirations created by the signed-in owner can enter that owner's private
queue. The linked list must be `1301130000002447`. The app verifies the existing
session's ClickUp key and encrypts it with this device's RSA public key; only
the worker has the private key. The AI process never receives either key.

The media pipeline, classification instructions, worker's content requirements,
JSON field shape and eight-section page template are extracted directly from
`team-skill/SKILL.md` and `team-skill/classify_worker.py`. Legacy production writes,
shared queues, auto-update and production-library operations are excluded. The media
adapter isolates HOME, preventing personal-browser cookie access, and records
the factual media kind omitted by the old script. It also supplies nominal frame
sample times; inferred caption transitions must be labeled approximate. Media
metadata is retained with the frames for diagnosis rather than forcing another
download. It uses the legacy `base` Whisper language detector and, when language
confidence is sufficient, the `small` decoder with that detected language fixed.
Otherwise it retains the base model's automatic transcription. Segment times are
checked against the actual decoded audio duration. Language scores are retained;
no language is hard-coded from the product name or market. Codex executes the legacy content instructions; identical prompts
do not guarantee identical generated wording across models or runs.

Generated results are checkpointed in QA. Delivery now follows legacy's library
pattern: a workspace-visible product Inspiration Library, one page per inspiration,
and a Master Tracker. The ClickUp connector provisions the library; the private
worker uses the owner's encrypted app key to create or update pages. It does not
receive connector credentials. The server checks access before queueing work.

For this test product, `qa_brief_visibility=PUBLIC`, `qa_brief_doc_id=8cq1r3y-44896`
and `qa_brief_tracker_page_id=8cq1r3y-118036`. The library is attached only to
list `1301130000002447`; legacy `config.doc_id` and its production folder are never
inherited. Provisioning another destination is an explicit setup step, not an
automatic fallback to another account or broader sharing after a permission error.
The API's returned `public` flag was false even for this PUBLIC creation request;
authorization is verified through the actual owner's access plus exact workspace,
list parent and document identity, not that flag alone.

Brief pages are named `test immuvi brief-N`. Page receipts and name matching let
retries update the existing page rather than create duplicates. The worker reads
the saved page back and compares parsed Markdown, preserving content and structure
while accepting ClickUp's formatting normalization. It then updates the tracker
and marks the inspiration Classified. Action Plan creation remains separate.
Numbers increase and may have gaps; they are never reassigned to another brief.

**Process All with Codex** resumes failed delivery from its saved result and number,
re-encrypting the owner's current app key for the same private worker. It does not
regenerate an approved brief. An uncertain creation can only resume when the library
listing identifies the existing page unambiguously. Missing or conflicting receipts,
changed sources/destinations and ambiguous matches stop for review, never blind
recreation. Older standalone-Doc jobs retain their stricter recovery guards.
Workspace visibility does not change the Mac's owner-only access boundary.

## Enabled And Pending

Enabled: private native image queue, capability probe, owner-only registration,
heartbeat, leases, upload and completion. Requires the local signed-in Codex CLI.
The service is independent of the Next.js server and can work when that server
is deployed elsewhere.

Enabled in code: private inspiration classification, legacy-format briefs and
ClickUp library delivery. Earlier standalone private-Doc creation returned HTTP
403; delivery now reuses a connector-provisioned QA library, as legacy does.
The QA sample's missing production settings were restored from
the legacy product: `Astro Rekha`, offer `50% OFF`, blank market and aliases.
This is copied QA reference configuration, not independent confirmation of a
currently advertised production offer. No production configuration was changed.
Image delivery currently remains QA Supabase storage, not ClickUp attachments.
These are separate implementation gates; worker installation does not complete
them. No legacy production queue is enabled to bypass those gates.

## Production Reuse

The same Mac and private-worker model can be retained after production rollout.
Current enrollment intentionally refuses production. Before switching, install
the reviewed private-worker schema there, pair the correct production auth ID
(it may differ from QA), issue a new device credential, and explicitly activate
the production environment. Keep separate configuration, service label and logs;
do not copy QA IDs, keys, queues or fixtures into production. Until that explicit
cutover, this Mac can only run QA jobs.

## Verification

- September 29 Drive repair: the former social-only URL allowlist rejected
  `QAA-INS-003` before enqueue. With the shared validator fixed, its actual public
  Drive video passed the isolated legacy pipeline: 15 seconds, five frames and
  a nonempty `whisper:small` transcript. URL tests cover supported file forms,
  malformed IDs, folders, Docs, duplicate query IDs, credentials and spoofed hosts.
- The live Drive run exposed a ClickUp formatting issue: a thematic break directly
  after a paragraph was imported as a setext heading. Upload preparation now pads
  parsed top-level separator tokens with blank lines, preserving code, reference
  definitions and all content. Both the preparation and saved-page checks still
  require identical rendered content; changed words, links or structure fail.
- The owner retried delivery of saved job `cd92189f-70a6-4b76-ab79-53f65d5fc807`.
  It completed at `2026-09-29T09:31:16Z`, error cleared, and `QAA-INS-003` became
  `Classified` (Festive Compatibility Teaser). Existing page `8cq1r3y-118256`,
  `test immuvi brief-22`, was reused without regenerating or creating a duplicate.
  Independent ClickUp readback confirmed matching content and its Master Tracker
  entry. The classifier retained the explicit narration uncertainty rather than
  treating the raw transcript as verified speech. Regression: 663 tests and
  TypeScript checks passed.
- SQL fixtures verify owner access, other-admin denial, credential isolation,
  claim ownership, leases, paused/offline behavior, interrupted-run handling,
  scoped uploads and idempotent publication. Transactions roll back.
- `scripts/check-qa-private-worker-api.mjs` tests actual authenticated/anonymous
  HTTP and storage permissions with disposable QA records; no AI/ClickUp calls.
- Unit tests cover configuration boundaries, runtime owner checks and retries.
- `scripts/check-qa-private-inspiration.mjs` verifies private queue and delivery
  boundaries in rollback-only QA transactions; `--apply` installs its migration.
- The authorized ad `2199245117340297` downloaded as a 17-second video with six
  frames and successful `whisper:base` transcription on September 28, 2026.
- A retained-evidence recheck with `whisper:small`, nominal frame timings and
  restored QA production settings generated all eight sections and three scripts.
  The model interpreted the transcript as devotional lyrics (`No voice over`),
  not advertising narration; this was an inference from transcription and frames,
  not a human listening review. Inferred caption ranges are explicitly approximate.
- The revised real result passed local validation and `qa_inspiration_import_data`
  in a read-only QA rollback transaction. Legacy list/object brief sections are
  normalized to text for the QA importer without changing the page Markdown.
  No Doc or result row was written by that diagnostic.
- Latest regression run: 647 tests passed; TypeScript checks passed.
- September 29 delivery recovery: job `eaa477cf-0f42-4009-9e5d-5684f28f5d6b`
  retains brief number 10 and its generated result. Its recorded create-Doc 403
  was eligible for delivery-only retry. The old handler discarded the response
  body, so the exact ClickUp permission/plan cause is not confirmed. Legacy uses
  workspace-visible Docs while QA requested private Docs. The user subsequently
  authorized the legacy library method; no production Doc permissions changed.
- `scripts/check-qa-private-brief-recovery.mjs` checks recovery ownership, unchanged
  source/destination, idempotent enqueue, preserved result/number and rejection of
  ambiguous writes using rollback-only QA fixtures. `--apply` installs the migration.
- September 29 repair: the third run used small-model automatic language detection
  and misidentified the Hindi clip as Sanskrit; its transcript ended at 23 seconds
  for a 17.02-second file. The earlier successful diagnostic had forced Hindi.
  The shared worker adapter now resolves Hindi from legacy base-detector scores
  automatically, with validated segment times, using the same path as diagnostics.
- Legacy narration uncertainty behavior is restored: unknown narration stays
  blank with an explanation and an empty narration timeline. Verified visual
  content can still support the complete eight-section brief. Unknown audio is
  never relabeled `No voice over` merely to pass validation. Explicit model
  failures, missing visual evidence, and incomplete briefs are still rejected.
- Inspiration errors are available from a clickable Failed/Blocked badge in an
  anchored native popover, not duplicated in Format Name or a title tooltip.
- The September 29 retained-evidence run used the shared adapter without a manual
  language override and passed classification/brief validation with three scripts.
  Narration remained explicitly unverified/blank; the complete brief used visible
  captions. This diagnostic made no ClickUp writes and does not prove live delivery.
- LaunchAgent startup and native capability are checked separately from actual
  image generation; do not treat a capability probe as a completed creative.
- September 29 live library delivery: the owner's app key created and then safely
  updated page `8cq1r3y-118056` in the QA library. The saved Markdown renders
  identically to the approved result, including all eight sections and three
  scripts. ClickUp page updates return an empty HTTP 200 body; this is accepted
  without skipping the brief readback verification.
- Job `eaa477cf-0f42-4009-9e5d-5684f28f5d6b` finished `done` at
  `2026-09-29T07:12:40Z`, with `error=null`. Inspiration `QAA-INS-001` is
  `Classified`, its format is `Devotional Marriage Listicle`, and its brief link is
  <https://app.clickup.com/9016762494/docs/8cq1r3y-44896/8cq1r3y-118056>.
  The app visibly shows Classified 1, Failed 0, and the linked brief. A separate
  connector read confirmed the Master Tracker row and exactly one brief page.
  Recovery reused the approved result and the same page; no AI regeneration or
  production write was performed.
- `scripts/check-qa-inspiration-library.mjs --test-applied` passed rollback-only
  checks for scoped library delivery, private ownership, receipt recovery,
  tracker rows, and successful publication clearing the old failure.
- `npm audit` reports one pre-existing moderate transitive advisory in
  `baseline-browser-mapping`; none in the added `marked` dependency. Unrelated
  package upgrades are not included in this repair.
- September 29 intake repair: creation and private dispatch now share the same
  request identity, so retrying an uncertain save cannot create another job.
  A dispatch failure never asks the user to add the URL again. The existing
  `QAA-INS-002` was dispatched through the shared service and verified running
  on Anay's Mac as job `1b642f1b-4ac1-459b-b1a7-166cf6227f1d`; the app visibly
  showed Classifying. Automatic intake, acknowledgement validation, offline/key
  failures, retry identity, and manual/edit exclusions are covered by tests.
