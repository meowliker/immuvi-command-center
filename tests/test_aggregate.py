"""Tests for tools/strategist/aggregate.py."""
from tools.strategist import aggregate


def _row(task_id, is_winner, status, brief_json, spend=None, revenue=None):
    return {
        "clickup_task_id": task_id,
        "is_winner": is_winner,
        "status": status,
        "brief_json": brief_json,
        "spend": spend,
        "revenue": revenue,
    }


def _brief(angle="A", persona="P", hook="Curiosity",
           structure="UGC", style="Polished UGC", funnel="TOF",
           emotion="curiosity", lingo=None, why="why-text"):
    return {
        "strategy":   {"angle_tag": angle, "persona_tag": persona,
                       "emotion": emotion},
        "creative":   {"creative_structure": structure,
                       "production_style": style,
                       "funnel_type": funnel,
                       "hook_type": hook},
        "copy":       {"hook": "h", "lingo": lingo or []},
        "production": {},
        "why_it_won": why,
    }


def test_aggregate_empty_returns_zero_stats():
    out = aggregate.build_memory_json(
        product_id="prod-1", product_name="Test", processed_rows=[])
    assert out["product_id"] == "prod-1"
    assert out["product_name"] == "Test"
    assert out["stats"]["judged_total"] == 0
    assert out["winner_briefs"] == []
    assert out["loser_briefs"] == []


def test_aggregate_counts_winner_statuses_separately():
    rows = [
        _row("t1", True, "winner",       _brief()),
        _row("t2", True, "mild winner",  _brief()),
        _row("t3", True, "scale",        _brief()),
        _row("t4", True, "complete",     _brief()),
        _row("t5", False, "loser",       _brief()),
        _row("t6", False, "killed",      _brief()),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["winner"]      == 1
    assert out["stats"]["mild_winner"] == 1
    assert out["stats"]["scale"]       == 1
    assert out["stats"]["complete"]    == 1
    assert out["stats"]["loser"]       == 1
    assert out["stats"]["killed"]      == 1
    assert out["stats"]["judged_total"] == 6


def test_aggregate_rolls_up_angle_counts():
    rows = [
        _row("t1", True, "winner", _brief(angle="Pediatrician")),
        _row("t2", True, "winner", _brief(angle="Pediatrician")),
        _row("t3", False, "loser", _brief(angle="Pediatrician")),
        _row("t4", True, "winner", _brief(angle="Mom-to-mom")),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    angles = {a["name"]: a for a in out["strategy_layer"]["angles"]}
    assert angles["Pediatrician"]["wins"] == 2
    assert angles["Pediatrician"]["losses"] == 1
    assert "t1" in angles["Pediatrician"]["evidence_task_ids"]
    assert "t2" in angles["Pediatrician"]["evidence_task_ids"]
    assert angles["Mom-to-mom"]["wins"] == 1
    assert angles["Mom-to-mom"]["losses"] == 0


def test_aggregate_rolls_up_creative_structure_with_roi():
    rows = [
        _row("t1", True,  "winner", _brief(structure="UGC"), spend=100, revenue=400),
        _row("t2", True,  "winner", _brief(structure="UGC"), spend=200, revenue=600),
        _row("t3", False, "loser",  _brief(structure="UGC"), spend=150, revenue=50),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    structs = {s["name"]: s for s in out["creative_direction_layer"]["creative_structures"]}
    ugc = structs["UGC"]
    assert ugc["wins"]    == 2
    assert ugc["losses"]  == 1
    assert ugc["spend"]   == 450.0
    assert ugc["revenue"] == 1050.0
    assert round(ugc["roi"], 4) == round(1050.0 / 450.0, 4)


def test_aggregate_overall_roi_in_stats():
    rows = [
        _row("t1", True, "winner", _brief(), spend=100, revenue=400),
        _row("t2", True, "winner", _brief(), spend=200, revenue=600),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["spend_total"]   == 300.0
    assert out["stats"]["revenue_total"] == 1000.0
    assert round(out["stats"]["roi_overall"], 4) == round(1000.0 / 300.0, 4)


def test_aggregate_skips_roi_when_no_spend_data():
    rows = [_row("t1", True, "winner", _brief())]  # no spend/revenue
    out = aggregate.build_memory_json("p", "P", rows)
    assert out["stats"]["roi_overall"] is None
    assert out["stats"]["tasks_with_spend_data"] == 0


def test_aggregate_winner_briefs_include_full_brief():
    b = _brief(angle="A", why="because reasons")
    rows = [_row("t1", True, "winner", b, spend=10, revenue=40)]
    out = aggregate.build_memory_json("p", "P", rows)
    assert len(out["winner_briefs"]) == 1
    wb = out["winner_briefs"][0]
    assert wb["task_id"]     == "t1"
    assert wb["status"]      == "winner"
    assert wb["why_it_won"]  == "because reasons"
    assert wb["performance"]["spend"]   == 10
    assert wb["performance"]["revenue"] == 40
    assert wb["performance"]["spend_data_complete"] is True


def test_aggregate_combinations_that_win():
    b = _brief(angle="A", persona="P1", structure="UGC", hook="Curiosity")
    rows = [
        _row("t1", True, "winner", b),
        _row("t2", True, "winner", b),
    ]
    out = aggregate.build_memory_json("p", "P", rows)
    combos = out["combinations_that_win"]
    assert len(combos) == 1
    c = combos[0]
    assert c["angle"]                == "A"
    assert c["persona"]              == "P1"
    assert c["creative_structure"]   == "UGC"
    assert c["hook_type"]            == "Curiosity"
    assert sorted(c["evidence_task_ids"]) == ["t1", "t2"]
