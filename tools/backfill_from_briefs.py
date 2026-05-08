#!/usr/bin/env python3
"""
backfill_from_briefs.py — one-shot backfill for broken inspiration rows
that already have a ClickUp brief document.

For each public.inspirations row with `_clickupDocPageUrl` set AND any of
the 8 classification fields blank, fetch the brief, parse the SNAPSHOT
table, extract fields, upsert into data jsonb. Skips rows whose brief is
unreachable or whose SNAPSHOT cannot be parsed.

Rows without a brief stay in inspiration_queue for the regular
classify_worker to re-classify.

Usage:
    python3 tools/backfill_from_briefs.py
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Load env from ~/.classify-inspiration.env
ENV_FILE = Path.home() / ".classify-inspiration.env"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

CU_KEY = os.environ.get("CLICKUP_API_KEY") or "pk_5476099_97NP5VRGEUQLU6JQKAA2P85HQD3TQJ0A"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SR_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKSPACE_ID = "9016762494"


def sb(path, method="GET", body=None):
    url = SUPABASE_URL.rstrip("/") + "/rest/v1/" + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SR_KEY,
        "Authorization": "Bearer " + SR_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
        return json.loads(body) if body else None


def fetch_brief(doc_id, page_id):
    url = f"https://api.clickup.com/api/v3/workspaces/{WORKSPACE_ID}/docs/{doc_id}/pages/{page_id}"
    req = urllib.request.Request(url, headers={"Authorization": CU_KEY})
    try:
        with urllib.request.urlopen(req) as r:
            d = json.loads(r.read().decode())
        return d.get("content") or ""
    except Exception as e:
        return None


def parse_snapshot(content):
    """Extract the 8 fields from the SNAPSHOT table at top of brief."""
    if not content:
        return None
    out = {}
    # Match `| Field | Value |` rows in the snapshot table
    rows = re.findall(r"\|\s*([A-Za-z][A-Za-z ]+?)\s*\|\s*(.+?)\s*\|", content)
    table = {k.strip().lower(): v.strip() for k, v in rows}
    out["brand"] = table.get("brand") or ""
    out["funnelStage"] = table.get("funnel") or ""
    out["hookType"] = table.get("hook type") or ""
    out["angle"] = table.get("angle") or ""
    out["persona"] = table.get("persona") or ""
    # Format: "Video — Professional Studio" → adType + productionStyle
    fmt = table.get("format") or ""
    if " — " in fmt:
        ad, prod = fmt.split(" — ", 1)
        out["adType"] = ad.strip()
        out["productionStyle"] = prod.strip()
    elif fmt:
        out["adType"] = fmt
        out["productionStyle"] = ""
    else:
        out["adType"] = ""
        out["productionStyle"] = ""

    # creativeStructure isn't in snapshot — try to derive from CREATIVE BREAKDOWN section
    # Look for section "## 2\. CREATIVE BREAKDOWN" hints. Fall back to empty.
    out["creativeStructure"] = ""
    # Heuristic: pull from "creative_structure" tag or section-3 patterns
    cb_match = re.search(r"##\s*2[\\.\s]+CREATIVE BREAKDOWN([\s\S]+?)(?=^##\s*\d|\Z)", content, re.M)
    if cb_match:
        body = cb_match.group(1)
        # Common labels we tag: HOOK / TENSION / PROOF / CTA BRIDGE / etc — use the
        # first second-column label cluster to guess structure.
        labels = re.findall(r"\|\s*[\w –\-]+?\s*\|\s*([A-Z][A-Z /]+?)\s*\|", body)
        labels = [l.strip() for l in labels if l.strip()]
        if labels:
            # Common structure inference: based on label sequence
            joined = " ".join(labels).upper()
            if "INTERVIEW" in joined:
                out["creativeStructure"] = "Interview"
            elif "TESTIMONIAL" in joined:
                out["creativeStructure"] = "Testimonial"
            elif "DEMO" in joined or "PRODUCT" in joined:
                out["creativeStructure"] = "Demo"
            elif "POV" in joined:
                out["creativeStructure"] = "UGC"
            elif "STORY" in joined or "NARRATIVE" in joined:
                out["creativeStructure"] = "Story / Narrative"
            elif "HOOK" in joined and "CTA" in joined:
                out["creativeStructure"] = "Story / Narrative"

    return out


def main():
    # 1. Find broken rows that have a brief
    rows = sb("inspirations?select=id,product_id,data&data->>_clickupDocPageUrl=not.is.null&limit=1000")
    fixable = []
    for r in rows or []:
        d = r.get("data") or {}
        broken = any(
            (d.get(k) is None or str(d.get(k)).strip() == "")
            for k in ("brand", "angle", "persona", "creativeStructure", "hookType", "productionStyle", "funnelStage", "adType")
        )
        if broken and d.get("_clickupDocPageUrl"):
            fixable.append(r)

    print(f"Found {len(fixable)} rows with brief but missing fields")

    fixed = 0
    skipped = 0
    for r in fixable:
        ins_id = r["id"]
        product_id = r["product_id"]
        d = r.get("data") or {}
        page_url = d.get("_clickupDocPageUrl")
        # URL: .../docs/<doc_id>/<page_id>
        m = re.search(r"/docs/([^/]+)/([^/?#]+)", page_url or "")
        if not m:
            print(f"  skip {ins_id}: cannot parse URL")
            skipped += 1
            continue
        doc_id, page_id = m.group(1), m.group(2)
        content = fetch_brief(doc_id, page_id)
        if not content:
            print(f"  skip {ins_id}: brief unreachable")
            skipped += 1
            continue
        parsed = parse_snapshot(content)
        if not parsed:
            print(f"  skip {ins_id}: cannot parse snapshot")
            skipped += 1
            continue
        # Only fill in fields that are currently blank — never overwrite good data
        patch = {}
        for k, v in parsed.items():
            cur = d.get(k)
            if (cur is None or str(cur).strip() == "") and v and str(v).strip():
                patch[k] = v
        if not patch:
            print(f"  skip {ins_id}: brief had nothing useful")
            skipped += 1
            continue
        # UPSERT into inspirations.data via PostgREST PATCH with JSONB merge
        new_data = dict(d)
        new_data.update(patch)
        try:
            sb(f"inspirations?id=eq.{urllib.parse.quote(ins_id)}&product_id=eq.{urllib.parse.quote(product_id)}",
               method="PATCH", body={"data": new_data, "status": "Classified"})
            print(f"  fixed {ins_id}: {sorted(patch.keys())}")
            fixed += 1
        except Exception as e:
            print(f"  fail  {ins_id}: {e}")
            skipped += 1

    print(f"\nDone. fixed={fixed} skipped={skipped} total={len(fixable)}")


if __name__ == "__main__":
    main()
