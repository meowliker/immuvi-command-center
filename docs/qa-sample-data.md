# QA Sample Dataset

Imported 2026-09-26 at the user's request, into QA project
`entgcnlfsnysnwyadzzp` only. Production Supabase was accessed using bounded REST
GET requests; no source writes, RPCs, schema changes or ClickUp calls were made.
No push or deployment was made.

## Products

| QA product | Source product | Creatives | Saved actions | Inspirations | Angles | Personas | Matrix cells |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AstroRekha - QA Sample | Astro Rekha IND | 27 | 5 | 5 | 16 | 9 | 9 |
| Canva - QA Sample | Canva | 20 | 5 | 5 | 13 | 11 | 13 |

Both appear in the existing QA member account's product selector. Its role,
password and other assignments were not changed. The Admin tab still requires
an existing QA administrator; importing content does not elevate a member.

## Table Coverage

227 new rows were inserted into 27 application tables, with all counts read back:

| Table | Rows |
| --- | ---: |
| products | 2 |
| angles | 29 |
| personas | 20 |
| angle_personas | 6 |
| ads | 47 |
| matrix_cells | 22 |
| manual_actions | 10 |
| inspirations | 10 |
| inspiration_queue | 10 |
| inspiration_results | 10 |
| competitor_brands | 2 |
| competitor_creatives | 2 |
| competitor_research_queue | 2 |
| strategist_recommendations | 2 |
| strategist_memory | 2 |
| strategist_runs | 7 |
| strategist_processed | 10 |
| producer_runs | 9 |
| activity_events | 2 |
| deleted_ads | 10 |
| task_video_winners | 2 |
| task_drive_cache | 2 |
| variation_briefs | 2 |
| variation_brief_queue | 2 |
| worker_registry | 1 |
| user_products | 2 |
| admin_audit_log | 2 |

This is not a literal clone of every database table. Production Auth users,
profiles, credentials and private account recovery journals were not copied.
Existing QA profiles are retained; `qa_*` operation/receipt tables are left to
real application operations rather than fabricated recovery state. The
`profiles_with_products` view derives its data from the existing profile and new
assignments, so it needs no inserted rows.

## Intentional Sanitization

- All copied record identities are new QA identities. Product IDs are
  `qa-sample-astrorekha` and `qa-sample-canva`. Existing QA content is not overwritten.
- Both product configurations have no ClickUp list. Live task/document IDs,
  credentials, OneScale mappings and operational metadata are removed. Required
  historical task identifiers use inert `qa-sample-*` values.
- External URLs/Drive file IDs are replaced by inert placeholders. Source/media
  links are intentionally not usable; no real external file is modified or copied.
- Queue records are cancelled/failed and run history is terminal. The worker row
  is a synthetic disabled/offline fixture, not a copied production machine.
- Missing sample data is filled explicitly with synthetic fixtures: competitor
  creatives/recommendations/research history, results derived from saved inspiration
  content, auxiliary media/brief records and activity. AstroRekha's competitor
  brand is synthetic; Canva's brand is copied. No generation/research was run.
- Matrix rows are rebuilt from the copied creative/taxonomy names because the
  sampled legacy cell IDs did not match current taxonomy IDs. These are derived
  fixtures, not a claim that historical production cells were repaired.
- Imported content may retain historical wording, dates and taxonomy issues.
  It is realistic test input, not a production data-cleaning operation.

## Evidence And Repeat Safety

### Navigation Preview Links

At the user's request, `AR-174-INS-035` in AstroRekha - QA Sample now has
an inspiration preview (`https://example.com/`), a Drive-home navigation link,
and a ClickUp test-list navigation link. The latter is display-only metadata:
`clickup_task_id` remains null, so it does not enable pushes or task deletion.
These are not an actual Drive creative file or a newly created ClickUp task.
The guarded one-row SQL is in `repairs/2026-09-26-qa-tracker-preview-links.sql`.
UPDATE triggers were inspected; no external requests are issued by them.

`scripts/seed-qa-samples.mjs` permits only the pinned source REST GETs and linked
QA SQL on branch `qa`. INSERT triggers were inspected for outbound effects. The
exact final plan passed a rolled-back transaction before its atomic commit.
The script refuses to proceed if either sample product already exists; it does
not have an overwrite/delete mode.

The private temporary evidence directory is:
`/var/folders/vf/w_h9vtlx0gdg2b011wt0zd1r0000gn/T/immuvi-qa-samples-qSx0YM`.
It contains the sanitized plan, per-product copied/synthetic counts, GET request
inventory and readback verification. No service credentials are written there.

Readback verified zero live creative ClickUp IDs, disconnected products and zero
enabled sample workers. The signed-in member's browser displayed both products,
AstroRekha Tracker/Action Plan/Inspiration data and disconnected sync controls.
All 490 domain/service tests pass, including four new import-policy tests.

Keep the sample products disconnected when testing. Linking them to an external
service is a separate action and was not authorized or performed by this import.
