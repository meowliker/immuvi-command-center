# Command HQ Migration

Milestone 10 has three local batches. All three are locally complete; zero local
finish batches remain. Live integration and user sign-off are separate gates.
This work stays on `qa`, at `/` with internal tabs. No push, deployment,
production writes, real ads launch or classifier dispatch is authorized.

## Fixed Batch Plan

1. **Complete: metrics, coverage and gap analysis.** Replace the product/access
   placeholder with eight legacy KPIs, five coverage groups, gap recommendations,
   product-scoped paginated reads, realtime refresh and explicit failure states.
2. **Complete: product operations and health.** HQ uses the shared QA connection
   controller for list/field configuration and Sync Now, with saved sync metadata,
   errors, key/auto-sync state and paginated product activity. Admin/member
   boundaries, invalid-response rejection and test-list restrictions are retained.
   Catalog persistence and destructive product operations are explicitly assigned
   to milestone 11, which already owns product management and cleanup.
3. **Complete locally: final parity and acceptance.** Compare audited legacy
   render output and key CSS metrics, restore compact product chips and coverage
   styling, reject malformed field options, invalidate stale list state, and
   verify responsive/access/failure behavior. See the acceptance report for
   evidence and remaining gates; local completion does not authorize cutover.

## Batch 1 Semantics

- `lib/domain/command-hq.js` owns pure snapshot calculations;
  `use-command-hq.ts` owns read lifecycle; `overview-tab.tsx` renders React.
  No iframe, legacy startup script, HTML injection or extra route is introduced.
- Read `ads`, `angles`, `personas`, and `deleted_ads` through `readProductRows`
  with 500-row pagination, explicit product filters and abort signals. Apply the
  snapshot only when all reads succeed and the active query is still current.
- Reuse shared realtime/focus/online/30-second invalidation. Keep the last good
  snapshot on refresh failure and label it; initial failures show dashes instead
  of false zeroes. Product/tab/user remount boundaries discard previous data.
- Include all live creatives, including child variations and production rows.
  Exclude deleted/quarantined rows and identities covered by deletion tombstones.
- Winners KPI: Winner, Mild Winner, Scale. Testing: Testing only. Ready: Ready
  to Launch only, not Approved/Assigned/In Production. Untested: Untested only.
  Win rate uses all live creatives as denominator, including untested creatives.
- Recommendations retain the legacy root-Winner rule and five-child threshold.
  All live children count toward variation coverage; all live creatives in the
  same angle/persona pair contribute TOF/MOF/BOF coverage.
- Active angle/persona catalogs determine coverage denominators. Field groups
  use the audited legacy seed catalogs plus observed live current-product custom
  values. Unused browser-only custom options are not migrated yet: legacy stores
  them under the global `immuvi_field_options_v1` key without product ownership.
  Catalog persistence/editor parity remains open, not silently claimed complete.

## Deliberate Correctness Differences

- Archived axes do not count; canonical aliases count once and match using the
  existing taxonomy normalization helpers.
- Winner cells use tuple identities instead of delimiter concatenation, and
  incomplete angle/persona mappings do not generate fake funnel recommendations.
- The missing-funnel warning counts only combinations with missing stages. The
  legacy warning included fully covered combinations in its displayed count.
- Product-scoped tombstones prevent deleted remote aliases from reappearing.

Backlog boundaries: bugs 35/36 motivate archived-axis exclusion, canonical
matching and isolation tests. This read-only batch does not repair contaminated
rows stored under the wrong `product_id`, validate their declared ClickUp Product
field, or rewrite duplicate taxonomy in storage. Import/cleanup enforcement and
stale-writer protection still require the operational/taxonomy/security gates;
do not mark either entire historical bug closed based on HQ calculations alone.

## Batch 1 Evidence

- 418 domain/service tests pass, including nine new HQ tests and direct comparison
  with the audited legacy pure summary function and literal field catalogs.
- Optimized Next.js build and TypeScript pass.
- Focused intercepted browser run: `/tmp/immuvi-hq-foundation/results.json`.
  Eight KPIs/five groups/gaps; 506 live creatives across pages; deletion and
  archived-axis filtering; realtime updates; initial/refresh failure and retry;
  empty states; late-response product isolation; keyboard refresh; root URL.
  Zero mutations, unexpected browser errors or external requests.
- Screenshots inspected at 320 and 1440px; overflow checks/screenshots also at
  390 and 768px. Full legacy visual acceptance is still batch 3.
- Full intercepted regression passes: `/tmp/immuvi-hq-regression/results.json`,
  178 mocked mutation attempts across the existing workflows, zero unexpected
  browser errors or external requests. HQ itself remains read-only. Keyboard
  verification waits for the actual refresh request, not an already-idle page.
