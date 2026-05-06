"""Markdown renderer for the strategist memory.

Takes the aggregate JSON, asks Claude to write a strategist memo in
markdown using the section structure from §6.2 of the spec.
"""

import json
import subprocess


CLAUDE_TIMEOUT_SECONDS = 300


class RenderError(Exception):
    pass


def _build_prompt(memory_json: dict) -> str:
    return f"""You are a senior creative strategist writing a one-page memo for the team.

Input: a JSON object summarising every winning and losing ad creative for one product.

Output: GitHub-flavored markdown. NO commentary before or after — just the memo. Use these exact sections in this exact order:

1. `# Strategist Memory — {memory_json.get('product_name','?')}`
2. A subtitle line: `_Last updated YYYY-MM-DD · N winners · M mild · L scaled · K losers · O killed · ROI X.XXx_`
3. `## What's winning right now` — bullet list of top 5 angles, top 5 personas, top 5 hook types, ranked by wins (with losses & ROI in parens)
4. `## Combinations to bet on` — top 5 combinations_that_win as `Angle × Persona × CreativeStructure × HookType` with evidence count
5. `## Vocabulary that wins` — top 10 lingo phrases with their winner-appearance count
6. `## Production playbook` — what an editor needs: production_styles, talent (from production sections of winner_briefs), settings, color palettes — all ranked with win count
7. `## What's dying / don't bother` — top 5 loser combinations + top 3 fading patterns
8. `## Trends` — rising and fading sections (skip if empty)
9. `## Full winners log` — for EACH winner_brief, format as:
   `### <task_id> — <strategy.angle_tag> × <strategy.persona_tag>` then a 3-line summary (status, hook line, why_it_won)
10. `## Full losers log` — same format but `why_it_died`

Be terse. Bullets, not paragraphs. Quote verbatim hooks/lingo when present.

— INPUT JSON —
```json
{json.dumps(memory_json, indent=2)}
```

— OUTPUT —
Just the markdown. No commentary."""


def render_markdown(memory_json: dict) -> str:
    prompt = _build_prompt(memory_json)
    cmd = ["claude", "-p", prompt, "--permission-mode", "bypassPermissions"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=CLAUDE_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        raise RenderError(
            f"claude -p timed out after {CLAUDE_TIMEOUT_SECONDS}s")
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or "")[-500:]
        raise RenderError(f"claude exit {r.returncode}: {tail}")
    return (r.stdout or "").strip()
