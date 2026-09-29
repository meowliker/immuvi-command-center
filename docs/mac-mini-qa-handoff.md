# Mac Mini Worker Handoff

## What Is Being Connected

The legacy architecture is:

`App -> Supabase queue -> Mac mini worker -> Supabase results + ClickUp library`

The Mac mini polls Supabase and reports heartbeats. The app does not send work
directly to the mini's IP address or SSH port. Localhost on the MacBook therefore
does not need to be exposed to the mini. SSH or Screen Sharing is optional for
administration, not a requirement for job processing.

The current QA app dispatches to owner-only private workers. Installing another
private worker on the mini would not reproduce the legacy shared-worker model.
Shared dispatch, worker selection and authorization need implementation and
verification alongside the Mac mini service. Do not mark setup complete merely
because a process is running or its heartbeat appears.

## Steps For Anay

1. Open Codex on the Mac mini under the macOS account that normally runs the
   legacy worker. Open its existing Immuvi repository for inspection. Do not
   reinstall, stop or reconfigure the running legacy service.
2. Give Codex the prompt below. It should inspect the actual installed worker,
   since the Mac mini's deployed version may differ from this repository.
3. Clone the published `qa` branch into a separate directory on the mini:

   ```sh
   mkdir -p "$HOME/CascadeProjects"
   git clone --branch qa --single-branch https://github.com/meowliker/immuvi-command-center.git "$HOME/CascadeProjects/immuvi-command-center-qa"
   ```

   If that destination already exists, stop and ask Codex to inspect it; do not
   delete or overwrite it. Open the new directory in Codex and check
   `git branch --show-current` and `git log -1 --oneline` against the handoff
   commit reported in the MacBook chat. Do not transfer `.env*`, `device.json`,
   credentials, browser profiles, logs, `node_modules`, `.next`, or personal
   Codex/Claude configuration directories. Dependencies are installed locally.
4. Complete any required provider sign-in or QA administrator authorization
   directly on the mini. Do not paste API keys or service credentials into chat.
   The mini should use its own authenticated tools, not Anay's Mac device token.
5. Let Codex implement and validate the shared QA integration in that separate
   checkout. The same app changes must then reach the checkout/deployment that
   you actually open on the MacBook; edits only on the mini cannot update an
   unrelated localhost server. Transfer reviewed changes without overwriting
   newer work on either machine.
6. In the updated app, select the shared QA Mac mini and test an authorized source
   in AstroRekha - QA Sample. Confirm Queued -> Classifying -> Classified, the
   saved brief, the ClickUp link and the Master Tracker entry. Test retry and
   priority without duplicating a brief. Test access from a second permitted
   account while confirming that Anay's Mac remains inaccessible to it.
7. Keep the mini awake, online and logged into its worker account. A LaunchAgent
   starts at that account's login, not before login. Production activation is a
   later, separately authorized step after QA sign-off.

## Prompt For Codex On The Mac Mini

