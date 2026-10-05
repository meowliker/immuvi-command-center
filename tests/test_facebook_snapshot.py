import sys
import types
import unittest
import contextlib
import io
import json
import os
import runpy
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'team-skill'))
import fb_ad_classifier as helper


class NavigationTimeout(Exception):
    pass


AD = '4115883025377044'
CONTENT = '{"ad_archive_id":"' + AD + '","body":{"text":"Verified ad"}}'


class Page:
    def __init__(self, loads, statuses=None):
        self.loads = loads
        self.statuses = statuses or [200] * len(loads)
        self.navigations = 0
        self.check = 0
        self.url = 'https://www.facebook.com/ads/library/?id=' + AD

    async def goto(self, url, **options):
        assert options == {'wait_until': 'domcontentloaded', 'timeout': 30000}
        self.navigations += 1
        self.check = 0
        status = self.statuses[self.navigations - 1]
        if isinstance(status, Exception):
            raise status
        return types.SimpleNamespace(status=status)

    async def content(self):
        values = self.loads[self.navigations - 1]
        result = values[min(self.check, len(values) - 1)]
        self.check += 1
        return result


class FacebookSnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        api = types.ModuleType('playwright.async_api')
        api.TimeoutError = NavigationTimeout
        self.api = api
        modules = patch.dict(sys.modules, {'playwright': types.ModuleType('playwright'), 'playwright.async_api': api})
        modules.start()
        self.addCleanup(modules.stop)
        sleeps = patch.object(helper.asyncio, 'sleep', new_callable=AsyncMock)
        self.sleep = sleeps.start()
        self.addCleanup(sleeps.stop)

    async def test_waits_for_late_marker_without_reloading(self):
        page = Page([['loading', 'loading', CONTENT]])
        evidence = {}
        self.assertEqual(await helper._load_ad_page(page, AD, evidence), CONTENT)
        self.assertEqual(page.navigations, 1)
        self.assertEqual(evidence['attempts'][0]['checks'], 3)

    async def test_retries_missing_marker_then_succeeds(self):
        page = Page([['loading'], [CONTENT]])
        evidence = {}
        self.assertEqual(await helper._load_ad_page(page, AD, evidence), CONTENT)
        self.assertEqual(page.navigations, 2)
        self.assertFalse(evidence['attempts'][0]['marker_found'])
        self.assertTrue(evidence['attempts'][1]['marker_found'])

    async def test_http_403_with_usable_ad_is_not_a_failure(self):
        evidence = {}
        self.assertEqual(await helper._load_ad_page(Page([[CONTENT]], [403]), AD, evidence), CONTENT)
        self.assertEqual(evidence['attempts'][0]['http_status'], 403)

    async def test_navigation_timeout_still_checks_rendered_content(self):
        evidence = {}
        self.assertEqual(await helper._load_ad_page(Page([[CONTENT]], [NavigationTimeout()]), AD, evidence), CONTENT)
        self.assertTrue(evidence['attempts'][0]['navigation_timed_out'])

    async def test_exhaustion_is_bounded_and_does_not_accept_neighboring_ad(self):
        page = Page([['{"ad_archive_id":"999"}']] * 3)
        evidence = {}
        with self.assertRaisesRegex(RuntimeError, 'not found after 3 page loads'):
            await helper._load_ad_page(page, AD, evidence)
        self.assertEqual(page.navigations, 3)
        self.assertEqual([row['checks'] for row in evidence['attempts']], [11, 11, 11])
        self.assertEqual(evidence['error_code'], 'facebook_snapshot_unavailable')
        self.assertNotIn('?', str(evidence))
        self.assertLessEqual(sum(call.args[0] for call in self.sleep.await_args_list), 34)

    async def test_legacy_parser_and_browser_cleanup_on_success_and_failure(self):
        for loads in [[[CONTENT]], [['loading']] * 3]:
            page = Page(loads)
            context = types.SimpleNamespace(new_page=AsyncMock(return_value=page))
            browser = types.SimpleNamespace(new_context=AsyncMock(return_value=context), close=AsyncMock())
            runtime = types.SimpleNamespace(chromium=types.SimpleNamespace(launch=AsyncMock(return_value=browser)))
            manager = AsyncMock()
            manager.__aenter__.return_value = runtime
            self.api.async_playwright = lambda: manager
            if len(loads) == 1:
                snapshot = await helper.fetch_ad_snapshot(AD)
                self.assertEqual(snapshot['ad_id'], AD)
                self.assertEqual(snapshot['body_text'], 'Verified ad')
            else:
                with self.assertRaises(RuntimeError):
                    await helper.fetch_ad_snapshot(AD)
            browser.close.assert_awaited_once()


class MediaAdapterTests(unittest.TestCase):
    def test_failed_page_parse_retains_diagnostics_and_unknown_media_kind(self):
        pipeline = '''import asyncio
import os
import subprocess
from fb_ad_classifier import fetch_ad_snapshot
def download_ytdlp(url, outdir):
    os.makedirs(outdir, exist_ok=True)
    vp = os.path.join(outdir, "video.mp4")
    subprocess.run(["yt-dlp","--quiet","-f","mp4/best[height<=720]/best","-o",vp,url], capture_output=True, timeout=90, check=True)
    return vp
def transcribe_audio(path):
    return '', [], ''
def probe_and_transcribe_audio(video_path, work_dir):
    return {}, '', []
try:
    asyncio.run(fetch_ad_snapshot('4115883025377044'))
except RuntimeError as error:
    result = {'frames': [], 'error': str(error)}
'''
        skill = '## Step 3\n```python\n' + pipeline + '\n```\n## Step 4'
        async def fail(ad_id, *, diagnostics):
            diagnostics.update({'error_code': 'facebook_snapshot_unavailable', 'attempts': [{'http_status': 403}]})
            raise RuntimeError('Facebook ad data was not found')
        audio = types.ModuleType('private_inspiration_audio')
        audio.transcribe_audio = lambda path: None
        script = Path(__file__).resolve().parents[1] / 'scripts/private-inspiration-media.py'
        original_path = sys.path.copy()
        # runpy does not add the script directory as a direct Python launch does.
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ), \
                patch.object(sys, 'path', [str(script.parent), *original_path]), \
                patch.dict(sys.modules, {'private_inspiration_audio': audio}), \
                patch('subprocess.run', side_effect=AssertionError('No download expected')) as download, \
                patch.object(helper, 'fetch_ad_snapshot', fail), \
                patch.object(Path, 'read_text', return_value=skill), \
                patch.object(sys, 'argv', [str(script), 'https://www.facebook.com/ads/library/?id=' + AD, directory]), \
                contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(script), run_name='__main__')
            with open(Path(directory) / 'media.json') as saved:
                result = json.load(saved)
        self.assertEqual(sys.path, original_path)
        download.assert_not_called()
        self.assertEqual(result['error_code'], 'facebook_snapshot_unavailable')
        self.assertEqual(result['metadata']['source_fetch']['attempts'][0]['http_status'], 403)
        self.assertEqual(result['frames'], [])
        self.assertEqual(result['media_kind'], 'unknown')


if __name__ == '__main__':
    unittest.main()
