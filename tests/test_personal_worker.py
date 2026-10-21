import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('personal_worker', Path(__file__).parents[1] / 'tools/personal-worker/worker.py')
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class PersonalWorkerTests(unittest.TestCase):
    def test_child_environment_never_inherits_backend_or_device_credentials(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.dict(os.environ, {'SUPABASE_SERVICE_ROLE_KEY': 'secret-admin', 'CLICKUP_API_KEY': 'secret-clickup',
                                         'DEVICE_TOKEN': 'secret-device', 'OLDPWD': '/private/old-project'}):
                env = worker.agent_environment(Path(tmp), 'claude')
            for key in ('SUPABASE_SERVICE_ROLE_KEY', 'CLICKUP_API_KEY', 'DEVICE_TOKEN', 'OLDPWD'):
                self.assertNotIn(key, env)
            self.assertEqual(env['PWD'], tmp)
            self.assertEqual(env['IMMUVI_DISABLE_BROWSER_COOKIES'], '1')

    def test_one_job_artifact_and_isolated_workspace_without_shared_skill(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            for name in ('GUIDE.md', 'fb_ad_classifier.py'):
                (root / name).write_text('test')
            class Process:
                returncode = 0
                def __init__(self, command, **kwargs):
                    self.command = command
                    self.cwd = kwargs['cwd']
                    self.env = kwargs['env']
                    assert kwargs['start_new_session']
                    assert json.loads((self.cwd / 'job.json').read_text())['ins_id'] == 'TEST-INS-1'
                    assert 'do not run /classify-inspiration' in command[-1].lower()
                def communicate(self, **kwargs):
                    (self.cwd / 'result.json').write_text('{"verified":"fixture"}')
                    return '', ''
            with patch.object(worker, 'ROOT', root), patch.object(worker, 'find_agent', return_value=('claude', '/fake/claude')), patch.object(worker.subprocess, 'Popen', Process):
                result, failure = worker.analyze({'ins_id': 'TEST-INS-1'})
                self.assertEqual(result, {'verified': 'fixture'})
                self.assertIsNone(failure)

    def test_keychain_secret_is_passed_on_stdin_not_arguments(self):
        saved = {'token': 'private-token', 'clickupKey': 'private-key'}
        class Response:
            returncode = 0
            stdout = ''
        def run(command, **kwargs):
            response = Response()
            if '-i' in command:
                self.assertNotIn('private-token', ' '.join(command))
                self.assertIn('input', kwargs)
            else:
                import base64
                response.stdout = base64.urlsafe_b64encode(json.dumps(saved).encode()).decode()
            return response
        with patch.object(worker.subprocess, 'run', side_effect=run):
            worker.keychain(False, saved)


if __name__ == '__main__':
    unittest.main()
