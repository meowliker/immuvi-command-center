#!/bin/bash
set -euo pipefail
umask 077
STEP='checking prerequisites'
RESTORE_SERVICE=0
restore_on_error() {
  STATUS=$?
  if [[ "$RESTORE_SERVICE" == 1 ]]; then
    for FILE in worker.py GUIDE.md fb_ad_classifier.py requirements.txt manifest.json; do
      [[ ! -f "$STAGE/previous/$FILE" ]] || cp "$STAGE/previous/$FILE" "$ROOT/$FILE"
    done
    launchctl bootstrap "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  fi
  printf '\nInstaller stopped during: %s (exit %s).\nExisting Immuvi records were not reset. Pairing codes are entered only when prompted.\n' "$STEP" "$STATUS" >&2
  exit "$STATUS"
}
trap restore_on_error ERR
if [[ "$(uname -s)" != Darwin ]]; then echo 'macOS is required.'; exit 1; fi
MODE="${1:-}"
if [[ $# -gt 1 || ( -n "$MODE" && "$MODE" != '--resume-pairing' && "$MODE" != '--repair' ) ]]; then
  echo 'Usage: bash install.sh [--resume-pairing|--repair]'
  exit 1
fi
if [[ "$MODE" != '--resume-pairing' ]] && ! command -v brew >/dev/null; then
  echo 'Install Homebrew from https://brew.sh, reopen Terminal, then run this installer again.'
  exit 1
fi
ROOT="$HOME/Library/Application Support/Immuvi Personal Worker"
PLIST="$HOME/Library/LaunchAgents/com.immuvi.personal-classifier.plist"
BASE='https://immuvi-command-center.vercel.app/personal-worker'
mkdir -p "$ROOT"
chmod 700 "$ROOT"
if [[ -f "$PLIST" && "$MODE" != '--repair' ]]; then
  echo 'A personal worker is already installed. Use --repair to drain it safely and preserve pairing and retained results.'
  exit 1
fi
if [[ "$MODE" == '--repair' && ! -f "$PLIST" ]]; then
  echo 'No installed personal worker service was found. Use first-time setup or --resume-pairing.'
  exit 1
fi
if [[ "$MODE" == '--resume-pairing' ]]; then
  PYTHON="$ROOT/venv/bin/python"
  if [[ ! -x "$PYTHON" ]]; then
    echo 'The private worker environment is missing. Run the installer without --resume-pairing first.'
    exit 1
  fi
else
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_INSTALL_UPGRADE=1
STEP='finding Python 3.12'
PYTHON="$(command -v python3.12 || true)"
if [[ -z "$PYTHON" ]]; then
  PREFIX="$(brew --prefix python@3.12 2>/dev/null || true)"
  PYTHON="$PREFIX/bin/python3.12"
fi
if [[ ! -x "$PYTHON" ]] || ! "$PYTHON" -c 'import sys; raise SystemExit(sys.version_info[:2] != (3,12))'; then
  STEP='installing missing Python 3.12'
  echo 'Installing missing Python 3.12. Existing working tools will not be upgraded.'
  brew install python@3.12
  PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
fi
"$PYTHON" -c 'import sys; raise SystemExit(sys.version_info[:2] != (3,12))'
STEP='checking local media tools'
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null ||
   ! ffmpeg -version >/dev/null 2>&1 || ! ffprobe -version >/dev/null 2>&1; then
  STEP='installing missing ffmpeg tools'
  brew install ffmpeg
fi
ffmpeg -version >/dev/null 2>&1
ffprobe -version >/dev/null 2>&1
fi
STEP='downloading verified worker files'
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/immuvi-personal-install.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
curl --fail --silent --show-error --proto '=https' --tlsv1.2 "$BASE/manifest.json" -o "$STAGE/manifest.json"
"$PYTHON" - "$BASE" "$STAGE" <<'PY'
import hashlib, json, pathlib, sys, urllib.request
base, stage = sys.argv[1], pathlib.Path(sys.argv[2])
manifest = json.loads((stage/'manifest.json').read_text())
expected = {'worker.py','GUIDE.md','fb_ad_classifier.py','requirements.txt'}
if manifest.get('contract') != 'personal-artifact-v1' or set(manifest.get('files',{})) != expected:
    raise SystemExit('Unsupported installer manifest')
for name, checksum in manifest['files'].items():
    with urllib.request.urlopen(base+'/'+name, timeout=30) as response:
        data=response.read(1000000)
    if hashlib.sha256(data).hexdigest()!=checksum:
        raise SystemExit('Asset verification failed; no worker was started')
    (stage/name).write_bytes(data)
PY
if [[ "$MODE" == '--repair' ]]; then
  STEP='validating the existing personal service'
  "$PYTHON" - "$PLIST" "$ROOT" <<'PY'
import pathlib,plistlib,sys
payload=plistlib.loads(pathlib.Path(sys.argv[1]).read_bytes())
root=pathlib.Path(sys.argv[2])
if payload.get('Label')!='com.immuvi.personal-classifier' or payload.get('ProgramArguments')!=[str(root/'venv/bin/python'),str(root/'worker.py'),'run']:
    raise SystemExit('Unexpected service configuration; no process was stopped')
PY
  STEP='waiting for graceful personal-worker shutdown'
  TARGET="gui/$(id -u)/com.immuvi.personal-classifier"
  worker_pid() { launchctl print "$TARGET" 2>/dev/null | awk '/^[[:space:]]*pid = [0-9]+/ {print $3}' || true; }
  if [[ -n "$(worker_pid)" ]]; then
    echo 'Finishing current analysis before updating. Retained results and pairing will be preserved.'
    launchctl kill SIGTERM "$TARGET"
    for (( WAITED=0; WAITED<1900; WAITED+=2 )); do
      [[ -n "$(worker_pid)" ]] || break
      sleep 2
    done
    if [[ -n "$(worker_pid)" ]]; then
      echo 'The worker is still finishing. No forced termination or update was performed.'
      exit 1
    fi
  fi
  mkdir -p "$STAGE/previous"
  for FILE in worker.py GUIDE.md fb_ad_classifier.py requirements.txt manifest.json; do
    [[ ! -f "$ROOT/$FILE" ]] || cp "$ROOT/$FILE" "$STAGE/previous/$FILE"
  done
  launchctl bootout "$TARGET" >/dev/null 2>&1 || true
  RESTORE_SERVICE=1
fi
for FILE in worker.py GUIDE.md fb_ad_classifier.py requirements.txt manifest.json; do
  cp "$STAGE/$FILE" "$ROOT/$FILE"
done
if [[ "$MODE" == '--resume-pairing' ]]; then
  STEP='verifying and resuming the saved pairing'
  "$PYTHON" "$ROOT/worker.py" resume-setup </dev/tty
  exit 0
fi
STEP='creating the private Python environment'
echo 'Creating the private worker environment...'
if [[ "$MODE" != '--repair' ]]; then "$PYTHON" -m venv "$ROOT/venv"; fi
STEP='installing private Python dependencies'
"$ROOT/venv/bin/python" -m pip install --disable-pip-version-check -r "$ROOT/requirements.txt"
STEP='installing the private browser runtime'
"$ROOT/venv/bin/python" -m playwright install chromium
STEP='checking local models and AI login'
echo 'Checking local models and AI login. First-time model downloads can take several minutes...'
"$ROOT/venv/bin/python" "$ROOT/worker.py" check
if [[ "$MODE" == '--repair' ]]; then
  STEP='checking the repaired private runtime'
  "$ROOT/venv/bin/python" "$ROOT/worker.py" diagnose --resume
  STEP='restarting the existing personal service'
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  RESTORE_SERVICE=0
  echo 'Personal worker updated. Saved pairing and retained results were preserved. Refresh My Mac before retrying the selected blocked inspiration.'
  exit 0
fi
STEP='pairing this Mac'
echo 'Ready to pair. Generate a fresh code in Immuvi > Inspiration > My Mac now.'
"$ROOT/venv/bin/python" "$ROOT/worker.py" setup </dev/tty
