import os
import threading
import unittest
from unittest.mock import Mock, patch

from tools import classify_worker as module


class AgentDiscoveryTests(unittest.TestCase):
    def test_current_and_legacy_app_layouts_resolve_without_path(self):
        paths = [
            '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
            '/Applications/Codex.app/Contents/Resources/codex-cli/bin/codex',
            '/Applications/ChatGPT.app/Contents/Resources/codex',
            '/Applications/Codex.app/Contents/Resources/codex',
        ]
        for available in paths:
            with self.subTest(path=available), patch.dict(os.environ, {'CODEX_BIN': ''}), \
                 patch.object(module.shutil, 'which', return_value=None), \
                 patch.object(module.os.path, 'exists', side_effect=lambda p: p == available), \
                 patch.object(module.os, 'access', side_effect=lambda p, _: p == available):
                self.assertEqual(module._resolve_codex_bin(), available)

    def test_environment_override_is_resolved_at_call_time(self):
        with patch.object(module.shutil, 'which', return_value=None), \
             patch.object(module.os.path, 'exists', return_value=True), \
             patch.object(module.os, 'access', return_value=True):
            for path in ['/custom/first/codex', '/custom/second/codex']:
                with patch.dict(os.environ, {'CODEX_BIN': path}):
                    self.assertEqual(module._resolve_codex_bin(), path)

    def test_missing_or_non_executable_agents_are_not_available(self):
        with patch.object(module.shutil, 'which', return_value=None), \
             patch.object(module.os.path, 'exists', return_value=True), \
             patch.object(module.os, 'access', return_value=False):
            self.assertIsNone(module._resolve_codex_bin())

    def test_codex_command_keeps_existing_options_and_prompt(self):
        path = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'
        with patch.object(module, '_has_claude', return_value=False), \
             patch.object(module, '_resolve_codex_bin', return_value=path):
            command = module.build_agent_cmd('one exact job', prefer='claude')
            self.assertEqual(command[0], path)
            self.assertEqual(command[1], 'exec')
            self.assertEqual(command[-1], 'one exact job')

    def test_claude_preference_is_unchanged(self):
        with patch.object(module, '_has_claude', return_value=True), \
             patch.object(module, '_has_codex', return_value=True):
            self.assertEqual(module.build_agent_cmd('prompt', prefer='claude')[0], 'claude')

    def worker(self):
        worker = module.Worker.__new__(module.Worker)
        worker.sb = Mock()
        worker._classify_lock = threading.Lock()
        worker._classify_futures = {}
        worker._find_offline_workers = Mock(return_value=set())
        worker._active_classify_count = Mock(return_value=0)
        worker._claude_cooldown_until = 0
        worker._agent_infra_cooldown_until = 0
        worker._caps = {'ffmpeg': True, 'classification_only': True}
        worker.worker_id = 'test-worker'
        return worker

    def test_unavailable_worker_does_not_read_or_claim_queue(self):
        worker = self.worker()
        with patch.object(module, '_has_claude', return_value=False), \
             patch.object(module, '_has_codex', return_value=False):
            self.assertFalse(worker._classify_has_capacity())
            self.assertIsNone(worker.claim_next_job())
        worker.sb.select.assert_not_called()
        worker.sb.update.assert_not_called()

    def test_restored_agent_resumes_capacity_without_dropping_cooldowns(self):
        worker = self.worker()
        with patch.object(module, '_has_claude', return_value=False), \
             patch.object(module, '_has_codex', return_value=True):
            self.assertTrue(worker._classify_has_capacity())
            worker._agent_infra_cooldown_until = float('inf')
            self.assertFalse(worker._classify_has_capacity())

    def test_refresh_preserves_unrelated_capabilities_and_touches_no_queue(self):
        worker = self.worker()
        with patch.object(module, '_has_claude', return_value=False), \
             patch.object(module, '_has_codex', return_value=True):
            worker.refresh_agent_capabilities()
        self.assertTrue(worker._caps['codex'])
        self.assertTrue(worker._caps['ffmpeg'])
        self.assertTrue(worker._caps['classification_only'])
        self.assertEqual(worker._caps['agent_launcher_revision'], 'codex-bundle-v2')
        worker.sb.update.assert_not_called()

    def test_infrastructure_failure_blocks_only_job_without_content_retry_charge(self):
        worker = self.worker()
        with patch.object(module, 'log'):
            worker.mark_agent_infra_failure({'id': 'queue-id', 'attempts': 1}, 'no usable agent CLI found')
        table, query, update = worker.sb.update.call_args.args
        self.assertEqual(table, 'inspiration_queue')
        self.assertEqual(query, 'id=eq.queue-id')
        self.assertEqual(update['status'], 'blocked')
        self.assertEqual(update['attempts'], 0)
        self.assertNotIn('url', update)
        self.assertNotIn('ins_id', update)
        self.assertNotIn('product_id', update)

    def test_claim_remains_compare_and_swap_when_agent_available(self):
        worker = self.worker()
        worker.sb.select.return_value = [{'id': 'q', 'attempts': 0}]
        worker.sb.update.return_value = []
        with patch.object(module, '_has_claude', return_value=False), \
             patch.object(module, '_has_codex', return_value=True):
            self.assertIsNone(worker.claim_next_job())
        self.assertEqual(worker.sb.update.call_args.args[1], 'id=eq.q&status=in.(pending,processing)&claimed_by=is.null')


if __name__ == '__main__':
    unittest.main()
