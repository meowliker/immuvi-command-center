#!/usr/bin/env python3
"""
classify_worker.py — distributed inspiration classifier worker.

Runs as a daemon on any machine (laptop, Mac mini, teammate's box).
Polls Supabase `inspiration_queue` for pending rows, claims one
atomically, runs the existing /clickup-creative-pipeline Claude Code
skill on it, writes results back, and loops.

Self-registers in `worker_registry` so the dashboard knows it's alive.
Heartbeats every 30s. Optionally auto-pauses when Claude Code isn't
running (useful on laptops — only contributes when you're working).

Single file. Python 3.9+ compatible (system Python on stock macOS works).

Setup: see tools/worker-setup.sh.
"""

import json
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ───────────────────────────────────────────

ENV_FILE = Path.home() / ".classify-inspiration.env"
WORKER_CONFIG_FILE = Path.home() / ".classify-inspiration-worker.json"
RESULT_DIR = Path("/tmp")  # the skill writes /tmp/cu_result_<task_id>.json
LOG_DIR = Path.home() / ".classify-inspiration-worker-logs"

POLL_INTERVAL_SECONDS = 60
HEARTBEAT_INTERVAL_SECONDS = 30
STALE_CLAIM_TIMEOUT_MINUTES = 10
PREFERRED_WORKER_OFFLINE_GRACE_MINUTES = 2
CLAUDE_CLI_TIMEOUT_SECONDS = 600  # 10 min hard ceiling per classification
MAX_ATTEMPTS_BEFORE_FAILED = 3
AUTO_PAUSE_CHECK_INTERVAL_SECONDS = 60


# ── Helpers ─────────────────────────────────────────────────

def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    print(line, flush=True)
    try:
        log_path = LOG_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.log"
        with open(log_path, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_env() -> dict:
    """Load ~/.classify-inspiration.env into a dict (and into os.environ)."""
    if not ENV_FILE.exists():
        log(f"FATAL: env file not found at {ENV_FILE}. Run worker-setup.sh first.")
        sys.exit(1)
    env = {}
    for raw in ENV_FILE.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
        os.environ[k.strip()] = v.strip()
    required = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    for key in required:
        if not env.get(key):
            log(f"FATAL: {key} missing in {ENV_FILE}")
            sys.exit(1)
    return env


def load_worker_config() -> dict:
    """Read or create the worker-local config."""
    if not WORKER_CONFIG_FILE.exists():
        log(f"FATAL: worker config not found at {WORKER_CONFIG_FILE}. Run worker-setup.sh first.")
        sys.exit(1)
    return json.loads(WORKER_CONFIG_FILE.read_text())


def probe_capabilities() -> dict:
    """What can this machine do?"""
    return {
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "ffprobe": shutil.which("ffprobe") is not None,
        "claude": shutil.which("claude") is not None,
        "yt_dlp": shutil.which("yt-dlp") is not None,
        "python_version": platform.python_version(),
        "claude_code_version": _safe_run(["claude", "--version"]),
    }


def _safe_run(cmd: list, timeout: int = 5) -> str:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=timeout)
        return out.decode("utf-8", errors="replace").strip().splitlines()[0]
    except Exception:
        return ""


def is_claude_code_running() -> bool:
    """Check if Claude Code is currently active on this machine.

    pgrep -f catches the main process and its children. We treat any
    `claude` process as "user is working" — a single hit is enough.
    """
    try:
        r = subprocess.run(
            ["pgrep", "-f", "claude"],
            capture_output=True, text=True, timeout=3
        )
        # Filter our own python's parent claude (if launched from claude code):
        # pgrep returns at least 1 line per matching pid.
        return bool(r.stdout.strip())
    except Exception:
        return True  # fail-open: assume yes so worker doesn't lock up


# ── Supabase REST wrappers ──────────────────────────────────

