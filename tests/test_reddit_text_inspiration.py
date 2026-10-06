import copy
import unittest
from unittest.mock import Mock, patch

from tools import classify_worker as module


URL = 'https://www.reddit.com/r/crafts/comments/abc/story/'


class RedditTextTests(unittest.TestCase):
    def setUp(self):
        self.evidence = {'source_url': URL, 'title': 'A handmade gift',
                         'body': 'I made a blanket as a wedding gift.',
                         'retrieved_at': '2026-10-06T10:00:00Z', 'retrieval_method': 'web_reader'}
        self.data = {'sourceUrl': URL, 'textEvidence': self.evidence, 'bodyCopy': self.evidence['body'],
                     'mediaKind': 'text', 'adType': 'Text', 'productionStyle': 'Text Post',
                     'voiceOver': 'No voice over', 'duration_seconds': None,
                     'captionTimeline': [], 'voiceOverTimeline': [], 'captionTranscript': '',
                     'noBrief': True, 'brand': 'Unbranded Reddit post', 'angle': 'Meaningful gifts',
                     'persona': 'Gift-making quilter', 'hookType': 'Question',
                     'creativeStructure': 'Storytelling', 'funnelStage': 'Not applicable'}
        self.result = {'source_url': URL, 'metadata': {'text_evidence': self.evidence},
                       'classification': {'media_kind': 'text'}, 'frames_extracted': 0}
        self.worker = module.Worker.__new__(module.Worker)
        self.worker.sb = Mock()
        self.worker.sb.select.side_effect = lambda table, _: (
            [{'id': 'Q-test', 'url': URL, 'data': copy.deepcopy(self.data)}]
            if table == 'inspirations' else [copy.deepcopy(self.result)])
        self.worker._verify_clickup_brief_page = Mock(return_value=(True, 'verified'))

    def verify(self, no_brief=True):
        return self.worker._verify_inspirations_row('Q-test', 'quilting', no_brief=no_brief)

    def test_complete_text_without_brief_passes_without_clickup(self):
        self.assertTrue(self.verify()[0])
        self.worker._verify_clickup_brief_page.assert_not_called()
        self.worker.sb.update.assert_not_called()

    def test_full_brief_still_requires_three_scripts_and_page(self):
        self.assertFalse(self.verify(False)[0])
        self.data['_clickupDocPageUrl'] = 'https://app.clickup.com/docs/doc/page'
        self.data['nextAdScripts'] = [{'script_breakdown': [{'time': 'Proposed beat 1'}]} for _ in range(3)]
        self.assertTrue(self.verify(False)[0])
        self.worker._verify_clickup_brief_page.assert_called_once()

    def test_text_cannot_be_video_or_have_fake_timing_audio(self):
        for key, value in [('adType', 'Video'), ('productionStyle', 'Static Graphic'),
                           ('voiceOver', 'Invented narration'), ('duration_seconds', 12),
                           ('captionTimeline', [{'start': 0}]), ('captionTranscript', 'Fake subtitle')]:
            with self.subTest(key=key):
                original = self.data[key]
                self.data[key] = value
                self.assertFalse(self.verify()[0])
                self.data[key] = original

    def test_unverified_removed_and_mismatched_evidence_fails(self):
        for key, value in [('source_url', 'https://example.com/other'), ('title', ''),
                           ('body', '[removed]'), ('body', ''), ('body', 'Different story'),
                           ('retrieval_method', 'guessed'), ('retrieved_at', '')]:
            with self.subTest(key=key):
                original = self.evidence[key]
                self.evidence[key] = value
                self.assertFalse(self.verify()[0])
                self.evidence[key] = original

    def test_result_must_match_inspiration_and_product_query(self):
        self.result['source_url'] = 'https://example.com/other'
        self.assertFalse(self.verify()[0])
        for table, query in [call.args for call in self.worker.sb.select.call_args_list]:
            self.assertIn('product_id=eq.quilting', query)
        self.worker.sb.update.assert_not_called()

    def test_only_reddit_posts_receive_contract(self):
        for url in [URL, URL.replace('www.', 'old.')]:
            contract = module.reddit_source_contract({'url': url, 'ins_id': 'Q-test'})
            self.assertIn('complete original post', contract)
            self.assertIn('No Brief retains priority', contract)
            self.assertIn('Never run bulk processing', contract)
        for url in ['https://reddit.com.evil.test/comments/id', 'https://example.com/comments/id',
                    'https://www.instagram.com/reel/a', 'https://reddit.com/r/crafts/']:
            self.assertEqual(module.reddit_source_contract({'url': url}), '')

    def test_inaccessible_text_stops_retries_without_touching_inspiration(self):
        with patch.object(module, 'log'):
            self.worker.mark_failure({'id': 'q', 'url': URL, 'attempts': 1},
                                     'FAIL Q-test: TEXT_SOURCE_UNAVAILABLE: removed')
        table, query, update = self.worker.sb.update.call_args.args
        self.assertEqual((table, query), ('inspiration_queue', 'id=eq.q'))
        self.assertEqual(update['status'], 'blocked')
        self.assertEqual(set(update), {'status', 'claimed_by', 'claimed_at', 'error_message'})

    def test_transient_reddit_video_failure_keeps_existing_retry_policy(self):
        for attempts, expected in [(1, 'pending'), (3, 'failed')]:
            with patch.object(module, 'log'):
                self.worker.mark_failure({'id': 'q', 'url': URL, 'attempts': attempts}, 'Network timeout')
            self.assertEqual(self.worker.sb.update.call_args.args[2]['status'], expected)


if __name__ == '__main__':
    unittest.main()
