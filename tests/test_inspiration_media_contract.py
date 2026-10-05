"""Offline media evidence regressions. All external tools and downloads are stubbed."""
import ast
import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'team-skill'))
import private_inspiration_pipeline as pipeline
import fb_ad_classifier as helper


class AudioEvidenceTests(unittest.TestCase):
    def test_failed_or_malformed_probe_never_means_no_voice_over(self):
        for response in [FileNotFoundError('ffprobe not installed'),
                         subprocess.CalledProcessError(1, 'ffprobe'),
                         subprocess.TimeoutExpired('ffprobe', 20),
                         SimpleNamespace(stdout='not json'), SimpleNamespace(stdout='{}'),
                         SimpleNamespace(stdout='{"streams":[]}'),
                         SimpleNamespace(stdout='{"streams":[{}]}')]:
            with self.subTest(response=response), patch.object(pipeline.subprocess, 'run') as run:
                if isinstance(response, Exception):
                    run.side_effect = response
                else:
                    run.return_value = response
                transcribe = Mock(side_effect=AssertionError('No transcription after failed probe'))
                probe, voice, timeline = pipeline.probe_and_transcribe_audio('video.mp4', '/tmp', transcribe)
                self.assertIsNone(probe['has_audio'])
                self.assertTrue(probe['error'].startswith('ffprobe:'))
                self.assertEqual((voice, timeline), ('', []))
                self.assertTrue(run.call_args.kwargs['check'])

    def test_confirmed_silent_video_skips_transcription(self):
        with patch.object(pipeline.subprocess, 'run', return_value=SimpleNamespace(stdout='{"streams":[{"codec_type":"video"}]}')):
            probe, voice, timeline = pipeline.probe_and_transcribe_audio('video.mp4', '/tmp', Mock(side_effect=AssertionError))
            self.assertFalse(probe['has_audio'])
            self.assertEqual((voice, timeline), ('No voice over', []))

    def test_audio_extracts_mono_16khz_and_retains_transcript_evidence(self):
        audio = SimpleNamespace(stdout='{"streams":[{"codec_type":"audio"}]}')
        timeline = [{'time': '0:00-0:03', 'voice_over': 'Verified words'}]
        transcribe = Mock(return_value=('Verified words', timeline, 'whisper:small'))
        with patch.object(pipeline.subprocess, 'run', side_effect=[audio, SimpleNamespace(returncode=0)]) as run:
            probe, voice, rows = pipeline.probe_and_transcribe_audio('video.mp4', '/tmp', transcribe)
            self.assertEqual(run.call_args.args[0], ['ffmpeg', '-y', '-i', 'video.mp4', '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', '/tmp/audio.wav'])
            transcribe.assert_called_once_with('/tmp/audio.wav')
            self.assertEqual((voice, rows), ('Verified words', timeline))
            self.assertEqual(probe['transcript_source'], 'whisper:small')

    def test_extraction_or_transcription_failure_stays_unknown(self):
        audio = SimpleNamespace(stdout='{"streams":[{"codec_type":"video"},{"codec_type":"audio"}]}')
        for failure in [subprocess.CalledProcessError(1, 'ffmpeg'), FileNotFoundError('whisper not installed')]:
            with self.subTest(failure=failure), patch.object(pipeline.subprocess, 'run', side_effect=[audio, failure]):
                probe, voice, timeline = pipeline.probe_and_transcribe_audio('video.mp4', '/tmp', Mock())
                self.assertTrue(probe['has_audio'])
                self.assertIsNone(probe['has_voice'])
                self.assertEqual((voice, timeline), ('', []))
        with patch.object(pipeline.subprocess, 'run', side_effect=[audio, SimpleNamespace(returncode=0)]):
            probe, voice, timeline = pipeline.probe_and_transcribe_audio('video.mp4', '/tmp', Mock(side_effect=ImportError('whisper')))
            self.assertEqual((voice, timeline), ('', []))
            self.assertTrue(probe['error'])

    def test_every_video_branch_uses_checked_audio_probe(self):
        skill = (ROOT / 'team-skill/SKILL.md').read_text()
        source = skill.split('## Step 3', 1)[1].split('```python\n', 1)[1].split('\n```', 1)[0]
        tree = pipeline.install_checked_audio_probe(pipeline.extend_qa_download_timeout(ast.parse(source)))
        start = next(i for i, node in enumerate(tree.body) if isinstance(node, ast.Assign)
                     and any(isinstance(target, ast.Name) and target.id == 'url' for target in node.targets))
        definitions = ast.fix_missing_locations(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)], type_ignores=[]))
        main = ast.fix_missing_locations(ast.Module(body=tree.body[start:], type_ignores=[]))
        for url in ['https://www.facebook.com/ads/library/?id=123', 'https://video.xx.fbcdn.net/test.mp4',
                    'https://www.instagram.com/reel/test/', 'https://www.tiktok.com/@test/video/1',
                    'https://www.youtube.com/watch?v=test', 'https://drive.google.com/file/d/test/view']:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as directory:
                media = str(Path(directory) / 'source.mp4')
                def download(_url, destination):
                    Path(destination).write_bytes(b'stub video')
                def generic(_url, _directory):
                    download(_url, media)
                    return media
                segment = {'time': '0:00-0:03', 'voice_over': 'Audio evidence'}
                checked = Mock(return_value=({'has_audio': True, 'has_voice': True}, 'Audio evidence', [segment]))
                namespace = {'os': os, 'sys': SimpleNamespace(argv=['test', url, directory], stderr=io.StringIO()),
                             'asyncio': asyncio, 'json': json, '_checked_audio_probe': checked}
                exec(compile(definitions, '<definitions>', 'exec'), namespace)
                namespace.update({'get_duration': lambda _: 3, 'download_video': download, 'download_ytdlp': generic,
                                  'extract_ad_id': lambda _: '123', 'decode_unicode': lambda value: value,
                                  'fetch_ad_snapshot': AsyncMock(return_value={'video_hd_url': 'stub'}),
                                  'extract_frames': lambda *_: ['frame.jpg'],
                                  'download_instagram_media': lambda *_: {'metadata': {}, 'frames': ['frame.jpg'], 'duration': 3, 'media_path': media, 'via': 'stub'},
                                  'download_tiktok_media': lambda *_: {'metadata': {}, 'frames': ['frame.jpg'], 'duration': 3, 'media_path': media, 'via': 'stub'}})
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    exec(compile(main, '<offline-platform-branch>', 'exec'), namespace)
                self.assertIsNone(namespace['result']['error'])
                checked.assert_called_once()
                self.assertEqual(namespace['result']['metadata']['voice_over_timeline'], [segment])

    def test_changed_probe_boundary_requires_review(self):
        for source in ['', 'def probe_and_transcribe_audio(other): pass',
                       'def probe_and_transcribe_audio(video_path, work_dir): pass\ndef probe_and_transcribe_audio(video_path, work_dir): pass']:
            with self.assertRaisesRegex(RuntimeError, 'review required'):
                pipeline.install_checked_audio_probe(ast.parse(source))


