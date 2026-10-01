# Automatic Taxonomy Expansion

## Cause

The old `autoDiscoverTaxonomy` path converted arbitrary ClickUp creative labels
into active product-wide angles/personas. Product scoping prevented cross-product
inserts, but did not constitute user approval. Local deletion markers expired,
new IDs bypassed ID-only deletion guards, and stale UPSERTs could clear archives.

Quilting's QT-AI-001 through QT-AI-020 tasks introduced 20 angle labels and 18
persona labels at 2026-10-01 05:42:50 UTC (11:12:50 IST). This predates the
parent-link repair, whose first backup began at 07:03:48 UTC. That repair changed
ClickUp relationships only, not Supabase taxonomy.

## Audit And Repair

All 27 products were compared against saved September 28 snapshots, using names
as well as IDs because several products had regenerated IDs. The current state
was backed up before the repair. No whole-product snapshot was restored.

- Quilting: archived 20 auto-imported angles and 18 personas. Retained 5 active
  angles, 2 active personas and the 2 angles already archived before this event.
- Kids Life Skill: archived 8 raw/generated persona variants from the September
  28 import batch. This repeats the class of issue recorded in backlog Bug 43.
  Retained its 18 active angles and 6 pre-existing personas.
- Phonics: archived 2 imported prose-style persona labels from automation tasks;
  retained 11 angles and 6 pre-existing personas.
- Medical and Astro Rekha: preserved new inspiration-backed categories. The
  source-only music-video angle and dash-variant Astro persona were left for
  review because a safe removal/remapping was not established.
- Other 22 products: no additional taxonomy names versus the comparison snapshot.

All 48 corrected entries remain in their original product as archived records.
No ad tags, creative identities, task relationships or assignments were remapped.
Creatives remain in the Tracker/Action Plan; archived cells remain accessible
using the existing archive view, rather than being forced into unrelated cells.

## Prevention

Sync imports creative evidence but no longer creates master taxonomy. Explicit
Add actions and accepted suggestions can still create categories. An additive
`creation_approved` column grandfathers existing categories; new legacy-client
inserts default to unapproved and archived. The database preserves its archive
and approval state on UPSERT, so stale browser snapshots cannot reactivate them.
Explicit Restore uses a product-scoped UPDATE and confirms unapproved entries.
Cross-product taxonomy moves fail with PT409, not a retryable serialization code.
Tab badges count active categories and active matrix cells, not archived entries.

## Verification

- 179 focused regression tests passed, including parent links, startup/auth,
  notes, inspiration identity, No Brief, taxonomy review, matrix search and AR alias.
- A rolled-back database rehearsal tested legacy insertion, explicit insertion,
  stale UPSERTs, explicit restore, archives and rejected cross-product changes.
- The apply transaction repeated those tests, rolled back all fixtures, and
  compared full-table row counts/hashes before and after the repair for products,
  ads, manual_actions, matrix_cells, inspirations, inspiration_results,
  inspiration_queue, deleted_ads, deleted_angles and deleted_personas.
- All protected hashes matched. Only the 48 intended archive/approval flags and
  updated timestamps changed; other taxonomy content was checked row-by-row.
- First apply attempt rolled back because the test harness caught its intentional
  boundary error outside the driver's savepoint API. The corrected run committed;
  only a `committed.json` receipt establishes an applied repair.

## Backup And Rollback

Private backup root: `~/.codex/backups/immuvi-taxonomy-20261001/`.
`before/` holds the complete snapshot. `applied-2/` holds the committed plan,
before/after taxonomy, protected-data fingerprints, trigger definitions,
verification and commit receipt. Earlier rehearsal/attempt directories are not
committed repairs.

`applied-2/rollback-data.sql` restores only the 48 archived entries. It aborts if
their content changed after the repair, preserving later user edits. It does not
remove the prevention guard or touch creative tables. Review before executing.
For code rollback use a targeted `git revert` of this repair commit, not a hard
reset. Prior code checkpoint is `5ba372198ec8286e310d46e7a007d1654dff7b85`.
The additive schema may remain during code rollback to protect older clients.

QA was not edited. The temporary AR dropdown-only alias remains unchanged.
