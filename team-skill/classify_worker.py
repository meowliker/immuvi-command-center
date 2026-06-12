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

import ast
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
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is on sys.path so `from tools.strategist...` and
# `from tools.producer...` imports resolve regardless of how the worker
# is invoked (python3 tools/classify_worker.py vs python3 -m tools.classify_worker).
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# ── Configuration ───────────────────────────────────────────

ENV_FILE = Path.home() / ".classify-inspiration.env"
WORKER_CONFIG_FILE = Path.home() / ".classify-inspiration-worker.json"
RESULT_DIR = Path("/tmp")  # the skill writes /tmp/cu_result_<task_id>.json
LOG_DIR = Path.home() / ".classify-inspiration-worker-logs"

POLL_INTERVAL_SECONDS = 60
HEARTBEAT_INTERVAL_SECONDS = 30
STALE_CLAIM_TIMEOUT_MINUTES = 10
ORPHANED_PROCESSING_TIMEOUT_MINUTES = 2
PREFERRED_WORKER_OFFLINE_GRACE_MINUTES = 2
CLAUDE_CLI_TIMEOUT_SECONDS = 1200  # 20 min ceiling (bumped 2026-05-14 — 600s tripped on TikToks: yt-dlp + 30 frame extracts + claude classify reliably hits 10-12 min)
PRODUCER_CLI_TIMEOUT_SECONDS = 1800  # 30 min for Codex image gen jobs
# Max producer jobs running in parallel on this machine. Each is a separate
# codex exec subprocess. Override via PRODUCER_MAX_CONCURRENCY env var.
# 2026-05-09: bumped from sequential (1) to 10 — user is on ChatGPT Max plan,
# rate limits not a concern. Memory invariant #1 (sequential) is explicitly
# overridden by user instruction.
PRODUCER_MAX_CONCURRENCY = int(os.environ.get("PRODUCER_MAX_CONCURRENCY", "10"))
PRODUCER_REQUIRE_PREFERRED_WORKER = os.environ.get("PRODUCER_REQUIRE_PREFERRED_WORKER", "0") == "1"
# Max classify jobs running in parallel on this machine. Each is a separate
# claude -p subprocess. Override via CLASSIFY_MAX_CONCURRENCY env var.
# 2026-05-15: bumped from sequential (1) to 3 by explicit user instruction.
# Producer-invariants #1 ("sequential claude -p across all 3 queues") is
# overridden here for the same reason it was overridden for producer codex —
# user is on a high-tier plan where rate limits are not the binding constraint.
# Belt-and-braces: _execute_classify_job detects rate-limit signals in claude
# stderr ("rate_limit", "429", "overloaded", "5-hour") and pauses the pool for
# 5 min via _claude_cooldown_until. Set CLASSIFY_MAX_CONCURRENCY=1 to revert.
CLASSIFY_MAX_CONCURRENCY = int(os.environ.get("CLASSIFY_MAX_CONCURRENCY", "3"))
CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS = int(os.environ.get("CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS", "300"))
MAX_ATTEMPTS_BEFORE_FAILED = 3
AUTO_PAUSE_CHECK_INTERVAL_SECONDS = 60

# Codex CLI binary (not on PATH; use absolute path).
CODEX_BIN = "/Applications/Codex.app/Contents/Resources/codex"

# ── Worker self-update (2026-05-12) ─────────────────────────
# Polls Vercel for newer versions of worker-related files. On change:
# validate syntax → atomic swap → drain producer pool → os.execv reload.
# Disable by setting WORKER_AUTO_UPDATE=0 in the environment.
WORKER_AUTO_UPDATE_ENABLED = os.environ.get("WORKER_AUTO_UPDATE", "1") != "0"
WORKER_UPDATE_CHECK_EVERY_SECONDS = 60  # ETag check every Nth poll cycle
WORKER_BACKUP_KEEP_COUNT = 3  # keep last N backups; older ones get pruned
WORKER_UPDATE_BASE_URL = os.environ.get(
    "WORKER_UPDATE_BASE_URL",
    "https://immuvi-command-center.vercel.app/team-skill",
).rstrip("/")

# Each entry is (Vercel URL path → local file path relative to project root).
# The main worker file triggers a re-exec on swap; the strategist files
# only need to be on disk (next strategist invocation imports the new code).
WORKER_UPDATE_MANIFEST = [
    {
        "url": f"{WORKER_UPDATE_BASE_URL}/classify_worker.py",
        "rel_path": "tools/classify_worker.py",
        "triggers_restart": True,
    },
    # Strategist modules: triggers_restart=True so Python's sys.modules cache
    # gets refreshed via re-exec. Without this, a strategist file update on
    # disk wouldn't take effect until the next manual worker restart.
    {
        "url": f"{WORKER_UPDATE_BASE_URL}/strategist/synthesis.py",
        "rel_path": "tools/strategist/synthesis.py",
        "triggers_restart": True,
    },
    {
        "url": f"{WORKER_UPDATE_BASE_URL}/strategist/renderer.py",
        "rel_path": "tools/strategist/renderer.py",
        "triggers_restart": True,
    },
]
# Backward-compat: kept as the primary URL for log lines + the single-file
# check path used by older code that imported this name.
WORKER_UPDATE_URL = WORKER_UPDATE_MANIFEST[0]["url"]

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
    required = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLICKUP_API_KEY")
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
        # Codex isn't on PATH; fall back to os.path.exists for the absolute binary.
        "codex": shutil.which(CODEX_BIN) is not None or os.path.exists(CODEX_BIN),
    }


# ── Agent-CLI dispatcher (claude OR codex, whichever is installed) ─────
# Worker tasks like classify-inspiration historically hard-coded `claude -p`.
# On machines that only have Codex installed (e.g. the Mac Mini), that fails.
# This dispatcher detects what's available and routes accordingly.
#   - prefer='claude' → use claude if present, else fall back to codex exec
#   - prefer='codex'  → use codex if present, else fall back to claude
# Returns the list-of-strings to pass to subprocess.run().

def _has_claude() -> bool:
    return shutil.which("claude") is not None


def _has_codex() -> bool:
    return shutil.which(CODEX_BIN) is not None or os.path.exists(CODEX_BIN)


def build_agent_cmd(prompt: str, prefer: str = "claude") -> list:
    """Return the CLI command list for running a skill-style prompt on this
    machine, using whichever agent CLI is actually installed.

    Both Claude Code's `claude -p <prompt>` and Codex's `codex exec <prompt>`
    accept the same prompt shape (free-form text mentioning skills the agent
    has installed). Skills like classify-inspiration auto-fetch their own
    files from Vercel via Step 0, so they work on either agent as long as
    the skill is installed locally for that agent.
    """
    claude_ok = _has_claude()
    codex_ok = _has_codex()
    use_claude = (prefer == "claude" and claude_ok) or (prefer == "codex" and not codex_ok and claude_ok)
    use_codex = (prefer == "codex" and codex_ok) or (prefer == "claude" and not claude_ok and codex_ok)
    if use_claude:
        return ["claude", "-p", prompt, "--permission-mode", "bypassPermissions"]
    if use_codex:
        return [
            CODEX_BIN, "exec",
            "--dangerously-bypass-approvals-and-sandbox",
            "-c", "shell_environment_policy.inherit=all",
            prompt,
        ]
    raise RuntimeError(
        "No agent CLI installed on this machine. Install `claude` "
        "(https://claude.ai/download) or Codex (/Applications/Codex.app)."
    )


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


# ── Worker self-update helpers ──────────────────────────────

def _worker_self_path() -> Path:
    """Absolute path to THIS classify_worker.py file."""
    return Path(__file__).resolve()


def _worker_etag_path() -> Path:
    """Where we cache the last-seen ETag so subsequent fetches are 304s."""
    return _worker_self_path().with_suffix(".py.etag")


