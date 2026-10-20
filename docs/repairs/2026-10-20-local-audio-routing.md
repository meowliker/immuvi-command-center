# Local Audio Verification Routing

## Cause

A TikTok inspiration exhausted content retries after the classification agent
selected a credit-based remote audio analyzer and its fallback never finished.
The active worker already had the isolated-working-directory fix and local
ffmpeg/Whisper tools. This was a separate routing gap: Facebook's extra contract
explicitly constrained transcription to local tools, but the shared narration
contract did not explicitly prohibit remote analyzer jobs.

## Scope

The shared classification prompt and published skill now require local source
audio verification on every platform, with no remote media-analysis uploads,
credit-based analyzer jobs or queued external fallback. Local acoustic evidence
must be corroborated; ASR failure or classifier output alone cannot prove that
narration is absent. Confirmed music-only videos remain eligible for full briefs.

No Brief retains optional narration and never requires larger ASR models or a
brief. Normal briefs retain source/transcript verification and bounded local
Whisper escalation with isolated checksum recovery. A specific local-tool
failure marker is infrastructure failure, not a spent content attempt. Ordinary
source, unclear-audio and unrelated provider errors retain their old handling.

Workers advertise local_audio_verification=local-only-v1 at startup and on
heartbeat. Three worker copies and two skill copies must remain identical.
No frontend, schema, product routing, taxonomy creation, deletion, refresh,
credential or permission changes are included.

## Verification And Recovery

75 Python worker tests and 331 application regression tests pass. Coverage
includes every platform in both brief modes, checksum and speech safeguards,
precise infrastructure-error detection, retry preservation and mirror parity.
This verifies prompt/routing behavior, not the accuracy of every future model
analysis. A readable source and actual evidence remain required.

The skill's embedded pipeline also imports the existing checksum-safe model
loader rather than calling the shared-cache Whisper loader directly.

The main deployment was verified READY, with served worker/skill assets matching
the tested files. A fresh Mac mini heartbeat advertised local-only-v1 before the
single backed-up queue row was retried. It completed on that operator retry
without resetting the previous attempt count. Independent readback confirmed
exactly one result, the original source/product/ID/full-brief setting, the
original product library, all eight brief sections and three structured scripts.
Saved audio evidence names local ffmpeg and cached AST/CLAP inference, explicitly
distinguishing incidental speech from ad narration and recording uncertainty.
No exact dialogue was invented. Existing creatives, taxonomy, matrix cells,
Action Plan entries and unrelated inspirations were byte-for-byte unchanged.
No matching credit-dependent failures remained in the all-product queue audit.
Detailed source/audio evidence and page verification remain in private backups.

Before a recovery, privately back up the selected product state and queue row.
Wait for an enabled fresh worker to advertise the new capability. Retry only
the exact authorized, unclaimed source/product/ID with unchanged brief mode and
no saved result to overwrite. Retain historical attempt counts. Independently
verify the final result and product-library brief, then compare existing records
with the baseline. Do not reset unrelated failures or publish live source URLs.

Pre-change main: c13deff55483d9a4c78678a7cb9ceee01ffa891d. A private rollback
bundle and pre-recovery snapshot are retained outside the public repository.
Revert the repair commit to roll back code; never overwrite active records with
old snapshots. QA is untouched.
