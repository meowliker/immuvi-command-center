import json
import os
from pathlib import Path
import pty
import select
import sys
import tempfile
import time
import unittest

REPO=Path(__file__).parents[1]
INSTALLER=REPO/'tools/personal-worker/install.sh'


class InstallerTests(unittest.TestCase):
    def run_installer(self, *, pip_failure=False, already_installed=False):
        with tempfile.TemporaryDirectory(prefix='immuvi-installer-test-') as tmp:
            base=Path(tmp); home=base/'Fixture Home'; home.mkdir(); binaries=base/'bin'; binaries.mkdir()
            log=base/'commands.jsonl'
            stub='#!'+sys.executable+'\n'+r'''
import hashlib,json,os,pathlib,sys
args=sys.argv[1:]; name=pathlib.Path(sys.argv[0]).name
with open(os.environ['FAKE_LOG'],'a') as f: f.write(json.dumps([name,args])+'\n')
if name=='uname': print('Darwin')
elif name=='brew':
    print('Unexpected Homebrew mutation; existing tools must be reused',file=sys.stderr)
    sys.exit(88)
elif name in ('ffmpeg','ffprobe'): pass
elif name=='curl':
    out=pathlib.Path(args[args.index('-o')+1])
    out.write_bytes((pathlib.Path(os.environ['ASSETS'])/'manifest.json').read_bytes())
elif args and args[0]=='-c': pass
elif args and args[0]=='-':
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
elif args and args[-1] in ('check','setup'): pass
else: sys.exit(89)
'''
            for name in ('uname','brew','python3.12','ffmpeg','ffprobe','curl'):
                file=binaries/name; file.write_text(stub); file.chmod(0o700)
            marker=home/'Library/LaunchAgents/com.immuvi.personal-classifier.plist'
            if already_installed:
                marker.parent.mkdir(parents=True); marker.write_text('preserve-existing-worker')
            env={**os.environ,'HOME':str(home),'PATH':str(binaries)+os.pathsep+os.environ['PATH'],
                 'FAKE_LOG':str(log),'ASSETS':str(REPO/'public/personal-worker'),
                 'FAKE_PIP_FAILURE':'1' if pip_failure else '0'}
            pid,fd=pty.fork()
            if pid==0:
                os.execve('/bin/bash',['/bin/bash',str(INSTALLER)],env)
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
            self.assertEqual(marker.read_text() if marker.exists() else None,
                             'preserve-existing-worker' if already_installed else None)
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


if __name__=='__main__':
    unittest.main()
