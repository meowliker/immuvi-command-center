#!/bin/bash
set -euo pipefail
umask 077
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
brew install python@3.12 ffmpeg yt-dlp
PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
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
"$PYTHON" -m venv "$ROOT/venv"
"$ROOT/venv/bin/python" -m pip install --disable-pip-version-check -r "$ROOT/requirements.txt"
"$ROOT/venv/bin/python" -m playwright install chromium
"$ROOT/venv/bin/python" "$ROOT/worker.py" check
"$ROOT/venv/bin/python" "$ROOT/worker.py" setup </dev/tty
