# All-Product Winner Variation Relationships

## Scope and Cause

Follow-up to `2026-10-01-winner-variation-links.md`. The user requested every
product be checked, not only the two examples. The production prevention fix is
commit `effc80b417e57e78be351f7a3f8dff8a00cee0c5`: task creation now resolves the
saved parent ID and verifies the explicit ClickUp relationship, independently
of inspiration provenance. Failed relationship writes can be retried without
creating a second task.

## Inventory

Read all 27 product configurations, 6,973 ads and deletion markers. The audit
found 796 active variation records, yielding 669 distinct eligible ClickUp
relationships after duplicate aliases and unsafe records were excluded.
An additional read-only check found zero active records whose `ad_origin`
contains `variation` but whose `parent_ad_id` is null.

Live ClickUp reads found 33 relationships already present, 623 missing across
20 products, and 13 inaccessible task references. The earlier Quilting repair
is included in the already-present count, not added a second time.

The combined review list has 124 records:

| Reason | Records | Treatment |
| --- | ---: | --- |
| Parent ID belongs to another product | 71 | No guessed cross-product link |
| Child or parent not published to ClickUp | 20 | No task creation |
| Deleted/protected parent | 12 | Preserve deletion |
| Parent cycle | 5 | Preserve for identity review |
| Same ClickUp task as parent | 3 | Do not link a task to itself |
| ClickUp task unavailable to the configured token | 13 | No inferred deletion or replacement |

These are review records, not necessarily distinct missing links. No task is
restored from deletion or reclassified by this repair. The previously protected
23 ambiguous self-heal deletions remain untouched.

### Product Inventory

The counts below describe the pre-repair audit. Review counts are records;
relationship counts are deduplicated pairs.

| Product | Already linked | Missing links | Review records |
| --- | ---: | ---: | ---: |
| KIDS LIFE SKILL | 3 | 126 | 5 |
| Canva | 0 | 19 | 6 |
| Art Therapy | 0 | 28 | 16 |
| Medical | 0 | 24 | 13 |
| Couple Workbook | 0 | 11 | 0 |
| Therapy | 0 | 28 | 0 |
| Sewing | 0 | 4 | 0 |
| PHONICS | 0 | 39 | 0 |
| Astro Rekha IND | 3 | 70 | 54 |
| NCLEX | 0 | 21 | 0 |
| Diabetics | 4 | 5 | 0 |
| Patchwork | 0 | 45 | 0 |
| Yoga Notes | 1 | 20 | 4 |
| Pharmacology | 0 | 0 | 0 |
| Canva Income Mastery | 0 | 0 | 0 |
| Instagram Growth Bundle | 0 | 0 | 0 |
| Kids Focus Activity Pack | 0 | 5 | 0 |
| Kids Earnest Jr | 0 | 0 | 0 |
| Horse and Human Bond | 0 | 9 | 0 |
| Quilting | 11 | 17 | 0 |
| Kids Encyclopedia bundle | 0 | 0 | 0 |
| Y | 0 | 0 | 0 |
| ADHD | 10 | 10 | 2 |
| Herbal Healing Handbook | 0 | 10 | 4 |
| Kids Mental Health | 1 | 131 | 20 |
| Paramedic Notes | 0 | 1 | 0 |
| Pro Architect Resource Vault | 0 | 0 | 0 |
| **Total** | **33** | **623** | **124** |

## Repair Method

`scripts/audit-all-variation-links.mjs` defaults to a read-only audit. Its
`--apply=<audit-directory>` mode uses the inspected audit plan, refreshes product
ownership and deletion evidence in batches of 20, and checks live list ownership
for both task IDs. It only POSTs a missing `/task/{child}/link/{parent}` relation.
It does not issue database writes or task create/update/delete requests.

Each batch reads ClickUp back and verifies both relationship directions,
preservation of existing links, and unchanged hashes of names, descriptions,
status, assignees, custom fields, hierarchy, dates and archive state. Requests
are paced, timeout-bounded, and do not blindly retry POSTs. Rerunning the plan
checks for existing links before writing.

## Verified Outcome

All 623 planned missing relationships were added across 20 products. The journal's
unique added pairs exactly match the audited plan; there were no extra pairs.
All 623 relationships were confirmed in both directions with existing links
retained. The other 33 relationships were already present and were not recreated.

For 622 additions, all compared task-content hashes were unchanged. One nested
Astro Rekha task (`AR-255-INS-122 - V5 - Music - V2 - Music`, `14zbvqqb03d`)
changed during its verification window. Another ClickUp actor also added a
separate relationship in that same window. The repair issued only the planned
relationship POST, not a content update. No concurrent changes were overwritten.
The original content warning is preserved rather than relabeled as an unchanged
save. A subsequent `--verify=<audit-directory>` read confirmed this relationship
in both directions and preservation of the original links; its content review
remains visible in `followup-verification.json`.

The 124 review records in the inventory remain untouched. No Supabase writes,
task creation, task deletion, or task-content updates were issued by the repair.
All 166 targeted regression tests passed. No browser was used.

## Backup and Rollback

Private evidence directory:
`/Users/anaytripathy/.codex/backups/immuvi-all-variation-links-1790839300268/`

- `database-before.json`: product ownership, parent and task identities, deletion markers.
- `clickup-before.json`: original relationships and task-content hashes.
- `audit.json`: full plan, per-product summary and review records.
- `repair-journal.jsonl`: per-pair pre-write snapshots, additions and readback verification.
- `repair-results.json`: cumulative repair outcome.
- `followup-verification.json`: read-only verification of the content-warning case.
- `legacy-reference-evidence.json`: private details for unresolved older parent references.

These snapshots contain operational data and are not committed to Git. No
credentials are included. They are not a full database dump: no database changes
are made by this repair.

To roll back, first review current relationships and the journal. Remove only
relationships whose `added` entries belong to this repair and were absent from
the corresponding `before` snapshot. Do not remove pre-existing relationships,
Production Queue mirror links, tasks, or Supabase rows. A failed readback may
still follow a successful write, so consult the journal, not only the final
success count. A rollback must be an explicit, separately approved operation.

Code baseline for this expansion: `effc80b417e57e78be351f7a3f8dff8a00cee0c5`.
Only the main worktree is edited; the QA branch is not modified and the user's
browser is not used.
