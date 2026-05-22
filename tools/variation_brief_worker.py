#!/usr/bin/env python3
"""variation_brief_worker — generates briefs for winning video variations.

Polls public.variation_brief_queue. For each pending job:
  1. Resolves the source file via the Drive API endpoint (or just uses
     the drive_file_id as a stable handle).
  2. Generates a stub 7-section brief markdown (real LLM invocation
     will be wired later when the classify-inspiration skill accepts a
     Drive file URL as input).
  3. Inserts into public.variation_briefs.
  4. Marks the queue row done.

Idempotent: if a variation_briefs row already exists for the
drive_file_id, the queue row is marked done immediately without
generating a new brief.

Usage:
  set -a; source ~/.classify-inspiration.env; set +a
  python3 tools/variation_brief_worker.py
"""
import os
import sys
import json
import time
import socket
import urllib.parse
import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SUPABASE_URL  = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY  = os.environ['SUPABASE_SERVICE_ROLE_KEY']
POLL_INTERVAL = int(os.environ.get('VBW_POLL_INTERVAL', '15'))
WORKER_ID     = 'vbw-' + socket.gethostname()


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _sb_request(method, path, body=None, prefer_return=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    if prefer_return and method in ('POST', 'PATCH'):
        headers['Prefer'] = 'return=representation'
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = Request(url, data=data, method=method, headers=headers)
    with urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else []


def claim_one():
    """Find a pending row, mark it claimed, return it (or None)."""
    pending = _sb_request('GET', 'variation_brief_queue?status=eq.pending&order=created_at.asc&limit=1')
    if not pending:
        return None
    job = pending[0]
    patch = {
        'status': 'classifying',
        'claimed_by': WORKER_ID,
        'claimed_at': _now_iso(),
        'attempts': (job.get('attempts') or 0) + 1,
    }
    # Race-safe: only flip pending → classifying
    updated = _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job["id"])}&status=eq.pending',
        patch
    )
    if not updated:
        return None
    return updated[0]


def brief_exists(drive_file_id):
    rows = _sb_request('GET', f'variation_briefs?drive_file_id=eq.{urllib.parse.quote(drive_file_id)}&select=id')
    return len(rows) > 0


def mark_done(job_id):
    _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job_id)}',
        {'status': 'done', 'processed_at': _now_iso(), 'error_message': None}
    )


def mark_failed(job_id, err):
    _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job_id)}',
        {'status': 'failed', 'processed_at': _now_iso(), 'error_message': str(err)[:500]}
    )


def generate_stub_brief(parent_ad_id, drive_file_id):
    """Build a stub brief markdown. Real LLM call will replace this body
    later when the classify-inspiration skill supports Drive file URLs."""
    stub_md = (
        f"# Variation Brief — {drive_file_id}\n\n"
        f"Parent: {parent_ad_id}\n"
        f"Source file: https://drive.google.com/file/d/{drive_file_id}/view\n\n"
        f"## Hook\n_TBD when DRIVE_MODE=live LLM is wired_\n\n"
        f"## Creative Structure\n_TBD_\n\n"
        f"## Production Style\n_TBD_\n\n"
        f"## What Made This Win\n_TBD_\n\n"
        f"## Body Copy\n_TBD_\n\n"
        f"## Persona Fit\n_TBD_\n\n"
        f"## Variation Ideas\n_TBD_\n"
    )
    rows = _sb_request(
        'POST',
        'variation_briefs',
        {
            'drive_file_id': drive_file_id,
            'ad_id': parent_ad_id,
            'brief_markdown': stub_md,
            'clickup_doc_page_url': None,
            'generated_by': WORKER_ID,
        }
    )
    return rows[0] if rows else None


def run_once():
    job = claim_one()
    if not job:
        return False
    print(f"[vbw] picked job {job['id']} drive_file_id={job['drive_file_id']}", flush=True)
    try:
        if brief_exists(job['drive_file_id']):
            print(f"[vbw] brief already exists — short-circuit", flush=True)
            mark_done(job['id'])
            return True
        brief = generate_stub_brief(job['parent_ad_id'], job['drive_file_id'])
        if not brief:
            mark_failed(job['id'], 'brief insert returned no row')
            return True
        mark_done(job['id'])
        print(f"[vbw] ✓ brief {brief['id']} for {job['drive_file_id']}", flush=True)
    except (HTTPError, URLError, Exception) as e:
        mark_failed(job['id'], e)
        print(f"[vbw] FAILED job {job['id']}: {e}", flush=True)
    return True


def main():
    print(f"[vbw] starting · worker_id={WORKER_ID} · poll={POLL_INTERVAL}s", flush=True)
    while True:
        try:
            had_work = run_once()
            if not had_work:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n[vbw] interrupted, exiting", flush=True)
            return 0
        except Exception as e:
            print(f"[vbw] loop error: {e}", flush=True)
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    sys.exit(main() or 0)
