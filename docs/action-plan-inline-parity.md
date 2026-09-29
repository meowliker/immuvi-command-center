# Action Plan Inline Editing Parity

Code comparison: `immuvi-command-center.html` column registry, custom field
registry, list schema installation, and task drawer (around lines 21402, 21628,
24407, and 30693). No browser comparison or production writes were performed.

## Table

- Retains the legacy built-in columns, resizing, selection, saved layouts and sorting.
- Discovers custom columns from the linked list schema, including empty fields.
- Dedicated Angle and Persona columns appear beside the task name by default,
  including in older layouts and before the ClickUp schema loads. They resolve
  the list's mapped tags or dropdowns for editing. Raw tag columns remain optional.
- New creative structure, production style, creative USP,
  funnel type, photo/video and product columns appear by default. Other fields
  are available under Columns and views. Existing explicit visibility choices
  and saved widths/order are preserved.
- Status and due date retain their workflow-specific save paths.
- People, dropdown and label fields are editable inline. Angle/persona tags use
  the product taxonomy and canonical creative save, not raw custom-field writes.
- Text, dates, numbers and other supported fields remain readable in the table
  and editable from the drawer. Unsupported types stay read-only.
- Real Editor custom fields and native task assignees are separate. Editor uses
  native assignees only when the list has no real Editor field.

## Task Drawer

- Task name or non-control row click opens the right-hand drawer.
- Retains Media Buyer/Strategist modes, status, due date, links, provenance,
  history, matrix navigation, winning artifacts and guarded removal controls.
- Assignments use compact searchable multi-select popovers.
- Other ClickUp fields use type-aware editors inside the drawer.
- Creative details expand inside the drawer; Action Plan no longer mounts the
  large assignments or creative-detail form dialogs. Production's separate
  editor workflow is unchanged.

## Save Behavior

- Inline selections display immediately while saving; failed saves roll back.
- Saves use the existing versioned, product-scoped QA RPCs and pending-write
  acknowledgements. Remote failures retain pending changes and report them.
- Canonical taxonomy writes retain dual tag/dropdown ClickUp writes. Unknown
  taxonomy/options are rejected rather than creating remote definitions.
- Linked ClickUp angle/persona values override stale Action Plan snapshots;
  explicit clears are not repopulated from old brief descriptions.

## Verification

- TypeScript check passed.
- 591 domain/service/component tests passed, including new field routing,
  picker interactions, failure rollback, custom types and sorting coverage.
- Installed QA `qa_plan_fields` and `qa_plan_creative` database fixtures passed
  inside rollback-only transactions.
- Browser regression fixtures updated but not executed, per the code-only
  request. Live outbound edits to the user's ClickUp tasks were not performed.
