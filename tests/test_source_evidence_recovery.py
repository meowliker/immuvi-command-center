import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from tools import classify_worker as worker

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("source_helper", ROOT / "team-skill/fb_ad_classifier.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
URL = "https://adstransparency.google.com/advertiser/AR123/creative/CR456?region=anywhere"
ASSET = "https://tpc.googlesyndication.com/archive/simgad/123"


def evidence():
    return {"source_url": URL, "advertiser_id": "AR123", "creative_id": "CR456",
            "verification_source": "browser_exact_creative", "image_urls": [ASSET]}


class SourceEvidenceRecoveryTests(unittest.TestCase):
    def test_audio_accepts_supported_evidence_not_impossible_listening(self):
        text = worker.local_audio_contract({"no_brief": False})
        for phrase in ("inability to listen", "Agreement between two local passes",
                       "unresolved_spans", "label the transcript partial",
                       "core claim/offer/CTA", "AUDIO_TRANSCRIPT_UNVERIFIED"):
            self.assertIn(phrase, text)
        self.assertNotIn("BOUNDED TRANSCRIPT REVIEW", worker.local_audio_contract({"no_brief": True}))

    def test_google_identity_rejects_similar_hosts_and_noncreative_pages(self):
        self.assertEqual(helper.google_ad_identity(URL), ("AR123", "CR456"))
        for url in (URL.replace("https:", "http:"), URL.replace(".com/", ".com.evil/"),
                    "https://adstransparency.google.com/advertiser/AR123",
                    URL.replace("google.com/", "google.com:8443/")):
            with self.assertRaises(ValueError):
                helper.google_ad_identity(url)

    def test_review_requires_exact_source_and_allowlisted_image(self):
        self.assertEqual(helper.validate_google_image_evidence(URL, evidence()), [ASSET])
        for key, value in (("source_url", URL + "&other=1"), ("creative_id", "CR789"),
                           ("advertiser_id", "AR789"), ("verification_source", "guessed"),
                           ("image_urls", []), ("image_urls", ["https://127.0.0.1/1"]),
                           ("image_urls", [ASSET + "?redirect=elsewhere"]),
                           ("image_urls", [ASSET] * 11)):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                helper.validate_google_image_evidence(URL, {**evidence(), key: value})

    def test_worker_review_is_product_and_inspiration_scoped(self):
        job = {"ins_id": "INS-1", "product_id": "p1", "url": URL}
        row = {"id": "INS-1", "product_id": "p1", "url": URL, "google_media_review": evidence()}
        self.assertIn("Exact-source browser review", worker.google_ads_source_contract(job, row))
        for key in ("id", "product_id", "url"):
            with self.assertRaises(ValueError):
                worker.google_ads_source_contract(job, {**row, key: "other"})
        self.assertEqual(worker.google_ads_source_contract({"url": "https://facebook.com/"}, row), "")

    def test_verified_image_download_hashes_actual_bytes_without_browser(self):
        body = b"\x89PNG\r\n\x1a\nimage-fixture"
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = body
        opener = Mock()
        opener.open.return_value = response
        with tempfile.TemporaryDirectory() as out, patch.object(helper.urllib.request, "build_opener", return_value=opener), \
                patch.object(helper, "_google_image_evidence") as browser:
            result = helper.download_google_ad_images(URL, out, evidence())
            browser.assert_not_called()
            self.assertEqual(Path(result["frames"][0]).read_bytes(), body)
            self.assertEqual(result["metadata"]["source_asset_sha256"], [helper.hashlib.sha256(body).hexdigest()])
            self.assertEqual(result["duration"], 0)
        response.read.return_value = b"<html>not an image</html>"
        with tempfile.TemporaryDirectory() as out, patch.object(helper.urllib.request, "build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError, "not a supported image"):
                helper.download_google_ad_images(URL, out, evidence())

    def test_saved_review_cannot_verify_a_result_from_another_creative(self):
        w = worker.Worker.__new__(worker.Worker)
        w.sb = Mock()
        w.sb.select.side_effect = [
            [{"id": "INS-1", "url": URL, "data": {"googleMediaReview": evidence()}}],
            [{"source_url": URL, "frames_extracted": 1,
              "metadata": {"google_media_review": {**evidence(), "creative_id": "CR789"},
                           "source_asset_sha256": ["a" * 64]}}],
        ]
        ok, reason = w._verify_inspirations_row("INS-1", "p1")
        self.assertFalse(ok)
        self.assertIn("exact-creative evidence", reason)

    def test_shared_and_personal_guides_keep_same_policy(self):
        for name in ("team-skill/SKILL.md", "public/team-skill/SKILL.md", "public/personal-worker/GUIDE.md"):
            text = (ROOT / name).read_text()
            for marker in ("bounded-local-evidence-v1", "download_google_ad_images", "unresolved_spans"):
                self.assertIn(marker, text)
        self.assertEqual((ROOT / "tools/classify_worker.py").read_text().count(
            '"source_evidence_revision": "bounded-local-google-images-v1"'), 2)


if __name__ == "__main__":
    unittest.main()
