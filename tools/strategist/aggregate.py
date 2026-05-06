"""Roll up strategist_processed rows into the full memory JSON.

Pure function: takes processed rows + product metadata, returns the JSON
shape defined in §6.1 of the design spec.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Map raw ClickUp status string → stats key.
STATUS_KEY_MAP = {
    "winner": "winner",
    "mild winner": "mild_winner",
    "scale": "scale",
    "complete": "complete",
    "loser": "loser",
    "killed": "killed",
}


def _empty_dim_entry():
    return {"wins": 0, "losses": 0,
            "spend": 0.0, "revenue": 0.0,
            "spend_data_count": 0,
            "evidence_task_ids": []}


def _roi(spend: float, revenue: float) -> Optional[float]:
    return (revenue / spend) if spend else None


def _add_to_dim(dimmap: dict, key: str, row: dict):
    """Increment win/loss + spend/revenue + evidence for a dimension key."""
    if not key:
        return
    e = dimmap.setdefault(key, _empty_dim_entry())
    if row["is_winner"]:
        e["wins"] += 1
    else:
        e["losses"] += 1
    e["evidence_task_ids"].append(row["clickup_task_id"])
    if row["spend"] is not None and row["revenue"] is not None:
        e["spend"]   += float(row["spend"])
        e["revenue"] += float(row["revenue"])
        e["spend_data_count"] += 1


def _finalise_dim(dimmap: dict, name_key: str = "name") -> List[dict]:
    """Return a sorted list of finalised dim entries. Does not mutate inputs."""
    out = []
    for k, e in dimmap.items():
        finalised = dict(e)  # shallow copy
        finalised[name_key] = k
        finalised["roi"] = _roi(finalised["spend"], finalised["revenue"])
        out.append(finalised)
    out.sort(key=lambda x: (-(x["wins"]), x["losses"]))
    return out


def build_memory_json(product_id: str, product_name: str,
                      processed_rows: List[Dict[str, Any]]) -> dict:
    """Build the full memory JSON for one product."""
    out = {
        "product_id": product_id,
        "product_name": product_name,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "winner": 0, "mild_winner": 0, "scale": 0, "complete": 0,
            "loser": 0, "killed": 0,
            "judged_total": 0,
            "spend_total": 0.0, "revenue_total": 0.0, "roi_overall": None,
            "tasks_with_spend_data": 0, "tasks_missing_spend_data": 0,
        },
        "strategy_layer": {
            "angles": [], "personas": [],
            "emotions_played": [],
        },
        "creative_direction_layer": {
            "creative_structures": [], "production_styles": [],
            "funnel_types": [], "hook_types": [],
        },
        "copy_layer": {"lingo": []},
        "combinations_that_win": [],
        "combinations_that_die": [],
        "winner_briefs": [],
        "loser_briefs": [],
        "trends": {"rising": [], "fading": []},
        "performance_data_hook": {
            "available_now":   ["spend", "revenue", "roi"],
            "reserved_for_v2": ["cpa", "roas", "ctr", "hook_rate",
                                "hold_rate", "cpm", "frequency"],
        },
    }

    angles    = {}
    personas  = {}
    emotions  = {}
    structs   = {}
    prods     = {}
    funnels   = {}
    hooks     = {}
    lingos    = defaultdict(int)
    win_combos  = defaultdict(list)
    lose_combos = defaultdict(list)

    for r in processed_rows:
        st = r["status"]
        stats_key = STATUS_KEY_MAP.get(st)
        if stats_key:
            out["stats"][stats_key] += 1
        out["stats"]["judged_total"] += 1

        spend_known = r["spend"] is not None and r["revenue"] is not None
        if spend_known:
            out["stats"]["spend_total"]   += float(r["spend"])
            out["stats"]["revenue_total"] += float(r["revenue"])
            out["stats"]["tasks_with_spend_data"] += 1
        else:
            out["stats"]["tasks_missing_spend_data"] += 1

        b = r["brief_json"] or {}
        strat = b.get("strategy", {}) or {}
        creat = b.get("creative", {}) or {}

        _add_to_dim(angles,   strat.get("angle_tag"),   r)
        _add_to_dim(personas, strat.get("persona_tag"), r)
        _add_to_dim(emotions, strat.get("emotion"),     r)
        _add_to_dim(structs,  creat.get("creative_structure"), r)
        _add_to_dim(prods,    creat.get("production_style"),   r)
        _add_to_dim(funnels,  creat.get("funnel_type"),        r)
        _add_to_dim(hooks,    creat.get("hook_type"),          r)

        for phrase in (b.get("copy", {}) or {}).get("lingo", []) or []:
            if r["is_winner"]:
                lingos[phrase] += 1

        # Combination key
        combo = (
            strat.get("angle_tag"),
            strat.get("persona_tag"),
            creat.get("creative_structure"),
            creat.get("hook_type"),
        )
        if all(combo):
            (win_combos if r["is_winner"] else lose_combos)[combo].append(
                r["clickup_task_id"])

        # Per-task brief — explicit keys must win over anything in brief_json.
        brief_entry = {
            **b,
            "task_id": r["clickup_task_id"],
            "status": r["status"],
            "performance": {
                "spend":   float(r["spend"])   if r["spend"]   is not None else None,
                "revenue": float(r["revenue"]) if r["revenue"] is not None else None,
                "roi":     _roi(float(r["spend"]), float(r["revenue"])) if spend_known else None,
                "spend_data_complete": spend_known,
            },
        }
        if r["is_winner"]:
            out["winner_briefs"].append(brief_entry)
        else:
            out["loser_briefs"].append(brief_entry)

    out["stats"]["roi_overall"] = _roi(
        out["stats"]["spend_total"], out["stats"]["revenue_total"])

    out["strategy_layer"]["angles"]   = _finalise_dim(angles)
    out["strategy_layer"]["personas"] = _finalise_dim(personas)
    out["strategy_layer"]["emotions_played"] = _finalise_dim(emotions)
    out["creative_direction_layer"]["creative_structures"] = _finalise_dim(structs)
    out["creative_direction_layer"]["production_styles"]   = _finalise_dim(prods)
    out["creative_direction_layer"]["funnel_types"]        = _finalise_dim(funnels)
    out["creative_direction_layer"]["hook_types"]          = _finalise_dim(hooks)

    out["copy_layer"]["lingo"] = sorted(
        [{"phrase": p, "winners": c} for p, c in lingos.items()],
        key=lambda x: -x["winners"])

    out["combinations_that_win"] = [
        {"angle": k[0], "persona": k[1],
         "creative_structure": k[2], "hook_type": k[3],
         "evidence_task_ids": v}
        for k, v in sorted(win_combos.items(), key=lambda kv: -len(kv[1]))
    ]
    out["combinations_that_die"] = [
        {"angle": k[0], "persona": k[1],
         "creative_structure": k[2], "hook_type": k[3],
         "evidence_task_ids": v}
        for k, v in sorted(lose_combos.items(), key=lambda kv: -len(kv[1]))
    ]

    return out
