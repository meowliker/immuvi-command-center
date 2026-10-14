# M-INS-181 provider outage

M-INS-181 belongs to Medical, prod-1777624706026. Its saved source is the
original gretawhite9 TikTok URL with video ID 7694315133543140615.
No classification result or brief existed at diagnosis. The saved failure
reported Codex 503 / selected model at capacity, after three attempts.
An explicitly requested retry then returned a Codex 429 rate limit.

The worker previously counted temporary provider failures as content failures.
Recognized Codex capacity/429/503 failures now pause classification dispatch
for the existing five-minute cooldown, return the exact claimed row to pending,
and restore the attempt consumed by that unavailable-provider run. Compare the
claim owner/time and product before updating. Source HTTP errors, authentication
errors, missing fields and media/evidence errors retain their existing handling.
Model selection, credentials, source content and brief mode are unchanged.

The CLI failure excerpt now includes stderr even when stdout is nonempty, so
the actual provider error cannot be hidden by a printed prompt.

57 Python tests passed, including service/error distinction, claim isolation,
attempt preservation, dispatch cooldown and existing classification guards.
Private original-record backup:
/Users/anaytripathy/.codex/backups/immuvi-m181-20261014.

Recovery must wait for provider_outage=cooldown-v1 in the live worker registry
before requesting the next retry. Completion requires saved source identity,
classification and the actual full ClickUp brief to pass verification.
