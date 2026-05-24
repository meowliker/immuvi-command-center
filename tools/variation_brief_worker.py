#!/usr/bin/env python3
"""variation_brief_worker — generates REAL briefs for winning video variations.

Polls public.variation_brief_queue. For each pending job, invokes the
Claude/Codex CLI with a structured prompt asking it to:
  1. Download the winning Drive file
  2. Extract frames + audio via ffmpeg
  3. Visually classify (same 8 fields as /classify-inspiration)
  4. Build a 7-section creative brief markdown tuned for "scale this winner"
  5. Create a ClickUp Doc page under the target task's product list
  6. Upsert into public.variation_briefs with brief_markdown + clickup_doc_page_url
  7. Print 'OK <queue_id>' on success or 'FAIL <queue_id>: <reason>' on failure

Pattern mirrors tools/classify_worker.py. Idempotent: short-circuits if a
brief already exists for the drive_file_id (handled by the worker via
SELECT before invoking the skill).

Usage:
  set -a; source ~/.classify-inspiration.env; set +a
  python3 tools/variation_brief_worker.py
"""
import os
import sys
import json
import time
import socket
import shutil
import subprocess
import urllib.parse
import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SUPABASE_URL  = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY  = os.environ['SUPABASE_SERVICE_ROLE_KEY']
POLL_INTERVAL = int(os.environ.get('VBW_POLL_INTERVAL', '15'))
CLI_TIMEOUT_S = int(os.environ.get('VBW_CLI_TIMEOUT_SECONDS', '1200'))
AGENT_PREFER  = (os.environ.get('VBW_AGENT_PREFER') or os.environ.get('CLASSIFY_AGENT_PREFER') or 'claude').strip().lower()
MAX_ATTEMPTS  = int(os.environ.get('VBW_MAX_ATTEMPTS', '3'))
WORKER_ID     = 'vbw-' + socket.gethostname()


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def log(msg):
    print(f"[{_now_iso()}] [vbw] {msg}", flush=True)


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


def build_agent_cmd(prompt, prefer='claude'):
    """Return [cmd, ...args, prompt] to invoke the chosen agent in -p mode."""
    have_claude = bool(shutil.which('claude'))
    have_codex  = bool(shutil.which('codex'))
    if prefer == 'codex' and have_codex:
        return ['codex', 'exec', prompt]
    if prefer == 'claude' and have_claude:
        return ['claude', '-p', prompt]
    if have_claude:
        return ['claude', '-p', prompt]
    if have_codex:
        return ['codex', 'exec', prompt]
    raise RuntimeError('Neither claude nor codex CLI is installed on PATH')


def claim_one():
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
    updated = _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job["id"])}&status=eq.pending',
        patch,
    )
    if not updated:
        return None
    return updated[0]


def brief_exists(drive_file_id):
    rows = _sb_request('GET', f'variation_briefs?drive_file_id=eq.{urllib.parse.quote(drive_file_id)}&select=id,clickup_doc_page_url')
    if not rows:
        return None
    row = rows[0]
    if not row.get('clickup_doc_page_url'):
        return None  # row exists but no doc URL yet — treat as not-done, let the worker re-run
    return row


def resolve_target_context(parent_ad_id, target_ad_id):
    """Pull useful context about the parent + target ads so the prompt can
    point Claude at the right ClickUp list / doc. Returns a dict (best-effort
    — missing fields just become 'unknown' in the prompt)."""
    ctx = {'parent_ad': None, 'target_ad': None}
    try:
        rows = _sb_request('GET', f'ads?id=in.({urllib.parse.quote(parent_ad_id)},{urllib.parse.quote(target_ad_id)})&select=id,format_name,clickup_task_id,product_id,meta')
        for r in rows:
            if r['id'] == parent_ad_id: ctx['parent_ad'] = r
            if r['id'] == target_ad_id: ctx['target_ad'] = r
    except Exception as e:
        log(f"resolve_target_context failed: {e}")
    return ctx


def mark_done(job_id):
    _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job_id)}',
        {'status': 'done', 'processed_at': _now_iso(), 'error_message': None},
    )


