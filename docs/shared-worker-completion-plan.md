# Shared Mac mini completion plan

The existing QA service is an inspiration worker, not full legacy parity.
Keep QA, production, and Anay's owner-only MacBook separate throughout this plan.
Do not ask for another mini installation for each stage. Prepare and verify the
combined release here, then perform one coordinated machine installation and
acceptance pass. Physical installation and paid/output-producing acceptance tests
are not complete until actually performed.

## 1. Approved automatic updates

Implementation added, opt-in and not installed on the mini yet:

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

Tests cover bad manifests, pinned sources, staging order, network failure,
concurrent checks, startup timeout/crash, previous-version fallback, and real IPC
activation gating. Machine-level updates under active production load remain
part of stage 5.

Limits: bootstrap changes or new Python/system dependencies can still require a
planned runtime upgrade. Auth expiry/hardware failure is not solved by code updates.
Startup rollback does not promise detection of every later semantic bug.

## 2. Durable task recovery

Pending implementation:

- Preserve queued work through offline periods; make offline enqueue explicit.
- On restart, reclaim expired leases only after verifying device/user/product
  authorization and which execution/delivery checkpoints already exist.
- Keep generated output and known ClickUp receipts; resume delivery without
  regenerating content. Resolve ambiguous writes by checking external identity.
- Define bounded retries, retry scheduling, cancellation and credential expiry.
  The current failure path clears the encrypted ClickUp token; simply changing a
  status back to pending cannot implement secure automatic recovery.
- Report queued/recovering/needs-attention states accurately. Test repeated
  shutdown and network loss, not only a successful retry.

## 3. Shared image generation / Producer

Pending implementation:

- Connect the shared selector, authorization, generation capability, queue and
  output storage to the actual legacy Producer contract.
- Retain ordered per-image output and attachment receipts. Recover completed
  variations instead of generating or uploading them again.
- Verify native engine availability and product/destination boundaries.
- Perform an explicitly approved QA image run and verify the actual image files,
  names, order, links and restart behavior. No production launch is implied.

## 4. Variation briefs and Strategist

Pending implementation:

- Port the separate legacy queue/execution contracts and prompts, including
  required context, result persistence, downstream links and permissions.
- Check real Codex/Claude availability instead of advertising inactive engines.
- Add recovery rules per workflow. Legacy Strategist marks abandoned jobs failed;
  blindly replaying everything is not equivalent or necessarily safe.
- Verify each complete workflow in QA, with duplicate prevention and isolation.

## 5. Consolidated install and acceptance

Only after stages 1-4 are implemented and verified locally:

1. Inspect/preserve the mini checkout and runtime. Pause claims and drain active
   work; do not kill production or change its credentials/configuration.
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
