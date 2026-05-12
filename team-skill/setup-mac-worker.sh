#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# setup-mac-worker.sh — one-shot Mac worker installer
#
# What this does (idempotent — safe to re-run):
#   1. Detects paths (repo, python, user)
#   2. Validates env + config files exist
#   3. Stops any running classify_worker.py process
#   4. Writes a LaunchAgent plist with auto-restart + log paths
#   5. Loads the LaunchAgent
#   6. Waits for the worker to register in Supabase
#   7. Prints exactly which System Settings panels to grant permissions
#
# Run from anywhere — it auto-detects the repo path:
#   bash /path/to/tools/setup-mac-worker.sh
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 1. Detect paths ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_PATH="$REPO_DIR/tools/classify_worker.py"

# Find python3 — prefer the newest available, fall back to /usr/bin/python3
PYTHON_BIN="$(command -v python3.14 || command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3.10 || command -v python3.9 || command -v python3 || true)"

LABEL="com.immuvi.classify-worker"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"
LOG_FILE="$HOME/Library/Logs/immuvi-classify-worker.log"

echo "═══════════════════════════════════════════════════════════════"
echo "  Immuvi Classify-Worker Mac Installer"
echo "═══════════════════════════════════════════════════════════════"
echo "  REPO:       $REPO_DIR"
echo "  WORKER:     $WORKER_PATH"
echo "  PYTHON:     ${PYTHON_BIN:-NOT FOUND}"
echo "  PLIST:      $PLIST"
echo "  LOG:        $LOG_FILE"
echo "  USER HOME:  $HOME"
echo

# ── 2. Validate ──────────────────────────────────────────────────

fail() { echo "❌ $1" >&2; exit 1; }
warn() { echo "⚠️  $1" >&2; }
ok()   { echo "✅ $1"; }

[ -n "$PYTHON_BIN" ] || fail "python3 not found on PATH. Install it first: https://www.python.org/downloads/"
[ -f "$WORKER_PATH" ] || fail "Worker not found at $WORKER_PATH. Make sure the repo is cloned and you're running this from inside it."

# Env file
if [ ! -f "$HOME/.classify-inspiration.env" ]; then
  warn "$HOME/.classify-inspiration.env not found — worker won't be able to talk to Supabase."
  warn "Run tools/worker-setup.sh first, OR scp the env file from another machine:"
  warn "    scp other-machine:~/.classify-inspiration.env ~/.classify-inspiration.env"
  read -p "Continue anyway? (y/N) " yn
  [ "$yn" = "y" ] || [ "$yn" = "Y" ] || exit 1
else
  ok ".classify-inspiration.env present"
fi

# Worker config
if [ ! -f "$HOME/.classify-inspiration-worker.json" ]; then
  warn "$HOME/.classify-inspiration-worker.json not found — autogenerating with hostname as worker_id"
  HOSTNAME_SHORT="$(hostname -s | tr '[:upper:]' '[:lower:]')"
  # macOS user → reasonable worker_id like "gp-mac-mini"
  if [ -z "$HOSTNAME_SHORT" ]; then HOSTNAME_SHORT="mac-$(whoami)"; fi
  cat > "$HOME/.classify-inspiration-worker.json" <<EOF
{
  "worker_id": "gp-$HOSTNAME_SHORT",
  "poll_interval_seconds": 15,
  "auto_pause_when_claude_idle": false
}
EOF
  ok "Created ~/.classify-inspiration-worker.json with worker_id=gp-$HOSTNAME_SHORT"
else
  ok ".classify-inspiration-worker.json present"
fi

# Check Codex install (worker uses it for producer + as fallback)
if [ -x "/Applications/Codex.app/Contents/Resources/codex" ]; then
  ok "Codex.app installed"
else
  warn "Codex.app not found at /Applications/Codex.app — producer jobs won't run on this machine"
fi

# Check Claude install (preferred for classify-inspiration / strategist)
if command -v claude >/dev/null 2>&1; then
  ok "Claude CLI installed"
else
  warn "Claude CLI not found — classify-inspiration / strategist will route to Codex instead (still works)"
fi

# Ensure log dir + LaunchAgents dir exist
mkdir -p "$PLIST_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# ── 3. Stop any running worker process ──────────────────────────

if pgrep -f "classify_worker\.py" >/dev/null 2>&1; then
  echo "→ Stopping running classify_worker.py process(es)..."
  pkill -f "classify_worker\.py" || true
  sleep 2
  ok "Existing worker stopped"
fi

# ── 4. Unload existing LaunchAgent if present ────────────────────

if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  echo "→ Unloading existing LaunchAgent..."
  launchctl unload "$PLIST" 2>/dev/null || true
  ok "Existing LaunchAgent unloaded"
fi

# ── 5. Write the LaunchAgent plist ───────────────────────────────

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$WORKER_PATH</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>$HOME</string>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>

  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>ProcessType</key>
  <string>Background</string>

  <key>Nice</key>
  <integer>5</integer>
</dict>
</plist>
EOF
ok "Wrote $PLIST"

# ── 6. Load the LaunchAgent ──────────────────────────────────────

echo "→ Loading LaunchAgent..."
launchctl load "$PLIST"
ok "LaunchAgent loaded — worker should start within 2 seconds"

# ── 7. Wait + verify ─────────────────────────────────────────────

echo
echo "→ Waiting up to 30s for worker to start + register..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 2
  if pgrep -f "classify_worker\.py" >/dev/null 2>&1; then
    ok "Worker process is running (PID: $(pgrep -f classify_worker.py | head -1))"
    break
  fi
  if [ "$i" = "15" ]; then
    fail "Worker did not start. Check the log: $LOG_FILE"
  fi
done

# Tail the log briefly to show startup messages
echo
echo "═══════════════════════════════════════════════════════════════"
echo "  Worker startup log (last 20 lines):"
echo "═══════════════════════════════════════════════════════════════"
sleep 3
tail -20 "$LOG_FILE" 2>/dev/null || echo "(log not yet written — give it a few more seconds)"

# ── 8. Final instructions ────────────────────────────────────────

cat <<EOF

═══════════════════════════════════════════════════════════════
  ✅ INSTALL COMPLETE
═══════════════════════════════════════════════════════════════

  Worker status:    launchctl list | grep $LABEL
  Live log:         tail -f $LOG_FILE
  Stop worker:      launchctl unload $PLIST
  Restart worker:   launchctl unload $PLIST && launchctl load $PLIST
  Uninstall:        launchctl unload $PLIST && rm $PLIST

  The worker now:
  • Auto-starts on every login (KeepAlive=true)
  • Auto-restarts if it crashes
  • Self-updates from Vercel every 60s — no more manual sync
  • Logs to $LOG_FILE

═══════════════════════════════════════════════════════════════
  ⚠ ONE-TIME macOS PERMISSIONS (if you see popups)
═══════════════════════════════════════════════════════════════

  If macOS prompts "python would like to access data from other apps":

  1. Open  System Settings → Privacy & Security → App Management
  2. Click '+' and add:
       $PYTHON_BIN
  3. ALSO add (broader, catches future cases):
       System Settings → Privacy & Security → Full Disk Access
       → '+' → $PYTHON_BIN

  If you already clicked "Don't Allow" and want to reset:
       tccutil reset SystemPolicyAppData

  Then run this script again — popup won't appear once permissions
  are granted.

═══════════════════════════════════════════════════════════════
EOF
