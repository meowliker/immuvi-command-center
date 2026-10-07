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
