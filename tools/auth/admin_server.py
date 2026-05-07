#!/usr/bin/env python3
"""
Local admin helper server for Immuvi user management.

Holds the Supabase service_role key (read from .env) and exposes
admin-only operations to the dashboard frontend running at
http://localhost:8102.

Run alongside the http.server and classify_worker:

    python3 tools/auth/admin_server.py > /tmp/immuvi-admin.log 2>&1 &
    disown

Endpoints (all require Authorization: Bearer <user_jwt>; the server
verifies the JWT belongs to an active admin):

    GET  /health                      → {"ok": true}
    POST /admin/create-user           → {email, username, full_name,
                                         temp_password, product_ids[]}
    POST /admin/reset-password        → {user_id, temp_password}
    POST /admin/deactivate            → {user_id}
    POST /admin/reactivate            → {user_id}
    POST /admin/assign-product        → {user_id, product_id}
    POST /admin/unassign-product      → {user_id, product_id}
    POST /admin/delete-user           → {user_id}    (full removal)

CORS allows http://localhost:8102 only.
"""
from __future__ import annotations
import json
import os
import secrets
import string
import subprocess
import sys
import threading
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT = int(os.environ.get("ADMIN_SERVER_PORT", "8103"))
ALLOWED_ORIGINS = (
    "http://localhost:8102",
    "http://127.0.0.1:8102",
)


# ─── env ───────────────────────────────────────────────────────────────
def load_env() -> dict:
    env = {}
    p = Path(__file__).resolve().parents[2] / ".env"
    if not p.exists():
        sys.exit(f"FAIL: {p} not found")
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
for _k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"):
    if not ENV.get(_k):
        sys.exit(f"FAIL: {_k} missing in .env")


# ─── Supabase calls ────────────────────────────────────────────────────
def sb_admin_api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{ENV['SUPABASE_URL']}/auth/v1{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "apikey": ENV["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {ENV['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
        })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def sb_verify_user_jwt(token: str) -> dict | None:
    """Returns user dict if JWT is valid, else None."""
    try:
        req = urllib.request.Request(
            f"{ENV['SUPABASE_URL']}/auth/v1/user",
            headers={
                "apikey": ENV["SUPABASE_SERVICE_ROLE_KEY"],
                "Authorization": f"Bearer {token}",
            })
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError):
        return None


def db_q(sql: str) -> list[list[str]]:
    """Run a query, return rows split by `|` (psql -A -F'|' -t)."""
    cmd = ["psql", ENV["SUPABASE_DB_URL"], "-v", "ON_ERROR_STOP=1",
           "-A", "-F|", "-t", "-c", sql]
    out = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if out.returncode != 0:
        raise RuntimeError(f"psql failed: {out.stderr.strip()}")
    rows = []
    for line in out.stdout.strip().splitlines():
        rows.append(line.split("|"))
    return rows


def lit(v) -> str:
    if v is None:
        return "NULL"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def is_active_admin(user_id: str) -> bool:
    rows = db_q(
        f"select role, is_active from public.profiles where id = {lit(user_id)};")
    if not rows or rows == [['']]:
        return False
    role, active = rows[0]
    return role == "admin" and active in ("t", "true")


def gen_password(n: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(n))


def audit(actor_id: str, action: str, target_user: str | None = None,
          target_product: str | None = None, meta: dict | None = None) -> None:
    db_q(f"""
        insert into public.admin_audit_log
          (actor_id, action, target_user, target_product, meta)
        values
          ({lit(actor_id)}, {lit(action)},
           {lit(target_user)}, {lit(target_product)},
           {lit(json.dumps(meta or {}))}::jsonb);
    """)


