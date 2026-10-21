import json
import os
from pathlib import Path
import pty
import plistlib
import select
import sys
import tempfile
import time
import unittest

REPO=Path(__file__).parents[1]
INSTALLER=REPO/'tools/personal-worker/install.sh'


class InstallerTests(unittest.TestCase):
    def run_installer(self, *, pip_failure=False, already_installed=False, resume=False, environment=True, repair=False):
        with tempfile.TemporaryDirectory(prefix='immuvi-installer-test-') as tmp:
            base=Path(tmp); home=base/'Fixture Home'; home.mkdir(); binaries=base/'bin'; binaries.mkdir()
            log=base/'commands.jsonl'
            stub='#!'+sys.executable+'\n'+r'''
import hashlib,json,os,pathlib,sys,plistlib
args=sys.argv[1:]; name=pathlib.Path(sys.argv[0]).name
with open(os.environ['FAKE_LOG'],'a') as f: f.write(json.dumps([name,args])+'\n')
if name=='uname': print('Darwin')
elif name=='brew':
    print('Unexpected Homebrew mutation; existing tools must be reused',file=sys.stderr)
    sys.exit(88)
elif name in ('ffmpeg','ffprobe'): pass
elif name=='launchctl':
    state=pathlib.Path(os.environ['FAKE_SERVICE'])
    if args[0]=='print':
        if state.read_text()=='running': print('    pid = 12345')
    elif args[0]=='kill':
        assert args[1]=='SIGTERM'; state.write_text('stopped')
    elif args[0]=='bootout': state.write_text('unloaded')
    elif args[0]=='bootstrap': state.write_text('running')
    else: sys.exit(91)
elif name=='curl':
    out=pathlib.Path(args[args.index('-o')+1])
    out.write_bytes((pathlib.Path(os.environ['ASSETS'])/'manifest.json').read_bytes())
elif args and args[0]=='-c': pass
elif args and args[0]=='-':
    if args[1].endswith('.plist'):
        payload=plistlib.loads(pathlib.Path(args[1]).read_bytes()); root=pathlib.Path(args[2])
        assert payload['ProgramArguments']==[str(root/'venv/bin/python'),str(root/'worker.py'),'run']
    else:
        stage=pathlib.Path(args[2]); assets=pathlib.Path(os.environ['ASSETS'])
        manifest=json.loads((stage/'manifest.json').read_text())
        for filename,checksum in manifest['files'].items():
            content=(assets/filename).read_bytes()
            assert hashlib.sha256(content).hexdigest()==checksum
            (stage/filename).write_bytes(content)
elif args[:2]==['-m','venv']:
    target=pathlib.Path(args[2])/'bin'; target.mkdir(parents=True,exist_ok=True)
    (target/'python').symlink_to(pathlib.Path(sys.argv[0]).resolve())
elif args[:2]==['-m','pip']:
    if os.environ.get('FAKE_PIP_FAILURE')=='1': sys.exit(42)
elif args[:2]==['-m','playwright']: pass
elif args and args[-1] in ('check','setup','resume-setup','diagnose'): pass
elif args[-2:]==['diagnose','--resume']: pass
else: sys.exit(89)
'''
            for name in ('uname','brew','python3.12','ffmpeg','ffprobe','curl','launchctl'):
                file=binaries/name; file.write_text(stub); file.chmod(0o700)
            if (resume or repair) and environment:
                venv=home/'Library/Application Support/Immuvi Personal Worker/venv/bin'
                venv.mkdir(parents=True); (venv/'python').symlink_to(binaries/'python3.12')
            marker=home/'Library/LaunchAgents/com.immuvi.personal-classifier.plist'
            if already_installed:
                root=home/'Library/Application Support/Immuvi Personal Worker'
                marker.parent.mkdir(parents=True); marker.write_bytes(plistlib.dumps({'Label':'com.immuvi.personal-classifier',
                    'ProgramArguments':[str(root/'venv/bin/python'),str(root/'worker.py'),'run']}))
            original_plist=marker.read_bytes() if marker.exists() else None
            service=base/'service-state';service.write_text('running')
            root=home/'Library/Application Support/Immuvi Personal Worker'
            if repair:
                root.mkdir(parents=True,exist_ok=True)
                (root/'worker.py').write_text('original worker')
                (root/'pending-result.json').write_text('retained result must not change')
            env={**os.environ,'HOME':str(home),'PATH':str(binaries)+os.pathsep+os.environ['PATH'],
                 'FAKE_LOG':str(log),'ASSETS':str(REPO/'public/personal-worker'),
                 'FAKE_PIP_FAILURE':'1' if pip_failure else '0','FAKE_SERVICE':str(service)}
            pid,fd=pty.fork()
            if pid==0:
                os.execve('/bin/bash',['/bin/bash',str(INSTALLER)]+(['--repair'] if repair else ['--resume-pairing'] if resume else []),env)
            output=b''; deadline=time.monotonic()+20
            try:
                while time.monotonic()<deadline:
                    ready,_,_=select.select([fd],[],[],1)
                    if not ready: continue
                    try: chunk=os.read(fd,65536)
                    except OSError: break
                    if not chunk: break
                    output+=chunk
                else:
                    os.kill(pid,9)
                    self.fail('Installer fixture timed out')
            finally:
                os.close(fd); _,status=os.waitpid(pid,0)
            commands=[json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            self.assertEqual(marker.read_bytes() if marker.exists() else None,original_plist)
            if repair and already_installed:
                self.assertEqual((root/'pending-result.json').read_text(),'retained result must not change')
                self.assertEqual(service.read_text(),'running')
                if pip_failure:self.assertEqual((root/'worker.py').read_text(),'original worker')
            return os.waitstatus_to_exitcode(status),output.decode(),commands

    def test_existing_tools_are_reused_without_homebrew_upgrades_or_link_repairs(self):
        code,output,commands=self.run_installer()
        self.assertEqual(code,0,output)
        self.assertFalse(any(name=='brew' for name,_ in commands))
        self.assertTrue(any(args[:2]==['-m','venv'] for _,args in commands))
        self.assertTrue(any(args[:2]==['-m','pip'] for _,args in commands))
        self.assertEqual(commands[-1][1][-1],'setup')
        self.assertIn('Ready to pair',output)

    def test_dependency_failure_reports_stage_and_never_proceeds_to_pairing(self):
        code,output,commands=self.run_installer(pip_failure=True)
        self.assertEqual(code,42,output)
        self.assertIn('installing private Python dependencies',output)
        self.assertFalse(any(args and args[-1]=='setup' for _,args in commands))

    def test_existing_worker_is_not_replaced_or_repaired_implicitly(self):
        code,output,commands=self.run_installer(already_installed=True)
        self.assertEqual(code,1,output)
        self.assertIn('already installed',output)
        self.assertFalse(any(name in ('brew','curl','python3.12') for name,_ in commands))

    def test_resume_downloads_verified_files_without_dependency_install_or_new_pairing(self):
        code,output,commands=self.run_installer(resume=True)
        self.assertEqual(code,0,output)
        self.assertFalse(any(name=='brew' for name,_ in commands))
        self.assertFalse(any(args and args[0]=='-m' for _,args in commands))
        self.assertEqual(commands[-1][1][-1],'resume-setup')
        self.assertFalse(any(args and args[-1] in ('check','setup') for _,args in commands))

    def test_resume_missing_environment_stops_without_downloading_or_pairing(self):
        code,output,commands=self.run_installer(resume=True,environment=False)
        self.assertEqual(code,1,output)
        self.assertIn('private worker environment is missing',output)
        self.assertFalse(any(name in ('brew','curl','python3.12') for name,_ in commands))

    def test_explicit_repair_drains_updates_and_preserves_pairing_and_journal(self):
        code,output,commands=self.run_installer(repair=True,already_installed=True)
        self.assertEqual(code,0,output)
        service=[args[0] for name,args in commands if name=='launchctl']
        self.assertLess(service.index('kill'),service.index('bootout'))
        self.assertLess(service.index('bootout'),service.index('bootstrap'))
        self.assertFalse(any(args and args[-1] in ('setup','resume-setup') for _,args in commands))
        self.assertFalse(any(args[:2]==['-m','venv'] for _,args in commands))
        self.assertTrue(any(args[-2:]==['diagnose','--resume'] for _,args in commands))

    def test_failed_repair_restores_previous_files_and_restarts_existing_service(self):
        code,output,commands=self.run_installer(repair=True,already_installed=True,pip_failure=True)
        self.assertEqual(code,42,output)
        self.assertEqual(commands[-1][0],'launchctl')
        self.assertEqual(commands[-1][1][0],'bootstrap')


if __name__=='__main__':
    unittest.main()
