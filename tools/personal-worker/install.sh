#!/bin/bash
set -euo pipefail
umask 077
STEP='checking prerequisites'
trap 'STATUS=$?; printf "\nInstaller stopped during: %s (exit %s).\nExisting Immuvi records were not reset. Pairing codes are entered only when prompted.\n" "$STEP" "$STATUS" >&2; exit "$STATUS"' ERR
if [[ "$(uname -s)" != Darwin ]]; then echo 'macOS is required.'; exit 1; fi
if ! command -v brew >/dev/null; then
  echo 'Install Homebrew from https://brew.sh, reopen Terminal, then run this installer again.'
  exit 1
fi
ROOT="$HOME/Library/Application Support/Immuvi Personal Worker"
BASE='https://immuvi-command-center.vercel.app/personal-worker'
mkdir -p "$ROOT"
chmod 700 "$ROOT"
if [[ -f "$HOME/Library/LaunchAgents/com.immuvi.personal-classifier.plist" ]]; then
  echo 'A personal worker is already installed. Stop it from My Mac before updating; retained results must not be interrupted.'
  exit 1
fi
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
for FILE in worker.py GUIDE.md fb_ad_classifier.py requirements.txt manifest.json; do
  cp "$STAGE/$FILE" "$ROOT/$FILE"
done
STEP='creating the private Python environment'
echo 'Creating the private worker environment...'
"$PYTHON" -m venv "$ROOT/venv"
STEP='installing private Python dependencies'
"$ROOT/venv/bin/python" -m pip install --disable-pip-version-check -r "$ROOT/requirements.txt"
STEP='installing the private browser runtime'
"$ROOT/venv/bin/python" -m playwright install chromium
STEP='checking local models and AI login'
echo 'Checking local models and AI login. First-time model downloads can take several minutes...'
"$ROOT/venv/bin/python" "$ROOT/worker.py" check
STEP='pairing this Mac'
echo 'Ready to pair. Generate a fresh code in Immuvi > Inspiration > My Mac now.'
"$ROOT/venv/bin/python" "$ROOT/worker.py" setup </dev/tty
