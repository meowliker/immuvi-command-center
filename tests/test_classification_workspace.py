import concurrent.futures
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from tools import classify_worker as module


class ClassificationWorkspaceTests(unittest.TestCase):
    def test_inaccessible_inherited_directory_is_not_used(self):
        original_env = dict(os.environ)
        seen = []

        def launch(cmd, **kwargs):
            workspace = Path(kwargs["cwd"])
            seen.append(workspace)
            self.assertTrue(workspace.is_absolute())
            self.assertTrue(workspace.is_dir())
            self.assertEqual(workspace.stat().st_mode & 0o777, 0o700)
            self.assertEqual(list(workspace.iterdir()), [])
            self.assertEqual(kwargs["env"]["PWD"], str(workspace))
            self.assertNotIn("OLDPWD", kwargs["env"])
            self.assertEqual(kwargs["env"]["CLASSIFY_TEST_VALUE"], "preserved")
            self.assertEqual(kwargs["timeout"], 123)
            return subprocess.CompletedProcess(cmd, 0, "OK", "")

        with patch.dict(os.environ, {"PWD": "/inaccessible/project", "OLDPWD": "/old/project",
                                    "CLASSIFY_TEST_VALUE": "preserved"}):
            with patch.object(module.os, "getcwd", side_effect=PermissionError("getcwd denied")), \
                 patch.object(module.os, "chdir", side_effect=AssertionError("Do not change global cwd")), \
                 patch.object(module.subprocess, "run", side_effect=launch):
                result = module.run_classification_agent(["agent", "prompt"], 123)
            self.assertEqual(os.environ["PWD"], "/inaccessible/project")
        self.assertEqual(result.stdout, "OK")
        self.assertFalse(seen[0].exists())
        self.assertEqual(dict(os.environ), original_env)

    def test_parallel_jobs_have_independent_workspaces(self):
        script = ("import json, os, pathlib, time; "
                  "p=pathlib.Path('job-only'); p.write_text('private'); time.sleep(.05); "
                  "print(json.dumps({'cwd':os.getcwd(),'pwd':os.environ['PWD'],'files':os.listdir()}))")
        import json
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda _: module.run_classification_agent(
                [sys.executable, "-c", script], 10), range(3)))
        values = [json.loads(r.stdout) for r in results]
        self.assertEqual(len({v["cwd"] for v in values}), 3)
        for result, value in zip(results, values):
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(value["pwd"], value["cwd"])
            self.assertEqual(value["files"], ["job-only"])
            self.assertFalse(Path(value["cwd"]).exists())

    def test_timeout_and_launch_failure_clean_only_the_job_workspace(self):
        for error in (subprocess.TimeoutExpired(["agent"], 1), PermissionError("denied")):
            seen = []
            def fail(cmd, **kwargs):
                seen.append(Path(kwargs["cwd"]))
                raise error
            with patch.object(module.subprocess, "run", side_effect=fail):
                with self.assertRaises(type(error)):
                    module.run_classification_agent(["agent"], 1)
            self.assertFalse(seen[0].exists())

    def test_codex_can_start_outside_a_repository(self):
        with patch.object(module, "_has_claude", return_value=False), \
             patch.object(module, "_has_codex", return_value=True), \
             patch.object(module, "_resolve_codex_bin", return_value="/agent/codex"):
            command = module.build_agent_cmd("exact job", prefer="codex")
        self.assertIn("--skip-git-repo-check", command)
        self.assertEqual(command[-1], "exact job")

    def test_worker_mirrors_and_both_classification_launches_use_isolation(self):
        root = Path(__file__).resolve().parent.parent
        worker = (root / "tools/classify_worker.py").read_bytes()
        for mirror in ("team-skill/classify_worker.py", "public/team-skill/classify_worker.py"):
            self.assertEqual((root / mirror).read_bytes(), worker)
        self.assertEqual(worker.count(b"r = run_classification_agent(cmd, CLAUDE_CLI_TIMEOUT_SECONDS)"), 2)


if __name__ == "__main__":
    unittest.main()
