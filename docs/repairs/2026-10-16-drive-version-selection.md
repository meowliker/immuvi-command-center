# Exact Drive Version Selection

T-INS-119 (Therapy) was blocked by the old inherited-directory failure. After
the launcher recovery, its folder was found to contain three numbered MP4s.
The user explicitly selected Version 2; exact source identifiers are retained
only in the private recovery backup. The already-running folder attempt had chosen
Version 1 as its primary timeline, so that result must not be accepted as the
user-selected final analysis.

## Scope

Optional sourceMediaSelection is exact inspiration/product/folder scoped.
Only jobs with an explicit selection get the selected-file contract and
verification. Unselected jobs keep their existing classification behavior.
The saved source URL, identity ledger, No Brief setting and product ownership
are not changed. No identity trigger is disabled and no schema changes occur.

The contract requires confirming the selected file is in the saved folder,
inspecting only that media, updating the same result and existing brief page,
and retaining sourceMediaSelection. Verification checks selected file ID/name,
actual-file SHA-256, matching primary_media and a single selected source_asset.
A captured selection cannot be dropped to bypass verification, and a prior
folder-wide result cannot trigger the already-complete shortcut.

Review-cache evidence also carries only the selected folder/file identity and
pending/analyzed state. This invalidates a folder-wide, sibling-version or
pre-analysis review without treating filenames as persuasive evidence. Normal
unselected review input and category creation/confirmation rules are unchanged.

Recovery must wait for the old attempt to release its claim before saving the
selection and retrying the same queue UUID on a worker advertising
drive_media_selection=exact-file-v1. Back up old data/results before replacement;
do not delete any inspiration, creative, result or brief page. Keep source and
taxonomy guards intact. Inspect saved file provenance and the actual ClickUp
page before reporting the selected-version classification complete.

Private evidence: /Users/anaytripathy/.codex/backups/immuvi-t-ins119-20261016.

## Live Verification

The selection and review-cache guards deployed READY on main.
The served worker/core assets matched tested local files byte-for-byte.
The Mac mini self-updated while idle and advertised exact-file-v1 before the
selection was saved. No additional service restart was needed.

The original folder attempt released its claim before the scoped operator
transaction backed it up, added the user's sourceMediaSelection and requeued
the same queue UUID. The prior result and brief were retained during processing,
not deleted. The selected-file attempt completed classified with no queue error.
Readback at 13:16 UTC on October 16 verified exactly one result, the same result
row and existing ClickUp page, original folder/ID/product/brief mode/added-by/time
and usage, and Version 2 as the only primary/source asset.

The selected-file checksum and media metadata are retained in private evidence.
An independent ClickUp GET confirmed the correct product library, selected
filename and all eight brief sections. Supabase readback confirmed three
structured scripts. The earlier folder-wide Version 1 result was not accepted
as the selected final analysis.

Unrelated inspirations were unchanged. All pre-existing creative and taxonomy
content/IDs were preserved (some category updated_at values changed). During
processing, a browser-tagged placement created TH-139-INS-119 and two approved
categories from the earlier candidate names. Their notes explicitly identify
placement of T-INS-119 and creation_approved=true. These concurrent records were
preserved; this recovery did not retag or remove that independent creative.
The Version 2 inspiration's adaptation proposals remain inspiration-local.

70 Python unittest tests and 331 application tests pass, including no-selection
compatibility, source/product scoping, stale-result rejection, selection-loss
rejection, file/checksum evidence, review-cache invalidation and mirror parity.
Private prior/final snapshots and verification JSONs are retained. QA was not
modified.

The repository is public. With explicit user approval, the three recent repair
commits were replaced with sanitized history, removing the earlier source-file
reference from reachable main history. A private rollback bundle is retained
outside the repository. No media or credentials were uploaded. Cached old
commits and external clones may still retain the earlier reference.

Pre-change main: 4afca8b. Rollback code by reverting this repair, never by
restoring stale records over concurrent activity. QA is not modified.