```text
Connect this Mac mini to our new Immuvi app as a persistent shared worker using
the legacy app's Supabase polling architecture and the same media pipeline,
classification instructions, brief templates and ClickUp library/page method.
Implement the complete integration where the required current source and access
are available; do not merely describe an installation or register a heartbeat.

First inspect this machine read-only. Find the actual legacy checkout, running
LaunchAgent, worker entry point, configuration paths, Python environment,
Codex/Claude availability and login state, enabled job types, concurrency and
auto-update behavior. Report non-secret metadata only. Never print tokens,
environment-file contents, private keys, authentication stores or credential-
bearing process arguments. Compare installed code with repository code before
assuming they match.

Preserve the running legacy production service, configuration, skill directories
and database. Do not run team-skill/setup-mac-worker.sh unchanged: the repository
version uses com.immuvi.classify-worker and pkill -f classify_worker.py. Do not
run the production curl installer, globally kill worker processes, overwrite
~/.classify-inspiration.env, or repoint the production worker to QA.

Use a separate current QA checkout, not the live legacy checkout. Clone branch
qa from https://github.com/meowliker/immuvi-command-center.git and verify the
handoff commit provided by the user. Preserve any existing local changes; never
reset or overwrite a checkout to force a match. If the handoff files or commit
are missing, stop installation and request the correct version. Do not copy
the MacBook's private device.json, auth stores or secrets onto this mini.

QA Supabase project: entgcnlfsnysnwyadzzp.
Production Supabase project: hdniumnkprkadlrrataz. Do not write to it.
QA product: qa-sample-astrorekha (AstroRekha - QA Sample).
Approved ClickUp test list: 1301130000002447.
ClickUp workspace: 9016762494.
QA Inspiration Library Doc: 8cq1r3y-44896.
QA Master Tracker page: 8cq1r3y-118036.
Brief naming: test immuvi brief-N, preserving existing numbering and receipts.
Verify these configured identities and permissions before any external write.

Read team-skill/SKILL.md and team-skill/classify_worker.py, plus the installed
legacy worker. Review docs/private-mac-worker.md, docs/repairs/
2026-09-29-brief-validation-parity.md and docs/repairs/
2026-09-29-private-queue-controls.md in the current QA source. Older audit docs
contain historical disabled-workflow statements; verify against current code.

The new QA app currently supports owner-only private dispatch. Add a separate,
explicit shared QA worker path for this mini and authorized product users.
Do not convert Anay's Mac to shared, weaken its owner checks, or silently bypass
QA isolation. Preserve its private queue, requeue, priority and two-slot behavior.
Shared and private jobs must have unambiguous destinations and must never both
process the same job. Implement app worker selection and database authorization;
do not assume installing a worker alone enables shared routing.

Reuse the legacy execution and content behavior, with the smallest audited
adaptation necessary for isolated QA configuration. Inventory inspiration,
variation briefs, strategist and producer support separately. Do not claim a
workflow works based solely on another workflow's successful test. Do not enable
ad launches or unrelated paid jobs as a setup side effect. Preserve real source
evidence and narration uncertainty; do not invent evidence or suppress genuine
failures to obtain Classified status. Identical prompts do not guarantee identical
wording between AI models or runs.

Install a distinct service, suggested label com.immuvi.classify-worker.qa and
display name Mac mini - QA, after checking for conflicts. Give it separate
configuration, identity, environment, runtime/skill paths and logs. Scope stop,
start and restart commands to that exact service. Audit subprocess HOME/config
inheritance and hard-coded Supabase/ClickUp destinations, not just SUPABASE_URL.
Prevent QA auto-update from downloading production settings or overwriting
production skill files. Use separate dependencies so QA setup cannot break the
running legacy installation. Prefer narrowly scoped worker credentials; if the
legacy runtime requires a broad QA credential, explain its scope and obtain the
appropriate administrator approval before enrollment. Never put it in the client.

Retain atomic claims, leases, heartbeats, pause/resume, bounded concurrency,
owner/product authorization and retry idempotency. Apply priority to waiting jobs
without interrupting active work. Reuse saved results and known ClickUp receipts
on retries. Serialize shared-library tracker updates to prevent lost entries.
Choose concurrency after inspecting the mini's existing production load; do
not copy the legacy classifier/producer limits without checking available capacity.

Test isolated fixtures first, then one user-authorized QA source end to end.
Verify classification fields, the full eight-section brief and three scripts,
ClickUp saved-page readback, Master Tracker entry, app status, retry without
duplicates, queue priority, bounded concurrency and second-user authorization.
Verify a second user cannot see, control or dispatch to Anay's Mac. Confirm the
legacy production service remains healthy and unchanged. Never fabricate success
or manually mark a failed item Classified to hide a delivery problem.

Ensure app-side changes are delivered to the checkout/deployment the user is
actually using; report any required coordinated update instead of claiming remote
localhost code changed automatically. Finish with worker name, service label,
configuration/log paths (no contents), verified workflows, remaining blockers,
QA-only changes, and exact service-specific status/pause/start/stop/rollback
commands. Do not deploy or migrate production without separate approval.
```

## Important Limits

This is a handoff plan based on the MacBook repository, not verification of the
Mac mini's current installation. The installed service must be inspected there.
No Mac mini connection, worker enrollment or production change was performed
while preparing this document. The existing private installer is not a shared-
worker installer and must not be presented as one.