def mark_failure(job, error):
    attempts = job.get('attempts') or 1
    if attempts >= MAX_ATTEMPTS:
        new_status = 'failed'
        log(f"[{job.get('id')}] FINAL FAILURE after {attempts} attempts: {error}")
    else:
        new_status = 'pending'
        log(f"[{job.get('id')}] attempt {attempts} failed, requeuing: {error}")
    _sb_request(
        'PATCH',
        f'variation_brief_queue?id=eq.{urllib.parse.quote(job["id"])}',
        {
            'status': new_status,
            'claimed_by': None,
            'claimed_at': None,
            'error_message': str(error)[:500],
        },
    )


def verify_brief_row(drive_file_id):
    """Server-side verify: the variation_briefs row must exist AND have both
    brief_markdown and clickup_doc_page_url set. Otherwise the skill lied."""
    rows = _sb_request('GET', f'variation_briefs?drive_file_id=eq.{urllib.parse.quote(drive_file_id)}&select=id,brief_markdown,clickup_doc_page_url&limit=1')
    if not rows:
        return (False, 'no variation_briefs row exists')
    row = rows[0]
    missing = []
    if not row.get('brief_markdown'): missing.append('brief_markdown')
    if not row.get('clickup_doc_page_url'): missing.append('clickup_doc_page_url')
    if missing:
        return (False, f'row exists but missing: {",".join(missing)}')
    return (True, 'verified')


def build_prompt(job, ctx):
    drive_file_id = job['drive_file_id']
    parent_ad_id  = job['parent_ad_id']
    target_ad_id  = job['target_ad_id']
    drive_url     = f'https://drive.google.com/file/d/{drive_file_id}/view'

    parent_name = (ctx.get('parent_ad') or {}).get('format_name') or parent_ad_id
    target_name = (ctx.get('target_ad') or {}).get('format_name') or target_ad_id
    target_cu   = (ctx.get('target_ad') or {}).get('clickup_task_id') or ''
    parent_cu   = (ctx.get('parent_ad') or {}).get('clickup_task_id') or ''
    product_id  = (ctx.get('target_ad') or {}).get('product_id') or (ctx.get('parent_ad') or {}).get('product_id') or ''

    return (
        f"Generate a creative brief for a WINNING VIDEO VARIATION using the same\n"
        f"workflow as the /classify-inspiration skill (download → frames → classify →\n"
        f"7-section brief → ClickUp Doc page). Do NOT batch-scan, do NOT pause for\n"
        f"consolidation, do NOT ask any questions.\n\n"
        f"Target job:\n"
        f"  queue_id:        {job.get('id')}\n"
        f"  drive_file_id:   {drive_file_id}\n"
        f"  drive_url:       {drive_url}\n"
        f"  parent_ad_id:    {parent_ad_id}  ({parent_name})\n"
        f"  parent_clickup:  {parent_cu}\n"
        f"  target_ad_id:    {target_ad_id}  ({target_name})\n"
        f"  target_clickup:  {target_cu}\n"
        f"  product_id:      {product_id}\n\n"
        f"REQUIRED WORK (all mandatory before printing OK):\n\n"
        f"  1. Resolve product config from public.products.config (look up by product_id={product_id}):\n"
        f"     clickup_list_id, doc_id (the ClickUp doc where briefs go).\n"
        f"  2. Download the Drive video at drive_url. Auth via $GOOGLE_DRIVE_API_KEY\n"
        f"     (loaded from ~/.classify-inspiration.env). The folder is shared 'Anyone\n"
        f"     with link' so the API key suffices.\n"
        f"  3. Use ffmpeg to extract frames (1 per second up to 60s) + audio probe.\n"
        f"  4. Visually classify the WINNING variation (ALL 8 mandatory):\n"
        f"     hook_type, creative_structure, production_style, funnel_type,\n"
        f"     persona, angle, ad_type, brand. Plus body_copy and creative_hypothesis.\n"
        f"  5. Build a 7-section brief markdown TUNED FOR 'scale this winner':\n"
        f"     ## What Made This Win\n"
        f"     ## Hook (verbatim + analysis)\n"
        f"     ## Creative Structure\n"
        f"     ## Production Style\n"
        f"     ## Body Copy + Tone\n"
        f"     ## Persona Fit\n"
        f"     ## Variation Ideas (concrete suggestions for how to scale or evolve this winner)\n"
        f"  6. Create a ClickUp Doc page in the product's brief doc (doc_id from step 1)\n"
        f"     titled 'Winner Brief — {parent_name} — {drive_file_id[-10:]}'. Capture the\n"
        f"     page URL.\n\n"
        f"  7. *** MANDATORY DB WRITE ***\n"
        f"     UPSERT into public.variation_briefs (drive_file_id is the conflict key):\n"
        f"       - drive_file_id        = '{drive_file_id}'\n"
        f"       - ad_id                = '{parent_ad_id}'\n"
        f"       - brief_markdown       = <the full markdown from step 5>\n"
        f"       - clickup_doc_page_url = <URL captured in step 6>\n"
        f"       - generated_by         = 'vbw'\n"
        f"     Use the Supabase REST API with $SUPABASE_SERVICE_ROLE_KEY (loaded from\n"
        f"     ~/.classify-inspiration.env). The UPSERT is MANDATORY — without it the\n"
        f"     worker's verify gate will reject this as FAIL and the queue row will\n"
        f"     retry up to {MAX_ATTEMPTS} times.\n\n"
        f"  8. (Optional but recommended) Post a ClickUp comment on the target task\n"
        f"     ({target_cu}) with: '🏆 Winner brief: <doc_url>'. Skip if target_clickup\n"
        f"     is empty.\n\n"
        f"  9. Do NOT touch variation_brief_queue at all — the worker handles queue state.\n\n"
        f"VERIFICATION (you must pass before printing OK):\n"
        f"  SELECT from public.variation_briefs WHERE drive_file_id='{drive_file_id}'.\n"
        f"  Both brief_markdown and clickup_doc_page_url MUST be non-empty.\n"
        f"  If either is missing, print 'FAIL {job.get('id')}: missing <field>'.\n\n"
        f"OUTPUT (the LAST line of stdout — nothing else after):\n"
        f"  On success:  'OK {job.get('id')}'\n"
        f"  On failure:  'FAIL {job.get('id')}: <one-line reason>'\n"
    )


