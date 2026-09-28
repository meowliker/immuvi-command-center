# Evidence-Backed Inspiration Taxonomy

## Baseline and Rollback

- Main baseline: `25e695960ab31aca2c3b0496cbbc8c0f72706e5a`.
- Local rollback tag: `backup/taxonomy-before-20260928`.
- Private production snapshots: `/private/tmp/immuvi-taxonomy-backup-20260928/before` and `after` (not tracked or served).
- Revert the taxonomy-fix commit on main to roll back code. Do not reset main or restore a whole database snapshot over newer user work.
- The additive `taxonomy_review_jobs` table can remain during rollback. Old worker versions do not claim these jobs. Keep its results for audit; no existing table needs to be dropped or reverted.

## Root Causes

The old inspiration suggestions combined current labels and generated scripts with source evidence, used token overlap and first-keyword fallbacks, excluded the current category from comparisons, and could replace a classifier's choice with a 72%-similar name. Canonicalization also silently collapsed distinct persona meanings. Those shortcuts are no longer used for inspiration suggestions or canonical assignment.

## Review Contract

- The user approved use of the existing Mac mini Codex login, not a new Anthropic API endpoint/key.
- Review jobs are separate from `inspiration_queue` and brief generation. They use only saved source copy, captions, narration and explicitly separated prior visual/creative observations. They do not claim to have rewatched media.
- New classifications continue inspecting actual media through the existing worker/skill. Their prompts now distinguish the addressed buyer from actors/incidental references and persuasive angle from format/hook, avoid forced broader matches and flag uncertainty.
- The browser queues up to four jobs at a time for its visible product. The Mac mini processes one review when classification slots are idle. Results are cached in the queue by product, inspiration and evidence/taxonomy signature.
- The worker reads authoritative same-product source/taxonomy and rechecks requester access. Product configuration is allowlisted; credentials and other products' records are not provided to the model.
- Review Codex runs with user config, plugins/apps, shell/browser/image tools and hooks disabled, read-only sandbox, no database/API credentials in its environment, and a structured-output schema.
- The runner can update only its own claimed review-job result. It never changes inspirations, ads, angles, personas, matrix cells, Action Plan entries, ClickUp tasks or briefs.
- Actionable output requires a valid same-product active category or a distinct new proposal, sufficient confidence and a quote verified against source evidence. Missing or unsupported evidence produces `Needs source review`.
- Suggestions are advisory. Clicking one shows reasoning/evidence and asks for confirmation. Only confirmation uses the existing manual inspiration-edit flow. No creative moves or brief regeneration occur.
- Failed reviews expose Retry. Product switches and source changes invalidate stale results. Old heuristic suggestion blobs are not displayed.

## Verification

- 100 JavaScript regression tests passed, including new evidence, product isolation, confirmation, cache, batching and stale-response tests.
- 10 existing No Brief worker tests and 4 new taxonomy worker tests passed.
- Existing production build passed without generated-asset or lockfile changes.
- Database tests ran in a rolled-back transaction: queue deduplication, assigned-product access, foreign inspiration rejection, forged-result/delete rejection, anonymous denial, and retry. The additive migration was then applied separately.
- Before/after snapshots: 27 products, 273 angles, 201 personas, 6,882 ads, 1,946 inspirations, 3,516 Action Plan records and 2,740 matrix cells. No missing records, product moves or new soft-deletions. Ads and inspirations were byte-for-byte unchanged. Some live-app records refreshed their timestamps; one product's `last_synced_at_ms` changed through concurrent syncing.
- No user browser was opened. End-to-end Mac mini execution and deployment status are recorded separately when observed; unit checks are not a claim that every inspiration has been reviewed.
