# Temporary UI Freeze Mitigation

The Inspiration table recomputed angle and persona suggestions for every row,
including comparisons against every peer. A read-only Node VM probe of Kids Life
Skill's 291 inspirations reproduced a synchronous render exceeding 23 seconds.
Hidden-tab boot rendering and full refreshes could run this work while the user
was viewing Action Plan.

## Temporary Change

- Render saved suggestion chips only; no peer comparisons during table paint.
- Retain product-scope and active-taxonomy checks for saved suggestions.
- Render only the active panel during general refreshes. Invalidate other tabs
  so opening them renders current data.
- Do not schedule hidden panels during boot.
- Skip direct Inspiration table/subview rendering while its panel is hidden.

Classification, explicit suggestion generation, manual taxonomy selection,
database records, briefs, queue processing, and product-boundary protections
are unchanged. No database migration or data repair is needed.

## Verification And Limits

55 focused/regression Node tests passed. The patched production HTML's visible
Inspiration rendering took 36 ms in the read-only VM probe. This measures
JavaScript/string generation, not browser layout or complete page loading.
No user browser was accessed. The separate startup timeout/error-handling
improvement is not part of this temporary patch.

For the permanent fix, calculate suggestions incrementally with evidence caches
and invalidate them when the relevant creative/product data changes. Keep that
work out of synchronous table rendering.

## Rollback

Revert this patch's commit on main. It is UI-only: no data rollback is required.
The local read-only profiling script is intentionally not part of the release.
