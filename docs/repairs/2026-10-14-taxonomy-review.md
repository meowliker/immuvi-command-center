# Taxonomy review recovery

## Confirmed cause

KMH-INS-216's latest completed review contained evidence structurally identical
to the current inspiration. JSONB reordered object keys, so JSON.stringify
comparison incorrectly displayed "Evidence changed - re-review".

The completed review separately failed quote validation. Raw agent output was
not retained, so its exact invalid citation cannot be reconstructed. The schema
now requires bare evidence field names and the prompt requires exact contiguous
quotes. Known source paths are safely normalized; fabricated/paraphrased quotes
still fail. Original voice_over timeline segments now participate in evidence.

## Changes and boundaries

- Compare evidence independently of object key order; preserve array/text order.
- Allow explicit re-review of completed jobs, with product authorization,
  deduplication and queue limits. No automatic reset of completed results.
- Retain four-job client concurrency and existing cache signatures/version.
- Never mutate creative labels, taxonomy, source content or briefs from reviews.
- Mirror the shared core across browser and Mac mini distributions.

KMH-INS-219 and KMH-INS-220 were blocked by unverified audio transcription with
briefs enabled. Neither has a saved result. They remain preserved pending source
media/transcripts or explicit permission for No Brief classification. Do not
silently switch modes or remove narration verification from full briefs.

## Separate requested restoration

AR-391-INS-247 remained a Winner with an intact cell assignment. Restored only
its archived Soulmate Sketch Recognition angle and added its exact missing
persona, Romantic Seekers Curious Whether They Already Know Their Soulmate.
A rollback rehearsal preceded the commit. Fingerprints of eleven protected
tables, including creatives, inspirations and matrix assignments, were unchanged.
Private backups: /private/tmp/immuvi-ar391-1791958351778.

## Verification

280 Node tests and 50 Python tests passed. Database rollback tests cover retry,
deduplication, RLS, foreign-product rejection and anonymous access denial.
No QA files were changed. No blanket claim that unrelated backlog bugs cannot
recur is made.
