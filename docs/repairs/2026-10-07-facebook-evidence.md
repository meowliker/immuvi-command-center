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

276 Node regression tests, 8 Reddit evidence tests, 4 taxonomy-worker tests,
and 7 new Facebook tests pass. Public worker/helper mirrors match.
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
