from pathlib import Path
from unittest.mock import Mock, patch
import unittest

from tools import classify_worker as worker


class LocalAudioContractTests(unittest.TestCase):
    def test_local_route_applies_to_all_platforms_and_modes(self):
        for platform in ("TikTok", "Instagram", "Facebook", "YouTube", "Other"):
            for mode in (False, True):
                with self.subTest(platform=platform, mode=mode):
                    text = worker.narration_presence_contract(
                        {"platform": platform, "no_brief": mode})
                    for required in ("LOCAL AUDIO VERIFICATION", "local tools on this worker",
                                     "Do not use Arcads", "upload source media to an external analyzer",
                                     "wait/poll", "AudioSet/AST", "Text-only and image sources skip"):
                        self.assertIn(required, text)
                    self.assertIn("Never infer absence from ASR failure alone", text)
                    self.assertIn("genuine narration is present but unclear", text)

    def test_no_brief_does_not_require_local_transcription_or_full_brief(self):
        text = worker.local_audio_contract({"no_brief": True})
        self.assertIn("optional-narration visual/text evidence", text)
        self.assertIn("Do not require speech verification", text)
        self.assertNotIn("Full brief:", text)
        self.assertNotIn("LOCAL_AUDIO_TOOL_UNAVAILABLE:", text)
        self.assertNotIn("turbo", text)

    def test_full_brief_keeps_local_checksum_and_evidence_guards(self):
        for mode in (False, None, "true"):
            text = worker.local_audio_contract({"no_brief": mode})
            for required in ("load_transcription_model", "isolated verified recovery",
                             "fresh Python subprocess", "task=transcribe",
                             "never run parallel large models", "Never infer no narration",
                             "LOCAL_AUDIO_TOOL_UNAVAILABLE:", "never fabricate a transcript"):
                self.assertIn(required, text)

    def test_only_explicit_local_tool_error_is_infrastructure(self):
        self.assertTrue(worker._agent_infra_failed(
            "FAIL inspiration: LOCAL_AUDIO_TOOL_UNAVAILABLE: ffmpeg not found"))
        for text in ("Audio transcript unclear", "TikTok download failed",
                     "AUDIO_TRANSCRIPT_UNVERIFIED: uncertain words", "Arcads credits exhausted"):
            self.assertFalse(worker._agent_infra_failed(text))

    def test_local_tool_failure_does_not_spend_a_content_attempt(self):
        w = worker.Worker.__new__(worker.Worker)
        w.sb = Mock()
        with patch.object(worker, "log"):
            w.mark_agent_infra_failure(
                {"id": "exact-queue", "attempts": 1},
                "LOCAL_AUDIO_TOOL_UNAVAILABLE: ffmpeg missing")
        table, query, values = w.sb.update.call_args.args
        self.assertEqual((table, query), ("inspiration_queue", "id=eq.exact-queue"))
        self.assertEqual(values["status"], "blocked")
        self.assertEqual(values["attempts"], 0)
        self.assertIsNone(values["claimed_by"])

    def test_execution_routes_local_tool_failure_to_infrastructure_handling(self):
        w = worker.Worker.__new__(worker.Worker)
        job = {"id": "exact-queue", "ins_id": "INS-test", "product_id": "product",
               "url": "https://tiktok.com/@creator/video/123", "no_brief": False}
        w.sb = Mock()
        w.sb.select.return_value = [{"id": job["ins_id"], "product_id": job["product_id"],
                                     "url": job["url"]}]
        w.mark_classifying = Mock()
        w._verify_inspirations_row = Mock(return_value=(False, "Not analyzed"))
        message = "FAIL INS-test: LOCAL_AUDIO_TOOL_UNAVAILABLE: missing local executable"
        w.run_skill_on_job = Mock(return_value={"success": False, "error": message})
        w.mark_agent_infra_failure = Mock()
        w.mark_failure = Mock()
        w.increment_failed = Mock()
        with patch.object(worker, "log"):
            w._execute_classify_job(job)
        w.mark_agent_infra_failure.assert_called_once_with(job, message)
        w.mark_failure.assert_not_called()
        w.increment_failed.assert_not_called()

    def test_heartbeat_reports_the_active_routing_revision(self):
        w = worker.Worker.__new__(worker.Worker)
        w._caps = {}
        with patch.object(worker, "_has_claude", return_value=False), \
             patch.object(worker, "_has_codex", return_value=False):
            w.refresh_agent_capabilities()
        self.assertEqual(w._caps["local_audio_verification"], "local-only-v1")

    def test_skill_pipeline_uses_the_existing_checksum_safe_loader(self):
        root = Path(__file__).resolve().parents[1]
        for directory in ("team-skill", "public/team-skill"):
            skill = (root / directory / "SKILL.md").read_text()
            self.assertIn("decode_unicode, load_transcription_model, USER_AGENT", skill)
            self.assertIn("model = load_transcription_model(model_name)", skill)
            self.assertNotIn("model = whisper.load_model(model_name)", skill)

    def test_worker_advertises_route_and_published_copies_match(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "tools/classify_worker.py").read_bytes()
        self.assertEqual(source.count(b'"local_audio_verification": "local-only-v1"'), 2)
        for directory in ("team-skill", "public/team-skill"):
            self.assertEqual((root / directory / "classify_worker.py").read_bytes(), source)
            skill = (root / directory / "SKILL.md").read_text()
            self.assertIn("Do not use\nArcads", skill)
            self.assertIn("LOCAL_AUDIO_TOOL_UNAVAILABLE:", skill)
        self.assertEqual((root / "team-skill/SKILL.md").read_bytes(),
                         (root / "public/team-skill/SKILL.md").read_bytes())


if __name__ == "__main__":
    unittest.main()
