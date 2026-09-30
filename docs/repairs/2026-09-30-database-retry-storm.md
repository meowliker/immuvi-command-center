# Database Retry Storm

## Diagnosis

The Sep 29 inspiration identity guard raised SQLSTATE `40001` for an application-level stale revision. The Sep 30 variation notes function used the same code for stale notes. Those conflicts cannot succeed by retrying an unchanged request. Affected PostgREST versions automatically retry `40001`, tying up their database pool and generating repeated errors.

Observed before repair: REST product/profile reads timed out at 8-12 seconds while direct SQL and the Auth health endpoint were responsive. About 17 authenticator sessions repeatedly executed inspiration UPSERTs in short transactions, often aborted. The user's dashboard showed 100% CPU and over 8.5 million PostgreSQL errors. Both live functions were confirmed to contain `40001`.

Reference: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

The database restarted during diagnosis (postmaster start 2026-09-30 09:54:27 UTC); this repair did not initiate that restart. Activity had already dropped before the function migration. Do not attribute all immediate recovery to the migration: the code change prevents the same stale-edit requests from restarting the loop.

The Management API log endpoint returned a backend error, so individual historical PostgreSQL error log lines were not retrieved. The diagnosis rests on live function definitions, observed SQL activity, reproduced stale UPSERT conflicts, and Supabase's documented retry behavior.

## Repair

Applied `20260930000200_nonretrying_edit_conflicts.sql` to the production Immuvi database. It changes only the error literal `40001` to `PT409` in two existing function definitions. No identity checks, authorization, grants, row ownership, tables or triggers are removed. PostgREST returns a terminal HTTP 409 conflict instead of internally retrying.

The notes API now explicitly maps `PT409` to HTTP 409, preserving legacy `40001` handling for deployment compatibility. The notes verification helper also applies the follow-up migration when provisioning the function.

## Verification

- Function definitions compared before/after: only the error literals changed.
- Full-row hashes and counts unchanged during migration: 1,995 inspirations, 6,927 ads, 27 products.
- Rolled-back SQL tests: notes save/readback, idempotence, stale-edit rejection, wrong product, unauthorized user.
- Rolled-back SQL tests: stale inspiration UPSERT returns `PT409`; source and product changes remain rejected; original inspiration unchanged.
- No remaining public function bodies contain `40001`.
- Post-repair Auth health / products / profiles / inspirations HTTP 200; first measured REST reads 55-186 ms.
- 145 focused automated regression tests passed.
- No user browser or password was used. A complete interactive sign-in still needs the user's confirmation.

## Backup and Rollback

Private backup: `/private/tmp/immuvi-conflict-retry-backup-1790762124573/`.
Contains previous exact function definitions, before row counts/hashes and verified after state. The previous application commit is `1ab1a516a52be31701bbe7cb96933f6818b49214`.

Do not restore the old `40001` literals on an affected PostgREST version: this would reintroduce the outage. Reverting the API change does not require reverting the database fix. Historical migrations are retained unchanged; fresh deployments must apply the follow-up migration too.
