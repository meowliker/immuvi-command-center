#!/usr/bin/env bash
# worker-setup.sh — first-run setup for the classify-worker daemon.
#
# Run once per machine (laptop, Mac mini, teammate's box) to:
#   1. Verify dependencies (python3, ffmpeg, claude CLI, ~/.classify-inspiration.env).
#   2. Ask for a worker_id (defaults: gp-laptop, gp-mac-mini, etc.).
#   3. Ask whether to auto-pause when Claude Code isn't running (default yes on laptops).
#   4. Write ~/.classify-inspiration-worker.json with the answers.
#   5. Install a LaunchAgent plist so the worker auto-starts on login (macOS).
#   6. Start it.
#
# Idempotent — safe to re-run. Updates config, reloads launchd.

set -e

WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_PY="$WORKER_DIR/classify_worker.py"
ENV_FILE="$HOME/.classify-inspiration.env"
WORKER_CFG="$HOME/.classify-inspiration-worker.json"
PLIST_LABEL="com.immuvi.classify-worker"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$HOME/.classify-inspiration-worker-logs"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  classify-worker setup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ── 1. Verify deps ─────────────────────────────────────────
fail=0
need() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "  ❌ $cmd — missing. ${hint}"
    fail=1
  else
    echo "  ✓ $cmd ($(command -v "$cmd"))"
  fi
}

echo "Dependency check:"
need python3 "Install via 'brew install python3' or system Python."
need ffmpeg  "Install via 'brew install ffmpeg'."
need claude  "Install Claude Code from https://claude.com/claude-code."

if [ "$fail" -eq 1 ]; then
  echo ""
  echo "Fix the missing dependencies above and re-run this script."
  exit 1
fi

# Probe Claude Code auth
echo ""
echo "Verifying Claude Code is authenticated…"
if ! claude -p "say hi" >/dev/null 2>&1; then
  echo "  ⚠️  'claude -p' failed. Make sure you're logged in:"
  echo "      claude login"
  echo ""
  echo "  Continuing setup anyway — you can fix auth before starting the worker."
else
  echo "  ✓ headless mode works"
fi

# ── 2. Verify env file exists ──────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "  ❌ $ENV_FILE not found."
  echo "     Create it (the classify-inspiration skill normally bootstraps this)."
  echo "     Required keys: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLICKUP_API_KEY"
  exit 1
fi
echo "  ✓ $ENV_FILE present"

# ── 3. Ask for config ──────────────────────────────────────
echo ""
echo "Worker configuration:"

# Default worker_id from existing config or hostname
default_worker_id=""
if [ -f "$WORKER_CFG" ]; then
  default_worker_id=$(python3 -c "import json,sys; print(json.load(open('$WORKER_CFG')).get('worker_id',''))" 2>/dev/null || echo "")
fi
if [ -z "$default_worker_id" ]; then
  default_worker_id="$(scutil --get ComputerName 2>/dev/null | tr '[:upper:] ' '[:lower:]-' | sed 's/[^a-z0-9-]//g')"
  [ -z "$default_worker_id" ] && default_worker_id="$(hostname -s)"
fi

read -r -p "  Worker name [${default_worker_id}]: " WORKER_ID
WORKER_ID="${WORKER_ID:-$default_worker_id}"

# Auto-pause default: yes on Macs that look like laptops, no on a Mac mini
machine_model=$(sysctl -n hw.model 2>/dev/null || echo "unknown")
if echo "$machine_model" | grep -qi "macmini\|mac.mini\|MacPro"; then
  default_auto_pause="n"
else
  default_auto_pause="y"
fi
read -r -p "  Auto-pause when Claude Code isn't running? (recommended for laptops) [${default_auto_pause}]: " AUTO_PAUSE_RAW
AUTO_PAUSE_RAW="${AUTO_PAUSE_RAW:-$default_auto_pause}"
case "$AUTO_PAUSE_RAW" in
  y|Y|yes|YES) AUTO_PAUSE="true" ;;
  *) AUTO_PAUSE="false" ;;
esac

read -r -p "  Polling interval seconds [60]: " POLL_INTERVAL
POLL_INTERVAL="${POLL_INTERVAL:-60}"

# ── 4. Write config file ───────────────────────────────────
mkdir -p "$LOG_DIR"
cat > "$WORKER_CFG" <<EOF
{
  "worker_id": "${WORKER_ID}",
  "auto_pause_when_claude_idle": ${AUTO_PAUSE},
  "poll_interval_seconds": ${POLL_INTERVAL},
  "machine_model": "${machine_model}",
  "configured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
echo ""
echo "  ✓ wrote ${WORKER_CFG}"

# ── 5. Write launchd plist ─────────────────────────────────
mkdir -p "$(dirname "$PLIST_PATH")"
PYTHON_BIN="$(command -v python3)"
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
                       "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON_BIN}</string>
    <string>${WORKER_PY}</string>
  </array>

  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>

  <key>WorkingDirectory</key>
  <string>${HOME}</string>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd.err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
EOF
echo "  ✓ wrote ${PLIST_PATH}"

# ── 6. (Re)load launchd service ────────────────────────────
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✓ classify-worker installed as '${WORKER_ID}'"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Worker controls:"
echo "    Status:    launchctl list | grep ${PLIST_LABEL}"
echo "    Stop:      launchctl unload ${PLIST_PATH}"
echo "    Start:     launchctl load   ${PLIST_PATH}"
echo "    Logs:      tail -f ${LOG_DIR}/launchd.out.log"
echo "    Run once manually (debug): python3 ${WORKER_PY}"
echo ""
echo "  The worker has registered itself in Supabase (worker_registry table)."
echo "  You can pause/resume it from the dashboard once that UI is live."
echo ""
