"""Supabase REST helpers for strategist tables.

Uses urllib + service-role key. All HTTP through _request() so tests
can mock at the urlopen boundary.
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


class _Req:
    """Minimal urllib-compatible request object that skips URL validation.

    urllib.request.Request.__init__ calls self._parse() which rejects
    non-http(s) URLs. Using a plain object lets tests pass fake base URLs
    while still hitting the urlopen mock boundary.
    """
    def __init__(self, method: str, full_url: str,
                 data: Optional[bytes], headers: dict) -> None:
        self.method      = method.upper()
        self.full_url    = full_url
        self.data        = data
        self.headers     = {k.capitalize(): v for k, v in headers.items()}
        self.unverifiable      = False
        self.origin_req_host   = None
        self.type              = full_url.split("://")[0] if "://" in full_url else "https"

    def get_method(self) -> str:
        return self.method

    def get_full_url(self) -> str:
        return self.full_url

    def has_header(self, header: str) -> bool:
        return header.capitalize() in self.headers

    def get_header(self, header: str, default=None):
        return self.headers.get(header.capitalize(), default)

    def add_unredirected_header(self, key: str, val: str) -> None:
        self.headers[key.capitalize()] = val


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
    req = _Req(method, url, data, headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
    if not raw:
        return None
    return json.loads(raw)


def load_processed_rows(supabase_url: str, service_key: str,
                        product_id: str) -> List[dict]:
    qs = urllib.parse.urlencode({"product_id": f"eq.{product_id}",
                                 "select": "*"})
    url = f"{supabase_url}/rest/v1/strategist_processed?{qs}"
    return _request("GET", url, service_key) or []


def upsert_processed_row(supabase_url: str, service_key: str,
                         row: dict) -> None:
    url = (f"{supabase_url}/rest/v1/strategist_processed"
           f"?on_conflict=product_id,clickup_task_id")
    _request("POST", url, service_key, body=row,
             prefer="resolution=merge-duplicates,return=minimal")


def upsert_memory(supabase_url: str, service_key: str,
                  product_id: str, memory_json: dict,
                  markdown: str) -> None:
    url = (f"{supabase_url}/rest/v1/strategist_memory"
           f"?on_conflict=product_id")
    body = {"product_id": product_id, "json": memory_json,
            "markdown": markdown,
            "updated_at": datetime.now(timezone.utc).isoformat()}
    _request("POST", url, service_key, body=body,
             prefer="resolution=merge-duplicates,return=minimal")


def pop_pending_run(supabase_url: str, service_key: str,
                    worker_id: str) -> Optional[dict]:
    """Find one pending strategist_runs row. Does NOT atomically claim;
    caller follows up with claim_run() to flip status."""
    qs = urllib.parse.urlencode({
        "status": "eq.pending",
        "select": "*",
        "order":  "created_at.asc",
        "limit":  "1",
    })
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    rows = _request("GET", url, service_key) or []
    return rows[0] if rows else None


def claim_run(supabase_url: str, service_key: str,
              run_id: int, worker_id: str) -> dict:
    """Atomically flip pending → running. Filter on status='pending' to avoid
    double-claim by another worker."""
    qs = urllib.parse.urlencode({
        "id":     f"eq.{run_id}",
        "status": "eq.pending",
    })
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    body = {"status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "worker_id": worker_id}
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    if not out:
        raise RuntimeError(f"strategist_runs row {run_id} not claimable")
    return out[0]


def finish_run(supabase_url: str, service_key: str,
               run_id: int, status: str, tasks_processed: int,
               tasks_skipped: int, error: Optional[str]) -> dict:
    qs = urllib.parse.urlencode({"id": f"eq.{run_id}"})
    url = f"{supabase_url}/rest/v1/strategist_runs?{qs}"
    body = {"status": status,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "tasks_processed": tasks_processed,
            "tasks_skipped": tasks_skipped,
            "error": error}
    out = _request("PATCH", url, service_key, body=body,
                   prefer="return=representation")
    return out[0] if out else {}


def get_product(supabase_url: str, service_key: str,
                product_id: str) -> Optional[dict]:
    qs = urllib.parse.urlencode({
        "id": f"eq.{product_id}",
        "select": "id,name,config",
    })
    url = f"{supabase_url}/rest/v1/products?{qs}"
    rows = _request("GET", url, service_key) or []
    return rows[0] if rows else None