class InstagramEvidenceTests(unittest.TestCase):
    def test_tiktok_video_is_retained_for_the_audio_branch(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / 'video.mp4'; video.write_bytes(b'stub video')
            with patch.object(helper, '_tiktok_download_tikwm', return_value=(str(video), {'title': 'Caption'})), \
                 patch.object(helper.subprocess, 'run', return_value=SimpleNamespace(stdout='{"streams":[{"duration":"3"}]}')), \
                 patch.object(helper, 'extract_frames', return_value=['frame.jpg']):
                result = helper.download_tiktok_media('https://tiktok.com/@test/video/1', directory)
            self.assertEqual(result['metadata']['caption'], 'Caption')
            self.assertEqual(result['media_path'], str(video))
            self.assertTrue(video.is_file())

    def test_cropped_og_preview_is_not_downloaded(self):
        with patch.object(helper.urllib.request, 'urlopen', side_effect=AssertionError('No network')):
            with self.assertRaisesRegex(RuntimeError, 'refusing image preview'):
                helper._ig_download_og('https://instagram.com/p/test', '/tmp', {'image_url': 'https://example.com/crop.jpg'})

    def test_reel_image_is_skipped_and_video_retained_for_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            image, video = Path(directory) / 'preview.jpg', Path(directory) / 'real.mp4'
            image.write_bytes(b'preview'); video.write_bytes(b'video')
            with patch.object(helper, 'fetch_instagram_og', return_value={}), \
                 patch.object(helper, '_ig_download_ytdlp', return_value=(str(image), 'image')), \
                 patch.object(helper, '_ig_download_gallery_dl', return_value=(str(video), 'video')) as full, \
                 patch.object(helper, '_ig_get_duration', return_value=3), \
                 patch.object(helper, 'extract_frames', return_value=['frame.jpg']):
                result = helper.download_instagram_media('https://instagram.com/reel/test/', directory)
            full.assert_called_once()
            self.assertEqual(result['media_kind'], 'video')
            self.assertTrue(Path(result['media_path']).is_file())

    def test_reel_only_previews_fail_but_original_photo_posts_work(self):
        for kind in ['reel', 'p']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                image = Path(directory) / 'original.jpg'; image.write_bytes(b'original photo')
                with patch.object(helper, 'fetch_instagram_og', return_value={}), \
                     patch.object(helper, '_ig_download_ytdlp', return_value=(str(image), 'image')), \
                     patch.object(helper, '_ig_download_gallery_dl', side_effect=RuntimeError('unavailable')), \
                     patch.object(helper, '_ig_download_snapinsta', return_value=(str(image), 'image')), \
                     patch.object(helper.urllib.request, 'urlopen', side_effect=AssertionError('No network')):
                    if kind == 'reel':
                        with self.assertRaisesRegex(RuntimeError, 'image preview'):
                            helper.download_instagram_media(f'https://instagram.com/{kind}/test/', directory)
                    else:
                        result = helper.download_instagram_media(f'https://instagram.com/{kind}/test/', directory)
                        self.assertEqual(result['media_kind'], 'image')
                        self.assertTrue(Path(result['frames'][0]).is_file())


if __name__ == '__main__':
    unittest.main()
