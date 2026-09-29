# ClickUp Product Linking

Compared against the repository legacy HTML on 2026-09-28, without browser use.

## Legacy Reference

- `openLinkClickUpModal` (line 34652 vicinity) opens a workspace/space/folder/list
  picker with manual ID/name fallback.
- `selectCUList` calls `saveProductClickUpLink` (line 33914 vicinity), which saves
  the selected product's list and starts sync when the active product has a key.
- `fetchAndStoreFieldMap` (line 29056) detects known field names automatically.
  Users do not complete a mapping form before connecting.
- `setupClickUpFields` explains missing custom fields; it does not create them.

## Native Flow

- Link ClickUp list opens a dialog with the approved QA list, its fetched name,
  and space/folder context when supplied by ClickUp. Manual URL/ID entry remains.
- Selecting the list saves the product link with server-side automatic field
  detection, then requests the initial import. No mapping dropdowns or separate
  Save list and fields step remain.
- Missing custom fields do not prevent linking or importing native task fields.
- Import re-detects current field IDs; recreated fields cannot leave import
  permanently bound to obsolete IDs. Duplicate-name fields prefer populated
  option sets, while Angle Tag / Persona Tag retain priority.
- The initial import reads the newly saved product on the server rather than
  waiting for a realtime client refresh. A failed import explicitly reports that
  the list was linked and can be synced again.
- Successful import enables live sync. An external list change pauses it.
- Account identity, admin-only configuration, versioned saves, duplicate-product
  link checks and task ownership checks remain in force.

## QA Boundary

Only list `1301130000002447` (Immuvi Test 1) is offered and accepted. It replaced
`901616718146` on 2026-09-28 at the user's request. Unlike the legacy full-workspace
picker, this QA picker does not enumerate production lists. Link and initial sync
do not issue ClickUp task writes. No live task changes, schema migration or
production enablement were performed for this implementation.

## Verification

- TypeScript check passed.
- 530 domain/service tests passed, including added automatic-link, missing-field,
  replaced-field import and forbidden-list cases.
- Existing browser fixtures were updated for the list dialog and automatic
  mapping flow, but were not executed; browser use was excluded by the user.
- Actual authenticated link/import acceptance remains to be performed by the
  user on the approved disposable list.

## Product Controls Follow-Up

- Product Profiles now has Add Product in its header and the legacy inline row:
  product, green linked-list badge, Change, Unlink, purple Sync Now, Setup Fields,
  Clean stale, last-sync time/task count, Manage Fields, and right-aligned Delete.
- Unlinked products show Link ClickUp List instead of unusable sync controls.
  Admin-only changes remain unavailable to members.
- Removed the duplicate refresh/settings/configuration buttons and health-facts
  grid. Errors and recoverable pending operations remain available.
- Link popup uses compact space/folder/list rows, Select, Manual entry (fallback),
  Save, and Cancel. The list name is fetched from ClickUp rather than requiring
  the user to type it. Only the QA allowlisted list is shown.
- Setup Fields explains the three automatically detected dropdown fields and
  their product-specific options. Product dialogs share compact typography,
  white surfaces, purple primary controls, and existing confirmation safeguards.
- Five component-render regression tests cover linked/unlinked states, exact
  action ordering, permissions, disabled sync, and picker controls. Browser
  fixtures have been updated but were not executed.

## Requested QA Seed Cleanup

Executed the separately reviewed one-time repair in
`docs/repairs/2026-09-28-remove-astrorekha-seed-tasks.sql` against QA project
`entgcnlfsnysnwyadzzp` only. Audit record **571** retains pre-change snapshots.

- Soft-deleted 27 unlinked `qaSample` creatives, added local tombstones, and
  removed their matrix assignments.
- Removed five unlinked `qaSample` action-plan records.
- Verified zero active creatives and zero actions for `qa-sample-astrorekha`.
- Preserved 16 angles, nine personas, five inspirations and one completed image
  run. Other products and all remote ClickUp tasks were untouched.
- No active work was present. The repair refuses changed counts, remote task
  identities, active work, an unexpected product name, or a repeated execution.

## Outbound Field Detection Follow-Up

Single-creative edits, bulk pushes and task creation now detect current fields
by name from the live list schema, just like import. Empty or obsolete saved
mapping IDs no longer suppress fields added after linking. Ownership checks and
the test-list allowlist remain unchanged. Verification: 539 domain, service and
product-control tests passed; TypeScript check passed.

