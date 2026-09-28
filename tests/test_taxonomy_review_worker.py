import unittest
from unittest.mock import Mock, patch
from tools.classify_worker import Worker, classification_only_prompt


class ReviewWorkerTests(unittest.TestCase):
    def worker(self):
        worker = Worker.__new__(Worker)
        worker.worker_id = 'gp-mac-mini'
        worker._caps = {'taxonomy_review': 'semantic-taxonomy-v1'}
        worker.sb = Mock()
        worker.sb.select.return_value = [{'id': 'job', 'attempts': 0}]
        worker.sb.update.side_effect = [[], [{'id': 'job', 'status': 'running'}]]
        return worker

    def test_claim_is_atomic_and_mac_mini_only(self):
        worker = self.worker()
        self.assertEqual(worker.claim_next_taxonomy_review()['status'], 'running')
        for call in worker.sb.update.call_args_list:
            self.assertEqual(call.args[0], 'taxonomy_review_jobs')
        self.assertIn('%2B', worker.sb.update.call_args_list[0].args[1])
        self.assertEqual(worker.sb.update.call_args_list[1].args[1], 'id=eq.job&status=eq.pending')
        worker = self.worker()
        worker.worker_id = 'gp-laptop'
        self.assertIsNone(worker.claim_next_taxonomy_review())
        worker.sb.select.assert_not_called()

    def test_lost_claim_never_dispatches(self):
        worker = self.worker()
        worker.sb.update.side_effect = [[], []]
        self.assertIsNone(worker.claim_next_taxonomy_review())

    def test_old_worker_does_not_claim_review_jobs(self):
        worker = self.worker()
        worker._caps = {}
        self.assertIsNone(worker.claim_next_taxonomy_review())
        worker.sb.select.assert_not_called()

    def test_normal_classification_prompt_does_not_force_broader_label(self):
        prompt = classification_only_prompt({'ins_id': 'Q-1', 'product_id': 'quilt'})
        self.assertIn('Do not force the closest or broadest existing label', prompt)
        self.assertIn('angle_needs_review', prompt)


if __name__ == '__main__':
    unittest.main()
