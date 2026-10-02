# Source Taxonomy Repair - 2026-10-02

## Findings

The Oct 1 repair was too narrow. Astro Rekha still had the same 20 angles and
20 personas; the Oct 2 snapshot contained no new taxonomy rows overnight.
Historical labels from inspirations had been copied into production tasks and
promoted to master taxonomy by the former sync discovery path. Source evidence
included snack shoppers, B2B astrology software buyers, skincare, and full
instruction/scene paragraphs. A source used by a production task is not proof
that its audience was approved for the destination product.

Snapshot saves also deleted taxonomy missing from a browser's in-memory arrays.
This could remove categories added by another tab, followed by recreation on old
clients. The inspiration mapping modal lacked a product/generation boundary and
used count-derived category IDs. Matrix assignment could create persona stubs.

Reviewed relevant backlog entries 11, 25, 27/28, 35/36, 38, 43, 49 and 62, plus
the inspiration identity recovery and Oct 1 repair. No fuzzy semantic merge,
"absent from ClickUp means delete", or creative deletion was used.

## Applied Data Repair

Inventoried all 27 products and 538 taxonomy rows against saved inspiration
evidence, creative usage, and historical snapshots. Archived 30 reviewed rows
across nine products, leaving their original labels and assignments unchanged:

| Product | Archived Angles | Archived Personas | Active Angles / Personas |
| --- | ---: | ---: | ---: |
| Astro Rekha IND | 3 | 12 | 17 / 8 |
| Medical | 0 | 2 | 14 / 11 |
| Therapy | 0 | 1 | 7 / 9 |
| Sewing | 1 | 0 | 13 / 8 |
| Patchwork | 0 | 2 | 12 / 11 |
| Yoga Notes | 0 | 3 | 12 / 15 |
| ADHD | 2 | 1 | 11 / 6 |
| Kids Mental Health | 1 | 0 | 21 / 23 |
| Paramedic Notes | 0 | 2 | 8 / 3 |

Quilting remains 5 active angles / 2 personas. All previous repair archives
remain untouched. Archives are reversible and accessible using the matrix's
archive toggle; affected creatives remain in Tracker and Action Plan. This does
not reclassify existing creatives. Uncertain source fit, historical variants,
and punctuation duplicates remain for review rather than being forcibly merged.
In particular, the two Spiritual persona spellings were not collapsed because
doing so safely requires reconciling both sets of live matrix assignments.

## Prevention

- Existing Oct 1 guard still blocks automatic sync creation and stale unarchive.
- New deletion guard ignores snapshot DELETEs without product-scoped tombstones.
- Explicit deletion uses an atomic, security-invoker RPC, with RLS intact and
  anonymous execution explicitly revoked (Supabase default grants were checked).
- Frontend omission deletion is limited to explicit local deletion intent.
- Failed pre-save reads and product/generation changes stop snapshot processing.
- Mapping defaults to an inspiration-local custom label, excludes archived
  options, and rejects callbacks from a different product or generation.
- Explicit new taxonomy uses unique IDs and the explicit-new flag.
- Matrix assignment does not invent missing master categories.
- Explicit Delete, Reset and stale-cleanup paths use the scoped deletion API.

## Verification And Rollback

195 focused Node regression tests passed across both HTML entry points, including
classification identity, taxonomy review, parent links, notes, auth startup,
search, no-brief behavior, performance safety and deletion boundaries. Inline
JavaScript syntax checks passed. No user browser was used.

Database contracts tested stale DELETE, stale UPSERT, explicit Restore/Delete,
wrong-product IDs, invalid RPC input, role grants and product cascade. Test
fixtures rolled back. The first apply attempt rolled back on an inherited anon
grant; the corrected final transaction committed successfully.

Inside the final repeatable-read transaction, full-row fingerprints before and
after matched for products, ads (7,024), inspirations (2,024), actions (3,622),
matrix cells (3,717), queues, results, and all deletion-marker tables. Taxonomy
row counts and all non-target content matched exactly. Only the 30 targets'
archive/approval timestamps and flags changed. No task, brief, media link,
status, relationship, inspiration number or product owner was rewritten.

Private backups: `/Users/anaytripathy/.codex/backups/immuvi-taxonomy-20261002/`.
`before/` holds the full snapshot; `applied-final/` contains the exact plan,
all-products audit, before/after taxonomy, protected hashes, `committed.json`,
and `rollback-data.sql`. That rollback aborts if target content has changed
since repair. `applied/` is a rolled-back attempt, not the committed repair.
Pre-change code checkpoint: `5d2c35e6710f9ac232ff63df39ac242b9c0c0265`.
Do not blindly reset the repository or restore entire tables. Roll back code
with a scoped revert, and use the guarded data rollback only after review.
Keep the additive database safeguards unless deliberately reverting them too.

These checks cover this regression family, not a guarantee that the entire
backlog or every historical creative's semantic classification is resolved.
