# QA Image Producer

The Action Plan Producer column opens the native React generation dialog. It
retains legacy winner-format ranking, persona fit, recency, product directives,
reference layout checks, 1-10 sequential variations, and per-image visual QA.

Delivery is intentionally different for QA: **private Supabase storage only**.
No ClickUp requests, attachments, status updates, production queue jobs or live
ad launches are made. Existing task statuses are unchanged after generation.

## Running

Project: `entgcnlfsnysnwyadzzp` only. Migration:
`20260928010000_qa_image_producer.sql` and
`20260928050000_qa_private_workers.sql`.

Workers now use a permanent, owner-only LaunchAgent. See
[Personal Mac Worker](private-mac-worker.md) for pairing, controls and boundaries.
The old shared-worker entry points are retired and fail closed. Starting the
dev server no longer launches a shared service-role worker. The private worker
probes native Codex image-tool availability before advertising readiness.
Requires the signed-in local Codex CLI; no image API-key fallback is used.

## Boundaries

- `qa_image_runs` is separate from legacy `producer_runs`. Only the validated
  authenticated RPC creates runs. Product RLS protects their briefs and outputs.
- One active job per creative; UUID idempotency prevents replayed submissions.
- Worker claims are atomic, current user access is rechecked, native execution
  has a 30-minute timeout. Interrupted jobs fail, never silently regenerate.
- Codex runs in a temporary workspace with its user configuration ignored and
  a whitelisted environment. It receives no Supabase or ClickUp credentials.
- `QA-SKILL.md` preserves generation rules but excludes legacy auto-update,
  credential discovery, ClickUp delivery and status transitions.
- PNGs are fully decoded, dimension/size/quality-manifest checked and ordered.
  Complete batches go to `qa-producer-images/<run-id>/<variation>.png`; the
  database retains prompts, checks, dimensions and hashes. Private signed links
  open from the dialog. Only the paired worker's active lease permits uploads;
  ordinary browser sessions cannot write images.
- QA references currently require public direct PNG/JPEG/WebP URLs. Private
  Drive/ClickUp attachments cannot be resolved until the future delivery/source
  integration is connected. Unsupported references fail explicitly.
- Generation is native AI output. Automated manifest checks supplement, not
  replace, the worker's visual quality inspection and human review.

Logs: `~/Library/Application Support/Immuvi/Workers/qa-personal/worker.log`.
The private worker is independent of the local app. Do not start the legacy
production worker for QA testing.

## Activity Summary

Today/This Week continue to count activity timestamps, matching legacy behavior.
Imported QA rows retain historical dates, so a new week can legitimately show
zeros. The empty state now includes the latest activity date. All time shows
current task totals without inventing recent activity or prior-period deltas.

## Verified September 28, 2026

- Rolled-back database tests: request identity, count validation, product/reference
  access, browser write rejection, active-job uniqueness, private image reads.
- Browser checks: dialog, request scope, offline/pending/failure states, image
  preview, date controls and legacy table bounds across desktop/mobile widths.
- Native smoke test `26b7d9f1-fb59-4bec-967a-695593f27a01`: one 1254x1254 PNG
  generated, decoded, uploaded and downloaded from private QA storage; visually
  checked. It appears under AstroRekha QA creative `AR-174-INS-035`.
  This run is explicitly labeled `testRun` with a chat-verification origin.
- No ClickUp calls, task status changes, production writes, pushes or deployments.
