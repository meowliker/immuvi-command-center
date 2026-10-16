import copy
import unittest
from unittest.mock import Mock

from tools import classify_worker as module


class DriveMediaSelectionTests(unittest.TestCase):
    def setUp(self):
        self.job = {"ins_id": "T-INS-119", "product_id": "therapy",
                    "url": "https://drive.google.com/drive/folders/folder123"}
        self.selection = {"source_url": self.job["url"], "file_id": "file_version_2",
                          "file_name": "reference-2.mp4", "verification_source": "user_selection"}
        self.row = {"id": self.job["ins_id"], "product_id": self.job["product_id"],
                    "url": self.job["url"], "drive_media_selection": self.selection}

    def test_unselected_jobs_keep_existing_behavior(self):
        for url in [self.job["url"], "https://instagram.com/reel/example", "https://drive.google.com/file/d/video/view"]:
            self.assertEqual(module.drive_media_selection_contract({**self.job, "url": url}, {}), "")

    def test_selection_is_exact_source_product_and_inspiration_scoped(self):
        for field in ["id", "product_id", "url"]:
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    module.selected_drive_media(self.job, {**self.row, field: "other"})
        for field, value in [("source_url", "https://other.example"), ("file_id", "../other"),
                             ("file_name", ""), ("file_name", "bad\nname"), ("verification_source", "media_text")]:
            selection = {**self.selection, field: value}
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                module.selected_drive_media(self.job, {**self.row, "drive_media_selection": selection})

    def test_contract_requires_only_selected_file_without_source_replacement(self):
        contract = module.drive_media_selection_contract(self.job, self.row)
        for text in ["file_version_2", "reference-2.mp4", "ONLY", "Do not substitute",
                     "Keep the original folder URL", "existing inspiration brief page",
                     "Preserve added-by/time", "selected_drive_file_sha256", "Do not change taxonomy"]:
            self.assertIn(text, contract)

    def test_existing_result_cannot_skip_new_selection(self):
        worker = module.Worker.__new__(module.Worker)
        worker.sb = Mock()
        data = {"sourceMediaSelection": self.selection}
        worker.sb.select.side_effect = [
            [{"id": self.job["ins_id"], "url": self.job["url"], "data": data}],
            [{"source_url": self.job["url"], "metadata": {}}],
        ]
        self.assertEqual(worker._verify_inspirations_row(self.job["ins_id"], "therapy"),
                         (False, "Selected Drive media is missing matching file-specific analysis"))
        worker.sb.update.assert_not_called()

    def test_lost_selection_cannot_bypass_final_verification(self):
        worker = module.Worker.__new__(module.Worker)
        worker.sb = Mock()
        worker.sb.select.return_value = [{"id": self.job["ins_id"], "url": self.job["url"], "data": {}}]
        self.assertEqual(worker._verify_inspirations_row(self.job["ins_id"], "therapy",
                         expected_drive_selection=self.selection),
                         (False, "Selected Drive media confirmation changed or was lost"))
        worker.sb.update.assert_not_called()

    def test_wrong_file_hash_name_or_selection_is_rejected(self):
        data = {"sourceMediaSelection": self.selection, "selectedMediaFileId": self.selection["file_id"],
                "selectedMediaFileName": self.selection["file_name"]}
        metadata = {"drive_media_selection": self.selection, "selected_drive_file_id": self.selection["file_id"],
                    "selected_drive_file_name": self.selection["file_name"], "selected_drive_file_sha256": "a" * 64}
        metadata.update(primary_media={"id": self.selection["file_id"], "name": self.selection["file_name"],
                                       "sha256": "a" * 64}, source_assets=[{"file_name": self.selection["file_name"]}])
        for key, value in [("selected_drive_file_id", "version_1"), ("selected_drive_file_name", "reference-1.mp4"),
                           ("selected_drive_file_sha256", ""), ("drive_media_selection", {})]:
            worker = module.Worker.__new__(module.Worker)
            worker.sb = Mock()
            worker.sb.select.side_effect = [
                [{"id": self.job["ins_id"], "url": self.job["url"], "data": copy.deepcopy(data)}],
                [{"source_url": self.job["url"], "metadata": {**metadata, key: value}}],
            ]
            self.assertFalse(worker._verify_inspirations_row(self.job["ins_id"], "therapy")[0])
            worker.sb.update.assert_not_called()

    def test_matching_selection_continues_through_normal_brief_validation(self):
        worker = module.Worker.__new__(module.Worker)
        worker.sb = Mock()
        data = {"sourceMediaSelection": self.selection, "selectedMediaFileId": self.selection["file_id"],
                "selectedMediaFileName": self.selection["file_name"]}
        metadata = {"drive_media_selection": self.selection, "selected_drive_file_id": self.selection["file_id"],
                    "selected_drive_file_name": self.selection["file_name"], "selected_drive_file_sha256": "a" * 64}
        metadata.update(primary_media={"id": self.selection["file_id"], "name": self.selection["file_name"],
                                       "sha256": "a" * 64}, source_assets=[{"file_name": self.selection["file_name"]}])
        worker.sb.select.side_effect = [
            [{"id": self.job["ins_id"], "url": self.job["url"], "data": data}],
            [{"source_url": self.job["url"], "metadata": metadata}],
        ]
        worker._repair_static_hook_caption_duplication = Mock(return_value=(data, False))
        ok, error = worker._verify_inspirations_row(self.job["ins_id"], "therapy")
        self.assertFalse(ok)
        self.assertIn("missing fields", error)
        worker.sb.update.assert_not_called()


if __name__ == "__main__":
    unittest.main()
