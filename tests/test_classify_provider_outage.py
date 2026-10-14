import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from tools import classify_worker as module


class ProviderOutageTests(unittest.TestCase):
    def test_stderr_provider_error_is_retained_when_stdout_contains_progress(self):
        worker=module.Worker.__new__(module.Worker);worker.sb=Mock();worker.sb.select.return_value=[]
        job={'id':'q1','ins_id':'M-INS-181','product_id':'p1','url':'https://source','no_brief':False}
        result=SimpleNamespace(returncode=1,stdout='Starting classification...',
                               stderr='ERROR: exceeded retry limit, last status: 429 Too Many Requests')
        with patch.object(module,'sync_classify_skill_files'),patch.object(module,'log'), \
             patch.object(module,'build_agent_cmd',return_value=['codex','exec','prompt']), \
             patch.object(module.subprocess,'run',return_value=result):
            outcome=worker.run_skill_on_job(job)
        self.assertFalse(outcome['success'])
        self.assertTrue(module._codex_service_unavailable(outcome['error']))

    def test_only_recognized_codex_service_failures_are_deferred(self):
        for message in ['Selected model is at capacity',
                        'ERROR: exceeded retry limit, last status: 429 Too Many Requests',
                        'unexpected status 503 Service Unavailable']:
            self.assertTrue(module._codex_service_unavailable('codex exit 1: '+message))
        for message in ['TikTok HTTP 429', 'source HTTP 503', 'codex exit 1: missing fields',
                        'codex exit 1: authentication_error 401', 'claude exit 1: overloaded',
                        'codex exit 1: model not found']:
            self.assertFalse(module._codex_service_unavailable(message))

    def test_outage_preserves_content_retry_budget_and_claim_identity(self):
        worker=module.Worker.__new__(module.Worker);worker.sb=Mock()
        job={'id':'q1','product_id':'p1','attempts':4,'claimed_by':'gp-mac-mini',
             'claimed_at':'2026-10-14T07:32:26Z'}
        with patch.object(module,'log'):
            worker.mark_provider_outage(job,'codex exit 1: Selected model is at capacity')
        table,query,update=worker.sb.update.call_args.args
        self.assertEqual(table,'inspiration_queue')
        for part in ['id=eq.q1','product_id=eq.p1','status=eq.classifying',
                     'claimed_by=eq.gp-mac-mini','claimed_at=eq.2026-10-14T07%3A32%3A26Z']:
            self.assertIn(part,query)
        self.assertEqual(update['attempts'],3)
        self.assertEqual(update['status'],'pending')
        self.assertEqual(set(update),{'status','claimed_by','claimed_at','attempts','error_message'})

    def test_provider_failure_uses_cooldown_instead_of_final_content_failure(self):
        worker=module.Worker.__new__(module.Worker);worker.sb=Mock()
        worker.sb.select.return_value=[{'id':'M-INS-181','url':'https://source'}]
        worker.mark_classifying=Mock();worker._verify_inspirations_row=Mock(return_value=(False,'not saved'))
        worker.run_skill_on_job=Mock(return_value={'success':False,'error':'codex exit 1: ERROR: exceeded retry limit, last status: 429 Too Many Requests'})
        worker.mark_provider_outage=Mock();worker.mark_failure=Mock();worker.increment_failed=Mock()
        job={'id':'q1','ins_id':'M-INS-181','product_id':'p1','url':'https://source','attempts':4}
        with patch.object(module,'log'),patch.object(module.time,'time',return_value=1000):
            worker._execute_classify_job(job)
        worker.mark_provider_outage.assert_called_once_with(job,worker.run_skill_on_job.return_value['error'])
        worker.mark_failure.assert_not_called();worker.increment_failed.assert_not_called()
        self.assertEqual(worker._claude_cooldown_until,1000+module.CLASSIFY_RATE_LIMIT_COOLDOWN_SECONDS)


if __name__=='__main__':
    unittest.main()
