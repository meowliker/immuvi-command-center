# Astro Rekha creative classification audit

## Scope and checkpoint

- Requested product only: `prod-1778009469915` (Astro Rekha IND).
- Main code checkpoint: `8262a2969fc79204f08c14e282e8f411c4ebc7e3`.
- Private read-only snapshot: `/Users/anaytripathy/.codex/backups/immuvi-astro-classification-20261002/before/`.
- Per-record inventory: `/Users/anaytripathy/.codex/backups/immuvi-astro-classification-20261002/creative-audit.json`.
- No production records changed. QA and the user's browser remain untouched.

## Inventory, not a completed semantic review

The snapshot contains 475 non-deleted creative records, including 127 variations,
plus 101 previously deleted records preserved without restoration. There are 17
active angles and 7 active personas. Exact normalized active category names have
no duplicates; this does not establish that their meanings are distinct.

- 392 creatives have a final Drive link; 83 do not.
- 225 have task descriptions; 250 do not. Some descriptions are copied source
  hypotheses or taxonomy tables, not transcripts of the finished creative.
- 239 link to same-product inspirations by explicit ID or exact source/brief URL.
  These are reference sources, not automatically evidence of the final asset.
- No existing Strategist transcript/frame analysis matched these tasks by exact
  task ID. This is a coverage gap, not a claim that the Drive media is inaccessible.
- 34 creative angles and 54 personas are outside active master taxonomy. Those
  labels need evidence review, not blind mapping or automatic unarchiving.
- 21 records lack an angle; 19 lack a persona. Flag counts overlap.

Potential semantic overlaps to investigate include Marriage Prediction versus
Marriage & Love Predictions; Birth Chart / Kundali versus Kundali Secrets;
Pregnancy Prediction versus Family/Fertility Prediction; and Young Couples
versus Young couples thinking about marriage. Do not merge these from names
alone. The animated-love-story angle may encode a format rather than a distinct
promise, but its three different scripts require separate review.

## Next gate

The user was asked whether the Mac mini may inspect final Drive videos/images
using its existing AI login in a read-only audit. No media-audit job was queued.
Existing approval for inspiration review covered saved evidence; do not claim
that all finished ads have been watched or corrected.

If approved, resolve each final asset to its exact creative/variation and retain
evidence provenance. Separate final media, editor-approved scripts, source ads,
and model-generated hypotheses. Never treat actors or incidental names as the
addressed buyer, and never copy a foreign product audience into this product.
Missing or conflicting evidence remains explicitly unresolved.

Only after evidence review, build a guarded per-record change plan. Check current
state against the snapshot and re-read any concurrent edit. Update canonical
creative tags, linked Action Plan fields, all relevant Matrix assignments and
ClickUp tag fields consistently. Preserve task identity, product ownership,
statuses, notes, briefs, media URLs, variation relationships and deleted records.
Merging cells must retain per-ad metadata and detect conflicts instead of
overwriting one cell with another. Back up before and after with guarded rollback.

## Safeguards checked

Reviewed backlog safeguards for product isolation, stale snapshots, taxonomy
creation/archive handling, semantic over-merging, action payload consistency,
identity collisions and unsafe renames (including 11, 25, 27/28, 35/36, 38, 43,
44, 49, 60 and 62). This is not certification that the entire backlog is resolved.

45 focused tests passed covering the new read-only inventory, source/product
boundaries, independent variation review, inspiration identity and existing
taxonomy review safeguards. These tests do not validate uninspected ad content.
