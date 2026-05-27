#!/usr/bin/env python3
"""Local Immuvi queue monitor.

Runs a localhost-only dashboard for inspiration and producer queues without
touching the production Command Center UI.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parent
ENV_PATH = pathlib.Path.home() / ".classify-inspiration.env"
WORKSPACE_ID = os.environ.get("CLICKUP_WORKSPACE_ID", "9016762494")
ACTIVE_STATUSES = {"pending", "processing", "running", "failed", "error"}


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    required = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise RuntimeError(f"Missing {', '.join(missing)} in {ENV_PATH}")
    return env


class Supabase:
    def __init__(self, env: dict[str, str]):
        self.url = env["SUPABASE_URL"].rstrip("/")
        self.key = env["SUPABASE_SERVICE_ROLE_KEY"]

    def headers(self, prefer: str | None = None) -> dict[str, str]:
        out = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            out["Prefer"] = prefer
        return out

    def request(self, method: str, table: str, query: str = "", body: Any = None) -> Any:
        suffix = f"?{query}" if query else ""
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{table}{suffix}",
            data=data,
            method=method,
            headers=self.headers("return=representation"),
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {table} failed: {exc.code} {detail}") from exc
        return json.loads(raw) if raw else []

    def select(self, table: str, query: str) -> list[dict[str, Any]]:
        return self.request("GET", table, query) or []

    def patch(self, table: str, query: str, body: dict[str, Any]) -> list[dict[str, Any]]:
        return self.request("PATCH", table, query, body) or []

    def insert(self, table: str, body: dict[str, Any]) -> list[dict[str, Any]]:
        return self.request("POST", table, "", body) or []


def enc(value: str) -> str:
    return urllib.parse.quote(value, safe=",()")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def age_seconds(value: str | None) -> int | None:
    dt = parse_dt(value)
    if not dt:
        return None
    return max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))


def output_images(outputs: Any) -> list[dict[str, str]]:
    if not isinstance(outputs, list):
        return []
    images = []
    for item in outputs:
        if not isinstance(item, dict):
            continue
        url = item.get("clickup_attachment_url") or item.get("url") or item.get("attachment_url")
        file_path = item.get("file_path") or ""
        images.append(
            {
                "url": url or "",
                "file_path": file_path,
                "variation_id": str(item.get("variation_id") or ""),
                "model": str(item.get("image_model") or ""),
                "quality": json.dumps(item.get("quality_gate") or {}, ensure_ascii=False),
            }
        )
    return images


def product_map(sb: Supabase) -> dict[str, str]:
    rows = sb.select("products", "select=id,name&limit=1000")
    return {row["id"]: row.get("name") or row["id"] for row in rows}


def summarize(env: dict[str, str]) -> dict[str, Any]:
    sb = Supabase(env)
    products = product_map(sb)

    iq_fields = "id,ins_id,product_id,url,platform,status,error_message,queued_at,processed_at,claimed_by,claimed_at,worker_assignment,attempts"
    pr_fields = "id,task_id,product_id,instruction,count,status,trigger,outputs,error,worker_id,started_at,finished_at,created_at,preferred_worker_id,retry_count,last_retry_at,retry_last_error,auto_retry"
    wr_fields = "worker_id,hostname,last_heartbeat,last_job_at,status,current_job_id,jobs_completed_total,jobs_failed_total,capabilities,enabled"

    inspiration = sb.select(
        "inspiration_queue",
        f"select={enc(iq_fields)}&order=queued_at.desc&limit=250",
    )
    producers = sb.select(
        "producer_runs",
        f"select={enc(pr_fields)}&order=created_at.desc&limit=150",
    )
    workers = sb.select("worker_registry", f"select={enc(wr_fields)}&order=last_heartbeat.desc&limit=50")

    for row in inspiration:
        row["product_name"] = products.get(row.get("product_id"), row.get("product_id"))
        row["age_seconds"] = age_seconds(row.get("queued_at"))
        row["claimed_age_seconds"] = age_seconds(row.get("claimed_at"))
        row["is_active"] = row.get("status") in ACTIVE_STATUSES
    for row in producers:
        row["product_name"] = products.get(row.get("product_id"), row.get("product_id"))
        row["task_url"] = f"https://app.clickup.com/t/{row.get('task_id')}" if row.get("task_id") else ""
        row["age_seconds"] = age_seconds(row.get("created_at"))
        row["run_seconds"] = age_seconds(row.get("started_at")) if row.get("status") == "running" else None
        row["images"] = output_images(row.get("outputs"))
        row["is_active"] = row.get("status") in {"pending", "running", "failed"}
        row["is_stuck"] = row.get("status") == "running" and (row.get("run_seconds") or 0) > 1800
    for row in workers:
        row["heartbeat_age_seconds"] = age_seconds(row.get("last_heartbeat"))
        row["online"] = (row.get("heartbeat_age_seconds") or 10**9) < 180

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "inspiration": inspiration,
        "producers": producers,
        "workers": workers,
        "counts": {
            "inspiration": count_by_status(inspiration),
            "producers": count_by_status(producers),
            "workers_online": sum(1 for w in workers if w.get("online")),
        },
    }


def count_by_status(rows: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for row in rows:
        status = str(row.get("status") or "unknown")
        out[status] = out.get(status, 0) + 1
    return out


def retry_inspiration(env: dict[str, str], queue_id: str) -> dict[str, Any]:
    sb = Supabase(env)
    query = urllib.parse.urlencode({"id": f"eq.{queue_id}"})
    rows = sb.patch(
        "inspiration_queue",
        query,
        {
            "status": "pending",
            "error_message": None,
            "claimed_by": None,
            "claimed_at": None,
            "processed_at": None,
        },
    )
    return {"ok": True, "updated": rows}


def retry_producer(env: dict[str, str], run_id: int) -> dict[str, Any]:
    sb = Supabase(env)
    rows = sb.select("producer_runs", f"select=*&id=eq.{run_id}&limit=1")
    if not rows:
        raise RuntimeError(f"Producer run {run_id} not found")
    old = rows[0]
    new_row = {
        "task_id": old["task_id"],
        "product_id": old["product_id"],
        "instruction": old.get("instruction") or "",
        "count": old.get("count") or 3,
        "status": "pending",
        "trigger": "retry-local-monitor",
        "preferred_worker_id": old.get("preferred_worker_id"),
    }
    created = sb.insert("producer_runs", new_row)
    return {"ok": True, "created": created, "source": old}


def fail_producer(env: dict[str, str], run_id: int) -> dict[str, Any]:
    sb = Supabase(env)
    query = urllib.parse.urlencode({"id": f"eq.{run_id}", "status": "eq.running"})
    rows = sb.patch(
        "producer_runs",
        query,
        {
            "status": "failed",
            "error": "marked failed from local queue monitor",
            "finished_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"ok": True, "updated": rows}


class Handler(BaseHTTPRequestHandler):
    env: dict[str, str] = {}

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("[queue-monitor] " + fmt % args + "\n")

    def send_json(self, payload: Any, status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        try:
            if self.path == "/" or self.path.startswith("/index.html"):
                return self.serve_file(ROOT / "index.html")
            if self.path.startswith("/api/summary"):
                return self.send_json(summarize(self.env))
            return self.serve_file(ROOT / self.path.lstrip("/"))
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc)}, 500)

    def do_POST(self) -> None:
        try:
            body = self.read_body()
            if self.path == "/api/retry/inspiration":
                return self.send_json(retry_inspiration(self.env, str(body["id"])))
            if self.path == "/api/retry/producer":
                return self.send_json(retry_producer(self.env, int(body["id"])))
            if self.path == "/api/fail/producer":
                return self.send_json(fail_producer(self.env, int(body["id"])))
            self.send_json({"ok": False, "error": "Unknown endpoint"}, 404)
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc)}, 500)

    def serve_file(self, path: pathlib.Path) -> None:
        if not path.exists() or not path.is_file() or ROOT not in path.resolve().parents and path.resolve() != ROOT:
            self.send_error(404)
            return
        raw = path.read_bytes()
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    Handler.env = load_env()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Immuvi queue monitor running at http://{args.host}:{args.port}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
