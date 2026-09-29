# Private Brief Validation Parity

## Incident

`QAA-INS-004` downloaded and generated its Instagram brief successfully, but QA
rejected it with `Variation 1 does not preserve the reference beat structure.`
The sixth observed beat was `Approx. 0:15 sample`; the proposed adaptation was
`Approx. 0:15-0:18, proposed`. Both had six rows in the same label order. The
brief explicitly distinguished observed evidence from a proposed ending.

The QA validator required identical row counts and literal time/label strings.
Legacy's prompt says preserve those *where possible*, and its runtime verifier
checks complete scripts, not literal equality. That extra QA check was removed.
No generated words, timings, source evidence or prompts were changed.

## Comparison

Reviewed `team-skill/SKILL.md` Steps 3-6 and
`team-skill/classify_worker.py` `_verify_inspiration_row` and
`_verify_clickup_brief_page` against the private media adapter, result validator,
delivery service and retry path.

| Situation | Outcome |
| --- | --- |
| Proposed beat timing differs from observed sample | Accepted, as in legacy; fidelity remains in the shared prompt |
| `sourceFormatMatch` / `scriptBreakdown` aliases | Accepted and normalized to the QA import keys |
| `Field` or `Strategy Snapshot`; `Direction` or `Value` | Both legacy header forms accepted |
| Case, emphasis, escaped heading numbers, slash spacing | Parsed as Markdown rather than compared as literal header strings |
| Extra prose mentions Source Format Match | No false failure from counting the phrase globally |
| Missing sections, missing scripts, empty breakdown cells | Rejected before publication |
| Tables appearing only inside fenced examples | Not counted as the actual brief tables |
| Explicit classifier failure or incorrect factual media type | Still rejected |
| Narration uncertainty | Existing QA policy retained: explain uncertainty and use verified visual evidence; never invent narration |
| ClickUp rewrites Markdown formatting | Rendered-content equivalence still required; separator spacing fixed separately |
| Missing permissions or uncertain create receipts | Still fails safely; does not claim success or blindly create another page |
| Retry with a saved validated result | Reuses the result and known page identity; owner-authorized dispatch still required |

Legacy can accept a permission-gated page based on a complete database payload.
QA intentionally retains its stricter verified-delivery requirement and approved
test-list boundary. These are not content-format parity failures. Source access
restrictions, provider outages and genuine incomplete results can still fail;
this audit is not a guarantee that every future source will be accessible.

## Verification

- Replayed the retained Instagram result against the repaired validator: all
  eight sections and three scripts pass without content edits or regeneration.
- Replayed retained successful Facebook and Drive briefs: both pass. An older
  explicit source-evidence failure remains rejected.
- Added regression cases for proposed timing/row adaptations, aliases, table
  header variants, repeated field mentions, malformed tables and fenced examples.
- Full domain, service and component suite: 664 tests passed. TypeScript passed.
- Restored only the validated result on failed job
  `ed3d91ed-c7f1-493a-9772-68aa4ce823b1`, after checking its owner, source URL and
  version, approved list, empty delivery receipts and absence of a published
  result. Status remained failed pending the normal authenticated delivery retry.
