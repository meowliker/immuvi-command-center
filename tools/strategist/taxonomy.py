"""Pure-function taxonomy and field mapping helpers.

Single source of truth for:
- ClickUp status → strategist group ("winner_group" / "loser_group" / "pending_group")
- Canonical custom field names + value extraction across ClickUp field types
- Product slug normalisation

Confirmed against immuvi-command-center.html:36945 and live ClickUp list 901613534733
on 2026-05-06.
"""

import re
from typing import Optional, Any

WINNER_STATUSES = frozenset({"winner", "mild winner", "scale", "complete"})
LOSER_STATUSES  = frozenset({"loser", "killed"})
PENDING_STATUSES = frozenset({"untested", "approved", "in production",
                              "ready to launch", "testing"})

CANONICAL_FIELD_KEYS = (
    "Persona Tag", "Angle Tag",
    "Hook Type", "Creative Structure", "Production Style",
    "Funnel Type", "Photo/Video", "Drive Link",
    "Spend", "Revenue",
    "Creative USP", "Notes",
    "Launch Date", "Approved Date",
    "Final Video ID", "Script ID",
)


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def classify_status(status: Optional[str]) -> Optional[str]:
    """Return 'winner_group', 'loser_group', 'pending_group', or None."""
    s = _norm(status)
    if not s:
        return None
    if s in WINNER_STATUSES:
        return "winner_group"
    if s in LOSER_STATUSES:
        return "loser_group"
    if s in PENDING_STATUSES:
        return "pending_group"
    return None


def is_judged(status: Optional[str]) -> bool:
    """True for winner_group or loser_group statuses."""
    g = classify_status(status)
    return g in ("winner_group", "loser_group")


def extract_field_value(field: dict) -> Any:
    """Extract a canonical Python value from a ClickUp custom field row.

    Returns None if the field is unset.
    """
    if "value" not in field or field.get("value") is None:
        return None
    ftype = field.get("type")
    val = field["value"]
    if ftype == "drop_down":
        opts = (field.get("type_config") or {}).get("options") or []
        # ClickUp dropdowns: value is the orderindex; map to option name.
        try:
            idx = int(val)
        except (TypeError, ValueError):
            return None
        for o in opts:
            if int(o.get("orderindex", -1)) == idx:
                return o.get("name")
        return None
    if ftype in ("short_text", "text", "url"):
        return str(val) if val != "" else None
    if ftype == "number":
        try:
            return float(val)
        except (TypeError, ValueError):
            return None
    if ftype == "date":
        # Returned as ms-epoch string; keep as-is, callers parse if needed.
        return str(val)
    if ftype == "users":
        # Return list of usernames if present, else None.
        if isinstance(val, list):
            names = [u.get("username") for u in val if u.get("username")]
            return names or None
        return None
    return val


_SLUG_RE_NONALNUM = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """ASCII-lowercase-hyphen slug used for repo snapshot filenames."""
    if not name:
        return ""
    s = name.lower()
    s = _SLUG_RE_NONALNUM.sub("-", s)
    return s.strip("-")
