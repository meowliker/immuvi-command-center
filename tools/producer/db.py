"""Supabase REST helpers for producer_runs table.

Uses urllib + service-role key. Single _request boundary so tests can
mock urlopen. Mirrors tools/strategist/db.py shape.
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _request(method: str, url: str, service_key: str,
             body: Any = None, prefer: Optional[str] = None) -> Any:
    headers = {
        "apikey":        service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
    if not raw:
        return None
    return json.loads(raw)


def pop_pending_run(supabase_url: str, service_key: str,
                    worker_id: str,
                    require_preferred_worker: bool = False) -> Optional[dict]:
    """Find the oldest pending producer_runs row this worker is allowed to claim.

    Honors `preferred_worker_id`:
      - NULL → any worker can claim
      - matches my worker_id → I can claim
      - other worker_id → I skip UNLESS the preferred worker hasn't heartbeated
        for >5 min (stale). In that case any worker can claim it as fallback.
    When `require_preferred_worker` is true, only rows explicitly assigned to
    this worker are returned. This lets a dev worker test producer changes
    without accidentally claiming production/unassigned generation jobs.
    """
    if require_preferred_worker:
        qs = urllib.parse.urlencode({
            "status": "eq.pending",
            "preferred_worker_id": f"eq.{worker_id}",
            "select": "*",
            "order":  "created_at.asc",
            "limit":  "1",
        })
        url = f"{supabase_url}/rest/v1/producer_runs?{qs}"
        rows = _request("GET", url, service_key) or []
        return rows[0] if rows else None

    # Stage 1: rows with no preferred worker, OR explicitly preferring this worker.
    qs1 = urllib.parse.urlencode({
        "status": "eq.pending",
        "or":     f"(preferred_worker_id.is.null,preferred_worker_id.eq.{worker_id})",
        "select": "*",
        "order":  "created_at.asc",
        "limit":  "1",
    })
    url1 = f"{supabase_url}/rest/v1/producer_runs?{qs1}"
    rows = _request("GET", url1, service_key) or []
    if rows:
        return rows[0]

    # Stage 2: stale-preference fallback. Pending rows with a preference
    # whose preferred worker hasn't been seen alive for 5+ min.
    qs2 = urllib.parse.urlencode({
        "status": "eq.pending",
        "preferred_worker_id": "not.is.null",
        "select": "*",
        "order":  "created_at.asc",
        "limit":  "10",
    })
    url2 = f"{supabase_url}/rest/v1/producer_runs?{qs2}"
    candidates = _request("GET", url2, service_key) or []
    if not candidates:
        return None

    pref_ids = list({r["preferred_worker_id"] for r in candidates if r.get("preferred_worker_id")})
    if not pref_ids:
        return None
    in_filter = "in.(" + ",".join(pref_ids) + ")"
    qs3 = urllib.parse.urlencode({
        "worker_id": in_filter,
        "select":    "worker_id,last_heartbeat",
    })
    url3 = f"{supabase_url}/rest/v1/worker_registry?{qs3}"
    hb_rows = _request("GET", url3, service_key) or []
    now = datetime.now(timezone.utc)
    fresh = set()
    for hb in hb_rows:
        ts = hb.get("last_heartbeat")
        if not ts:
            continue
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if (now - t).total_seconds() < 300:
                fresh.add(hb["worker_id"])
        except Exception:
            continue
    for r in candidates:
        if r.get("preferred_worker_id") not in fresh:
            return r
    return None


def claim_run(supabase_url: str, service_key: str,
              run_id: int, worker_id: str) -> dict:
    """Atomically flip pending → running. Filter on status='pending' to avoid
    double-claim races."""
    qs = urllib.parse.urlencode({
        "id":     f"eq.{run_id}",
        "status": "eq.pending",
    })
    url = f"{supabase_url}/rest/v1/producer_runs?{qs}"
    body = {
        "status":     "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "worker_id":  worker_id,
        "error":      None,
    }
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    if not out:
        raise RuntimeError(f"producer_runs row {run_id} not claimable")
    return out[0]


def finish_run(supabase_url: str, service_key: str, run_id: int,
               status: str, outputs: Optional[List[Dict[str, Any]]],
               error: Optional[str]) -> dict:
    """Mark run done|failed with outputs and/or error message."""
    qs = urllib.parse.urlencode({"id": f"eq.{run_id}"})
    url = f"{supabase_url}/rest/v1/producer_runs?{qs}"
    body = {
        "status":      status,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "outputs":     outputs,
        "error":       error,
    }
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    return out[0] if out else {}