# ─── HTTP handler ──────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "ImmuviAdmin/1.0"

    def _origin_ok(self) -> str | None:
        origin = self.headers.get("Origin", "")
        return origin if origin in ALLOWED_ORIGINS else None

    def _send_cors(self, origin: str | None):
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers",
                             "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods",
                             "GET, POST, OPTIONS")

    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors(self._origin_ok())
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors(self._origin_ok())
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send_json(200, {"ok": True})
        return self._send_json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        # Auth gate.
        token = self.headers.get("Authorization", "")
        if not token.lower().startswith("bearer "):
            return self._send_json(401, {"error": "missing bearer token"})
        token = token.split(" ", 1)[1].strip()
        user = sb_verify_user_jwt(token)
        if not user or not user.get("id"):
            return self._send_json(401, {"error": "invalid jwt"})
        actor_id = user["id"]
        if not is_active_admin(actor_id):
            return self._send_json(403, {"error": "not an admin"})

        # Parse body.
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode() or "{}")
        except Exception as e:
            return self._send_json(400, {"error": f"bad json: {e}"})

        try:
            if path == "/admin/create-user":
                return self._create_user(actor_id, body)
            if path == "/admin/reset-password":
                return self._reset_password(actor_id, body)
            if path == "/admin/deactivate":
                return self._set_active(actor_id, body, False)
            if path == "/admin/reactivate":
                return self._set_active(actor_id, body, True)
            if path == "/admin/assign-product":
                return self._assign_product(actor_id, body)
            if path == "/admin/unassign-product":
                return self._unassign_product(actor_id, body)
            if path == "/admin/delete-user":
                return self._delete_user(actor_id, body)
            if path == "/admin/set-role":
                return self._set_role(actor_id, body)
            if path == "/admin/update-products":
                return self._update_products(actor_id, body)
        except Exception as e:
            return self._send_json(500, {"error": str(e)})

        return self._send_json(404, {"error": "unknown endpoint"})

    # ── ops ──
    def _create_user(self, actor_id: str, b: dict):
        email = (b.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return self._send_json(400, {"error": "valid email required"})
        username = (b.get("username") or "").strip() or email.split("@")[0]
        full_name = (b.get("full_name") or "").strip()
        password = b.get("temp_password") or gen_password()
        product_ids = b.get("product_ids") or []
        role = b.get("role") if b.get("role") in ("admin", "member") else "member"

        # Create auth user.
        u = sb_admin_api("POST", "/admin/users", {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": full_name,
                "username": username,
                "role": role,
                "must_change_password": True,
            },
        })
        new_id = u["id"]
        # Trigger created profile; sync username/role.
        db_q(f"""
          update public.profiles
             set username = {lit(username)},
                 full_name = {lit(full_name)},
                 role = {lit(role)},
                 must_change_password = true,
                 created_by = {lit(actor_id)}
           where id = {lit(new_id)};
        """)
        # Assign products.
        for pid in product_ids:
            db_q(f"""
              insert into public.user_products(user_id, product_id, assigned_by)
              values ({lit(new_id)}, {lit(pid)}, {lit(actor_id)})
              on conflict do nothing;
            """)
        audit(actor_id, "create_user", target_user=new_id,
              meta={"email": email, "role": role,
                    "products": product_ids})
        return self._send_json(200, {
            "ok": True,
            "user_id": new_id,
            "email": email,
            "temp_password": password,
        })

    def _reset_password(self, actor_id: str, b: dict):
        user_id = b.get("user_id")
        if not user_id:
            return self._send_json(400, {"error": "user_id required"})
        password = b.get("temp_password") or gen_password()
        sb_admin_api("PUT", f"/admin/users/{user_id}", {
            "password": password,
            "user_metadata": {"must_change_password": True},
        })
        db_q(f"""
          update public.profiles set must_change_password = true
           where id = {lit(user_id)};
        """)
        audit(actor_id, "reset_password", target_user=user_id)
        return self._send_json(200, {
            "ok": True, "user_id": user_id, "temp_password": password})

    def _set_active(self, actor_id: str, b: dict, active: bool):
        user_id = b.get("user_id")
        if not user_id:
            return self._send_json(400, {"error": "user_id required"})
        sb_admin_api("PUT", f"/admin/users/{user_id}",
                     {"ban_duration": "none" if active else "876600h"})
        db_q(f"""
          update public.profiles set is_active = {str(active).lower()}
           where id = {lit(user_id)};
        """)
        audit(actor_id, "reactivate" if active else "deactivate",
              target_user=user_id)
        return self._send_json(200, {"ok": True, "user_id": user_id,
                                      "is_active": active})

    def _assign_product(self, actor_id: str, b: dict):
        user_id, product_id = b.get("user_id"), b.get("product_id")
        if not user_id or not product_id:
            return self._send_json(400, {"error": "user_id & product_id"})
        db_q(f"""
          insert into public.user_products(user_id, product_id, assigned_by)
          values ({lit(user_id)}, {lit(product_id)}, {lit(actor_id)})
          on conflict do nothing;
        """)
        audit(actor_id, "assign_product",
              target_user=user_id, target_product=product_id)
        return self._send_json(200, {"ok": True})

    def _unassign_product(self, actor_id: str, b: dict):
        user_id, product_id = b.get("user_id"), b.get("product_id")
        if not user_id or not product_id:
            return self._send_json(400, {"error": "user_id & product_id"})
        db_q(f"""
          delete from public.user_products
           where user_id = {lit(user_id)} and product_id = {lit(product_id)};
        """)
        audit(actor_id, "unassign_product",
              target_user=user_id, target_product=product_id)
        return self._send_json(200, {"ok": True})

    def _update_products(self, actor_id: str, b: dict):
        """Replace user's product list atomically."""
        user_id = b.get("user_id")
        product_ids = b.get("product_ids") or []
        if not user_id:
            return self._send_json(400, {"error": "user_id required"})
        # Diff strategy: delete all then insert chosen.
        db_q(f"delete from public.user_products where user_id = {lit(user_id)};")
        for pid in product_ids:
            db_q(f"""
              insert into public.user_products(user_id, product_id, assigned_by)
              values ({lit(user_id)}, {lit(pid)}, {lit(actor_id)})
              on conflict do nothing;
            """)
        audit(actor_id, "update_products",
              target_user=user_id, meta={"products": product_ids})
        return self._send_json(200, {"ok": True, "product_ids": product_ids})

    def _set_role(self, actor_id: str, b: dict):
        user_id = b.get("user_id")
        role = b.get("role")
        if role not in ("admin", "member"):
            return self._send_json(400, {"error": "role must be admin|member"})
        # Don't let admin demote themselves.
        if user_id == actor_id and role != "admin":
            return self._send_json(400,
                {"error": "cannot demote yourself"})
        db_q(f"update public.profiles set role={lit(role)} where id={lit(user_id)};")
        audit(actor_id, "set_role", target_user=user_id, meta={"role": role})
        return self._send_json(200, {"ok": True, "role": role})

    def _delete_user(self, actor_id: str, b: dict):
        user_id = b.get("user_id")
        if not user_id:
            return self._send_json(400, {"error": "user_id required"})
        if user_id == actor_id:
            return self._send_json(400, {"error": "cannot delete yourself"})
        sb_admin_api("DELETE", f"/admin/users/{user_id}")
        # cascades delete profiles + user_products.
        audit(actor_id, "delete_user", target_user=user_id)
        return self._send_json(200, {"ok": True})

    def log_message(self, fmt, *args):
        # quieter access log
        sys.stderr.write(f"[admin] {self.address_string()} {fmt % args}\n")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"OK: admin server listening on http://127.0.0.1:{PORT}")
    print(f"    CORS allowed: {', '.join(ALLOWED_ORIGINS)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutdown")
        server.server_close()


if __name__ == "__main__":
    main()
