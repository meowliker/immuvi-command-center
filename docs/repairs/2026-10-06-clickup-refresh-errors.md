# ClickUp Refresh Error Diagnosis

## Evidence

The screenshot's temporary-unavailability toast was produced by a generic
client-side cooldown. Every error from the complete fetch/merge pipeline entered
the same cooldown, losing the exception and blaming ClickUp even for Supabase
safeguard failures or local rendering errors. A second manual click received the
same fixed one-minute message, even if the cooldown was five minutes or the user
had corrected the API key. Stale failures could also affect a switched product.

Production runtime logs on October 6 showed repeated GET /api/clickup HTTP 401
responses in the preceding hour, alongside successful responses. No serverless
error-level logs appeared in that diagnostic window. The old proxy did not log
upstream error codes, so the particular browser request cannot be conclusively
matched to a revoked token versus a workspace authorization error. Browser
credentials were not accessed and no user browser was opened.

## Change

- Preserve HTTP status, ClickUp error code, Retry-After and X-RateLimit-Reset.
- Separate invalid credentials, workspace/list permissions, rate limits,
  upstream/network errors, malformed responses, Supabase safeguards and local errors.
- Stop automatic polling after an invalid-key response; changed credentials or
  an explicit manual retry can recover. Never bypass a real rate-limit deadline.
- Keep automatic one-minute refresh budgets, request single-flight, product
  generation checks, deletion safeguards and client-local manual refreshes.
- Keep error labels visible instead of allowing the age ticker to claim Live.
- Pin pagination to its starting credential and reject invalid task-list payloads.
- Proxy responses are private/no-store; upstream error logs contain only method,
  status and a validated error code. No tokens, bodies or task data are logged.
- Bound upstream GET/HEAD reads to 20 seconds. Writes are not retried or given
  new timeout behavior by this change.

## Verification And Rollback

259 Node regression tests pass, covering auth correction, workspace errors,
rate-limit headers/deadlines, transient retry, stale product/key failures,
data preservation, privacy, manual isolation and existing application guards.
No database migrations, production record updates, or credential changes were
performed. QA was not modified. Pre-change main checkpoint: f99bb72.

This fixes error handling, not an externally revoked credential. The user must
check their ClickUp token in Settings > Apps and enter the correct token directly
in Immuvi, not in chat. Regeneration is not automatic because it can invalidate
the same token used by other integrations.
