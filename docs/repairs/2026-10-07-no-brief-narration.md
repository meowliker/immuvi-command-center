# No Brief optional narration

ARI-INS-315 persisted no_brief=true correctly but was blocked by the shared
Facebook audio contract. The classification verifier also required non-empty
voiceOver for every video. Both incorrectly imposed transcript completeness on
classification-only jobs.

Only strict boolean no_brief=true now permits blank, explicitly unverified
narration when source-scoped visual/text evidence and its limitation are saved
consistently in inspiration data and result metadata. No invented voice-over,
false 'No voice over', mismatched source, missing media or automatic taxonomy
creation is permitted. Full-brief behavior is unchanged. No Brief instructions
continue to prohibit all ClickUp brief/tracker actions and generated scripts,
and preserve any pre-existing brief.

Verification: 276 Node tests and 50 Python tests pass. Coverage includes the
No Brief exception, mismatched/missing evidence, fabricated narration, normal
brief requirements, source boundaries and deployed mirror consistency.

Rollback code checkpoint: b6e23e8. Do not overwrite live completed rows with
old queue backups. Recovery is scoped to ARI-INS-315 in prod-1778009469915;
ARI-INS-300 keeps its existing full-brief request and is not requeued by this fix.