class SB:
    """Tiny Supabase REST helper. Uses service role key from env.

    Service role bypasses RLS, which is fine for a trusted worker process.
    """
    def __init__(self, env: dict):
        self.url = env["SUPABASE_URL"].rstrip("/")
        self.key = env["SUPABASE_SERVICE_ROLE_KEY"]

    def _headers(self, prefer: str = "return=representation") -> dict:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    def _request(self, method: str, path: str, body=None, prefer="return=representation"):
        full_url = f"{self.url}/rest/v1/{path.lstrip('/')}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(full_url, data=data, method=method, headers=self._headers(prefer))
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                payload = resp.read()
                if not payload:
                    return []
                return json.loads(payload.decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8")
            except Exception:
                pass
            log(f"[SB {method} {path}] HTTP {e.code}: {err_body[:300]}")
            raise
        except Exception as e:
            log(f"[SB {method} {path}] {e}")
            raise

    def select(self, table: str, query: str = "") -> list:
        return self._request("GET", f"{table}?{query}" if query else table)

    def insert(self, table: str, row: dict) -> list:
        return self._request("POST", table, body=row)

    def upsert(self, table: str, row: dict, on_conflict: str = "id") -> list:
        return self._request(
            "POST", f"{table}?on_conflict={on_conflict}",
            body=row,
            prefer="return=representation,resolution=merge-duplicates"
        )

    def update(self, table: str, query: str, patch: dict) -> list:
        return self._request("PATCH", f"{table}?{query}", body=patch)


# ── Worker class ────────────────────────────────────────────

class Worker:
    def __init__(self):
        self.env = load_env()
        self.cfg = load_worker_config()
        self.worker_id = self.cfg["worker_id"]
        self.hostname = socket.gethostname()
        self.os_name = platform.system().lower()
        self.auto_pause_when_claude_idle = bool(self.cfg.get("auto_pause_when_claude_idle", False))
        self.poll_interval = int(self.cfg.get("poll_interval_seconds", POLL_INTERVAL_SECONDS))
        self.sb = SB(self.env)
        self.shutdown = threading.Event()
        self.is_busy = False
        self.current_job_id = None
        self._caps = probe_capabilities()
        # Wire signal handlers for graceful shutdown
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, self._on_signal)

    # ── Lifecycle ──

    def _on_signal(self, *_):
        log(f"received signal — shutting down (current job: {self.current_job_id})")
        self.shutdown.set()

    def register(self):
        row = {
            "worker_id": self.worker_id,
            "hostname": self.hostname,
            "os": self.os_name,
            "python_version": self._caps.get("python_version", ""),
            "claude_code_version": self._caps.get("claude_code_version", ""),
            "last_heartbeat": _now_iso(),
            "status": "idle",
            "capabilities": self._caps,
            "enabled": True,
        }
        try:
            self.sb.upsert("worker_registry", row, on_conflict="worker_id")
            log(f"registered as {self.worker_id} (caps: {json.dumps(self._caps)})")
        except Exception as e:
            log(f"FATAL: registration failed: {e}")
            sys.exit(1)

    def deregister_offline(self):
        try:
            self.sb.update(
                "worker_registry",
                f"worker_id=eq.{urllib.parse.quote(self.worker_id)}",
                {"status": "offline", "last_heartbeat": _now_iso()},
            )
            log("marked self as offline in registry")
        except Exception as e:
            log(f"deregister failed (non-fatal): {e}")

    # ── Heartbeat thread ──

    def heartbeat_loop(self):
        while not self.shutdown.is_set():
            try:
                paused = self.auto_pause_when_claude_idle and not is_claude_code_running()
                next_status = "paused" if paused else ("busy" if self.is_busy else "idle")
                self.sb.update(
                    "worker_registry",
                    f"worker_id=eq.{urllib.parse.quote(self.worker_id)}",
                    {
                        "last_heartbeat": _now_iso(),
                        "status": next_status,
                        "current_job_id": str(self.current_job_id) if self.current_job_id else None,
                    },
                )
            except Exception as e:
                log(f"heartbeat error (non-fatal): {e}")
            self.shutdown.wait(HEARTBEAT_INTERVAL_SECONDS)

    # ── Stale-claim recovery ──

    def release_stale_claims(self):
        """Reset queue rows claimed > 10min ago back to pending.

        Handles the case where a worker crashed mid-job without setting status='offline'.
        Runs once per polling cycle — cheap.
        """
        try:
            cutoff = _now_iso(offset_minutes=-STALE_CLAIM_TIMEOUT_MINUTES)
            # Match any claim that hasn't completed (still claimed/classifying).
            self.sb.update(
                "inspiration_queue",
                f"claimed_at=lt.{urllib.parse.quote(cutoff)}&status=in.(claimed,classifying)",
                {"status": "pending", "claimed_by": None, "claimed_at": None},
            )
        except Exception as e:
            log(f"stale-claim sweep failed (non-fatal): {e}")

    # ── Polling + claim ──

    def _find_offline_workers(self) -> set:
        """Workers whose heartbeat is older than 2 minutes are considered offline.

        Used to interpret 'preferred:<worker>' assignments — if the preferred
        worker is offline, anyone else can claim.
        """
        try:
            cutoff = _now_iso(offset_minutes=-PREFERRED_WORKER_OFFLINE_GRACE_MINUTES)
            rows = self.sb.select(
                "worker_registry",
                f"select=worker_id,last_heartbeat&last_heartbeat=lt.{urllib.parse.quote(cutoff)}"
            )
            return {r["worker_id"] for r in rows if r.get("worker_id")}
        except Exception:
            return set()

    def claim_next_job(self):
        """Find a pending row this worker can handle, claim it atomically.

        Returns the claimed row (dict) or None.
        """
        offline = self._find_offline_workers()

        # We can claim if assignment is 'auto', exactly our id, or 'preferred:<x>'
        # where x is currently offline. Build an OR list for the URL filter.
        preferred_offline = [f"preferred:{w}" for w in offline]
        allowed = ["auto", self.worker_id] + preferred_offline
        # PostgREST `in.(...)` filter — comma-separated, URL-encoded.
        in_list = ",".join(urllib.parse.quote(v) for v in allowed)

        # Step 1: find the oldest matching pending row.
        try:
            rows = self.sb.select(
                "inspiration_queue",
                f"select=*&status=eq.pending"
                f"&worker_assignment=in.({in_list})"
                f"&order=queued_at.asc&limit=1"
            )
        except Exception:
            return None
        if not rows:
            return None
        candidate = rows[0]
        cid = candidate.get("id")
        if not cid:
            return None

        # Step 2: optimistic claim — UPDATE WHERE id=$id AND status='pending'.
        # If 0 rows updated, another worker won. Try next cycle.
        now_iso = _now_iso()
        try:
            updated = self.sb.update(
                "inspiration_queue",
                f"id=eq.{cid}&status=eq.pending",
                {
                    "status": "claimed",
                    "claimed_by": self.worker_id,
                    "claimed_at": now_iso,
                    "attempts": (candidate.get("attempts") or 0) + 1,
                },
            )
            return updated[0] if updated else None
        except Exception as e:
            log(f"claim failed for {cid}: {e}")
            return None

    # ── Run the skill via Claude Code CLI ──

    def run_skill_on_job(self, job: dict) -> dict:
        """Invoke `claude -p` headless to run /clickup-creative-pipeline on this single job.

        We pass the job context via the prompt. The skill already knows how to
        process a single inspiration end-to-end (download, classify, brief,
        ClickUp doc, write back to inspirations table). We just need to point
        it at the right ins_id.

        Returns: {"success": bool, "error": Optional[str]}
        """
        ins_id = job.get("ins_id")
        product_id = job.get("product_id")
        url = job.get("url")
        platform_hint = job.get("platform") or "unknown"

        if not ins_id or not product_id or not url:
            return {"success": False, "error": "queue row missing ins_id/product_id/url"}

        # The classify-inspiration skill is the one that processes
        # inspiration_queue rows. The worker prompt is INTENTIONALLY explicit
        # about every required DB write — earlier loose phrasings caused the
        # skill to skip the inspirations writeback entirely (returned "OK"
        # without persisting to Supabase). Every required write is mandatory.
        prompt = (
            f"Run the /classify-inspiration skill on a SINGLE pending row from inspiration_queue. "
            f"Do NOT batch-scan, do NOT pause for consolidation, do NOT ask any questions.\n\n"
            f"Target row:\n"
            f"  queue_id:   {job.get('id')}\n"
            f"  ins_id:     {ins_id}\n"
            f"  product_id: {product_id}\n"
            f"  url:        {url}\n"
            f"  platform:   {platform_hint}\n\n"
            f"REQUIRED WORK (mandatory — all of these must succeed before printing OK):\n\n"
            f"  1. Resolve product config from Supabase products.config: clickup_list_id, doc_id, ins_prefix.\n"
            f"  2. Download the ad media (Playwright for Facebook Ad Library, yt-dlp for IG/TT/etc.).\n"
            f"  3. Extract frames + audio probe via ffmpeg.\n"
            f"  4. Visually classify: hook_type, creative_structure, production_style, funnel_type, "
            f"persona, angle, ad_type, brand, body_copy, creative_hypothesis, duration_seconds.\n"
            f"  5. Build the 7-section creative brief markdown.\n"
            f"  6. Create a ClickUp Doc page in the product's Inspiration Library doc with the brief. "
            f"Capture the doc page URL.\n\n"
            f"  7. *** MANDATORY DB WRITES — do NOT skip these *** \n"
            f"\n"
            f"     7a. INSERT into public.inspiration_results (ins_id, product_id, source_url, platform, "
            f"metadata, classification, brief, clickup_doc_page_url, clickup_doc_id, duration_seconds, "
            f"frames_extracted) ON CONFLICT(ins_id, product_id) DO UPDATE.\n"
            f"\n"
            f"     7b. UPSERT into public.inspirations with these EXACT columns/keys "
            f"(note: the inspirations table has NO ins_id column — the queue's ins_id maps to "
            f"inspirations.id):\n"
            f"           - id          = '{ins_id}'\n"
            f"           - product_id  = '{product_id}'\n"
            f"           - url         = '{url}'\n"
            f"           - title       = <short formatName from classification>\n"
            f"           - platform    = '{platform_hint}'\n"
            f"           - status      = 'Saved' (or 'Classified')\n"
            f"           - data        = JSONB blob with ALL of: hookType, creativeStructure, "
            f"productionStyle, funnelStage, persona, angle, adType, brand, sourceUrl, bodyCopy, "
            f"creativeHypothesis, duration_seconds, _clickupDocPageUrl, _clickupDocId, classifiedAt, "
            f"formatName, notes.\n"
            f"\n"
            f"     Use the Supabase REST API with the service-role key from $SUPABASE_SERVICE_ROLE_KEY "
            f"(loaded from ~/.classify-inspiration.env). Both writes are MANDATORY — without them the "
            f"dashboard renders the row blank.\n\n"
            f"  8. Do NOT touch inspiration_queue at all (no status update, no claimed_by, no "
            f"processed_at). The worker handles queue state.\n\n"
            f"VERIFICATION (you must pass this before printing OK):\n"
            f"  After step 7, run a SELECT against public.inspirations WHERE id='{ins_id}' "
            f"AND product_id='{product_id}'. Confirm the row exists AND data->>'_clickupDocPageUrl' is non-empty "
            f"AND data->>'hookType' is non-empty AND data->>'creativeStructure' is non-empty.\n\n"
            f"OUTPUT (the LAST line of stdout — nothing else after):\n"
            f"  On success:        'OK {ins_id}'\n"
            f"  On any failure:    'FAIL {ins_id}: <one-line reason>'\n"
            f"  If the verification SELECT shows the row missing or fields blank, that is a FAIL.\n"
        )

        cmd = [
            "claude", "-p", prompt,
            "--permission-mode", "bypassPermissions",
        ]
        log(f"[{job.get('id')}] running skill on {ins_id} (timeout {CLAUDE_CLI_TIMEOUT_SECONDS}s)")
        try:
            r = subprocess.run(
                cmd,
                capture_output=True, text=True,
                timeout=CLAUDE_CLI_TIMEOUT_SECONDS,
            )
            stdout = (r.stdout or "").strip()
            stderr = (r.stderr or "").strip()
            tail = stdout[-500:] if stdout else stderr[-500:]
            if r.returncode != 0:
                return {"success": False, "error": f"claude exit {r.returncode}: {tail}"}
            # Skill is asked to print 'OK <ins_id>' on success.
            skill_says_ok = f"OK {ins_id}" in stdout
            skill_says_fail = f"FAIL {ins_id}" in stdout
            if skill_says_fail:
                idx = stdout.find(f"FAIL {ins_id}")
                return {"success": False, "error": stdout[idx:idx + 300]}
            # Belt-and-suspenders: verify the inspirations row actually
            # landed in Supabase. The skill has historically returned OK
            # without writing to the DB. Worker MUST not flip the queue
            # row to "classified" unless the dashboard would actually have
            # something to render.
            verify_ok, verify_msg = self._verify_inspirations_row(ins_id, product_id)
            if not verify_ok:
                return {"success": False, "error": f"skill returned without persisting: {verify_msg}"}
            if skill_says_ok:
                return {"success": True}
            # Skill exited 0 but no OK marker — verification passed though,
            # so trust the verify and continue. Log for debugging.
            log(f"[{job.get('id')}] skill exit 0 with no OK marker but verify passed; tail: {tail[-200:]}")
            return {"success": True, "warning": "no_ok_marker_but_verified"}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"claude timeout after {CLAUDE_CLI_TIMEOUT_SECONDS}s"}
        except FileNotFoundError:
            return {"success": False, "error": "claude CLI not found in PATH"}
        except Exception as e:
            return {"success": False, "error": f"{type(e).__name__}: {e}"}

    # ── Server-side verification of skill output ──

    def _verify_inspirations_row(self, ins_id: str, product_id: str) -> tuple:
        """Confirm the skill actually wrote a usable row to public.inspirations.

        Note on schema: `inspirations` has no `ins_id` column — the
        inspiration's identifier IS the `id` column (values like 'ARI-INS-001').
        Queue's `ins_id` corresponds to inspirations' `id`.

        We require: row exists AND data->>'_clickupDocPageUrl' is set AND
        data->>'hookType' is set AND data->>'creativeStructure' is set.
        Without all three, the dashboard renders the row blank — which is
        not a real classification, so we treat it as failure.

        Returns: (success: bool, message: str).
        """
        try:
            qs = (
                f"select=id,data&"
                f"id=eq.{urllib.parse.quote(ins_id)}&"
                f"product_id=eq.{urllib.parse.quote(product_id)}&"
                f"limit=1"
            )
            rows = self.sb.select("inspirations", qs)
            if not rows:
                return (False, f"no inspirations row for id={ins_id}")
            data = (rows[0] or {}).get("data") or {}
            missing = []
            for k in ("_clickupDocPageUrl", "hookType", "creativeStructure"):
                if not data.get(k):
                    missing.append(k)
            if missing:
                return (False, f"inspirations row exists but missing fields: {', '.join(missing)}")
            return (True, "verified")
        except Exception as e:
            return (False, f"verify query failed: {e}")

    # ── Outcome bookkeeping ──

    def mark_classifying(self, job_id):
        try:
            self.sb.update(
                "inspiration_queue",
                f"id=eq.{job_id}",
                {"status": "classifying"},
            )
        except Exception as e:
            log(f"could not flip {job_id} to classifying: {e}")

    def mark_classified(self, job_id):
        try:
            self.sb.update(
                "inspiration_queue",
                f"id=eq.{job_id}",
                {
                    "status": "classified",
                    "processed_at": _now_iso(),
                    "error_message": None,
                },
            )
        except Exception as e:
            log(f"could not flip {job_id} to classified: {e}")

    def mark_failure(self, job: dict, error: str):
        attempts = (job.get("attempts") or 1)
        if attempts >= MAX_ATTEMPTS_BEFORE_FAILED:
            new_status = "failed"
            log(f"[{job.get('id')}] FINAL FAILURE after {attempts} attempts: {error}")
        else:
            new_status = "pending"  # let any worker retry
            log(f"[{job.get('id')}] attempt {attempts} failed, requeuing: {error}")
        try:
            self.sb.update(
                "inspiration_queue",
                f"id=eq.{job.get('id')}",
                {
                    "status": new_status,
                    "claimed_by": None,
                    "claimed_at": None,
                    "error_message": error[:500],
                },
            )
        except Exception as e:
            log(f"could not flip {job.get('id')} to {new_status}: {e}")

    def increment_completed(self):
        try:
            row = self.sb.select(
                "worker_registry",
                f"select=jobs_completed_total&worker_id=eq.{urllib.parse.quote(self.worker_id)}"
            )
            cur = row[0]["jobs_completed_total"] if row else 0
            self.sb.update(
                "worker_registry",
                f"worker_id=eq.{urllib.parse.quote(self.worker_id)}",
                {"jobs_completed_total": cur + 1, "last_job_at": _now_iso()},
            )
        except Exception as e:
            log(f"increment_completed failed (non-fatal): {e}")

    def increment_failed(self):
        try:
            row = self.sb.select(
                "worker_registry",
                f"select=jobs_failed_total&worker_id=eq.{urllib.parse.quote(self.worker_id)}"
            )
            cur = row[0]["jobs_failed_total"] if row else 0
            self.sb.update(
                "worker_registry",
                f"worker_id=eq.{urllib.parse.quote(self.worker_id)}",
                {"jobs_failed_total": cur + 1, "last_job_at": _now_iso()},
            )
        except Exception as e:
            log(f"increment_failed failed (non-fatal): {e}")

    # ── Main loop ──

    def run(self):
        log(f"=== classify-worker starting as '{self.worker_id}' on {self.hostname} ({self.os_name}) ===")
        log(f"poll interval: {self.poll_interval}s · auto-pause-when-claude-idle: {self.auto_pause_when_claude_idle}")

        self.register()

        # Start heartbeat thread
        hb = threading.Thread(target=self.heartbeat_loop, name="heartbeat", daemon=True)
        hb.start()

        try:
            while not self.shutdown.is_set():
                try:
                    if self.auto_pause_when_claude_idle and not is_claude_code_running():
                        # Skip claiming — heartbeat thread will surface 'paused'.
                        self.shutdown.wait(self.poll_interval)
                        continue

                    # Cleanup any stale claims first
                    self.release_stale_claims()

                    job = self.claim_next_job()
                    if not job:
                        self.shutdown.wait(self.poll_interval)
                        continue

                    self.is_busy = True
                    self.current_job_id = job.get("id")
                    self.mark_classifying(self.current_job_id)
                    # Idempotency shortcut: if the inspirations row is already
                    # complete (e.g. a previous run wrote it but verify
                    # erroneously failed), skip the 7-min skill run and just
                    # flip the queue row.
                    pre_ok, pre_msg = self._verify_inspirations_row(
                        job.get("ins_id"), job.get("product_id"))
                    if pre_ok:
                        log(f"[{self.current_job_id}] inspirations row already complete — skipping skill run")
                        outcome = {"success": True, "shortcut": True}
                    else:
                        outcome = self.run_skill_on_job(job)
                    if outcome.get("success"):
                        self.mark_classified(self.current_job_id)
                        self.increment_completed()
                        log(f"[{self.current_job_id}] ✓ classified")
                    else:
                        self.mark_failure(job, outcome.get("error", "unknown error"))
                        self.increment_failed()
                except Exception as e:
                    log(f"main-loop error: {e}\n{traceback.format_exc()}")
                finally:
                    self.is_busy = False
                    self.current_job_id = None
        finally:
            self.deregister_offline()
            log("=== classify-worker stopped ===")


def _now_iso(offset_minutes: int = 0) -> str:
    """ISO 8601 UTC with optional minute offset (negative for past times)."""
    from datetime import timedelta
    dt = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return dt.isoformat()


# ── Entry point ─────────────────────────────────────────────

def main():
    worker = Worker()
    worker.run()


if __name__ == "__main__":
    main()
