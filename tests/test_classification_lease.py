from concurrent.futures import Future
import threading
import unittest
from unittest.mock import Mock, patch
from tools import classify_worker as module


class ClassificationLeaseTests(unittest.TestCase):
    def setUp(self):
        self.worker = module.Worker.__new__(module.Worker)
        self.worker.sb = Mock()
        self.worker.worker_id = 'gp-mac-mini'
        self.worker._classify_lock = threading.Lock()
        self.worker._classify_futures = {}

    def test_lease_outlives_agent_timeout(self):
        self.assertGreaterEqual(module.STALE_CLAIM_TIMEOUT_MINUTES * 60,
                                module.CLAUDE_CLI_TIMEOUT_SECONDS + 300)

    def test_live_local_job_never_released(self):
        self.worker._classify_futures['active'] = Future()
        self.worker.sb.select.return_value = [dict(id='active', status='classifying',
            claimed_at='2026-10-07T00:00:00Z', claimed_by='gp-mac-mini')]
        self.worker.release_stale_claims()
        self.assertEqual(self.worker.sb.update.call_count, 1)
        self.assertIn('claimed_by=is.null', self.worker.sb.update.call_args.args[1])

    def test_expired_claim_uses_original_owner_timestamp_and_state(self):
        self.worker.sb.select.return_value = [dict(id='expired', status='classifying',
            claimed_at='2026-10-07T00:00:00Z', claimed_by='gp-mac-mini')]
        self.worker.release_stale_claims()
        table, query, payload = self.worker.sb.update.call_args_list[0].args
        self.assertEqual(table, 'inspiration_queue')
        for expected in ['id=eq.expired', 'status=eq.classifying', 'claimed_by=eq.gp-mac-mini',
                         'claimed_at=eq.2026-10-07T00%3A00%3A00Z']:
            self.assertIn(expected, query)
        self.assertEqual(payload, {'status':'pending','claimed_by':None,'claimed_at':None})

    def test_completed_future_can_be_recovered(self):
        future = Future(); future.set_result(None)
        self.worker._classify_futures['expired'] = future
        self.worker.sb.select.return_value = [dict(id='expired',status='claimed',
            claimed_at='2026-10-07T00:00:00Z',claimed_by='gp-mac-mini')]
        self.worker.release_stale_claims()
        self.assertIn('id=eq.expired', self.worker.sb.update.call_args_list[0].args[1])

    def test_same_queue_cannot_be_claimed_while_local_future_runs(self):
        self.worker._find_offline_workers = Mock(return_value=set())
        self.worker._classify_futures['active'] = Future()
        self.worker.sb.select.return_value = [{'id':'active','attempts':3}]
        with patch.object(module, '_has_codex', return_value=True), patch.object(module, '_has_claude', return_value=False):
            self.assertIsNone(self.worker.claim_next_job())
        self.worker.sb.update.assert_not_called()


if __name__ == '__main__':
    unittest.main()
