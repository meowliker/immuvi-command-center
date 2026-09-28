# UI Performance and Load Safety

## Baseline and Rollback

- Branch: `main`. QA checkout and its uncommitted migration work were not edited.
- Baseline: `fc2ac62a64a430465c1220e038189121e2ae11a4`.
- Local rollback tag: `backup/ui-before-20260928`.
- Private backup directory: `/Users/anaytripathy/.codex/backups/immuvi-ui-20260928/`.
- `main-before.bundle` contains the baseline source history. `before/` and `after/`
  contain private JSON snapshots plus SHA-256 manifests. Raw records and credentials
  are not committed or published.
- Revert the commit containing this document on `main` and push the revert to undo
  this patch. Do not hard-reset main, touch QA, or overwrite the live database with
  an old snapshot. The code fix requires no schema migration or data rewrite.

## Changes

- Guard direct tab renderers and outer render wrappers, not only `renderAll`.
  Hidden tabs are invalidated and rendered on their next opening. Saved boot tab
  visibility is restored before invoking its renderer.
- Cache evidence tokens and suggestions in bounded, product-keyed memory caches.
  Relevant evidence/taxonomy changes invalidate suggestion results. No automatic
  assignment, merging, or database save happens during suggestion recalculation.
- Recalculate one inspiration field per timer turn. Classification imports yield
  between records, are single-flight, and stop on product switches. Late reads from
  an earlier product/load generation are discarded.
- Replayed results only fill genuinely missing brief fields for already classified,
  placed, testing, winning, and losing inspirations. Manual taxonomy, status,
  classification time, and No Brief choice are preserved. Exact inspiration IDs
  take precedence over URL matches. Consumed results are no longer bulk-deleted.
- Product/inspiration reads reject errors instead of interpreting them as empty
  data. Cloud queries time out at 20 seconds; initial state loading also has a
  30-second overall watchdog. Failure shows a blocking Retry dialog that reloads
  the page without clearing storage. Unloaded/mismatched product state cannot be
  flushed. Existing in-memory records are retained after a failed fetch.

## Verification

- Automated regression suites cover visible-tab rendering, cache reuse and
  invalidation, product switching, overlapping polls, late responses, failures,
  Retry, classification replay, No Brief, matrix search, deletion retries, and
  intentional-deletion preservation. Both HTML entry files are checked.
- Offline Node VM profiling used the backed-up Kids Life Skill product (291
  inspirations), including cached winner evidence from other products. For 582
  suggestion units: approximately 4.7 seconds total CPU, 14 ms p95, 98 ms maximum
  first unit; cached lookup pass approximately 7 ms. Units yield between calls.
  This is not a real-browser DOM/layout measurement.
- Read-only snapshots covered products (27), ads including soft-deleted rows
  (6,877), inspirations (1,942), actions (3,513), cells (2,740), angles (273),
  personas (201), results (1), queue rows (1,849), and deletion markers (1,583).
- Pre-deployment comparison: no missing ads/inspirations/taxonomy/cells, no changed
  product ownership, and no changed deletion markers. The still-live old app
  rewrote timestamps/metadata during the audit. Two auto-healed Action Plan rows
  were replaced by new UUIDs for the same ClickUp task IDs and product, with the
  same business payload except healing ID/time/client metadata. Both versions
  are retained in the private snapshots. This is not a transactionally frozen
  database backup or a claim that live data stayed byte-identical.
- No production database writes were performed by the repair or verification
  commands. Existing user/browser/worker activity was not stopped. The user's
  browser was not opened or controlled.

## Remaining Verification Boundary

The app still renders the full visible table. These changes remove hidden-tab
work and long uninterrupted suggestion loops, but do not virtualize large tables.
An isolated browser performance recording remains useful if freezes continue.
Do not claim perfect browser responsiveness or zero future bugs from Node tests.
