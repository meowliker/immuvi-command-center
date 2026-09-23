import copy
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from tools import classify_worker as module


class NoBriefTests(unittest.TestCase):
    def setUp(self):
        self.worker = module.Worker.__new__(module.Worker)
        self.data = {
            "noBrief": True, "brand": "Source", "angle": "Beginner Confidence",
            "persona": "Beginner Quilter", "creativeStructure": "Tutorial / How-To",
            "hookType": "Curiosity", "productionStyle": "Organic / Raw UGC",
            "funnelStage": "TOF", "adType": "Video", "mediaKind": "video",
            "voiceOver": "No voice over", "bodyCopy": "Real source caption",
        }
        self.worker.sb = Mock()
        self.worker.sb.select.side_effect = lambda *_: [{"id": "INS-test", "data": copy.deepcopy(self.data)}]
        self.worker._verify_clickup_brief_page = Mock(return_value=(True, "verified"))
        self.job = {"id": "q-test", "ins_id": "INS-test", "product_id": "p-test",
                    "url": "https://example.com/ad", "platform": "instagram", "no_brief": True}

    def verify(self, no_brief=True):
        return self.worker._verify_inspirations_row("INS-test", "p-test", no_brief=no_brief)

    def test_classification_only_needs_no_brief_url_or_scripts(self):
        self.assertEqual(self.verify(), (True, "verified classification only"))
        self.worker._verify_clickup_brief_page.assert_not_called()

    def test_normal_mode_still_requires_brief(self):
        self.assertFalse(self.verify(False)[0])
        self.data["_clickupDocPageUrl"] = "https://app.clickup.com/doc"
        self.assertIn("nextAdScripts", self.verify(False)[1])
        self.data["nextAdScripts"] = [{"script_breakdown": [{"time": "0:00"}]} for _ in range(3)]
        self.assertTrue(self.verify(False)[0])
        self.worker._verify_clickup_brief_page.assert_called_once()

    def test_mode_must_be_persisted(self):
        self.data.pop("noBrief")
        self.assertFalse(self.verify()[0])

    def test_classification_and_media_validation_stays_strict(self):
        for field in ("brand", "angle", "persona", "hookType", "productionStyle",
                      "creativeStructure", "funnelStage", "adType", "mediaKind"):
            with self.subTest(field=field):
                original = self.data.pop(field)
                self.assertFalse(self.verify()[0])
                self.data[field] = original
        self.data["adType"] = "Photo"
        self.assertIn("mismatch", self.verify()[1])

    def test_bad_caption_or_audio_still_fails(self):
        for value in ("", "Transcript unavailable", "It's a ball. It's a ball"):
            self.data["voiceOver"] = value
            self.assertFalse(self.verify()[0])
        self.data["voiceOver"] = "No voice over"
        self.data["bodyCopy"] = "Real<br>caption"
        self.assertFalse(self.verify()[0])

    def test_image_classification_without_audio(self):
        self.data.update(mediaKind="image", adType="Photo", voiceOver="")
        self.assertTrue(self.verify()[0])

    def test_agent_receives_only_requested_mode_and_verifier_gets_same_mode(self):
        for mode in (True, False, None):
            with self.subTest(mode=mode):
                job = {**self.job, "no_brief": mode}
                self.worker._verify_inspirations_row = Mock(return_value=(True, "verified"))
                with patch.object(module, "sync_classify_skill_files"), patch.object(module, "log"), \
                     patch.object(module, "build_agent_cmd", side_effect=lambda prompt, **_: ["claude", "-p", prompt]), \
                     patch.object(module.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="OK INS-test", stderr="")) as run:
                    self.assertTrue(self.worker.run_skill_on_job(job)["success"])
                    prompt = run.call_args.args[0][2]
                    if mode is True:
                        self.assertIn("CLASSIFICATION-ONLY", prompt)
                        self.assertIn("Do NOT generate creative brief content", prompt)
                        self.assertNotIn("5. Build the creative brief markdown", prompt)
                        self.assertIn("Preserve an existing brief/link", prompt)
                    else:
                        self.assertIn("5. Build the creative brief markdown", prompt)
                        self.assertNotIn("CLASSIFICATION-ONLY", prompt)
                    self.worker._verify_inspirations_row.assert_called_once_with(
                        "INS-test", "p-test", require_next_script_format=True, no_brief=mode is True)

    def test_retry_shortcut_honors_saved_mode(self):
        self.worker.mark_classifying = Mock()
        self.worker.mark_classified = Mock()
        self.worker.increment_completed = Mock()
        self.worker.run_skill_on_job = Mock()
        self.worker._verify_inspirations_row = Mock(return_value=(True, "verified classification only"))
        with patch.object(module, "log"):
            self.worker._execute_classify_job(self.job)
        self.worker.run_skill_on_job.assert_not_called()
        self.worker.mark_classified.assert_called_once_with("q-test")
        self.assertTrue(self.worker._verify_inspirations_row.call_args.kwargs["no_brief"])

    def test_historical_requeue_does_not_require_a_brief_for_no_brief_jobs(self):
        self.worker._last_incomplete_classified_audit_at = 0
        self.worker.sb.select.return_value = [self.job]
        self.worker.sb.select.side_effect = None
        self.worker._verify_inspirations_row = Mock(return_value=(True, "verified"))
        with patch.object(module, "AUTO_REQUEUE_INCOMPLETE_CLASSIFIED", True):
            self.worker.requeue_incomplete_classified_jobs()
        self.worker.sb.update.assert_not_called()
        self.assertTrue(self.worker._verify_inspirations_row.call_args.kwargs["no_brief"])

    def test_shipped_worker_and_skill_mirrors_match(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "tools/classify_worker.py").read_bytes()
        for directory in ("team-skill", "public/team-skill"):
            self.assertEqual(source, (root / directory / "classify_worker.py").read_bytes())
        self.assertEqual((root / "team-skill/SKILL.md").read_bytes(),
                         (root / "public/team-skill/SKILL.md").read_bytes())


if __name__ == "__main__":
    unittest.main()
