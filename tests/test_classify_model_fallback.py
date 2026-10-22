import json
import os
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

from tools import classify_worker as worker


ERROR = 'ERROR: {"type":"invalid_request_error","message":"The \'unavailable-model\' model is not supported when using Codex with a ChatGPT account."}'


class ModelFallbackTests(unittest.TestCase):
    def test_only_exact_model_startup_rejection_is_infrastructure(self):
        self.assertTrue(worker._agent_infra_failed('codex exit 1: ' + ERROR))
        for message in ['Facebook model not found', 'brief publish failed', 'invalid_request_error: source unavailable']:
            self.assertFalse(worker._codex_model_unavailable(message))

    def test_catalog_filters_hidden_rejected_and_stale_models(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'CODEX_HOME': directory}):
            path = Path(directory) / 'models_cache.json'
            cache = {'fetched_at': datetime.now(timezone.utc).isoformat(), 'models': [
                {'slug': 'hidden', 'priority': 0, 'visibility': 'hide'},
                {'slug': 'unavailable-model', 'priority': 1, 'visibility': 'list'},
                {'slug': 'current-model', 'priority': 2, 'visibility': 'list', 'default_reasoning_level': 'high'},
            ]}
            path.write_text(json.dumps(cache))
            self.assertEqual(worker._codex_fallback_model(ERROR), ('current-model', 'high'))
            cache['fetched_at'] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
            path.write_text(json.dumps(cache))
            self.assertIsNone(worker._codex_fallback_model(ERROR))
            path.write_text('not json')
            self.assertIsNone(worker._codex_fallback_model(ERROR))

    def test_one_fallback_preserves_prompt_environment_and_total_timeout(self):
        command = ['/app/codex', 'exec', '-c', 'shell_environment_policy.inherit=all', 'exact job']
        failed = subprocess.CompletedProcess(command, 1, '', ERROR)
        success = subprocess.CompletedProcess(command, 0, 'done', '')
        with patch.object(worker.subprocess, 'run', side_effect=[failed, success]) as run, \
             patch.object(worker, '_codex_fallback_model', return_value=('current-model', 'high')), \
             patch.object(worker.time, 'monotonic', side_effect=[100, 103]), patch.object(worker, 'log'):
            self.assertIs(worker.run_classification_agent(command, 60), success)
        self.assertEqual(run.call_count, 2)
        first, second = run.call_args_list
        self.assertEqual(second.args[0], command[:2] + ['--model', 'current-model', '-c', 'model_reasoning_effort="high"'] + command[2:])
        self.assertEqual(second.kwargs['timeout'], 57)
        self.assertEqual(first.kwargs['cwd'], second.kwargs['cwd'])
        self.assertEqual(first.kwargs['env'], second.kwargs['env'])

    def test_fallback_does_not_loop(self):
        command = ['codex', 'exec', 'exact job']
        failed = subprocess.CompletedProcess(command, 1, '', ERROR)
        with patch.object(worker.subprocess, 'run', return_value=failed) as run, \
             patch.object(worker, '_codex_fallback_model', return_value=('current-model', 'high')), patch.object(worker, 'log'):
            self.assertIs(worker.run_classification_agent(command, 60), failed)
        self.assertEqual(run.call_count, 2)

    def test_success_claude_and_content_failure_never_retry(self):
        for command, code, error in [(['codex', 'exec', 'job'], 0, ERROR),
                                     (['claude', '-p', 'job'], 1, ERROR),
                                     (['codex', 'exec', 'job'], 1, 'Could not verify published brief')]:
            result = subprocess.CompletedProcess(command, code, '', error)
            with patch.object(worker.subprocess, 'run', return_value=result) as run:
                self.assertIs(worker.run_classification_agent(command, 60), result)
                self.assertEqual(run.call_count, 1)

    def test_missing_catalog_and_exhausted_timeout_do_not_retry(self):
        command = ['codex', 'exec', 'job']
        result = subprocess.CompletedProcess(command, 1, '', ERROR)
        for fallback, elapsed in [(None, 1), (('current-model', 'high'), 60)]:
            with patch.object(worker.subprocess, 'run', return_value=result) as run, \
                 patch.object(worker, '_codex_fallback_model', return_value=fallback), \
                 patch.object(worker.time, 'monotonic', side_effect=[0, elapsed]):
                worker.run_classification_agent(command, 60)
                self.assertEqual(run.call_count, 1)


if __name__ == '__main__':
    unittest.main()
