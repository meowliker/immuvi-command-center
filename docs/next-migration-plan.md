# Immuvi Command Center Next.js Migration Plan

This branch (`qa`) starts the Next.js migration without replacing production.
The current single-file dashboard remains the behavioral baseline at
`/immuvi-command-center.html`.

## Safety Rules

- Production remains on `main` until QA explicitly approves a branch merge.
- Preserve the legacy HTML route until each feature has a tested React
  equivalent.
- Migrate one surface at a time and compare it against the legacy route.
- Do not change Supabase schema or ClickUp behavior as part of UI extraction
  unless a bug fix explicitly requires it.

## Phase 0: Compatibility Shell

- Add Next.js App Router project files.
- Serve the current HTML files through route handlers.
- Inject QA Supabase environment variables at request time so the legacy HTML
  can point at a test project without editing the production baseline file.
- Wrap existing Vercel API functions with App Router route handlers.
- Keep `/team-skill/*` and `/install-skill.sh` available because the worker
  installer depends on those static URLs.

## Phase 1: Shared Domain Layer

- Extract Supabase clients and typed table models.
- Extract ClickUp status and custom-field mapping into one module.
- Extract product-boundary, taxonomy, tombstone, and identity resolution helpers.
- Add unit tests for the invariants recorded in `bugs-backlog.md`.

Started in QA:

- `lib/domain/product-config.js` protects product config merge behavior so
  `clickup_list_id`, `clickup_list_name`, tracker views, production settings,
  `doc_id`, and `ins_prefix` are not wiped by partial writes.
- `lib/domain/clickup.js` parses ClickUp list URLs and creates list-scoped cache
  keys for statuses and custom fields.
- `lib/domain/taxonomy.js` normalizes bullet/list-prefixed taxonomy names for
  comparison without changing the visible legacy route.
- `lib/domain/deleted-ads.js` centralizes soft-delete and tombstone checks for
  app ids and ClickUp task ids.
- `tests/domain/*.test.js` covers the first bug-backlog invariants before these
  helpers are wired into React surfaces.

Service extraction:

- `lib/services/supabase-rest.js` centralizes service-role REST/Auth request
  plumbing and PostgREST filter escaping.
- `lib/services/clickup-proxy.js` centralizes ClickUp proxy target validation,
  CORS headers, and user-token forwarding.
- `api/clickup.js` now uses the shared ClickUp proxy helper while preserving
  the existing browser-facing `/api/clickup?path=...` contract.
- `tests/services/*.test.js` covers service URL construction, fail-closed
  secret handling, ClickUp path validation, and header forwarding.

## Phase 2: React Surfaces

Migrate in this order:

1. Auth and product switcher.
2. Admin and user management.
3. Inspiration queue and worker health.
4. Action Plan.
5. Creative Tracker.
6. Creative Matrix.
7. Strategist and Producer.

## Phase 3: Legacy Retirement

- Keep the legacy route behind a QA-only link until all high-risk workflows
  pass browser tests.
- Remove legacy globals only after the replacement has test coverage for
  Supabase persistence, ClickUp sync, realtime updates, and worker queues.

## Bug Backlog Translation

Converting to Next.js does not automatically fix historical bugs. Each fixed
bug should become either a typed helper, a regression test, or both. The main
bug classes this migration is designed to reduce are:

- duplicate ClickUp field/status maps,
- global product/list cache leakage,
- full-container `innerHTML` re-render flicker,
- stale async writes after product switches,
- matrix/ad/action identity drift,
- missing verification around worker-produced deliverables.
