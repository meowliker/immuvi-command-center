import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {targetEnv} from '../scripts/strategist-env.mjs';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
process.chdir(root);
targetEnv();
const label='com.immuvi.strategist-app-worker';
const dir=path.join(homedir(),'Library','LaunchAgents');
const file=path.join(dir,`${label}.plist`);
const logs=path.join(root,'backups','strategist-worker');
await mkdir(dir,{recursive:true});await mkdir(logs,{recursive:true,mode:0o700});
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const previous=await readFile(file).catch(()=>null);
if(previous)await writeFile(path.join(logs,`launch-agent-${Date.now()}.plist`),previous,{mode:0o600});
await writeFile(file,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root,'scripts/strategist-worker.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(path.join(logs,'stdout.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(logs,'stderr.log'))}</string>
</dict></plist>\n`,{mode:0o600});
const domain=`gui/${process.getuid()}`;
const service=`${domain}/${label}`;
const isLoaded=()=>{
  try{execFileSync('launchctl',['print',service],{stdio:'ignore'});return true;}catch{return false;}
};
if(isLoaded()){
  execFileSync('launchctl',['bootout',service],{stdio:'pipe'});
  for(let attempt=0;attempt<40&&isLoaded();attempt++)await delay(250);
  if(isLoaded())throw new Error('The previous Strategist worker is still unloading; retry the setup shortly.');
}
// launchd can briefly report an unloaded service while its old registration is still being removed.
for(let attempt=0;;attempt++){
  try{execFileSync('launchctl',['bootstrap',domain,file],{stdio:'pipe'});break;}
  catch(error){
    if(attempt>=4||isLoaded()||!String(error.stderr).includes('Bootstrap failed: 5'))throw error;
    await delay(1000);
  }
}
console.log('Strategist worker installed and started.');
