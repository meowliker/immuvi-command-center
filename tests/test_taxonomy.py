"""Tests for tools/strategist/taxonomy.py — pure functions, no I/O."""
from tools.strategist import taxonomy


# ── classify_status ──

def test_classify_status_winner_group():
    for s in ("winner", "Winner", "WINNER", " winner ",
              "mild winner", "Mild Winner",
              "scale", "Scale",
              "complete", "COMPLETE"):
        assert taxonomy.classify_status(s) == "winner_group", f"failed on {s!r}"

def test_classify_status_loser_group():
    for s in ("loser", "Loser", "killed", "Killed"):
        assert taxonomy.classify_status(s) == "loser_group", f"failed on {s!r}"

def test_classify_status_pending_group():
    for s in ("untested", "approved", "in production",
              "ready to launch", "testing"):
        assert taxonomy.classify_status(s) == "pending_group", f"failed on {s!r}"

def test_classify_status_unknown_returns_none():
    assert taxonomy.classify_status("") is None
    assert taxonomy.classify_status(None) is None
    assert taxonomy.classify_status("blocked") is None


# ── is_judged ──

def test_is_judged_true_for_winners_and_losers():
    assert taxonomy.is_judged("winner") is True
    assert taxonomy.is_judged("mild winner") is True
    assert taxonomy.is_judged("scale") is True
    assert taxonomy.is_judged("complete") is True
    assert taxonomy.is_judged("loser") is True
    assert taxonomy.is_judged("killed") is True

def test_is_judged_false_for_pending():
    assert taxonomy.is_judged("testing") is False
    assert taxonomy.is_judged("untested") is False
    assert taxonomy.is_judged("ready to launch") is False
    assert taxonomy.is_judged(None) is False


# ── canonical field map ──

def test_canonical_field_keys_present():
    keys = set(taxonomy.CANONICAL_FIELD_KEYS)
    assert "Persona Tag" in keys
    assert "Angle Tag" in keys
    assert "Hook Type" in keys
    assert "Creative Structure" in keys
    assert "Production Style" in keys
    assert "Funnel Type" in keys
    assert "Photo/Video" in keys
    assert "Drive Link" in keys
    assert "Spend" in keys
    assert "Revenue" in keys

def test_extract_field_value_dropdown_returns_label():
    field = {
        "name": "Hook Type",
        "type": "drop_down",
        "type_config": {"options": [
            {"id": "abc", "name": "Pain / Problem", "orderindex": 0},
            {"id": "def", "name": "Curiosity", "orderindex": 1},
        ]},
        "value": 1,  # ClickUp returns the orderindex for dropdowns
    }
    assert taxonomy.extract_field_value(field) == "Curiosity"

def test_extract_field_value_dropdown_unset_returns_none():
    field = {"name": "Hook Type", "type": "drop_down",
             "type_config": {"options": [{"id": "x", "name": "A", "orderindex": 0}]}}
    assert taxonomy.extract_field_value(field) is None

def test_extract_field_value_short_text():
    assert taxonomy.extract_field_value(
        {"name": "Persona Tag", "type": "short_text", "value": "tired-mom"}
    ) == "tired-mom"

def test_extract_field_value_url():
    assert taxonomy.extract_field_value(
        {"name": "Drive Link", "type": "url", "value": "https://drive.google.com/x"}
    ) == "https://drive.google.com/x"

def test_extract_field_value_number():
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number", "value": "320.50"}
    ) == 320.50
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number", "value": 0}
    ) == 0.0

def test_extract_field_value_unset_value_returns_none():
    assert taxonomy.extract_field_value(
        {"name": "Spend", "type": "number"}
    ) is None


# ── slugify ──

def test_slugify_basic():
    assert taxonomy.slugify("Astro Rekha") == "astro-rekha"
    assert taxonomy.slugify("Kids Mental Health") == "kids-mental-health"
    assert taxonomy.slugify("KIDS LIFE SKILL") == "kids-life-skill"
    assert taxonomy.slugify("Canva Mastery — Scripts") == "canva-mastery-scripts"
    assert taxonomy.slugify("  multi   spaces  ") == "multi-spaces"


def test_extract_field_value_date_returns_string():
    # ClickUp returns ms-epoch as a string; module passes it through.
    assert taxonomy.extract_field_value(
        {"name": "Launch Date", "type": "date", "value": "1714900000000"}
    ) == "1714900000000"


def test_extract_field_value_users_returns_usernames_list():
    field = {
        "name": "Editor", "type": "users",
        "value": [
            {"id": 1, "username": "alice"},
            {"id": 2, "username": "bob"},
        ],
    }
    assert taxonomy.extract_field_value(field) == ["alice", "bob"]


def test_extract_field_value_users_empty_list_returns_none():
    assert taxonomy.extract_field_value(
        {"name": "Editor", "type": "users", "value": []}
    ) is None


def test_extract_field_value_unknown_type_falls_through():
    # Unknown type returns the raw value unchanged.
    assert taxonomy.extract_field_value(
        {"name": "X", "type": "made_up_type", "value": "raw"}
    ) == "raw"
