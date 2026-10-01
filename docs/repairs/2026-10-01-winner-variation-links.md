# Missing Winner Variation Relationships

## Cause

ClickUp's Related section displays explicit task relationships, not Immuvi's `parent_ad_id` or matching task names. The matrix and Variation Lab creation paths saved the correct parent in Immuvi but did not stamp the older `_sourceClickupId` field. The ClickUp push handler only followed `sourceFormatId`, `_sourceClickupId`, or a previous task ID when creating relationships; it did not resolve `parentAdId`. Inspiration provenance could also exclude that branch entirely. Link errors were only logged to the console.

Confirmed from live APIs:
- Art Therapy task `86d2qrfxg` (`5773-1 old winner`) still has its eight existing relationships. No repair made to it.
- Quilting winner `86d49vrpw` (`QU-025-INS-031`) initially had only the existing Production Queue mirror link `86d49vybm`.
- Immuvi retained all ten direct variations and one nested variation with correct parent IDs. No lost tasks or product migration was involved.

## Changes

Both HTML entrypoints now resolve and capture the exact parent before creating a variation task. Parent resolution is scoped to the loaded product and refuses missing, deleted, quarantined, foreign or ambiguous parents. Parents must have an existing ClickUp task.

After creation, the app checks the child and parent belong to the captured product list, creates only the missing relationship, and reads it back. This runs independently of inspiration provenance. Nested variations link to their immediate parent, not a name-matched ancestor. Existing non-variation creation and brief behavior remain unchanged.

Link failures enter the existing out-of-sync banner as a distinct relationship operation. Manual Retry rechecks the relationship, not task creation. Requests have bounded timeouts; no automatic retry loop was added.

## Live Repair

Ran `scripts/repair-variation-parent-links.mjs --root=AD-1788609387484` in audit mode, then `--apply` after inspecting the exact plan.

Added 11 missing relationships: ten direct variations to `86d49vrpw`, and nested task `14zbvqqazva` to V1 task `86d4b61k6`.

Verified every new relationship in both directions. Every existing task link was retained. Hashes of task names, descriptions, statuses, assignees, custom fields, hierarchy, dates and archive state were unchanged. No Supabase writes, task creation/deletion, content edits or status updates were performed.

Persistent backup: `/Users/anaytripathy/.codex/backups/immuvi-variation-links-1790838228869/`.
Contains the original relationship sets, exact added pairs, per-write snapshots and verification results. To undo only this repair, remove only the 11 pairs recorded in `verified.json.added`; do not remove Production Queue links or other relationships. Review current state before rollback.

Code baseline: `c909cf481621ef84668e1c3cefa8d7e834880f7e`. QA was not edited. No user browser was used. Historical variations outside this Quilting family were not automatically relinked.

The subsequent user-authorized all-product audit and repair is documented in
`2026-10-01-all-product-variation-links.md`.
