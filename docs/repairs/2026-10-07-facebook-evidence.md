# Facebook inspiration evidence failures

Audited ARI-INS-224, ARI-INS-299 and ARI-INS-300 in product prod-1778009469915.
All three retained their original source and had no saved classification result.
224/299 failed after Facebook returned a different archive ID. 300 failed after
base/medium Whisper could not verify Mongolian narration. These are evidence
failures, not evidence of missing database rows.

## Fix and boundaries

- Replace regex/brace-window extraction with JSON parsing of the exact archive
  object's own snapshot. Quotes, braces in copy and large objects cannot break
  the boundary; missing target media cannot borrow a neighboring ad's media.
- Facebook-only worker instructions require the exact target and permit one
  stronger local multilingual ASR attempt. Unverified speech is never converted
  to 'No voice over', captions or an invented translation.
- Explicit target/transcript evidence failures block instead of repeatedly
  retrying. Network errors retain their existing retry behavior.
- Existing No Brief, product isolation, taxonomy approval and queue ownership
  contracts remain intact. No UI, schema, auth, deletion or sync changes.
- Recovery script permits only the three audited queue UUIDs and original error
  states, takes private backups, refuses existing results and active claims,
  and waits for an updated Mac mini. Attempts, source URLs, IDs, product and
  brief flags are retained. No inspiration row is rewritten by the script.

## Verification and limitations

276 Node regression tests and all 47 Python tests pass, including Facebook,
Reddit, taxonomy, agent discovery and classification lease coverage. The older
agent-discovery fixture now initializes the same lock/future map as real workers.
Public worker/helper mirrors match.
Public HTTP access to Facebook from this machine returned 403, so parser tests
are not proof these particular ads remain accessible. Recovery must be verified
from completed worker results; inaccessible sources need original media.

Rollback checkpoint: e53572e0750764a2a70381e6c93d9f027d0478fa.
Revert code only; never restore an old queue backup over an active/completed job.

## Live recovery

Deployment 7a75f89 was verified READY, with byte-identical production assets.
The Mac mini adopted exact-ad-v1 at 06:07 UTC. All three original queue entries
were backed up and retried. 224 and 299 still lacked exact target snapshots and
were blocked without changing their inspiration rows or creating results.

The user supplied ad ID 1753736445862006 as the corrected source for 299.
A rollback-tested administrative transaction updated only that unused record's
source in inspirations, inspiration_identity and its existing queue. The
immutable-source trigger was restored before commit, its function unchanged;
history retained both URLs. IDs, product, request ID, brief flag and attempts
were preserved. No existing result, brief, creative placement or taxonomy review
existed. Private audit: /private/tmp/immuvi-facebook-20261007/.

Live observation also exposed a 10-minute stale-claim timeout despite a 20-minute
agent timeout: 300 was reclaimed while transcription was still allowed to run.
Recovery now waits for the agent timeout plus five minutes, skips active local
futures, uses compare-and-set on the original claim owner/time/state, and refuses
to claim a queue already running locally. Five regression tests cover this.

The 300 retry then reported a large-v3 SHA256/cache failure. The helper retries
that specific model load once in a unique temporary download directory.
Whisper's checksum check remains in force; shared cache files are not removed.
Other errors are not retried. Two tests cover bounded recovery and unchanged
non-checksum failures. Worker adoption and a completed classification must be
verified separately before claiming this inspiration is repaired.

The isolated large-v3 download subsequently passed its checksum, but the local
model process was killed with exit 137. Do not interpret that exit alone as proof
of OOM. The fallback now uses Whisper turbo in a fresh subprocess (no resident
base/medium tensors), original-language transcription only, and truthful model
provenance. Full-size large-v3 and concurrent large-model fallback attempts are
explicitly excluded. Evidence validation still determines whether it can save.

## Verified source corrections

The user also supplied 903515338972882 as the corrected source for 224. The same
rollback-tested, locked correction procedure preserved its identity and history.
Both 224 and 299 completed classification with exactly one result each and their
original No Brief=false setting. Their actual ClickUp pages were read back:
each has eight sections, three variations and the corrected source URL.
224 completed at 06:49:27 UTC; 299 completed at 06:24:38 UTC on 2026-10-07.
After correction, stale attempts to write the old URLs were rejected by the
unchanged immutable-source guard. No active angles/personas were created.

Deployment 958d909 is READY on production main and both published Python assets
match the tested local bytes. The Mac mini adopted isolated-checksum-v2-turbo;
300 was backed up and queued once for a fresh-process turbo attempt. Its source,
identity, attempts history and brief mode were retained. Attempt 7 ended blocked:
Mongolian narration remained unverifiable after base and turbo attempts. No
classification result or ClickUp brief was created. Automatic retries stopped;
300 requires a reliable transcript or clearer source before further recovery.
Do not report it as repaired or substitute invented narration.
