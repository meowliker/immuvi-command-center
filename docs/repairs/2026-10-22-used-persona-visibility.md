# Used persona visibility and stale action taxonomy

An earlier approved taxonomy cleanup archived a persona still used by active
creatives. Their records survived, but the normal matrix cell became hidden.
Preserving database records alone was not sufficient verification of visibility.

The scoped recovery restored one existing persona and moved one additional
creative to an existing angle after explicit user confirmation. Its ClickUp
Angle Tag, saved creative, action labels and matrix assignment were updated.
No new category, task or brief was created. Original inspiration analysis and
brief content were preserved. Private before/after backups remain outside Git.

Verification found that an older Action Plan snapshot could reappear after the
repair. The renderer now prefers current creative labels only when both the
source creative ID and nonempty ClickUp task ID match the action exactly.
Different-task parent references, unverified links and missing current labels
retain the existing fallback behavior. Rendering performs no new writes.

## Verification

- All nine expected creative identities are present in the normal matrix cell
  and Action Plan: five photos, four videos; eight Testing, one Ready to Launch.
- Desktop and mobile isolated-browser checks use the actual render functions
  with a read-only live snapshot, not an authenticated user session.
- All 393 top-level JavaScript regression tests passed, including same-task
  stale labels, parent references, missing links, taxonomy boundaries, deletion,
  variation relationships and search.
- The scoped repair compared thirteen protected table fingerprints inside its
  transaction, excluding only the explicitly approved rows. Other records were
  unchanged by that transaction. QA was not modified.

## Cleanup rule

Before archiving categories, enumerate every assigned nondeleted creative by
identity, including photo ads and virtual Action Plan rows. Check the resulting
normal-view visibility, not just row counts or unchanged payloads. If hiding
active tasks is not intended, obtain a decision before archiving their category.
Do not automatically restore all archived categories or weaken the existing
placement-creation guard.
