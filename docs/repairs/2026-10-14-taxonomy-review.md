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
briefs enabled. The user subsequently confirmed that both exact source videos
have music and on-screen text, not spoken narration. Brief mode remains enabled.

## Follow-up: missing cell and music-only sources

KMH-INS-216 also had a blank saved angle. A rollback-tested, source-grounded
repair selected the existing Dysregulated Kids category and retained its exact
existing stressed-parent persona. Pending review entries were completed as
explicit manual-source-review results with exact source quotes, not claimed as
Mac mini output. Only its data.angle changed; briefs/scripts, other inspirations,
creatives, assignments, master categories and queues were fingerprint-verified
unchanged. Private backup: /private/tmp/immuvi-kmh216-cell-1791959206014.

The audio helper incorrectly assigned has_voice=bool(transcript), which treats
ASR hallucinations over music as verified speech. It now marks ASR output as a
candidate requiring narration review. The worker explicitly separates narration
presence from transcription success, accepts confirmed music-only sources for
full visual/text-led briefs, and preserves the unknown-narration failure guard.
Exact-source user confirmation is allowlisted and scoped to inspiration ID,
product and URL; it cannot carry arbitrary prompt instructions. No Brief remains
an independent setting. These two confirmations were saved with private backups
under /private/tmp/immuvi-kmh-music-1791959368603 before any retry.

The follow-up passes 280 Node and 54 Python tests, including music-only full
brief acceptance, exact-source confirmation isolation and all previous unknown
audio/No Brief guards. No QA changes or master taxonomy creation are involved.

## Verified production outcome

Production release de8a7a9 served byte-identical worker/skill assets. The Mac
mini advertised music-aware-v1 before the two exact jobs were retried once.
Both finished classified on attempt 2, with no error, no_brief=false, one result
each, No voice over, user-confirmed music-only provenance and three scripts.
The actual ClickUp pages were independently read through the existing API and
contain all eight sections and timed visual/text-led breakdowns:

- KMH-INS-219: page 8cq1r3y-125476, Study Claim to Family Checklist.
- KMH-INS-220: page 8cq1r3y-125456, Tried-Everything Static Testimonial.

Both reuse ADHD Kids. Parents Seeking ADHD Support remains a local proposal
with persona_needs_review=true; no master persona was created. Source IDs,
URLs and brief mode were retained. Durable private rollback and verification
snapshots: /Users/anaytripathy/.codex/backups/immuvi-kmh-20261014.

KMH-INS-216's live repaired record and review were additionally passed through
the deployed review client without browser use: both axes return Match confirmed
and the drawer's required angle/persona values are nonempty.

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