def run_skill(job, ctx):
    prompt = build_prompt(job, ctx)
    try:
        cmd = build_agent_cmd(prompt, prefer=AGENT_PREFER)
    except RuntimeError as e:
        return (False, str(e))
    agent_label = cmd[0]
    log(f"[{job.get('id')}] running skill on {job['drive_file_id']} via {agent_label} (timeout {CLI_TIMEOUT_S}s)")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=CLI_TIMEOUT_S)
        stdout = (r.stdout or '').strip()
        stderr = (r.stderr or '').strip()
        tail = stdout[-500:] if stdout else stderr[-500:]
        if r.returncode != 0:
            return (False, f'agent exit {r.returncode}: {tail}')
        ok_marker = f"OK {job.get('id')}"
        fail_marker = f"FAIL {job.get('id')}"
        if fail_marker in stdout:
            idx = stdout.find(fail_marker)
            return (False, stdout[idx:idx + 300])
        ok_ack = ok_marker in stdout
        v_ok, v_msg = verify_brief_row(job['drive_file_id'])
        if not v_ok:
            return (False, f'skill returned without persisting: {v_msg}')
        if not ok_ack:
            log(f"[{job.get('id')}] no OK marker but verify passed; tail: {tail[-200:]}")
        return (True, 'ok')
    except subprocess.TimeoutExpired:
        return (False, f'agent timeout after {CLI_TIMEOUT_S}s')
    except FileNotFoundError:
        return (False, f'{agent_label} CLI not found in PATH')
    except Exception as e:
        return (False, f'{type(e).__name__}: {e}')


def run_once():
    job = claim_one()
    if not job:
        return False
    log(f"picked job {job['id']} drive_file_id={job['drive_file_id']}")
    try:
        existing = brief_exists(job['drive_file_id'])
        if existing:
            log(f"[{job['id']}] brief already exists ({existing.get('clickup_doc_page_url')}) — short-circuit")
            mark_done(job['id'])
            return True
        ctx = resolve_target_context(job['parent_ad_id'], job['target_ad_id'])
        ok, msg = run_skill(job, ctx)
        if ok:
            mark_done(job['id'])
            log(f"[{job['id']}] ✓ brief generated")
        else:
            mark_failure(job, msg)
    except (HTTPError, URLError, Exception) as e:
        mark_failure(job, e)
        log(f"[{job['id']}] FAILED: {e}")
    return True


def main():
    log(f"starting · worker_id={WORKER_ID} · poll={POLL_INTERVAL}s · agent={AGENT_PREFER} · max_attempts={MAX_ATTEMPTS}")
    while True:
        try:
            had_work = run_once()
            if not had_work:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            log("interrupted, exiting")
            return 0
        except Exception as e:
            log(f"loop error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    sys.exit(main() or 0)