Live inspection on 2026-09-28 still found none of the creative fields on list
`901616718146`. Add these to **Immuvi test only**, not its parent space:

| Field | Type / options |
| --- | --- |
| Angle Tag | Text |
| Persona Tag | Text |
| Inspiration Link (optional dedicated field) | Website / URL; otherwise retained in the task description |
| Drive Link | Website / URL |
| Photo/Video | Dropdown: Photo, Video |
| Funnel Type | Dropdown: TOF, MOF, BOF |
| Creative Structure | Dropdown: product's Setup Fields options |
| Hook Type | Dropdown: product's Setup Fields options |
| Production Style | Dropdown: product's Setup Fields options |
| Creative USP | Text |

For variation testing also add Parent Ad (Text) and Variation Number (Number).
These two are optional, not prerequisites for the standard inspiration workflow.
Use native task name, description, assignees and due date rather than duplicate
custom fields. No manual ID mapping is required after creation.

The inspected list has only not started, in progress and completed statuses.
Exact lifecycle round trips require corresponding list-only statuses, including
Untested, Approved, Assigned, In Production, Ready to Launch, Testing, Mild Winner,
Winner, Scale, Loser, Killed and Complete. Do not change inherited production
statuses. Step 1 remains incomplete until schema setup and an authenticated
disposable create/edit/import round trip have been verified.

## Legacy Field Compatibility Follow-Up

Compared the supplied legacy field screenshot with `fetchAndStoreFieldMap`,
`pushFieldToClickUp`, `importTasksFromClickUp` helpers and the description
hydration helpers in `immuvi-command-center.html`. No browser or production
ClickUp mutation was used.

- Angle Tag / Persona Tag are primary text values. Angle / Persona dropdowns
  are secondary mirrors when a matching option exists. Single edits now mirror
  both, matching bulk pushes; missing options and write failures retain the
  pending edit rather than claiming the mirror succeeded.
- Bulk mirror selection now uses the same populated-option preference as import
  and single writes. Pending edits are acknowledged only after both writes.
- Creation uses matching secondary dropdowns, ignores unused duplicate fields,
  and does not fail solely because an optional dropdown lacks an option when
  the authoritative text tag is available. Dropdown-only fields still validate.
- Imports fall back from empty text tags to dropdowns and labeled descriptions.
  Source ad URLs can be recovered from plain or Markdown description fields, so
  Inspiration Link is not a mandatory extra custom field.
- All custom fields retain their display/raw data, including Reviewer, Product,
  Notes, dates, IDs, Spend and Revenue. As in legacy, the displayed Editor is
  mirrored from native task assignees. No extra Editor field is required.
- The screenshot's names cover the core legacy schema; actual dropdown options,
  task statuses and the QA list's schema still need live acceptance checks.
  This does not establish worker or output-delivery readiness.

Verification: 544 domain/service/product-control tests passed; TypeScript check
passed. Regression cases cover dual writes, missing options, clears, duplicate
dropdowns, import fallback, native Editor and legacy custom field types.

## Replacement Test List Activated

The approved destination is now **Immuvi Test 1**, ID `1301130000002447`, in
workspace `9016762494`. Prior-list inspection notes above are historical.

- Updated the shared application allowlist, cleanup and source-sync UI references.
- Applied QA migration `20260928030000` to project `entgcnlfsnysnwyadzzp` only:
  seven database routines and the creation-list constraint now permit the new
  list, not the old one. Historical migrations were not edited.
- Relinked `qa-sample-astrorekha`, cleared old sync metadata and saved old/new
  configuration in audit record **574**. Preserved the one active imported
  creative and all remote tasks. Task ownership checks reject writes to its old
  list through the replacement list. No old task IDs were reassigned.
- Remote inspection confirmed Untested, Approved, In Production, Ready to
  Launch, Testing, Winner, Loser, Scale and Complete statuses.
- The new list currently exposes 14 custom fields. Angle Tag, Persona Tag,
  Creative Structure, Hook Type, Production Style and Creative USP are absent.
  Angle/Persona dropdowns are also absent but optional when tags are present.
- Direct database-password authentication was unavailable. The migration and
  relink were executed transactionally through the authenticated management API,
  with the linked QA project guard and migration history recorded atomically.

Verification: 545 domain/service/component tests and TypeScript passed. SQL
import/link tests passed inside rolled-back transactions before and after the
change, including retired-list rejection. Database verification found seven new
list guards, zero old-list guards and the new strict creation constraint. Local
server returned HTTP 200. No real task creation or worker dispatch was performed.
