import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const setup = `
import ast, os, subprocess, sys, tempfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, 'scripts')
from private_inspiration_pipeline import extend_qa_download_timeout
skill = Path('team-skill/SKILL.md').read_text()
pipeline = skill.split('## Step 3', 1)[1].split('\x60\x60\x60python\\n', 1)[1].split('\\n\x60\x60\x60', 1)[0]
`;

function python(source) {
  assert.equal(execFileSync('python3', ['-c', setup + source], { encoding: 'utf8' }).trim(), 'passed');
}

test('QA changes only the legacy yt-dlp deadline, not other timeouts or prompts', () => {
  python(`
before = ast.parse(pipeline)
after = extend_qa_download_timeout(ast.parse(pipeline))
assert ast.dump(before) != ast.dump(after)
download = next(node for node in after.body if isinstance(node, ast.FunctionDef) and node.name == 'download_ytdlp')
call = next(node for node in ast.walk(download) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'run')
timeout = next(keyword for keyword in call.keywords if keyword.arg == 'timeout')
assert timeout.value.value == 300
timeout.value.value = 90
assert ast.dump(before) == ast.dump(after)
assert Path('team-skill/SKILL.md').read_text() == skill
adapter = Path('scripts/private-inspiration-media.py').read_text()
assert 'tree = extend_qa_download_timeout(ast.parse(pipeline))' in adapter
assert 'timeout:15*60_000' in Path('scripts/private-inspiration-runner.mjs').read_text()
print('passed')
`);
});

test('QA downloader retains partial output and preserves timeout and failure propagation', () => {
  python(`
tree = extend_qa_download_timeout(ast.parse(pipeline))
download = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'download_ytdlp')
module = ast.fix_missing_locations(ast.Module(body=[download], type_ignores=[]))
with tempfile.TemporaryDirectory() as directory:
    partial = Path(directory) / 'video.mp4.part'
    partial.write_bytes(b'retained partial video')
    original = partial.read_bytes(), partial.stat().st_mtime_ns
    vp = os.path.join(directory, 'video.mp4')
    url = 'https://drive.google.com/file/d/test-file/view'
    calls = []
    failure = None
    def run(args, **kwargs):
        calls.append((args, kwargs))
        assert args == ['yt-dlp', '--quiet', '-f', 'mp4/best[height<=720]/best', '-o', vp, url]
        assert kwargs == {'capture_output': True, 'timeout': 300, 'check': True}
        assert (partial.read_bytes(), partial.stat().st_mtime_ns) == original
        if failure:
            raise failure
    namespace = {'os': os, 'subprocess': SimpleNamespace(run=run)}
    exec(compile(module, '<qa-download-test>', 'exec'), namespace)
    assert namespace['download_ytdlp'](url, directory) == vp
    for failure in [subprocess.TimeoutExpired('yt-dlp', 300), subprocess.CalledProcessError(1, 'yt-dlp')]:
        try:
            namespace['download_ytdlp'](url, directory)
            raise AssertionError('Download failure was swallowed')
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
            assert error is failure
    assert len(calls) == 3
    assert (partial.read_bytes(), partial.stat().st_mtime_ns) == original
print('passed')
`);
});

test('QA deadline adaptation rejects changed legacy boundaries instead of patching arbitrary calls', () => {
  python(`
valid = "def download_ytdlp():\\n    subprocess.run(['yt-dlp'], timeout=90, check=True)\\n"
for source in [
    '', valid + valid,
    valid.replace('download_ytdlp', 'other_download'),
    valid.replace('subprocess.run', 'other.run'),
    valid.replace('timeout=90', 'timeout=120'),
    valid.replace('timeout=90', 'timeout=deadline'),
    valid.replace('timeout=90, ', ''),
    valid + "    subprocess.run(['other'], timeout=90)\\n",
]:
    try:
        extend_qa_download_timeout(ast.parse(source))
        raise AssertionError('Changed boundary was accepted')
    except RuntimeError as error:
        assert 'review required' in str(error)
print('passed')
`);
});
