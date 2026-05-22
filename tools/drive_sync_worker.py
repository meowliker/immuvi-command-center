#!/usr/bin/env python3
"""drive_sync_worker — pre-fetches Drive folder contents for new ads.

Polls public.ads for rows created in the last DRIVE_SYNC_WINDOW_HOURS (default 24h)
whose drive_link is a Drive folder URL. For each such ad that has no row yet
in public.task_drive_cache, lists the folder via the Drive API and upserts
every file into task_drive_cache.

Legacy ads (older than the window OR already cached) are NEVER backfilled —
the picker falls back to a live API call on cache miss.

Usage:
  set -a; source ~/.classify-inspiration.env; set +a
  python3 tools/drive_sync_worker.py
"""
import os
import re
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
DRIVE_API_KEY = os.environ.get('GOOGLE_DRIVE_API_KEY', '')
POLL_INTERVAL = int(os.environ.get('DSW_POLL_INTERVAL', '300'))   # 5 min default
WINDOW_HOURS  = int(os.environ.get('DRIVE_SYNC_WINDOW_HOURS', '24'))
WORKER_ID     = 'dsw-' + socket.gethostname()

FOLDER_RE = re.compile(r'/folders/([a-zA-Z0-9_-]+)')


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def parse_folder_id(url):
    if not url or not isinstance(url, str):
        return None
    m = FOLDER_RE.search(url)
    return m.group(1) if m else None


def _sb_request(method, path, body=None, prefer_return=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }
    if prefer_return and method in ('POST', 'PATCH'):
        headers['Prefer'] = 'return=representation'
    elif method == 'POST':
        headers['Prefer'] = 'resolution=merge-duplicates'
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = Request(url, data=data, method=method, headers=headers)
    with urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else []


def drive_list(folder_id):
    """Return the list of files in a public Drive folder, or None on error."""
    base = 'https://www.googleapis.com/drive/v3/files'
    qs = urllib.parse.urlencode({
        'q': f"'{folder_id}' in parents and trashed = false",
        'fields': 'files(id,name,mimeType,thumbnailLink,webViewLink,size,modifiedTime)',
        'pageSize': '100',
        'supportsAllDrives': 'true',
        'includeItemsFromAllDrives': 'true',
        'key': DRIVE_API_KEY,
    })
    url = f'{base}?{qs}'
    try:
        req = Request(url)
        with urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        return data.get('files', [])
    except (HTTPError, URLError) as e:
        print(f"[dsw] drive_list error for {folder_id}: {e}", flush=True)
        return None


def find_candidates():
    """Find ads created in the last N hours with a folder drive_link that
    has NO row in task_drive_cache yet."""
    cutoff = (datetime.datetime.now(datetime.timezone.utc) -
              datetime.timedelta(hours=WINDOW_HOURS)).isoformat()
    # Pull recent ads with non-null drive_link
    qs = (
        f"select=id,drive_link,created_at&"
        f"created_at=gte.{urllib.parse.quote(cutoff)}&"
        f"drive_link=not.is.null&"
        f"order=created_at.desc&limit=500"
    )
    recent = _sb_request('GET', f'ads?{qs}')

    # Pull the set of ad_ids that already have cache rows (cheap one-query check)
    cached_rows = _sb_request('GET', 'task_drive_cache?select=ad_id&limit=10000')
    cached_set = {r['ad_id'] for r in cached_rows}

    candidates = []
    for ad in recent:
        fid = parse_folder_id(ad.get('drive_link') or '')
        if not fid:
            continue
        if ad['id'] in cached_set:
            continue
        candidates.append((ad['id'], fid))
    return candidates


def sync_one(ad_id, folder_id):
    files = drive_list(folder_id)
    if files is None:
        return False
    if not files:
        # Empty folder is fine — but skip; nothing to insert. Don't mark cached.
        print(f"[dsw] ad={ad_id} folder={folder_id} is empty — skipping", flush=True)
        return True
    rows = []
    for f in files:
        rows.append({
            'ad_id': ad_id,
            'drive_file_id': f.get('id'),
            'file_name': f.get('name') or 'unnamed',
            'mime_type': f.get('mimeType'),
            'thumbnail_url': f.get('thumbnailLink'),
            'web_view_url': f.get('webViewLink'),
            'modified_time': f.get('modifiedTime'),
            'size_bytes': int(f['size']) if f.get('size') and str(f['size']).isdigit() else None,
            'cached_at': _now_iso(),
        })
    try:
        _sb_request(
            'POST',
            'task_drive_cache?on_conflict=ad_id,drive_file_id',
            rows
        )
        print(f"[dsw] ✓ cached {len(rows)} file(s) for ad={ad_id} folder={folder_id}", flush=True)
        return True
    except (HTTPError, URLError) as e:
        print(f"[dsw] FAIL upsert for ad={ad_id}: {e}", flush=True)
        return False


def run_once():
    if not DRIVE_API_KEY:
        print("[dsw] GOOGLE_DRIVE_API_KEY not set — sleeping", flush=True)
        return False
    candidates = find_candidates()
    if not candidates:
        return False
    print(f"[dsw] {len(candidates)} ad(s) to sync", flush=True)
    for ad_id, folder_id in candidates:
        sync_one(ad_id, folder_id)
        time.sleep(0.5)   # be gentle on Drive API
    return True


def main():
    print(f"[dsw] starting · worker_id={WORKER_ID} · poll={POLL_INTERVAL}s · window={WINDOW_HOURS}h", flush=True)
    while True:
        try:
            had_work = run_once()
            time.sleep(POLL_INTERVAL if not had_work else max(60, POLL_INTERVAL // 5))
        except KeyboardInterrupt:
            print("\n[dsw] interrupted, exiting", flush=True)
            return 0
        except Exception as e:
            print(f"[dsw] loop error: {e}", flush=True)
            time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    sys.exit(main() or 0)
