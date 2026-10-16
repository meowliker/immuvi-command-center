# Confirmed Orphan Action Cleanup

## Exact Case

The new screenshot identifies `AD-12837`. Production inspection found:

- Astro Rekha Action Plan row `8caa32cc-e4e8-4114-814a-dab7c5d4fbfe` is titled
  `AR-261-INS-127`, references source ID `AD-12837`, and links task `86d46v3hg`.
- No Astro Rekha creative exists for that source or ClickUp task. ClickUp returned
  404 for the exact task during a read-only check.
- The global creative ID `AD-12837` now belongs to a different, soft-deleted
  Kids Life Skill creative, `KL-460-INS-164`, with a different ClickUp ID and its
  own explicit deletion history. It must not be deleted, moved or restored.

The earlier `c3481fe` repair resolves a missing display ID to an existing saved
creative. It cannot resolve this case because the Astro Rekha creative is absent
altogether. This is an orphan Action Plan reference with a legacy ID collision,
not a ClickUp personal-key authorization failure. The screenshot's rejection is
before ClickUp deletion. The user's successful deletion in another browser was
not replayed, so its exact cached state is unknown.

## Approved Scope

The user requested leaving the existing entry untouched, and approved adding a
separate explicit confirmation for stale-entry cleanup. There is no automatic
cleanup, production entry removal, broad ownership trigger or ID-generator change.

- After the normal creative lookup fails, request a read-only orphan preview.
- Preview and confirmation both authorize the existing Supabase caller and check
  the exact product, source reference, saved action UUID and ClickUp identity.
- Require a second user confirmation before committing cleanup. Cancel, changed
  identity, product switch, access failure and missing readback preserve state.
- Remove only the selected Action Plan row and add a product/action-scoped marker.
  Never reuse the foreign source ID as a global deletion marker.
- The cleanup option does not delete or update any creative or ClickUp task.
  It does not purge matrix data, unlink inspirations or flush a product snapshot.
- Normal verified creative deletion retains its prior behavior. No refresh
  timers, taxonomy creation or product-label rules are changed.

The broader legacy ID-collision prevention proposal was deliberately not applied
under this deletion-only scope. This option safely handles orphan references; it
is not a claim that all historical creative identity issues are repaired.

## Verification

328 application tests pass, including confirmation/cancellation, exact action
selection, product switching, no ClickUp calls and preservation of unrelated
creatives, matrix state, inspirations and production entries.

Database tests reproduce a source ID belonging to another product, including its
existing explicit deletion marker. Preview changes nothing; only an explicit
confirmation removes the synthetic orphan entry. Foreign records and history,
independent entries, authorization, conflicts, idempotence and anonymous denial
are checked. The entire fixture/function transaction rolls back.

Migration `20261016000200` adds only the security-invoker orphan cleanup function
and grants. After installation, the real `AD-12837` preview was run under an
authorized member role in a READ ONLY transaction. Before/after snapshots prove
the real entry, foreign creative and history remain unchanged. Existing `ads`
triggers are unchanged. No real task or entry was deleted.

Private snapshots and installation evidence:
`/Users/anaytripathy/.codex/backups/immuvi-confirmed-orphan-cleanup-20261016`.

Pre-change code is `c3481fe`. Revert this repair commit on main to roll back code;
the unused additive function can remain or be dropped separately. Never restore
whole snapshots or undo legitimate confirmed removals. QA was not modified.
