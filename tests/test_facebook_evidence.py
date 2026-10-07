import importlib.util
import json
from pathlib import Path
import unittest
import sys
from unittest.mock import Mock, patch

from tools import classify_worker as worker

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('fb_helper', ROOT / 'team-skill/fb_ad_classifier.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def page(ads):
    return '<script type="application/json">' + json.dumps({'ads': ads}) + '</script>'


def ad(identity, **snapshot):
    return {'ad_archive_id': identity, 'snapshot': snapshot}


class FacebookEvidenceTests(unittest.TestCase):
    def test_checksum_failure_uses_one_isolated_verified_retry(self):
        whisper = Mock()
        model = object()
        whisper.load_model.side_effect = [RuntimeError('SHA256 checksum mismatch'), model]
        with patch.dict(sys.modules, {'whisper': whisper}), patch.object(helper.tempfile, 'mkdtemp', return_value='/private/tmp/isolated-model'):
            self.assertIs(helper.load_transcription_model('large-v3'), model)
        self.assertEqual(whisper.load_model.call_args_list[0].args, ('large-v3',))
        self.assertEqual(whisper.load_model.call_args_list[1].kwargs, {'download_root':'/private/tmp/isolated-model'})

    def test_other_model_failures_and_second_checksum_failure_stop(self):
        for error, expected in [(RuntimeError('Out of memory'), 1), (RuntimeError('SHA256 checksum mismatch'), 2)]:
            whisper = Mock(); whisper.load_model.side_effect = error
            with patch.dict(sys.modules, {'whisper':whisper}), patch.object(helper.tempfile, 'mkdtemp', return_value='/private/tmp/isolated-model'):
                with self.assertRaises(RuntimeError):
                    helper.load_transcription_model('large-v3')
            self.assertEqual(whisper.load_model.call_count, expected)

    def test_exact_id_not_first_ad(self):
        result = helper.parse_ad_snapshot(page([
            ad('wrong', videos=[{'video_hd_url': 'https://video/wrong.mp4'}]),
            ad('target', videos=[{'video_hd_url': 'https://video/right.mp4'}],
               body={'text': 'A "quote" and } brace { ' + 'x' * 25000}),
        ]), 'target')
        self.assertEqual(result['video_hd_url'], 'https://video/right.mp4')
        self.assertEqual(result['ad_id'], 'target')
        self.assertTrue(result['body_text'].endswith('x' * 25000))

    def test_missing_target_cannot_borrow_neighbor_media(self):
        for ads in [[ad('wrong', video_hd_url='https://video/wrong.mp4')],
                    [ad('target', body={'text': 'no media'}), ad('wrong', image_url='wrong')]]:
            with self.assertRaisesRegex(RuntimeError, 'FB_TARGET_UNAVAILABLE:'):
                helper.parse_ad_snapshot(page(ads), 'target')

    def test_static_and_card_media_and_numeric_ids(self):
        for snapshot in [{'images': [{'original_image_url': 'https://image/right.png'}]},
                         {'cards': [{'original_image_url': 'https://image/right.png'}]}]:
            self.assertEqual(helper.parse_ad_snapshot(page([ad(123, **snapshot)]), '123')['image_url'],
                             'https://image/right.png')

    def test_id_string_in_copy_does_not_count_as_identity(self):
        with self.assertRaisesRegex(RuntimeError, 'FB_TARGET_UNAVAILABLE:'):
            helper.parse_ad_snapshot(page([ad('wrong', video_hd_url='https://wrong',
                body={'text': '"ad_archive_id":"target"'})]), 'target')

    def test_contract_does_not_change_other_platforms_or_no_brief(self):
        for url in ['https://www.facebook.com/ads/library/?id=123',
                    'https://facebook.com/ads/library/?id=123']:
            text = worker.facebook_source_contract({'url': url, 'no_brief': True})
            for required in ['No Brief', 'large-v3', 'Mongolian=mn', 'FB_TARGET_UNAVAILABLE:',
                             'AUDIO_TRANSCRIPT_UNVERIFIED:', 'do not create taxonomy']:
                self.assertIn(required, text)
        for url in ['https://facebook.com.evil.test/ads/library/?id=123',
                    'https://www.instagram.com/reel/a', 'https://facebook.com/watch']:
            self.assertEqual(worker.facebook_source_contract({'url': url}), '')

    def test_blocked_evidence_stops_retries_only_for_facebook_library(self):
        w = worker.Worker.__new__(worker.Worker)
        w.sb = Mock()
        with patch.object(worker, 'log'):
            for marker in ['FB_TARGET_UNAVAILABLE:', 'AUDIO_TRANSCRIPT_UNVERIFIED:']:
                w.mark_failure({'id': 'queue', 'url': 'https://facebook.com/ads/library/?id=1',
                                'attempts': 1}, marker + ' evidence missing')
                table, query, update = w.sb.update.call_args.args
                self.assertEqual((table, query), ('inspiration_queue', 'id=eq.queue'))
                self.assertEqual(update['status'], 'blocked')
                self.assertEqual(set(update), {'status', 'claimed_by', 'claimed_at', 'error_message'})
            w.mark_failure({'id': 'queue', 'url': 'https://facebook.com/ads/library/?id=1',
                            'attempts': 1}, 'Network timeout')
            self.assertEqual(w.sb.update.call_args.args[2]['status'], 'pending')

    def test_published_mirrors_match(self):
        self.assertEqual((ROOT / 'team-skill/fb_ad_classifier.py').read_bytes(),
                         (ROOT / 'public/team-skill/fb_ad_classifier.py').read_bytes())
        for path in ['team-skill/classify_worker.py', 'public/team-skill/classify_worker.py']:
            self.assertEqual((ROOT / path).read_bytes(), (ROOT / 'tools/classify_worker.py').read_bytes())


if __name__ == '__main__':
    unittest.main()
