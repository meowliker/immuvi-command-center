"""Bounded QA adaptations of the retained legacy media pipeline."""
import ast
import json
import os
import subprocess


def probe_and_transcribe_audio(video_path, work_dir, transcribe):
    """Unknown audio stays unknown; only a successful probe can prove silence."""
    probe = {'has_audio': None, 'has_voice': None, 'transcript_source': '', 'error': ''}
    try:
        response = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', video_path],
            capture_output=True, text=True, timeout=20, check=True,
        )
        streams = json.loads(response.stdout)['streams']
        if not isinstance(streams, list) or not streams or any(
                not isinstance(stream, dict) or not stream.get('codec_type') for stream in streams):
            raise ValueError('Missing or invalid media streams')
        probe['has_audio'] = any(stream['codec_type'] == 'audio' for stream in streams)
    except Exception as error:
        probe['error'] = f'ffprobe:{str(error)[:120]}'
        return probe, '', []
    if not probe['has_audio']:
        probe['has_voice'] = False
        return probe, 'No voice over', []

    wav = os.path.join(work_dir, 'audio.wav')
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', video_path, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wav],
            capture_output=True, text=True, timeout=60, check=True,
        )
        transcript, timeline, source = transcribe(wav)
    except Exception as error:
        probe['error'] = f'audio-verification:{str(error)[:120]}'
        return probe, '', []
    probe['transcript_source'] = source
    probe['has_voice'] = True if transcript else None
    return probe, transcript, timeline


def install_checked_audio_probe(tree):
    definitions = [node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == 'probe_and_transcribe_audio']
    if len(definitions) != 1 or [arg.arg for arg in definitions[0].args.args] != ['video_path', 'work_dir']:
        raise RuntimeError('Legacy audio probe boundary changed; review required')
    definitions[0].body = ast.parse('return _checked_audio_probe(video_path, work_dir)').body
    return tree


def extend_qa_download_timeout(tree):
    definitions = [node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == 'download_ytdlp']
    if len(definitions) != 1:
        raise RuntimeError('Legacy download boundary changed; review required')
    calls = [node for node in ast.walk(definitions[0])
             if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
             and isinstance(node.func.value, ast.Name)
             and node.func.value.id == 'subprocess' and node.func.attr == 'run']
    if len(calls) != 1:
        raise RuntimeError('Legacy download subprocess changed; review required')
    timeouts = [keyword for keyword in calls[0].keywords if keyword.arg == 'timeout']
    if len(timeouts) != 1 or not isinstance(timeouts[0].value, ast.Constant) or timeouts[0].value.value != 90:
        raise RuntimeError('Legacy download timeout changed; review required')
    # Allow slower public video transfers, still below the outer 900-second cap.
    # Leave yt-dlp arguments and existing resumable .part files unchanged.
    timeouts[0].value = ast.copy_location(ast.Constant(value=300), timeouts[0].value)
    return tree
