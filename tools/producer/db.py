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
                    worker_id: str) -> Optional[dict]:
    """Find the oldest pending producer_runs row. Caller follows up with claim_run."""
    qs = urllib.parse.urlencode({
        "status": "eq.pending",
        "select": "*",
        "order":  "created_at.asc",
        "limit":  "1",
    })
    url = f"{supabase_url}/rest/v1/producer_runs?{qs}"
    rows = _request("GET", url, service_key) or []
    return rows[0] if rows else None


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
