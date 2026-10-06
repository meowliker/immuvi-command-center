# Reddit Text Inspiration Failure

Q-INS-055 failed after three attempts because the media-only worker sent a
Reddit self/text post through media download and required video/image evidence.
The public original post was readable as text. The user explicitly requested
text-only analysis on October 6.

## Repair

- Reddit post routing reads the original body before deciding text versus media.
- Text results require matching source evidence in both inspiration and result,
  a retrieval timestamp/method, Text media classification, and no fabricated
  frames, timestamps, captions, or narration.
- Full briefs retain the three proposed product scripts, explicitly distinguished
  from untimed source narrative. No Brief still skips all brief/ClickUp work.
- Missing/inaccessible original text blocks automatic retries with an actionable
  reason. Transient image/video errors retain the existing retry policy.
- New text display options are scoped to text inspirations. No master taxonomy,
  existing creative, product, or relationship migration is included.

## Recovery And Verification

`scripts/retry-reddit-text-inspiration.mjs` backs up and locks one exact
product/inspiration pair, refuses existing results/source mismatches/claimed
jobs, and requeues only after a live Mac mini reports reddit-text-v1. It retains
identity, URL, attempts, No Brief mode and inspiration data; it routes this retry
to the upgraded Mac mini. No other queue is touched.

Private pre-recovery backup: `/private/tmp/immuvi-q55-text-before-20261006`.
Pre-change commit: `2d054a4b903fc816379eccaaa7935827a5a79751`.
Code rollback can revert the text-support commit; do not delete new text results
or restore the old queue after a successful run.

Verified locally: 236 Node tests, 33 targeted worker tests, and git diff checks.
Production classification completion is verified separately from code deployment.
