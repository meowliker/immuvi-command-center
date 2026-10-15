# ClickUp Product Ownership

## Incident

Kids Mental Health tasks displayed Canva in ClickUp, and Canva tasks displayed
Kids Mental Health. Their Immuvi product IDs and ClickUp lists were correct; the
incorrect value was the ClickUp Product custom field.

Product writes reused numeric dropdown positions from cached field metadata,
copied raw Product values from source tasks, fuzzy-matched names, and resolved
delayed writes through the currently selected product. These paths could send
the wrong option even though the creative itself had the correct owner.

## Prevention

- Product writes use stable option UUIDs, never dropdown positions or fuzzy matches.
- The owning product, API key and field map are captured before asynchronous work.
- Product is not inherited from a source task or OneScale display name.
- Late field schemas cannot install into another selected product.
- The server verifies the actual task/list owner and corrects legacy numeric
  writes from already-open clients. Contradictory or ambiguous ownership fails
  before any ClickUp write. Unrelated requests do not need the catalog.
- The catalog is cached for one minute with single-flight reads. Failed writes
  are not automatically retried; upstream rate-limit timing is preserved.
- The task editor cannot reassign the Product field independently of ownership.

No new database tables, migrations, AI calls, taxonomy changes, or refresh timers
are introduced. Server credentials remain server-side and are never forwarded
to ClickUp or returned to browsers.

## Recovery Scope

The read-only audit covered all 27 products. Live ClickUp dropdown metadata was
checked for 26 uniquely mapped products. Only the three binding keys
`clickup_product_field_id`, `clickup_product_option_id`, and
`clickup_product_name` are added to existing product configuration.

The confirmed repair set is 15 app-created tasks: seven Canva, six Kids Mental
Health, one Kids Life Skill, and one Patchwork. Each requires matching Immuvi
ownership, the expected live ClickUp list, the audited incorrect Product value,
and an app-created tag. Only the Product field and its two Immuvi metadata
mirrors are updated, with readback and comparison of all other task fields.

Historical alternate labels such as Nursing and Couple (priced) are not mass
renamed. Medical retains Nursing as its established default. The placeholder
product Y shares Yoga Notes' list and has no unambiguous Product option; it is
left for review rather than guessed or merged.

CW-INS-093 was retried once with its original exact Facebook ad ID and briefs
enabled. The worker again reported no verifiable media for that exact ID. The
user subsequently requested leaving it; the blocked record is preserved, with
no replacement media, fabricated classification, or generated brief.

## Verification and Rollback

- JavaScript regression suite: 308 passing tests, including 16 new ownership tests.
- Classification regression subset: 29 passing Python tests.
- Production catalog/ClickUp read-only guard checks cover canonical create
  payloads, old-client writes and rejection of a conflicting product hint.
- Private before/after records and per-task verification are stored locally at
  `/Users/anaytripathy/.codex/backups/immuvi-product-ownership-20261015`.
- The pre-change code revision is `296821f`. Revert this repair commit on main
  to roll back code; never reset shared history or touch QA.
- Data rollback must use the private snapshots, restore only the three binding
  keys and the affected Product fields, and reject intervening edits. Never
  restore whole product configs, task snapshots or creative metadata wholesale.

Tests exercise the relevant backlog protections: product isolation, tombstones,
taxonomy approval, No Brief, exact-source evidence, notes, relationships,
read-only manual refresh and the one-minute automatic refresh budget. This is
scoped regression evidence, not a guarantee that all future bugs are impossible.
