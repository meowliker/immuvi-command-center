"""Per-task `claude -p` synthesis.

Takes a bundled task (description, comments, fields, optional doc page)
and asks Claude to produce a single winner_brief / loser_brief JSON
entry following the schema in §6.1 of the design spec.
"""

import json
import re
import subprocess
from typing import Any, Dict


CLAUDE_TIMEOUT_SECONDS = 300  # 5 min per task


class SynthesisError(Exception):
    pass


# Greedy on the JSON object so nested {...} structures match the outermost
# closing brace. The fence boundaries already disambiguate.
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)


def _extract_json_block(text: str) -> Dict[str, Any]:
    """Extract the first JSON object from claude stdout.

    Looks for fenced ```json ... ``` first, then a bare {...}.
    """
    if not text:
        raise SynthesisError("empty stdout — could not parse JSON")
    m = _JSON_FENCE_RE.search(text)
    if m:
        return json.loads(m.group(1))
    # Bare object fallback: greedy from first '{' to last '}'.
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end > start:
        candidate = text[start:end+1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    raise SynthesisError(
        f"could not parse JSON from claude stdout: {text[:300]!r}")


def _build_prompt(bundle: dict) -> str:
    fields = bundle.get("custom_fields", {}) or {}
    comments = "\n".join(
        f"- {c.get('comment_text','')}"
        for c in (bundle.get("comments") or [])
    ) or "(no comments)"

    is_winner = (bundle.get("status") or "").lower() in (
        "winner", "mild winner", "scale", "complete")
    verdict_word = "won" if is_winner else "died"

    prompt = f"""You are a senior creative strategist analysing one paid-ad task.
Output a single JSON object — nothing before, nothing after — wrapped in ```json ... ``` fences.

The schema:
{{
  "strategy":   {{
    "angle_tag":       "free-text — the tactical angle",
    "persona_tag":     "free-text — the audience persona",
    "pain_point":      "what hurt the viewer",
    "promise":         "what the ad promised to fix",
    "awareness_level": "problem-aware | solution-aware | product-aware | most-aware",
    "emotion":         "fear | hope | fomo | curiosity | pride | relief | anger | other",
    "social_proof":    "doctor | mom | expert | stat | before-after | celeb | UGC | none"
  }},
  "creative":   {{
    "creative_structure": "from the canonical list (UGC, Testimonial, Demo, Tutorial / How-To, Story / Narrative, Hook + Offer, Listicle, Static / Photo, Comparison, Interview, Skit / Roleplay, AI / Voiceover)",
    "production_style":   "from canonical list (Organic / Raw UGC, Polished UGC, Professional Studio, AI Generated, Screen Record, Animation / Motion, Static Graphic, Slideshow, Repurposed Organic, Competitor Inspired)",
    "funnel_type":        "TOF | MOF | BOF",
    "hook_type":          "Pain / Problem | Fear | Curiosity | Social Proof | Aspirational | Direct Offer | Controversy / Bold Claim | POV | Question | News / Trend | Pattern Interrupt",
    "visual_style":       "free-text",
    "lighting":           "natural | studio | harsh | moody",
    "composition":        "free-text",
    "talent":             "free-text",
    "setting":            "free-text",
    "props":              ["array of strings"],
    "color_palette":      "free-text",
    "text_overlay":       "free-text"
  }},
  "copy":       {{
    "hook":     "verbatim hook line",
    "headline": "verbatim headline",
    "body":     "verbatim or summary",
    "cta":      "verbatim CTA",
    "lingo":    ["recurring vocabulary phrases that appeared"]
  }},
  "production": {{
    "person_count":  1,
    "expression":    "free-text",
    "gaze":          "to-camera | off-camera | none",
    "body_language": "free-text"
  }},
  "why_it_{verdict_word}": "200-word essence — your strategist read on why this resonated (or why it died)"
}}

Use the canonical taxonomy values when applicable. If you cannot infer a field, return null for it.

— TASK CONTEXT —
Task ID:      {bundle.get('task_id')}
Title:        {bundle.get('title')}
Status:       {bundle.get('status')}
Description:
{bundle.get('description') or '(none)'}

Custom fields:
{json.dumps(fields, indent=2)}

Comments (most recent first):
{comments}

Linked brief doc text (if any):
{bundle.get('doc_page_text') or '(none)'}

— OUTPUT —
Just the fenced JSON object. No commentary."""
    return prompt


def synthesise_task(bundle: dict) -> dict:
    """Run claude -p once on a task bundle. Return the parsed JSON brief."""
    prompt = _build_prompt(bundle)
    cmd = ["claude", "-p", prompt, "--permission-mode", "bypassPermissions"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=CLAUDE_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        raise SynthesisError(
            f"claude -p timed out after {CLAUDE_TIMEOUT_SECONDS}s")
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or "")[-500:]
        raise SynthesisError(f"claude exit {r.returncode}: {tail}")
    return _extract_json_block(r.stdout)
