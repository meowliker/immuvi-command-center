# Inspiration No Brief

The checkbox beside the URL input is unchecked by default. Its value is captured
for each new inspiration, persisted as `data.noBrief`, and sent to the queue as
`no_brief`. Mixed queues and retries retain each item's original choice.

Classification-only jobs still inspect the source media and validate taxonomy,
format, caption and narration. They skip the creative brief, three variation
scripts, ClickUp document creation and missing-brief repair. Existing briefs are
not deleted. Normal jobs retain the existing full-brief validation.

## Deployment

Apply `20260923090000_inspiration_no_brief.sql` before deploying the frontend and
worker. It adds a default-false column and prevents workers without the
`classification_only` capability from claiming No Brief jobs. Workers update
from the deployed team-skill assets; active workers drain jobs before restarting.

The migration was applied to Immuvi on 2026-09-23. The column and guard function
did not exist beforehand. No existing inspiration or brief content was changed.

## Verification

- `node --test tests/inspiration-no-brief.test.mjs`
- `python3 -m unittest tests.test_classify_no_brief -v`
- `node tests/db/test_inspiration_no_brief.mjs` (requires database credentials;
  all fixture and schema writes are rolled back)

## Rollback

Revert the feature commit to remove the checkbox and worker mode. Leave the
additive schema in place while any No Brief jobs exist: the guard prevents old
workers from generating unwanted briefs. Do not reset those jobs to full-brief
mode or delete existing results. To remove the schema entirely, first resolve
all No Brief jobs with the user's approval, then remove the trigger, function
and column. Previously saved `data.noBrief` flags should remain as history.
