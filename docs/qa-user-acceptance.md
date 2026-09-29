# QA User Acceptance

Status: awaiting user review. This is the handoff for the existing acceptance
stage, not another implementation milestone or permission to push/deploy.

Open the single-page dashboard at http://127.0.0.1:3001/ on branch `qa`.
The isolated QA backend is `entgcnlfsnysnwyadzzp`. Keep ClickUp disconnected for
this review; live ClickUp testing was explicitly skipped. Do not use production
records, enable workers or launch ads. Use only disposable QA records for edits.

## Review Checklist

All user results below are pending. Automated passes do not fill these in.
Report any mismatch with the tab, action, expected result and a screenshot.

| Review area | What to confirm | User result |
| --- | --- | --- |
| Overall interface | The legacy-style layout is acceptable; all 11 sections stay as tabs at `/`, without a second dashboard or separate feature pages. Check desktop and the screen size you normally use. | Pending |
| Product and taxonomy | Switching products shows the right data; Angles, Personas and Competitors are usable. On disposable QA records, check editing and save/cancel. | Pending |
| Creative workflow | Tracker filters, creative details and Matrix cells show the expected relationships. Check a disposable local creative across the relevant views without sending it to ClickUp. | Pending |
| Action Plan and Production | Review task details, dates, statuses, brief presentation and variation relationships. Confirm the workflow feels right without attempting an external launch or remote task creation. | Pending |
| Inspiration and Strategist | Review existing QA content, source details, brief tables and approval/import controls. Worker processing and generated-content quality are outside this local review. | Pending |
| HQ and administration | Review totals, connection health, product access, field management and confirmations. Do not delete existing products/users or run cleanup to demonstrate a confirmation. | Pending |

## Differences Requiring A Decision

- Cleanup preserves unused taxonomy, quarantined work and referenced records.
  Legacy destructive pruning is not reproduced. Keep this protection unless a
  specific alternative is reviewed and approved.
- Inspiration uses explicit guarded imports instead of automatic worker-result
  ingestion. Inline edits use Save/Cancel; suggestions and new taxonomy promotion
  require confirmation. Manual intake uses a form, not browser prompts.
- Duplicate ordering is stable; reuse counts use accessible copies instead of
  stale flags. HQ includes connection health and activity information.
- Worker/classifier dispatch, resume and OneScale launching remain unavailable
  without isolated destinations. Live ClickUp delivery remains unverified.
- Automated layout checks do not establish pixel-exact legacy parity. A rejected
  visual or behavioral difference is a concrete fix request, not assumed approval.

## Completion Boundary

The local release build, restart checks, 486 domain/service tests and 44-screen
browser smoke pass. Prior QA database/auth/concurrency evidence is recorded in
[the release gate](qa-release-gate.md); backlog limitations are in
[backlog evidence](qa-backlog-evidence.md).

Only explicit user feedback can close visual/workflow acceptance. Approval may
be limited to local QA with the above exclusions; it does not certify skipped
integrations or authorize deployment. No user approval has been recorded yet.

After that review, the remaining cutover work is to select a separate QA host,
prepare its isolated configuration, and obtain permission before uploading or
deploying. Deployed smoke checks and previous-version rollback must then be
verified. The existing local restart is not a hosted rollback rehearsal.
Production stays unchanged. No push, merge or deployment is authorized here.