- This batch introduces no SQL, API mutations or remote configuration changes.

## Batch 2 Implementation And Boundaries

- One `ClickUpProvider` owns the existing connection hook per user/product/role.
  Both the global connection panel and HQ consume the same state and write lock.
  Tab changes retain the key, mappings, request state and auto-sync selection;
  product/user/role changes dispose requests and timers. No duplicate sync loop.
- Admins can open the existing list and field-mapping controls from HQ. Members
  can supply their session key and sync assigned products, but cannot configure
  lists/fields. Existing server role/access checks remain authoritative.
- Sync Now always uses the saved product list, never a draft list input. The
  client and existing server allowlist both restrict it to `901616718146`.
  Unsupported destinations are visibly blocked. No automatic outbound launch.
- Sync health separates missing key, missing link, blocked destination, busy,
  never-synced and failed operations. Saved timestamps/counts come from product
  config, not a guessed success time. Zero tasks is displayed as zero; missing or
  invalid metadata is not treated as zero. Stored mapping counts require the
  current linked list and recognized field names.
- Malformed sync counts, malformed connection schemas, wrong-list responses and
  mismatched saved mappings are rejected before success notices. A failed sync
  stops auto-sync. Editing/removing the session key clears obsolete notices, and
  editing it stops auto-sync until explicitly re-enabled.
- Product activity reuses `PlanHistory` and its 40-event keyset pagination,
  same-product validation, realtime refresh, atomic loaded-window replacement,
  failed-page retention and explicit retry. Its errors do not blank the KPIs.
- Add/delete product, unlink, Clean stale, and the legacy Manage Fields catalog
  editor are NOT implemented by this batch. They stay in milestone 11, with
  guarded persistence, confirmations and field-schema creation/mapping ownership.
  Configure fields here maps existing ClickUp fields; it does not create remote
  fields or migrate `immuvi_field_options_v1` from a browser. No placeholder
  buttons pretending to perform those unsupported operations were added.
- New browser verification covers admins/members, shared busy state, tab/product
  changes, unverified/failed sync replies, zero-count persisted metadata,
  key removal, paginated history failure/retry, and 320/390/768/1440px layouts.
  Focused evidence: `/tmp/immuvi-hq-operations/results.json`, zero real external
  requests or database mutations. Integration responses/config changes use
  in-memory browser fixtures only.
- 423 domain/service tests and optimized Next.js build pass. Full intercepted
  regression passes: `/tmp/immuvi-hq-operations-regression/results.json`, with
  178 mocked database mutation attempts across the existing workflows and zero
  unexpected browser errors or external requests. This includes malformed
  connection-response rejection and retry. Each browser scenario now clones its
  product fixture so a previous scenario's saved settings cannot leak into it.
- No SQL, remote configuration, production changes, pushes or deployments.

## Batch 3 Acceptance

- Restored compact legacy product chips, coverage percentages/count placement,
  typography, gradient rules/progress, card spacing and gap-list treatment.
  The eight KPIs, five coverage groups and gap text match audited legacy render
  functions for the same fixture; key computed CSS dimensions match too.
- Invalid option lists/labels and duplicate field identities are rejected before
  the connection editor can render them. Retry remains available.
- An observed saved-list change clears old schema/mappings, notices and errors,
  updates the list input, stops auto-sync and aborts/discards a pending client
  request. This does not promise cancellation of a server-side operation; shared
  write locking can defer observing a remote product change until the write ends.
- Fixed the shared header's min-content overflow for unbroken product names.
  Long/literal markup names stay text, product controls remain within bounds,
  and coverage uses one column through 768px and three above it.
- Access revocation removes the product KPIs, sync controls and history. Existing
  initial/refresh failure, pagination, keyboard, member, busy, retry and late
  product-response tests still pass.
- 424 domain/service tests and focused browser acceptance pass. Focused evidence:
  `/tmp/immuvi-hq-final/results.json`, zero mocked DB mutations, unexpected browser
  errors or external requests. Normal 320/1440px and long-name screenshots were
  inspected; automated bounds checks include 320/390/768/1440/1920px.
- Final build and whole-app regression results are recorded in
  [Command HQ acceptance](command-hq-acceptance.md).
- No legacy HTML, SQL, API handlers or remote settings were changed by this batch.

Overall tracker: 6/13 milestones fully closed, 7 still open. Action Plan,
Inspiration, Production and HQ are locally complete but retain acceptance gates.
Next implementation is milestone 11, taxonomy/admin; then QA/security regression
and cutover approval. HQ catalog/product-management dependencies remain in 11.
Do not restart completed local finish batches or count external gates as code work.
