"""Run the repository's legacy media pipeline without loading production settings."""
import ast
import contextlib
import io
import json
import os
from pathlib import Path
import sys
from functools import partial
from private_inspiration_audio import transcribe_audio

ROOT = Path(__file__).resolve().parent.parent
skill = (ROOT / 'team-skill/SKILL.md').read_text()


def contract():
    worker = ast.parse((ROOT / 'team-skill/classify_worker.py').read_text())
    prompts = [node for node in ast.walk(worker) if isinstance(node, ast.JoinedStr)
               and any(isinstance(v, ast.Constant) and isinstance(v.value, str)
                       and 'Run the /classify-inspiration skill' in v.value for v in node.values)]
    if len(prompts) != 1:
        raise RuntimeError('Legacy prompt boundary changed; review required')
    text = ''.join(v.value if isinstance(v, ast.Constant) else '[context]' for v in prompts[0].values)
    return {
        'classification': skill.split('## Step 4', 1)[1].split('## Step 5', 1)[0],
        'worker': text.split('  4. Visually classify', 1)[1].split('  6. Create a ClickUp Doc', 1)[0],
        'template': skill.split('### 6c', 1)[1].split('### 6d', 1)[0],
        'shape': skill.split("cat > /tmp/result_[INS_ID].json <<'JSON'\n", 1)[1].split('\nJSON', 1)[0],
    }


if sys.argv[1] == '--contract':
    print(json.dumps(contract()))
elif sys.argv[1] == '--audio':
    print(json.dumps(transcribe_audio(sys.argv[2])))
else:
    url, directory = sys.argv[1:3]
    # Isolated HOME prevents the helper's browser-cookie fallbacks from reading
    # the owner's personal browser profile. This adapter never reads env files.
    os.environ['HOME'] = str(Path(directory) / 'home')
    Path(os.environ['HOME']).mkdir(exist_ok=True)
    sys.path.insert(0, str(ROOT / 'team-skill'))
    import fb_ad_classifier
    source_evidence = {}
    fb_ad_classifier.fetch_ad_snapshot = partial(fb_ad_classifier.fetch_ad_snapshot, diagnostics=source_evidence)
    pipeline = skill.split('## Step 3', 1)[1].split('```python\n', 1)[1].split('\n```', 1)[0]
    audio_evidence = {}

    def transcribe_checked(path):
        try:
            transcript = transcribe_audio(path)
            audio_evidence.update(transcript['evidence'])
            return transcript['text'], transcript['timeline'], transcript['source']
        except Exception as error:
            audio_evidence['error'] = str(error)[:200]
            return '', [], 'unavailable:audio verification failed'

    # Replace only transcription, leaving the legacy downloader and prompts intact.
    tree = ast.parse(pipeline)
    definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'transcribe_audio']
    if len(definitions) != 1:
        raise RuntimeError('Legacy transcription boundary changed; review required')
    definitions[0].body = ast.parse('return _qa_transcribe_audio(wav_path)').body
    ast.fix_missing_locations(tree)
    namespace = {'__name__': '__qa_pipeline__', '_qa_transcribe_audio': transcribe_checked}
    sys.argv = ['legacy-media', url, directory]
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(tree, 'legacy-skill-media', 'exec'), namespace)
    result = namespace['result']
    result.setdefault('metadata', {})['transcription_evidence'] = audio_evidence
    if source_evidence:
        result['metadata']['source_fetch'] = source_evidence
        if source_evidence.get('error_code'):
            result['error_code'] = source_evidence['error_code']
    # Legacy prose expects factual media_kind, but its pipeline omits that key.
    kind = namespace.get('snapshot', {}).get('media_kind')
    if not kind and result.get('frames'):
        downloaded = namespace.get('ig') or namespace.get('tt') or {}
        kind = 'video' if 'vp' in namespace or downloaded.get('media_path') else 'carousel' if len(result['frames']) > 1 else 'image'
    result['media_kind'] = kind or 'unknown'
    if kind == 'video':
        from fb_ad_classifier import FRAME_INTERVAL_SEC
        result['frame_samples'] = [
            {'image': index + 1, 'nominal_seconds': index * FRAME_INTERVAL_SEC}
            for index, _ in enumerate(result['frames'])
        ]
        result['frame_timing'] = {
            'interval_seconds': FRAME_INTERVAL_SEC,
            'precision': 'Regular ffmpeg fps samples, not exact caption-transition timestamps. '
                         'Any inferred caption or beat ranges must be labeled approximate.',
        }
    (Path(directory) / 'media.json').write_text(json.dumps(result))
    print(json.dumps(result))
