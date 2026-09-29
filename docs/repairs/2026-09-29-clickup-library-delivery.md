# QA ClickUp Library Delivery

## Cause And Repair

Legacy provisions a workspace-visible product Inspiration Library through the
ClickUp connector, creates or updates an inspiration page, then updates its Master
Tracker and Immuvi projection. QA instead attempted a new private Doc for every
brief; the app account received HTTP 403. That response alone does not establish
which plan or permission caused the rejection.

The user authorized the legacy method. The connector created a separate QA library
under approved list `1301130000002447`. The app account subsequently created and
updated the brief page successfully, proving its page access without extracting
its key or putting connector credentials on the worker.

The initial live write exposed two response compatibility bugs: ClickUp normalizes
Markdown and returns an empty HTTP 200 for page updates. The worker now compares
parsed Markdown and accepts empty successful PUT responses. It still requires
verified page content before updating the tracker and marking Immuvi Classified.

## Verified Result

- Library: `8cq1r3y-44896`, ASTROREKHA - QA SAMPLE Inspiration Library.
- Tracker: `8cq1r3y-118036`, contains the inspiration and its brief link.
- Brief: `8cq1r3y-118056`, `test immuvi brief-10`.
- Link: <https://app.clickup.com/9016762494/docs/8cq1r3y-44896/8cq1r3y-118056>.
- Job: `eaa477cf-0f42-4009-9e5d-5684f28f5d6b`, done, error null.
- Inspiration: `QAA-INS-001`, Classified, Devotional Marriage Listicle.
- Finished: `2026-09-29T07:12:40Z`.
- Connector readback: one tracker and one brief page; complete eight-section brief.
- Visible app verification: Classified 1, Failed 0, populated classification fields
  and the correct ClickUp brief link.

## Safety And Scope

Owner-only worker access is unchanged. All writes were limited to QA Supabase and
the approved test-list library. Production Docs, production worker, generation
prompts and the approved brief content were not changed.

Library IDs are configured explicitly per QA product. This is not automatic
connector provisioning for every future product. Recovery preserves result, number
and receipts, updates an unambiguously identified existing page, and refuses blind
recreation after uncertain writes. A new Action Plan task is a separate operation.

## Tests

641 domain/service/component tests and TypeScript checks pass. Applied database
fixtures pass and roll back. Tests cover formatting-only equivalence, changed
words/numbers/links/rows, empty PUT responses, update-in-place recovery, ambiguous
creation, test-list isolation and clearing errors only on successful publication.
