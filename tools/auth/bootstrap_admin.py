#!/usr/bin/env python3
"""
Bootstrap the first admin user.

Usage:
    python3 tools/auth/bootstrap_admin.py <email> [--password <pw>]

If --password is omitted, a strong temp password is generated and printed.

What this does:
  1. Calls Supabase Admin API (service_role) to create the auth user
     with email_confirm=true so they can sign in immediately.
  2. The on_auth_user_created trigger creates a profiles row.
  3. We promote the profile to role='admin' + must_change_password=true.
  4. We assign all existing products to the admin (cosmetic — admins
     bypass user_products via is_admin(), but it keeps UI consistent).
  5. Logs an entry in admin_audit_log.

Idempotent: re-running with the same email re-promotes to admin and
re-assigns products without resetting the password.
"""
from __future__ import annotations
import argparse
import json
import os
import secrets
import string
import sys
import urllib.request
import urllib.error
from pathlib import Path


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


def gen_password(n: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(n))


def admin_api(env: dict, method: str, path: str, body: dict | None = None) -> dict:
    url = f"{env['SUPABASE_URL']}/auth/v1{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
        })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{body_txt}") from e


def find_user_by_email(env: dict, email: str) -> dict | None:
    res = admin_api(env, "GET", f"/admin/users?email={email}")
    users = res.get("users") if isinstance(res, dict) else None
    if not users:
        return None
    for u in users:
        if (u.get("email") or "").lower() == email.lower():
            return u
    return None


def create_user(env: dict, email: str, password: str, full_name: str = "") -> dict:
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "full_name": full_name,
            "role": "admin",
            "must_change_password": True,
        },
    }
    return admin_api(env, "POST", "/admin/users", payload)


def db_exec(env: dict, sql: str, args: list | None = None) -> list[dict]:
    """Run a SQL via PostgREST RPC isn't generic. We use psql instead."""
    import subprocess
    cmd = ["psql", env["SUPABASE_DB_URL"], "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql]
    out = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if out.returncode != 0:
        raise RuntimeError(f"psql failed: {out.stderr}")
    return out.stdout.strip().splitlines()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("--password", default=None)
    ap.add_argument("--full-name", default="")
    args = ap.parse_args()

    env = load_env()
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"):
        if not env.get(k):
            sys.exit(f"FAIL: {k} missing in .env")

    existing = find_user_by_email(env, args.email)
    if existing:
        user_id = existing["id"]
        print(f"OK: user {args.email} already exists (id={user_id}); promoting to admin.")
        password_was_set = False
    else:
        password = args.password or gen_password()
        u = create_user(env, args.email, password, args.full_name)
        user_id = u["id"]
        password_was_set = True
        print(f"OK: created auth user {args.email}")
        print(f"    id={user_id}")
        print(f"    temp password: {password}")
        print(f"    (save this — it's not retrievable later)")

    # Promote in profiles.
    db_exec(env, f"""
        update public.profiles
           set role='admin',
               is_active=true,
               full_name=coalesce(nullif({_lit(args.full_name)}, ''), full_name)
         where id={_lit(user_id)};
    """)

    # Assign all products (cosmetic for admins).
    db_exec(env, f"""
        insert into public.user_products(user_id, product_id, assigned_by)
        select {_lit(user_id)}, id, {_lit(user_id)}
          from public.products
        on conflict do nothing;
    """)

    # Audit log.
    db_exec(env, f"""
        insert into public.admin_audit_log(actor_id, action, target_user, meta)
        values ({_lit(user_id)}, 'bootstrap_admin', {_lit(user_id)},
                jsonb_build_object('script','bootstrap_admin.py','password_set', {str(password_was_set).lower()}));
    """)

    print(f"OK: {args.email} is now admin and assigned to all products.")


def _lit(v) -> str:
    """Minimal SQL literal escape for inputs we control (uuid, name)."""
    if v is None:
        return "NULL"
    s = str(v).replace("'", "''")
    return f"'{s}'"


if __name__ == "__main__":
    main()
