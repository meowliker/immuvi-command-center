#!/bin/sh
set -eu
# Never installs into the legacy interpreter or its user site-packages.
qa_root="$HOME/Library/Application Support/Immuvi/Workers/qa-shared"
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
umask 077
mkdir -p "$qa_root"
if [ ! -x "$qa_root/python/bin/python" ]; then
  /opt/homebrew/bin/python3.13 -m venv "$qa_root/python"
fi
PIP_CACHE_DIR="$qa_root/python/pip-cache" "$qa_root/python/bin/python" -m pip install -r "$repo_root/scripts/shared-qa-requirements.txt"
PLAYWRIGHT_BROWSERS_PATH="$qa_root/python/browsers" "$qa_root/python/bin/python" -m playwright install chromium
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
printf '%s\n' 'Isolated media dependencies ready; existing ffmpeg/ffprobe are used read-only.'
