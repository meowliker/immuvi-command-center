# Deletion Identity Resolution

## Evidence

The reported message is the API's `P0002` / missing-creative branch, before
ClickUp deletion. It is not an invalid ClickUp token response. The supplied
colleague token passed read-only authentication and read 100 tasks from each of
the Astro Rekha, Kids Mental Health, and Canva lists. No token was written to a
file, logged, or used for a mutation.

Many saved creatives have serial IDs distinct from their ClickUp task IDs. A
read-only refresh can display the latter; the previous deletion API required
the displayed ID to match `ads.id` exactly. A deterministic test reproduces
that rejection and the corrected resolution. The exact task from the screenshot
was unavailable, so that colleague's particular deletion was not replayed.

## Changes

- Only after the RPC explicitly returns `P0002`, resolve an exact ClickUp ID in
  the requested product, under the caller's existing Supabase JWT. Require one
  unique saved creative. No name matching, cross-product search, upsert, or
  invented record is allowed.
- Call the original security-invoker RPC with that canonical ID. It still locks
  and checks the record, expected task identity, quarantine, supersession,
  shared-task conflicts, product access and deletion markers.
- Verify committed deletion against the canonical saved record. Return both the
  requested ID and canonical ID without breaking older clients.
- Clear only those confirmed identities locally. A pending single-creative save
  must finish first; deletion never forces a whole-product save to create a row.
- Action Plan tombstones are no longer added before database confirmation.
- The RPC also removes same-product action references with the exact deleted
  ClickUp task ID, including stale source aliases. Other task IDs and independent
  variations remain untouched.
- Internal requests have a shared 24-second deadline within the browser's
  30-second timeout, and retain the existing per-request bound and auth retry.

Genuinely missing records, ambiguous matches, conflicts and unauthorized
requests remain blocked. An unknown ClickUp permission failure is not bypassed.
The one-minute refresh budget, product-label fix, notes, taxonomy and source
inspiration behavior are unchanged.

## Verification

- 319 JavaScript regression tests pass across both HTML entry points and API
  mocks, including stale aliases, failed readbacks, pending writes, duplicate
  clicks, stale product responses and failure-state preservation.
- Synthetic database deletion tests run under an authenticated member role.
  Authorization, foreign-product denial, identity conflict, missing-row
  preservation, idempotence, stale action cleanup, independent variation
  preservation and anonymous denial pass. The entire test transaction rolls
  back, including function changes and fixtures.
- Migration `20261016000100` is installed and recorded. Security-invoker mode
  and existing grants are unchanged. Installation changes no existing creative,
  deletion-marker, action, inspiration, angle or persona rows.
- No real creative or ClickUp task was deleted during diagnosis or verification.
  A signed-in end-user deletion still needs the colleague's retry.

## Backup and Rollback

Pre-change code: `12ebe1920f15ed9b6edb59376abf9f18622bf641`.
Private function, permission and installation snapshots:
`/Users/anaytripathy/.codex/backups/immuvi-delete-identity-20261016`.

Roll back code with a normal revert on main, not a reset. Restore the private
pre-change function definition if the database behavior must also be reverted.
Never restore whole creative snapshots or undo legitimate user deletions. QA
was not modified. Passing these scoped regressions is not a promise that all
future bugs are impossible.
