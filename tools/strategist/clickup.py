"""ClickUp REST API helpers for the strategist worker.

Uses urllib only (matches classify_worker.py pattern — zero extra deps).
All HTTP goes through `_request` so tests can mock at the boundary.
"""

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from typing import List, Dict, Optional, Any

CLICKUP_API_BASE = "https://api.clickup.com/api/v2"
PAGE_SIZE = 100  # ClickUp's max per page


def _request(method: str, url: str, api_key: str,
             body: Optional[dict] = None, max_retries: int = 4) -> dict:
    """One unified HTTP boundary so tests can patch urlopen."""
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": api_key,
                 "Content-Type": "application/json"})
    backoff = 1.0
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and attempt < max_retries - 1:
                time.sleep(min(backoff, 60))
                backoff *= 2
                continue
            raise


def list_tasks(api_key: str, list_id: str,
               include_closed: bool = True) -> List[dict]:
    """List all tasks in a list, paginated."""
    out = []
    page = 0
    while True:
        params = {
            "page": page,
            "subtasks": "true",
            "include_closed": "true" if include_closed else "false",
        }
        url = (f"{CLICKUP_API_BASE}/list/{list_id}/task?"
               f"{urllib.parse.urlencode(params)}")
        payload = _request("GET", url, api_key)
        tasks = payload.get("tasks", [])
        if not tasks:
            break
        out.extend(tasks)
        page += 1
    return out


def get_task_full(api_key: str, task_id: str) -> dict:
    """Fetch the full task object including custom_fields."""
    url = (f"{CLICKUP_API_BASE}/task/{task_id}"
           f"?include_subtasks=false&custom_task_ids=false")
    return _request("GET", url, api_key)


def get_task_comments(api_key: str, task_id: str,
                      max_comments: int = 30) -> List[dict]:
    """Fetch task comments. Caps at `max_comments` (most recent first)."""
    url = f"{CLICKUP_API_BASE}/task/{task_id}/comment"
    payload = _request("GET", url, api_key)
    comments = payload.get("comments", [])
    return comments[:max_comments]


def get_list_custom_fields(api_key: str, list_id: str) -> List[dict]:
    """Fetch the custom field definitions for a list."""
    url = f"{CLICKUP_API_BASE}/list/{list_id}/field"
    payload = _request("GET", url, api_key)
    return payload.get("fields", [])


_DOC_URL_RE = re.compile(
    r"https?://app\.clickup\.com/\d+/v/dc/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)?"
)


def extract_clickup_doc_url(text: Optional[str]) -> Optional[str]:
    """Find the first ClickUp doc URL in a string, or None."""
    if not text:
        return None
    m = _DOC_URL_RE.search(text)
    return m.group(0) if m else None


def compute_content_hash(status: str, description: str,
                         comments: List[dict],
                         custom_fields: Dict[str, Any]) -> str:
    """Stable hash for incremental cache invalidation.

    Sort dict keys so reorderings don't change the hash. Hash only the
    comment text bodies (not authorship metadata).
    """
    payload = {
        "status": (status or "").strip().lower(),
        "description": (description or "").strip(),
        "comments": [(c.get("comment_text") or "") for c in comments],
        "custom_fields": {k: custom_fields[k] for k in sorted(custom_fields)},
    }
    blob = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(blob).hexdigest()