def _prune_worker_backups(keep: int = WORKER_BACKUP_KEEP_COUNT) -> None:
    """Keep only the N most recent .bak.* files for the worker."""
    try:
        parent = _worker_self_path().parent
        backups = sorted(
            parent.glob("classify_worker.py.bak.*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in backups[keep:]:
            try:
                old.unlink()
            except Exception:
                pass
    except Exception:
        pass


def _project_root() -> Path:
    """Project root directory (two levels up from this file)."""
    return _worker_self_path().parent.parent


def _check_one_file_update(entry: dict) -> bool:
    """Check + download ONE file from the manifest. Returns True if a new
    version was just written to disk. Mirrors the original single-file logic
    but parameterized over (url, rel_path)."""
    url = entry["url"]
    rel = entry["rel_path"]
    file_path = _project_root() / rel
    etag_path = file_path.with_name(file_path.name + ".etag")
    # Skip if the target file doesn't exist yet (avoid creating phantom dirs).
    if not file_path.exists():
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            return False
    try:
        headers = {}
        if etag_path.exists():
            try:
                stored_etag = etag_path.read_text().strip()
                if stored_etag:
                    headers["If-None-Match"] = stored_etag
            except Exception:
                pass
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.getcode()
                new_etag = resp.headers.get("ETag", "") or ""
                body = resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 304:
                return False
            log(f"[self-update] HTTP {e.code} fetching {rel} — skipping")
            return False
        except Exception as e:
            log(f"[self-update] fetch error for {rel}: {e}")
            return False
        if status != 200 or not body:
            return False
        try:
            current = file_path.read_bytes() if file_path.exists() else b""
            if body == current:
                if new_etag:
                    try: etag_path.write_text(new_etag)
                    except Exception: pass
                return False
        except Exception:
            current = b""
        # Syntax-validate Python files before swapping
        if rel.endswith(".py"):
            try:
                ast.parse(body.decode("utf-8"))
            except SyntaxError as e:
                log(f"[self-update] {rel} has syntax error — refusing to swap: {e}")
                return False
        # Backup the current version
        try:
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup = file_path.with_name(file_path.name + ".bak." + ts)
            if file_path.exists():
                shutil.copy2(file_path, backup)
        except Exception as e:
            log(f"[self-update] backup failed for {rel}: {e}")
        # Atomic rename
        tmp = file_path.with_name(file_path.name + ".tmp")
        try:
            tmp.write_bytes(body)
            os.replace(tmp, file_path)
        except Exception as e:
            log(f"[self-update] write/swap failed for {rel}: {e}")
            try: tmp.unlink()
            except Exception: pass
            return False
        if new_etag:
            try: etag_path.write_text(new_etag)
            except Exception: pass
        log(f"[self-update] downloaded new version of {rel}")
        return True
    except Exception as e:
        log(f"[self-update] unexpected error for {rel}: {e}")
        return False


def check_for_worker_update() -> bool:
    """Iterate over WORKER_UPDATE_MANIFEST. Returns True if ANY entry with
    triggers_restart=True was updated (meaning the worker should re-exec).
    Non-restart entries (e.g. strategist modules) are updated silently —
    the next import picks them up.
    """
    if not WORKER_AUTO_UPDATE_ENABLED:
        return False
    needs_restart = False
    for entry in WORKER_UPDATE_MANIFEST:
        updated = _check_one_file_update(entry)
        if updated and entry.get("triggers_restart"):
            needs_restart = True
    if needs_restart:
        _prune_worker_backups()
        log("[self-update] worker file updated — will restart after pool drain")
    return needs_restart


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
        # Producer parallel-execution pool. Producer jobs (image gen) run
        # concurrently up to PRODUCER_MAX_CONCURRENCY per machine.
        self._producer_pool = ThreadPoolExecutor(
            max_workers=PRODUCER_MAX_CONCURRENCY,
            thread_name_prefix="producer",
        )
        self._producer_futures = {}  # run_id -> Future
        self._producer_lock = threading.Lock()
        # Classify parallel-execution pool (NEW 2026-05-15). Each slot runs
        # one `claude -p /classify-inspiration` subprocess to completion.
        # Strategist still runs sequentially — only when ALL classify slots
        # are idle — because strategist also uses `claude -p` and we don't
        # want it competing for the same rate-limit window mid-classify.
        self._classify_pool = ThreadPoolExecutor(
            max_workers=CLASSIFY_MAX_CONCURRENCY,
            thread_name_prefix="classify",
        )
        self._classify_futures = {}  # queue_id -> Future
        self._classify_lock = threading.Lock()
        # Rate-limit cooldown: time.time() epoch until which we pause all
        # classify dispatch. Set when _execute_classify_job detects a
        # rate-limit signal in claude stderr/stdout.
        self._claude_cooldown_until = 0.0
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
                # Worker is busy if strategist is running OR any classify
                # or producer jobs are in flight in their parallel pools.
                _producer_active = self._active_producer_count() > 0
                _classify_active = self._active_classify_count() > 0
                _is_busy = self.is_busy or _producer_active or _classify_active
                next_status = "paused" if paused else ("busy" if _is_busy else "idle")
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
        """Reset/recover queue rows that can no longer make progress.

        Handles the case where a worker crashed mid-job without setting status='offline'.
        Also handles dashboard-created rows that were inserted as
        status='processing' but never claimed by a worker.
        Runs once per polling cycle — cheap.
        """
        try:
            cutoff = _now_iso(offset_minutes=-STALE_CLAIM_TIMEOUT_MINUTES)
            # Match any claim that hasn't completed (still claimed/classifying/processing).
            self.sb.update(
                "inspiration_queue",
                f"claimed_at=lt.{urllib.parse.quote(cutoff)}&status=in.(claimed,classifying,processing)",
                {"status": "pending", "claimed_by": None, "claimed_at": None},
            )
            orphan_cutoff = _now_iso(offset_minutes=-ORPHANED_PROCESSING_TIMEOUT_MINUTES)
            self.sb.update(
                "inspiration_queue",
                f"queued_at=lt.{urllib.parse.quote(orphan_cutoff)}&status=eq.processing&claimed_by=is.null",
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
        """Find a queued row this worker can handle, claim it atomically.

        Returns the claimed row (dict) or None.
        """
        offline = self._find_offline_workers()

        # We can claim if assignment is 'auto', exactly our id, or 'preferred:<x>'
        # where x is currently offline. Build an OR list for the URL filter.
        preferred_offline = [f"preferred:{w}" for w in offline]
        allowed = ["auto", self.worker_id] + preferred_offline
        # PostgREST `in.(...)` filter — comma-separated, URL-encoded.
        in_list = ",".join(urllib.parse.quote(v) for v in allowed)

        # Step 1: find the oldest matching claimable row. Newer dashboard
        # code writes status='pending', but older/manual flows used
        # status='processing' before the worker ever claimed the row. Treat
        # unclaimed processing rows as queued work so both workers can drain
        # that backlog.
        try:
            rows = self.sb.select(
                "inspiration_queue",
                f"select=*&status=in.(pending,processing)"
                f"&claimed_by=is.null"
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

        # Step 2: optimistic claim — UPDATE WHERE id=$id AND status is still
        # claimable. If 0 rows updated, another worker won. Try next cycle.
        now_iso = _now_iso()
        try:
            updated = self.sb.update(
                "inspiration_queue",
                f"id=eq.{cid}&status=in.(pending,processing)&claimed_by=is.null",
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

    def claim_next_variation_brief_job(self):
        """Atomically claim a pending variation_brief_queue row. Mirrors
        claim_next_job (which is for inspiration_queue) — same pattern:
        SELECT order_by created_at ASC, then PATCH ?status=eq.pending to
        flip to classifying so a second worker on the same row loses the
        race and finds nothing left.

        Returns the claimed row dict, or None if no pending work.
        """
        try:
            rows = self.sb.select(
                "variation_brief_queue",
                "select=id,parent_ad_id,drive_file_id,target_ad_id,attempts"
                "&status=eq.pending&order=created_at.asc&limit=1",
            )
            if not rows:
                return None
            job = rows[0]
            patch = {
                "status": "classifying",
                "claimed_by": self.worker_id,
                "claimed_at": _now_iso(),
                "attempts": (job.get("attempts") or 0) + 1,
            }
            updated = self.sb.update(
                "variation_brief_queue",
                f"id=eq.{urllib.parse.quote(job['id'])}&status=eq.pending",
                patch,
            )
            if not updated:
                return None  # lost the race to another worker
            return updated[0]
        except Exception as e:
            log(f"claim_next_variation_brief_job error: {e}")
            return None

    def _resolve_brief_context(self, parent_ad_id, target_ad_id):
        """Look up parent + target ads from public.ads for the brief prompt.
        Best-effort — missing fields just become 'unknown' downstream."""
        ctx = {"parent_ad": None, "target_ad": None}
        try:
            qs = (
                "select=id,format_name,clickup_task_id,product_id,meta&"
                f"id=in.({urllib.parse.quote(parent_ad_id)},{urllib.parse.quote(target_ad_id)})"
            )
            rows = self.sb.select("ads", qs)
            for r in rows:
                if r.get("id") == parent_ad_id: ctx["parent_ad"] = r
                if r.get("id") == target_ad_id: ctx["target_ad"] = r
        except Exception as e:
            log(f"_resolve_brief_context error: {e}")
        return ctx

    # ── Producer parallel-execution helpers ──

    def _active_producer_count(self) -> int:
        """Count of producer jobs currently running in the pool."""
        with self._producer_lock:
            return sum(1 for f in self._producer_futures.values() if not f.done())

    def _reap_producer_futures(self) -> None:
        """Remove completed futures from tracking. Call before submitting new ones."""
        with self._producer_lock:
            done_ids = [rid for rid, f in self._producer_futures.items() if f.done()]
            for rid in done_ids:
                f = self._producer_futures.pop(rid)
                # Surface any uncaught exception from the worker thread.
                try:
                    exc = f.exception(timeout=0)
                    if exc:
                        log(f"[producer] run {rid} raised: {exc}")
                except Exception:
                    pass

    def _producer_has_capacity(self) -> bool:
        """True if pool has a free slot for a new producer job."""
        return self._active_producer_count() < PRODUCER_MAX_CONCURRENCY

    # ── Classify parallel-execution helpers (2026-05-15) ──

    def _active_classify_count(self) -> int:
        """Count of classify jobs currently running in the pool."""
        with self._classify_lock:
            return sum(1 for f in self._classify_futures.values() if not f.done())

    def _reap_classify_futures(self) -> None:
        """Remove completed classify futures from tracking."""
        with self._classify_lock:
            done_ids = [qid for qid, f in self._classify_futures.items() if f.done()]
            for qid in done_ids:
                f = self._classify_futures.pop(qid)
                try:
                    exc = f.exception(timeout=0)
                    if exc:
                        log(f"[classify] queue {qid} raised: {exc}")
                except Exception:
                    pass

    def _classify_has_capacity(self) -> bool:
        """True if pool has a free slot AND we're not in rate-limit cooldown."""
        if time.time() < self._claude_cooldown_until:
            return False
        return self._active_classify_count() < CLASSIFY_MAX_CONCURRENCY

    def _execute_classify_job(self, job: dict) -> None:
        """Run a single classify job end-to-end on a pool thread.

        Mirrors the old sequential block (mark_classifying → idempotency
        shortcut → skill run → mark_classified/mark_failure) but runs on a
        worker thread so multiple jobs can be in flight at once.

        Rate-limit guard: if the skill's error string contains a known
        rate-limit signal, set the global cooldown so further dispatch
        pauses until the window passes. This protects the producer-
        invariants #1 worst case (5-hour Anthropic cooldown) — when
        Anthropic returns a 429/529, we back off rather than slamming
        them with 3 more in-flight requests.
        """
        queue_id = job.get("id")
        ins_id = job.get("ins_id")
        product_id = job.get("product_id")
        try:
            self.mark_classifying(queue_id)
            # Idempotency: skip the 10-min skill run if the inspirations row
            # is already complete from a prior attempt.
            pre_ok, pre_msg = self._verify_inspirations_row(ins_id, product_id)
            if pre_ok:
                log(f"[{queue_id}] inspirations row already complete — skipping skill run")
                self.mark_classified(queue_id)
                self.increment_completed()
                return
            outcome = self.run_skill_on_job(job)
            err = (outcome.get("error") or "").lower()
            rl_signals = ("rate_limit", "rate limit", "429", "529", "overloaded", "5-hour", "5 hour")
            if any(t in err for t in rl_signals):
                self._claude_cooldown_until = time.time() + CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS
                log(f"[{queue_id}] RATE-LIMIT SIGNAL detected — pausing classify pool for "
                    f"{CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS}s. Error: {err[:200]}")
            if outcome.get("success"):
                self.mark_classified(queue_id)
                self.increment_completed()
                log(f"[{queue_id}] ✓ classified")
            else:
                self.mark_failure(job, outcome.get("error", "unknown error"))
                self.increment_failed()
        except Exception as e:
            log(f"[{queue_id}] classify pool exception: {e}\n{traceback.format_exc()}")
            try:
                self.mark_failure(job, f"worker exception: {e}")
            except Exception:
                pass

    def _execute_variation_brief_job(self, job: dict) -> None:
        """Run a single variation_brief_queue job end-to-end on a pool thread.

        Mirrors _execute_classify_job's structure (idempotency check →
        skill run → mark done/fail → rate-limit-cooldown bookkeeping).
        Shares the same _classify_pool, so this job competes for the
        same N concurrency slots as inspiration jobs.
        """
        queue_id      = job.get("id")
        drive_file_id = job.get("drive_file_id")
        parent_ad_id  = job.get("parent_ad_id")
        target_ad_id  = job.get("target_ad_id")
        try:
            self._mark_brief_classifying(queue_id)
            # Idempotency: skip the skill if the brief is already complete.
            pre_ok, pre_msg = self._verify_variation_brief_row(drive_file_id)
            if pre_ok:
                log(f"[{queue_id}] variation_briefs row already complete — skipping skill run")
                self._mark_brief_done(queue_id)
                self.increment_completed()
                return
            ctx = self._resolve_brief_context(parent_ad_id, target_ad_id)
            outcome = self.run_variation_brief_skill_on_job(job, ctx)
            err = (outcome.get("error") or "").lower()
            rl_signals = ("rate_limit", "rate limit", "429", "529", "overloaded", "5-hour", "5 hour")
            if any(t in err for t in rl_signals):
                self._claude_cooldown_until = time.time() + CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS
                log(f"[{queue_id}] RATE-LIMIT SIGNAL on brief job — pausing classify pool for "
                    f"{CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS}s. Error: {err[:200]}")
            if outcome.get("success"):
                self._mark_brief_done(queue_id)
                self.increment_completed()
                log(f"[{queue_id}] ✓ brief generated")
            else:
                self._mark_brief_failure(job, outcome.get("error", "unknown error"))
                self.increment_failed()
        except Exception as e:
            log(f"[{queue_id}] brief pool exception: {e}\n{traceback.format_exc()}")
            try:
                self._mark_brief_failure(job, f"worker exception: {e}")
            except Exception:
                pass

    def _execute_producer_run(self, prod_run: dict) -> None:
        """Run a single producer job end-to-end on a pool thread.

        Thread-safe: each call uses its own subprocess + local state.
        Handles success, FAIL, ambiguous, and timeout (with attachment recovery).
        Always patches the producer_runs row to a terminal status.
        """
        from tools.producer.db import finish_run as _finish_producer_run
        run_id = prod_run["id"]
        log(f"[producer] picking up run id={run_id} "
            f"task={prod_run['task_id']} count={prod_run.get('count', 5)}")
        try:
            _instr = (prod_run.get("instruction") or "").replace("\n", " ").strip()
            # Fetch strategist memory for the product (best-effort).
            _strategist_memory_blob = ""
            try:
                _mem_qs = urllib.parse.urlencode({
                    "select": "json,markdown,updated_at",
                    "product_id": "eq." + str(prod_run["product_id"]),
                    "limit": "1",
                })
                _mem_url = (f"{os.environ['SUPABASE_URL']}/rest/v1/"
                            f"strategist_memory?{_mem_qs}")
                _mem_req = urllib.request.Request(_mem_url, headers={
                    "apikey":        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                    "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                    "Accept":        "application/json",
                })
                with urllib.request.urlopen(_mem_req, timeout=10) as _mr:
                    _rows = json.loads(_mr.read().decode() or "[]")
                if _rows:
                    _row0 = _rows[0]
                    _mj = _row0.get("json") or {}
                    _md = _row0.get("markdown") or ""
                    _strategist_memory_blob = (
                        "## Strategist memory (JSON)\n```json\n"
                        + json.dumps(_mj, indent=2)
                        + "\n```\n\n"
                        "## Strategist memory (markdown)\n"
                        + _md.strip() + "\n"
                    )
                else:
                    _strategist_memory_blob = "(none — no strategist memory yet for this product)\n"
            except Exception as _mem_err:
                log(f"[producer] strategist memory fetch failed: {_mem_err}")
                _strategist_memory_blob = "(strategist memory fetch failed — proceed without)\n"

            _prompt = (
                "Use the immuvi-creative-producer skill.\n"
                "Use model: GPT-5.5.\n"
                "Use reasoning effort: medium.\n"
                "Generate the images using your native image generation capability — the same one you use in the Codex chat. Do not specify or hard-code a particular image model name; use whatever native image tool is available.\n"
                "Use image quality: high.\n"
                "Use image size/aspect ratio: match the inspiration image unless the task specifies another size. Do NOT hard-code 1024x1536. If inspiration dimensions are unavailable, fall back to the task/platform default, then 4:5 for static social ads.\n\n"
                "Output requirement: each variation must be generated/saved/uploaded as its own standalone final image file. Do NOT create or upload contact sheets, 2x2 grids, merged review boards, collages, multi-variation images, no-output placeholders, failed retry artifacts, rejected drafts, metadata files, prompt files, or duplicate copies. Final upload filenames must include "
                f"RUN{run_id}_V##_final. If the native image tool returns a grid, split it into separate final files before upload and mark only the individual final files as outputs.\n\n"
                "Run producer job:\n"
                f"- task_id: {prod_run['task_id']}\n"
                f"- product_id: {prod_run['product_id']}\n"
                f"- producer_run_id: {run_id}\n"
                f"- count: {prod_run.get('count', 5)}\n"
                f"- instruction: {_instr}\n\n"
                "Creative Strategist data:\n"
                f"{_strategist_memory_blob}\n"
                "Required flow:\n"
                "1. Read ClickUp task details and custom fields.\n"
                "2. Read ClickUp task comments.\n"
                "3. Find inspiration doc link and source image link from description/comments.\n"
                "4. Read the ClickUp inspiration doc page.\n"
                "5. Download and visually analyze the source inspiration image.\n"
                "6. Extract inspiration dimensions/aspect ratio and use that for generation (do NOT hard-code 1024x1536).\n"
                "7. Build a reference_anatomy note before generation: subject_type, subject_presence, setting, composition, overlay_system, copy_density, product_presence, edge_alignment, text_alignment, and variation_1_lock. variation_1_lock must capture the exact setting, subject pose, camera angle, crop, emotional mood, overlay geometry, left-edge/inset behavior, and text alignment that Variation 1 must copy.\n"
                "8. Build a structured creative brief before image generation.\n"
                "9. Use Creative Strategist data to reuse winning elements and avoid losing combos.\n"
                "10. Generate the requested number of standalone image files using your native image generation at high quality (same as Codex chat — do not hard-code a specific model name). Generate one variation per native image call. Variation 1 must be the reference-faithful version: same setting, subject type, pose, camera angle, crop, overlay positions, edge alignment, and text alignment while swapping only our task message/product/offer. Variations 2+ may explore new settings/executions while preserving the selected reference mechanic. Never count a merged grid/contact sheet as a final output.\n"
                "11. Preserve reference anatomy, not just theme. Reference anatomy wins over offer/CTA prominence when they conflict, but PRODUCT DIRECTIVES are mandatory: the offer must be visibly featured and talent/faces must match the stated market. If the reference has a human subject, include a comparable visible human subject in similar scale/role/pose region; do not replace them with a backpack, chair, desk, hallway, worksheet, empty classroom, playground, or product shot. For BREAKING NEWS references, make one full-bleed candid photo with compact overlays on top of the photo: a left-edge red/blue slanted BREAKING NEWS band around the lower third, about 50-65% canvas width and 7-10% canvas height, plus one compact left-edge white headline strip directly below, about 75-90% canvas width and 8-12% canvas height. Preserve the reference's left-edge/inset behavior and headline alignment. The red BREAKING box must be wider than the blue NEWS box, both with balanced padding; the diagonal join must sit between words and never through letters. Keep visible photo under and around the overlays. Keep the main headline about the angle/persona. If an offer is specified, show it as a small separate CTA tag/badge attached to the existing overlay, usually at the far right end of the headline strip or just below its right edge. Do not put the offer inside the headline sentence and do not omit it. No full-width TV-news bar, oversized CTA/footer bar, blank white bottom panel, product mockup, oversized poster headline, large white copy block, or icon/product row.\n"
                "12. If a native image call errors or returns no output, retry with a materially simpler prompt under 900 characters, then one final ultra-simple prompt under 550 characters. Do not repeat the same failed prompt. Do not use any fallback renderer.\n"
                "13. Quality gate each image before upload — persona match, required market/talent match, mandatory offer visible, readable typography, reference-anatomy match, mechanic match, brand fit, not generic. Reject Variation 1 if it changes the inspiration setting, subject pose, camera angle, overlay position, edge alignment, or text alignment. For BREAKING NEWS references, reject any image with no comparable visible human subject when the reference has one, a left gap when the reference starts at the left edge, centered headline text when the reference is left-aligned, squeezed BREAKING box, oversized NEWS box, diagonal join through letters, distorted/glitched banner text, full-width TV-news banner, missing offer CTA, offer inside the main headline sentence, oversized CTA/footer/button, blank white bottom panel, bottom poster block, oversized headline text, photo missing below/around the overlays, or extra footer/poster sections beyond photo + compact news band + compact headline strip + small attached offer CTA.\n"
                "14. Regenerate once if quality gate fails, using a simpler prompt that fixes the specific failed criterion. If no image passes the reference-anatomy quality gate after retry, PATCH the run failed instead of uploading a weak/non-matching image.\n"
                f"15. Upload only final accepted images to ClickUp, exactly one attachment per accepted variation, with filenames containing RUN{run_id}_V##_final. Verify the local file exists, is non-empty, and opens as an image before upload.\n"
                "16. Add ClickUp comment with summary and output links.\n"
                "17. Set ClickUp task status to Ready to Launch only after upload succeeds.\n"
                "18. PATCH producer_runs row "
                f"{run_id} with status='done' and outputs as a JSON array of objects each "
                "containing: variation_id, file_path, clickup_attachment_url, source_inspiration, "
                "inspiration_dimensions, aspect_ratio, reference_anatomy, variation_1_lock, prompt, image_model, quality_gate. "
                "On failure PATCH status='failed' with a useful error string that includes native_generation_failed, reference_anatomy, and the final simplified prompt when image generation fails.\n\n"
                f"Print 'OK {run_id}' on success or 'FAIL {run_id}: <reason>' on failure "
                "as the LAST line of stdout."
            )
            # 2026-05-11: force GPT-5.5 + medium reasoning at the runtime
            # level via CLI flags. The prompt-text "Use model: X" hints don't
            # actually change the model — only --model / -c flags do. Without
            # these, codex exec falls back to ~/.codex/config.toml defaults
            # (which had reasoning_effort=low → poor image-gen output).
            cmd = [
                CODEX_BIN, "exec",
                "--dangerously-bypass-approvals-and-sandbox",
                "-c", "shell_environment_policy.inherit=all",
                "--model", "gpt-5.5",
                "-c", "model_reasoning_effort=medium",
                _prompt,
            ]
            try:
                r = subprocess.run(cmd, capture_output=True,
                                   text=True,
                                   timeout=PRODUCER_CLI_TIMEOUT_SECONDS)
                stdout = (r.stdout or "").strip()
                stderr = (r.stderr or "").strip()
                tail = (stdout[-300:] or stderr[-300:])
                ok = f"OK {run_id}" in stdout
                failed = f"FAIL {run_id}" in stdout
                if r.returncode != 0 or failed:
                    err = f"codex exit {r.returncode}: {tail}"
                    try:
                        _finish_producer_run(
                            supabase_url=os.environ["SUPABASE_URL"],
                            service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                            run_id=run_id, status="failed",
                            outputs=None, error=err,
                        )
                    except Exception:
                        pass
                    log(f"[producer] run {run_id} FAILED: {tail[-200:]}")
                elif ok:
                    # Pillow / fallback rejection — verify Codex actually used a
                    # real native image generator. If outputs were silently made
                    # by Pillow / ASCII art / static graphic renderer, force-fail
                    # the run so the buyer never ships fake images. Re-fetches
                    # the row to read what the skill wrote back.
                    _is_fake = False
                    _fake_reason = ""
                    try:
                        _verify_qs = urllib.parse.urlencode({
                            "id":     f"eq.{run_id}",
                            "select": "outputs",
                        })
                        _verify_url = f"{os.environ['SUPABASE_URL']}/rest/v1/producer_runs?{_verify_qs}"
                        _verify_req = urllib.request.Request(_verify_url, headers={
                            "apikey":        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                            "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                        })
                        with urllib.request.urlopen(_verify_req, timeout=10) as _vr:
                            _vrows = json.loads(_vr.read().decode() or "[]")
                        _outputs = (_vrows[0].get("outputs") if _vrows else None) or []
                        # Markers that indicate a fake / fallback image gen.
                        _bad_markers = (
                            "pillow", "fallback", "programmatic", "static graphic",
                            "ascii", "PIL ", "local high-resolution", "deterministic SVG",
                            "PIL.Image", "drawn with",
                        )
                        for _o in _outputs:
                            _model = str((_o or {}).get("image_model") or "").lower()
                            if any(m in _model for m in _bad_markers):
                                _is_fake = True
                                _fake_reason = f"image_model='{_model[:120]}'"
                                break
                    except Exception as _ve:
                        log(f"[producer] run {run_id} verify error (allowing through): {_ve}")
                    if _is_fake:
                        log(f"[producer] run {run_id} REJECTED — Pillow/fallback detected. {_fake_reason}")
                        try:
                            _finish_producer_run(
                                supabase_url=os.environ["SUPABASE_URL"],
                                service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                run_id=run_id, status="failed",
                                outputs=None,
                                error=f"Worker rejected fake/Pillow output. {_fake_reason}. The skill must use Codex native image generation only.",
                            )
                        except Exception:
                            pass
                    else:
                        log(f"[producer] run {run_id} DONE")
                else:
                    log(f"[producer] run {run_id} ambiguous, "
                        f"trusting skill writeback. tail: {tail[-200:]}")
            except subprocess.TimeoutExpired:
                log(f"[producer] run {run_id} TIMEOUT after {PRODUCER_CLI_TIMEOUT_SECONDS}s — attempting attachment recovery")
                _recovered = False
                try:
                    _cu_key = os.environ.get("CLICKUP_API_KEY", "")
                    _task_url = f"https://api.clickup.com/api/v2/task/{prod_run['task_id']}"
                    _req = urllib.request.Request(
                        _task_url,
                        headers={"Authorization": _cu_key}
                    )
                    with urllib.request.urlopen(_req, timeout=15) as _tr:
                        _task_data = json.loads(_tr.read().decode())
                    _attachments = _task_data.get("attachments") or []
                    _tag = f"RUN{run_id}"
                    _matched = []
                    for a in _attachments:
                        _haystack = (a.get("title") or "") + " " + (a.get("url") or "")
                        if _tag not in _haystack or "_final" not in _haystack:
                            continue
                        _matched.append(a)
                    _expected = prod_run.get("count", 1)
                    if len(_matched) >= _expected:
                        _outputs = [
                            {
                                "variation_id": f"V{str(i+1).zfill(2)}",
                                "file_path": None,
                                "clickup_attachment_url": a.get("url"),
                                "image_model": "native Codex/ChatGPT image generation; recovered from ClickUp attachments because worker timed out before metadata writeback",
                                "source_inspiration": None,
                                "aspect_ratio": None,
                                "prompt": None,
                                "quality_gate": {"status": "recovered"},
                            }
                            for i, a in enumerate(_matched[:_expected])
                        ]
                        try:
                            _status_body = json.dumps({"status": "Ready to Launch"}).encode()
                            _sr = urllib.request.Request(
                                f"https://api.clickup.com/api/v2/task/{prod_run['task_id']}",
                                data=_status_body, method="PUT",
                                headers={"Authorization": _cu_key,
                                         "Content-Type": "application/json"}
                            )
                            urllib.request.urlopen(_sr, timeout=10)
                        except Exception:
                            pass
                        _finish_producer_run(
                            supabase_url=os.environ["SUPABASE_URL"],
                            service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                            run_id=run_id, status="done",
                            outputs=_outputs, error=None,
                        )
                        log(f"[producer] run {run_id} RECOVERED — {len(_matched)} attachments found in ClickUp")
                        _recovered = True
                    else:
                        log(f"[producer] run {run_id} timeout recovery: only {len(_matched)}/{_expected} attachments found — marking failed")
                except Exception as _re:
                    log(f"[producer] run {run_id} timeout recovery error: {_re}")
                if not _recovered:
                    try:
                        _finish_producer_run(
                            supabase_url=os.environ["SUPABASE_URL"],
                            service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                            run_id=run_id, status="failed",
                            outputs=None,
                            error=f"timeout after {PRODUCER_CLI_TIMEOUT_SECONDS}s — no attachments found for recovery",
                        )
                    except Exception:
                        pass
        except Exception as _outer:
            log(f"[producer] run {run_id} crashed: {_outer}\n{traceback.format_exc()}")
            try:
                _finish_producer_run(
                    supabase_url=os.environ["SUPABASE_URL"],
                    service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                    run_id=run_id, status="failed",
                    outputs=None, error=f"worker thread crashed: {_outer}",
                )
            except Exception:
                pass

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
            f"  2. Download the ad media (Playwright only for Facebook Ad Library; non-browser downloader chain for TikTok; yt-dlp/helper chain for IG/other video URLs).\n"
            f"     Never try to download TikTok through a browser UI. For ads.tiktok.com Creative Center/topads links, use the skill helper's Creative Center SSR signed-MP4 resolver.\n"
            f"  3. Extract frames + audio probe via ffmpeg.\n"
            f"  4. Visually classify (ALL 8 are MANDATORY — none may be blank):\n"
            f"       hook_type, creative_structure, production_style, funnel_type,\n"
            f"       persona, angle, ad_type, brand.\n"
            f"     Plus: body_copy, creative_hypothesis, duration_seconds (best-effort).\n"
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
            f"AND product_id='{product_id}'. Confirm the row exists AND ALL EIGHT classification "
            f"fields are non-empty in data:\n"
            f"    data->>'brand'             non-empty\n"
            f"    data->>'angle'             non-empty\n"
            f"    data->>'persona'           non-empty\n"
            f"    data->>'creativeStructure' non-empty\n"
            f"    data->>'hookType'          non-empty\n"
            f"    data->>'productionStyle'   non-empty\n"
            f"    data->>'funnelStage'       non-empty\n"
            f"    data->>'adType'            non-empty\n"
            f"  AND data->>'_clickupDocPageUrl' is non-empty.\n"
            f"  If ANY of the nine values is null/empty, that is a hard FAIL — print "
            f"'FAIL {ins_id}: missing fields: <comma-list>'. The worker will retry up to "
            f"{MAX_ATTEMPTS_BEFORE_FAILED} times.\n\n"
            f"OUTPUT (the LAST line of stdout — nothing else after):\n"
            f"  On success:        'OK {ins_id}'\n"
            f"  On any failure:    'FAIL {ins_id}: <one-line reason>'\n"
            f"  If the verification SELECT shows the row missing or fields blank, that is a FAIL.\n"
        )

        # Auto-route: prefer claude (the skill's native agent) but fall back
        # to codex on machines that only have Codex installed. The
        # classify-inspiration SKILL.md auto-updates via Step 0 from Vercel,
        # so it works under either agent as long as the skill files exist
        # locally for that agent.
        cmd = build_agent_cmd(prompt, prefer="claude")
        agent_label = cmd[0] if cmd[0] == "claude" else "codex"
        log(f"[{job.get('id')}] running skill on {ins_id} via {agent_label} (timeout {CLAUDE_CLI_TIMEOUT_SECONDS}s)")
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

    def run_variation_brief_skill_on_job(self, job, ctx):
        """Invoke the agent CLI to generate a real brief for a winning
        variation. Mirrors run_skill_on_job's structure: build prompt →
        subprocess → check OK/FAIL → server-side verify → return outcome.

        Differences from the inspiration flow:
        - Target table is variation_briefs (UPSERT on drive_file_id)
        - No inspiration_results write
        - Source is a Drive file URL, not a competitor ad URL
        - Brief slant is 'scale this winner', not 'classify this competitor'
        """
        queue_id      = job.get("id")
        parent_ad_id  = job.get("parent_ad_id")
        target_ad_id  = job.get("target_ad_id")
        drive_file_id = job.get("drive_file_id")
        drive_url     = f"https://drive.google.com/file/d/{drive_file_id}/view"

        parent = ctx.get("parent_ad") or {}
        target = ctx.get("target_ad") or {}
        parent_name = parent.get("format_name") or parent_ad_id
        target_name = target.get("format_name") or target_ad_id
        target_cu   = target.get("clickup_task_id") or ""
        parent_cu   = parent.get("clickup_task_id") or ""
        product_id  = target.get("product_id") or parent.get("product_id") or ""

        # 2026-05-25: look up the winner's actual file_name so the brief
        # title reads "13011-2.png" instead of "VOY5Eiv" (last 6 chars of
        # the opaque drive_file_id). Falls back to drive_file_id suffix
        # only if the winners row is missing.
        winner_label = f"{winner_label}"
        try:
            _wrows = self.sb.select(
                "task_video_winners",
                f"select=file_name&drive_file_id=eq.{urllib.parse.quote(drive_file_id)}&limit=1",
            )
            if _wrows and _wrows[0].get("file_name"):
                winner_label = _wrows[0]["file_name"]
        except Exception as e:
            log(f"winner_label lookup failed (using fallback): {e}")

        prompt = (
            f"Generate a creative brief for a WINNING VIDEO VARIATION using the same\n"
            f"workflow as the /classify-inspiration skill (download Drive file → ffmpeg\n"
            f"frames + audio → visual classification → 7-section brief → ClickUp Doc\n"
            f"page). Do NOT batch-scan, do NOT pause for consolidation, do NOT ask any\n"
            f"questions.\n\n"
            f"Target job:\n"
            f"  queue_id:        {queue_id}\n"
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
            f"     persona, angle, ad_type, brand. Plus body_copy, headline, cta,\n"
            f"     creative_hypothesis, duration_seconds, frame_by_frame, why_it_works,\n"
            f"     replication_brief, what_to_test, competitor_intel, our_next_ad.\n"
            f"  5. Build the brief markdown using the EXACT SAME 7-section template as\n"
            f"     the /classify-inspiration skill (see ~/.claude/skills/classify-inspiration\n"
            f"     /SKILL.md Step 6 for the canonical template). The user has asked the\n"
            f"     winner briefs to look identical to inspiration briefs so they render\n"
            f"     consistently inside the same ClickUp doc. Reuse the exact section\n"
            f"     headings + table column names. Sections:\n"
            f"\n"
            f"       # Winner — {parent_name} — {winner_label}\n"
            f"       * * *\n"
            f"       ## 1\\. SNAPSHOT      (table: Brand, Platform=Drive, Duration, Funnel,\n"
            f"                              Format, Hook Type, Angle, Persona, Status=Winner,\n"
            f"                              Decision, Reference=<drive_url>) + Ad Copy,\n"
            f"                              Headline, CTA + 'In one sentence' summary\n"
            f"       ## 2\\. CREATIVE BREAKDOWN   (frame-by-frame table:\n"
            f"                                    Time | Label | What Happens | Emotion Triggered)\n"
            f"       ## 3\\. WHY IT WORKS  (bullets — the psychology that made THIS variant win)\n"
            f"       ## 4\\. REPLICATION BRIEF  (Talent, Set, Key overlay, Subtitle style,\n"
            f"                                  Pacing, Music, Mid-video, End card)\n"
            f"       ## 5\\. WHAT TO TEST  (numbered list of scale variations to try next —\n"
            f"                              this is where the 'scale-this-winner' angle goes)\n"
            f"       ## 6\\. COMPETITOR INTEL  (how this winner positions us vs the category)\n"
            f"       ## 7\\. OUR NEXT AD  (3-line editor brief + hypothesis for the next variation\n"
            f"                            that builds on this winner)\n"
            f"\n"
            f"     DO NOT use different headings or fewer sections — the user verified\n"
            f"     this. Every section must be present.\n"
            f"  6. Create a ClickUp Doc page in the product's brief doc (doc_id from step 1)\n"
            f"     titled 'Winner Brief — {parent_name} — {winner_label}'. Capture\n"
            f"     the page URL.\n\n"
            f"  7. *** MANDATORY DB WRITE ***\n"
            f"     UPSERT into public.variation_briefs (drive_file_id is the conflict key):\n"
            f"       - drive_file_id        = '{drive_file_id}'\n"
            f"       - ad_id                = '{parent_ad_id}'\n"
            f"       - brief_markdown       = <full markdown from step 5>\n"
            f"       - clickup_doc_page_url = <URL captured in step 6>\n"
            f"       - generated_by         = '{self.worker_id}'\n"
            f"     Use the Supabase REST API with $SUPABASE_SERVICE_ROLE_KEY (loaded from\n"
            f"     ~/.classify-inspiration.env). UPSERT is MANDATORY — without it the\n"
            f"     server-side verify gate rejects this as FAIL.\n\n"
            f"  8. (Optional but recommended) Post a ClickUp comment on the target task\n"
            f"     ({target_cu}) with: '🏆 Winner brief: <doc_url>'. Skip if target_clickup\n"
            f"     is empty.\n\n"
            f"  9. Do NOT touch variation_brief_queue at all — the worker handles queue state.\n\n"
            f"VERIFICATION (you must pass before printing OK):\n"
            f"  SELECT from public.variation_briefs WHERE drive_file_id='{drive_file_id}'.\n"
            f"  Both brief_markdown and clickup_doc_page_url MUST be non-empty.\n"
            f"  If either is missing, print 'FAIL {queue_id}: missing <field>'.\n\n"
            f"OUTPUT (the LAST line of stdout — nothing else after):\n"
            f"  On success:  'OK {queue_id}'\n"
            f"  On failure:  'FAIL {queue_id}: <one-line reason>'\n"
        )

        _prefer = (os.environ.get("CLASSIFY_AGENT_PREFER") or "claude").strip().lower()
        if _prefer not in ("claude", "codex"):
            _prefer = "claude"
        cmd = build_agent_cmd(prompt, prefer=_prefer)
        agent_label = cmd[0] if cmd[0] == "claude" else "codex"
        log(f"[{queue_id}] running brief skill on {drive_file_id} via {agent_label} "
            f"(timeout {CLAUDE_CLI_TIMEOUT_SECONDS}s)")
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
                return {"success": False, "error": f"{agent_label} exit {r.returncode}: {tail}"}
            ok_marker = f"OK {queue_id}"
            fail_marker = f"FAIL {queue_id}"
            skill_says_ok = ok_marker in stdout
            if fail_marker in stdout:
                idx = stdout.find(fail_marker)
                return {"success": False, "error": stdout[idx:idx + 300]}
            verify_ok, verify_msg = self._verify_variation_brief_row(drive_file_id)
            if not verify_ok:
                return {"success": False, "error": f"skill returned without persisting: {verify_msg}"}
            if skill_says_ok:
                return {"success": True}
            log(f"[{queue_id}] brief skill exit 0 with no OK marker but verify passed; tail: {tail[-200:]}")
            return {"success": True, "warning": "no_ok_marker_but_verified"}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"{agent_label} timeout after {CLAUDE_CLI_TIMEOUT_SECONDS}s"}
        except FileNotFoundError:
            return {"success": False, "error": f"{agent_label} CLI not found in PATH"}
        except Exception as e:
            return {"success": False, "error": f"{type(e).__name__}: {e}"}

    # ── Server-side verification of skill output ──

    def _verify_inspirations_row(self, ins_id: str, product_id: str) -> tuple:
        """Confirm the skill actually wrote a usable row to public.inspirations.

        Note on schema: `inspirations` has no `ins_id` column — the
        inspiration's identifier IS the `id` column (values like 'ARI-INS-001').
        Queue's `ins_id` corresponds to inspirations' `id`.

        We require: row exists AND ALL 9 dashboard-critical fields are
        non-empty in data:
            _clickupDocPageUrl, brand, angle, persona, creativeStructure,
            hookType, productionStyle, funnelStage, adType.
        This matches the contract the skill prompt commits to (lines
        ~1053–1061) and the May 9 fix `bfbc474`. Previously this only
        checked 3 fields, allowing partially-filled rows to flip the queue
        to "classified" with blank columns in the dashboard. Now if ANY of
        the 9 is missing, this returns (False, …) → the worker requeues
        and the skill retries up to MAX_ATTEMPTS_BEFORE_FAILED.

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
            for k in (
                "_clickupDocPageUrl",
                "brand",
                "angle",
                "persona",
                "creativeStructure",
                "hookType",
                "productionStyle",
                "funnelStage",
                "adType",
            ):
                if not data.get(k):
                    missing.append(k)
            if missing:
                return (False, f"inspirations row exists but missing fields: {', '.join(missing)}")
            return (True, "verified")
        except Exception as e:
            return (False, f"verify query failed: {e}")

    def _verify_variation_brief_row(self, drive_file_id):
        """Confirm the skill actually wrote a usable row to public.variation_briefs.

        Required: row exists AND brief_markdown is non-empty AND
        clickup_doc_page_url is non-empty. Without all three, the
        downstream UI surfaces (provenance banner, picker brief button,
        ClickUp description patcher) can't function — treat as failure.

        Returns: (success: bool, message: str).
        """
        try:
            qs = (
                "select=id,brief_markdown,clickup_doc_page_url&"
                f"drive_file_id=eq.{urllib.parse.quote(drive_file_id)}&limit=1"
            )
            rows = self.sb.select("variation_briefs", qs)
            if not rows:
                return (False, f"no variation_briefs row for {drive_file_id}")
            row = rows[0] or {}
            missing = []
            if not row.get("brief_markdown"):       missing.append("brief_markdown")
            if not row.get("clickup_doc_page_url"): missing.append("clickup_doc_page_url")
            if missing:
                return (False, f"row exists but missing: {','.join(missing)}")
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

    def _mark_brief_classifying(self, job_id):
        try:
            self.sb.update(
                "variation_brief_queue",
                f"id=eq.{urllib.parse.quote(job_id)}",
                {"status": "classifying"},
            )
        except Exception as e:
            log(f"could not flip brief {job_id} to classifying: {e}")

    def _mark_brief_done(self, job_id):
        try:
            self.sb.update(
                "variation_brief_queue",
                f"id=eq.{urllib.parse.quote(job_id)}",
                {
                    "status": "done",
                    "processed_at": _now_iso(),
                    "error_message": None,
                },
            )
        except Exception as e:
            log(f"could not flip brief {job_id} to done: {e}")

    def _mark_brief_failure(self, job, error):
        attempts = (job.get("attempts") or 1)
        if attempts >= MAX_ATTEMPTS_BEFORE_FAILED:
            new_status = "failed"
            log(f"[{job.get('id')}] BRIEF FINAL FAILURE after {attempts} attempts: {error}")
        else:
            new_status = "pending"
            log(f"[{job.get('id')}] brief attempt {attempts} failed, requeuing: {error}")
        try:
            self.sb.update(
                "variation_brief_queue",
                f"id=eq.{urllib.parse.quote(job.get('id'))}",
                {
                    "status": new_status,
                    "claimed_by": None,
                    "claimed_at": None,
                    "error_message": str(error)[:500],
                },
            )
        except Exception as e:
            log(f"could not flip brief {job.get('id')} to {new_status}: {e}")

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
        if WORKER_AUTO_UPDATE_ENABLED:
            log(f"self-update: enabled · checks {WORKER_UPDATE_URL} every {WORKER_UPDATE_CHECK_EVERY_SECONDS}s")

        self.register()

        # Start heartbeat thread
        hb = threading.Thread(target=self.heartbeat_loop, name="heartbeat", daemon=True)
        hb.start()

        self._last_update_check_at = 0.0
        self._pending_self_restart = False

        try:
            while not self.shutdown.is_set():
                try:
                    # ── Self-update check (cheap ETag GET, ~90ms when unchanged) ──
                    # Runs at most every WORKER_UPDATE_CHECK_EVERY_SECONDS so
                    # we don't hammer Vercel. If a newer version is found, it
                    # gets validated + atomically swapped to disk. We delay
                    # the re-exec until the producer pool drains so no
                    # in-flight image gen is interrupted.
                    if WORKER_AUTO_UPDATE_ENABLED:
                        now = time.time()
                        if now - self._last_update_check_at >= WORKER_UPDATE_CHECK_EVERY_SECONDS:
                            self._last_update_check_at = now
                            if check_for_worker_update():
                                self._pending_self_restart = True

                    # ── Restart if pending and BOTH pools drained ──
                    if self._pending_self_restart:
                        p_active = self._active_producer_count() if hasattr(self, "_active_producer_count") else 0
                        c_active = self._active_classify_count() if hasattr(self, "_active_classify_count") else 0
                        if p_active == 0 and c_active == 0 and not self.is_busy:
                            log("[self-update] both pools drained · re-executing worker with new code")
                            # Shut down both executors + heartbeat thread cleanly
                            try:
                                self._classify_pool.shutdown(wait=False)
                            except Exception:
                                pass
                            try:
                                self._producer_pool.shutdown(wait=False)
                            except Exception:
                                pass
                            try:
                                self.deregister_offline()
                            except Exception:
                                pass
                            # os.execv replaces this process in-place — same
                            # PID, parent (LaunchAgent etc.) doesn't notice.
                            try:
                                python_bin = sys.executable
                                os.execv(python_bin, [python_bin] + sys.argv)
                            except Exception as e:
                                log(f"[self-update] os.execv failed (continuing on old code): {e}")
                                self._pending_self_restart = False
                        else:
                            # Don't claim NEW work while waiting to restart;
                            # just let the existing jobs finish.
                            log(f"[self-update] waiting for in-flight job(s) before restart "
                                f"(classify={c_active}, producer={p_active})")
                            self.shutdown.wait(min(self.poll_interval, 10))
                            continue

                    if self.auto_pause_when_claude_idle and not is_claude_code_running():
                        # Skip claiming — heartbeat thread will surface 'paused'.
                        self.shutdown.wait(self.poll_interval)
                        continue

                    # Cleanup any stale claims first
                    self.release_stale_claims()

                    # ── CLASSIFY PARALLEL DISPATCH (2026-05-15) ──
                    # Reap completed classify futures (frees slots).
                    self._reap_classify_futures()
                    # Dispatch new classify jobs up to CLASSIFY_MAX_CONCURRENCY,
                    # all in this single poll cycle. Each job runs on a pool
                    # thread; the main loop is non-blocking.
                    _classify_dispatched = 0
                    while self._classify_has_capacity():
                        job = self.claim_next_job()
                        if not job:
                            break
                        # mark_classifying happens INSIDE _execute_classify_job
                        # so all the side-effects stay in the worker thread.
                        fut = self._classify_pool.submit(
                            self._execute_classify_job, job
                        )
                        with self._classify_lock:
                            self._classify_futures[job["id"]] = fut
                        _classify_dispatched += 1
                    if _classify_dispatched > 0:
                        _active = self._active_classify_count()
                        log(f"[classify] dispatched {_classify_dispatched} new job(s); "
                            f"{_active}/{CLASSIFY_MAX_CONCURRENCY} slot(s) in use")

                    # ── VARIATION BRIEF PARALLEL DISPATCH (2026-05-23) ──
                    # Shares _classify_pool with inspiration jobs (per design
                    # decision — winning-variation briefs are infrequent and
                    # don't need their own concurrency budget). Reaps already
                    # happened above; here we only dispatch.
                    _brief_dispatched = 0
                    while self._classify_has_capacity():
                        brief_job = self.claim_next_variation_brief_job()
                        if not brief_job:
                            break
                        fut = self._classify_pool.submit(
                            self._execute_variation_brief_job, brief_job
                        )
                        with self._classify_lock:
                            self._classify_futures[brief_job["id"]] = fut
                        _brief_dispatched += 1
                    if _brief_dispatched > 0:
                        _active = self._active_classify_count()
                        log(f"[brief] dispatched {_brief_dispatched} new job(s); "
                            f"{_active}/{CLASSIFY_MAX_CONCURRENCY} slot(s) in use")

                    # Heartbeat-relevant busy flag: True if ANY classify slot is occupied.
                    self.is_busy = self._active_classify_count() > 0

                    # ── Strategist queue check ──
                    # Strategist uses `claude -p`, same rate-limit pool as
                    # classify. Run it ONLY when classify pool is fully idle
                    # to avoid two-or-more concurrent `claude -p` invocations.
                    # This gate is what keeps us safe under producer-invariants #1
                    # (sequential claude -p across the queues that share that pool).
                    if self._active_classify_count() == 0:
                        try:
                            from tools.strategist.pipeline import run_strategist_for_product
                            from tools.strategist.db import pop_pending_run
                            run = pop_pending_run(
                                supabase_url=os.environ["SUPABASE_URL"],
                                service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                worker_id=self.worker_id,
                            )
                            if run is not None:
                                log(f"[strategist] picking up run id={run['id']} "
                                    f"product={run['product_id']} "
                                    f"trigger={run['trigger']}")
                                self.is_busy = True
                                self.current_job_id = None  # strategist run ids are not uuids; send NULL to avoid 22P02
                                try:
                                    run_strategist_for_product(
                                        supabase_url=os.environ["SUPABASE_URL"],
                                        service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                        clickup_api_key=os.environ["CLICKUP_API_KEY"],
                                        run_id=run["id"],
                                        product_id=run["product_id"],
                                        worker_id=self.worker_id,
                                        snapshot_dir=str(Path(__file__).parent /
                                                         "strategist_memory"),
                                        log=log,
                                    )
                                finally:
                                    self.is_busy = False
                                    self.current_job_id = None
                                continue
                        except Exception as e:
                            log(f"[strategist] poll/run failed: {e}")

                    # ── Producer queue check (Agent 2) — PARALLEL DISPATCH ──
                    # Uses `codex exec` which is a SEPARATE rate-limit pool from
                    # `claude -p`. Safe to run concurrently with classify slots —
                    # the two pools don't compete for the same Anthropic budget.
                    try:
                        from tools.producer.db import (
                            pop_pending_run as _pop_producer_run,
                            claim_run as _claim_producer_run,
                        )
                        # Reap completed producer futures first (frees slots).
                        self._reap_producer_futures()
                        # Dispatch as many pending producer runs as we have
                        # capacity for, in this single poll cycle.
                        _dispatched = 0
                        while self._producer_has_capacity():
                            prod_run = _pop_producer_run(
                                supabase_url=os.environ["SUPABASE_URL"],
                                service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                worker_id=self.worker_id,
                                require_preferred_worker=PRODUCER_REQUIRE_PREFERRED_WORKER,
                            )
                            if prod_run is None:
                                break
                            run_id = prod_run["id"]
                            # Claim atomically — second worker on same run will
                            # raise RuntimeError and we skip to the next.
                            try:
                                _claim_producer_run(
                                    supabase_url=os.environ["SUPABASE_URL"],
                                    service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                                    run_id=run_id,
                                    worker_id=self.worker_id,
                                )
                            except RuntimeError as e:
                                log(f"[producer] claim race lost on run {run_id}: {e}")
                                continue
                            # Submit to pool — runs concurrently, doesn't block.
                            fut = self._producer_pool.submit(
                                self._execute_producer_run, prod_run
                            )
                            with self._producer_lock:
                                self._producer_futures[run_id] = fut
                            _dispatched += 1
                        if _dispatched > 0:
                            _active = self._active_producer_count()
                            log(f"[producer] dispatched {_dispatched} new job(s); "
                                f"{_active}/{PRODUCER_MAX_CONCURRENCY} slot(s) in use")
                    except Exception as e:
                        log(f"[producer] poll/run failed: {e}")

                    # ── End of poll cycle ──
                    # Wait for the next poll tick before the next dispatch round.
                    self.shutdown.wait(self.poll_interval)
                except Exception as e:
                    log(f"main-loop error: {e}\n{traceback.format_exc()}")
        finally:
            # Drain in-flight classify + producer jobs before shutting down.
            try:
                _c_active = self._active_classify_count()
                if _c_active > 0:
                    log(f"[classify] waiting for {_c_active} in-flight job(s) to finish before shutdown")
                self._classify_pool.shutdown(wait=True)
            except Exception as _ce:
                log(f"[classify] pool shutdown error: {_ce}")
            try:
                _active = self._active_producer_count()
                if _active > 0:
                    log(f"[producer] waiting for {_active} in-flight job(s) to finish before shutdown")
                self._producer_pool.shutdown(wait=True)
            except Exception as _se:
                log(f"[producer] pool shutdown error: {_se}")
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
