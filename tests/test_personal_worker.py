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
                self.assertEqual(len(kwargs['input'].splitlines()), 1)
                self.assertTrue(kwargs['input'].startswith('add-generic-password '))
                self.assertNotIn('quit', kwargs['input'])
            else:
                import base64
                response.stdout = base64.urlsafe_b64encode(json.dumps(saved).encode()).decode()
            return response
        with patch.object(worker.subprocess, 'run', side_effect=run):
            worker.keychain(False, saved)

    def test_keychain_write_failure_stops_without_readback_or_secret_output(self):
        response = type('Response', (), {'returncode': 1})()
        with patch.object(worker.subprocess, 'run', return_value=response) as run:
            with self.assertRaisesRegex(RuntimeError, 'Could not save credentials') as error:
                worker.keychain(False, {'token': 'fixture-token', 'clickupKey': 'fixture-key'})
        self.assertEqual(run.call_count, 1)
        self.assertNotIn('fixture-token', str(error.exception))
        self.assertNotIn('fixture-key', str(error.exception))

    def test_keychain_readback_must_match(self):
        import base64
        response = type('Response', (), {'returncode': 0, 'stdout': base64.urlsafe_b64encode(b'{}').decode()})()
        with patch.object(worker.subprocess, 'run', return_value=response):
            with self.assertRaisesRegex(RuntimeError, 'Keychain readback failed'):
                worker.keychain(False, {'token': 'fixture-token', 'clickupKey': 'fixture-key'})

    def test_resume_verifies_saved_device_without_consuming_pairing_code(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / 'private-worker'; root.mkdir()
            saved = {'token': 'fixture-token', 'clickupKey': 'fixture-key'}
            with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.Path, 'home', return_value=home), \
                    patch.object(worker, 'ROOT', root), patch.object(worker, 'find_agent'), \
                    patch.object(worker, 'keychain', return_value=saved) as keychain, \
                    patch.object(worker, 'request', return_value={'ok': True}) as request, \
                    patch.object(worker.getpass, 'getpass', side_effect=AssertionError('Must not prompt')), \
                    patch.object(worker.subprocess, 'run') as run:
                worker.setup(resume=True)
            keychain.assert_called_once_with()
            request.assert_called_once_with('heartbeat', {'token': 'fixture-token'})
            self.assertEqual(run.call_args_list[-1].args[0][:2], ['launchctl', 'bootstrap'])
            launch = home / 'Library/LaunchAgents' / (worker.SERVICE + '.plist')
            self.assertTrue(launch.is_file())
            self.assertEqual(launch.stat().st_mode & 0o777, 0o600)
            self.assertNotIn(b'fixture-token', launch.read_bytes())
            self.assertNotIn(b'fixture-key', launch.read_bytes())

    def test_resume_missing_or_revoked_credentials_never_starts_service(self):
        for saved in (None, {}, {'token': 'fixture-token', 'clickupKey': 'fixture-key'}):
            with self.subTest(saved=saved), tempfile.TemporaryDirectory() as tmp:
                home = Path(tmp)
                with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.Path, 'home', return_value=home), \
                        patch.object(worker, 'find_agent'), patch.object(worker, 'keychain', return_value=saved), \
                        patch.object(worker, 'request', side_effect=worker.ServiceError(401)), \
                        patch.object(worker.subprocess, 'run') as run:
                    with self.assertRaises(RuntimeError):
                        worker.setup(resume=True)
                run.assert_not_called()
                self.assertFalse((home / 'Library/LaunchAgents' / (worker.SERVICE + '.plist')).exists())

    def test_setup_cannot_replace_an_existing_service(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            launch = home / 'Library/LaunchAgents' / (worker.SERVICE + '.plist')
            launch.parent.mkdir(parents=True); launch.write_text('existing-worker')
            with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.Path, 'home', return_value=home), \
                    patch.object(worker, 'keychain') as keychain, patch.object(worker, 'request') as request:
                with self.assertRaisesRegex(RuntimeError, 'already installed'):
                    worker.setup(resume=True)
            keychain.assert_not_called(); request.assert_not_called()
            self.assertEqual(launch.read_text(), 'existing-worker')

    def test_rejected_artifact_is_retained_and_does_not_strand_classifying(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            worker.atomic_json(root/'pending-result.json',{'job':{'id':'fixture-job','lease':'fixture-lease','no_brief':True},'result':{}})
            operations=[]
            def request(op,credentials,**payload):
                operations.append(op)
                if op=='complete':
                    raise worker.ServiceError(400)
                self.assertEqual(op,'fail')
                self.assertEqual(payload['code'],'EVIDENCE_UNVERIFIED')
                worker.STOP.set()
                return {'ok':True}
            class Thread:
                def __init__(self,**kwargs): pass
                def start(self): pass
            worker.STOP.clear()
            try:
                with patch.object(worker,'ROOT',root),patch.object(worker,'keychain',return_value={'token':'fixture-token'}),patch.object(worker,'request',side_effect=request),patch.object(worker.threading,'Thread',Thread):
                    worker.run()
                self.assertEqual(operations,['complete','fail'])
                self.assertFalse((root/'pending-result.json').exists())
                self.assertEqual(len(list(root.glob('review-*.json'))),1)
            finally:
                worker.STOP.clear()


if __name__ == '__main__':
    unittest.main()
