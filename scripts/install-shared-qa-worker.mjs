import { mkdir, readFile, writeFile, chmod, stat, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes, createHash, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { privateWorkerHeaders } from '../lib/services/private-worker.js';
import { validateSharedWorkerConfig } from '../lib/services/shared-worker.js';
import { atomicJson, managedUpdatesEnabled, readReleaseState } from '../lib/services/shared-worker-updates.js';

process.umask(0o077);
if(process.platform!=='darwin')throw new Error('macOS required.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const label='com.immuvi.classify-worker.qa',domain=`gui/${process.getuid()}`;
const directory=join(homedir(),'Library/Application Support/Immuvi/Workers/qa-shared');
const runtimeHome=join(directory,'home'),configPath=join(directory,'device.json');
const plist=join(homedir(),'Library/LaunchAgents',`${label}.plist`),log=join(directory,'worker.log');
const mode=process.argv[2];
const launch=(args)=>execFileSync('/bin/launchctl',args,{stdio:'pipe',encoding:'utf8'});
if(mode==='--status') {
 try {console.log(launch(['print',`${domain}/${label}`]).split('\n').filter(l=>/^\s*(state|pid|runs|last exit code) =/.test(l)).join('\n'));}
 catch {console.log('Shared QA LaunchAgent is not loaded.');}
 try {await stat(configPath);console.log('Device paired (credentials not displayed).');}catch{console.log('Waiting for QA administrator enrollment.');}
 const state=await readReleaseState(directory);
 console.log(JSON.stringify({automaticUpdates:await managedUpdatesEnabled(directory),release:state.current||'bootstrap',pendingActivation:state.pending}));
 process.exit(0);
}
if(mode==='--enable-updates' || mode==='--disable-updates') {
 validateSharedWorkerConfig(JSON.parse(await readFile(configPath,'utf8')));
 await atomicJson(join(directory,'updates.json'),{schema:1,enabled:mode==='--enable-updates'});
 console.log(mode==='--enable-updates'?'Approved QA updates enabled. First activation requires an idle service restart.':'Automatic update discovery disabled; the installed release is retained.');
 process.exit(0);
}
if(mode==='--stop'){launch(['bootout',`${domain}/${label}`]);console.log('Only shared QA service stopped.');process.exit(0);}
if(mode==='--start'){launch(['bootstrap',domain,plist]);console.log('Shared QA service started.');process.exit(0);}
if(mode==='--restart'){launch(['kickstart','-k',`${domain}/${label}`]);console.log('Only shared QA service restarted; interrupted leases require review.');process.exit(0);}
if(mode==='--pause' || mode==='--resume') {
 await writeFile(join(directory,'paused'),mode==='--pause'?'1':'0',{mode:0o600});
 try {
  const config=validateSharedWorkerConfig(JSON.parse(await readFile(configPath,'utf8')));
  const client=createClient(config.url,config.anonKey,{auth:{persistSession:false},global:{headers:privateWorkerHeaders(config)}});
  const result=await client.rpc('qa_shared_worker_set_paused',{p_paused:mode==='--pause'});
  if(result.error)throw new Error('Local pause updated; database pause could not be confirmed.');
  // Once the database confirms pause, allow the app to resume it normally.
  // A failed network call keeps the local latch armed.
  await writeFile(join(directory,'paused'),'0',{mode:0o600});
 }catch(error){if(error.code!=='ENOENT')throw error;}
 console.log(mode==='--pause'?'Shared QA claims paused; active jobs finish.':'Shared QA resumed.');process.exit(0);
}
if(!['--prepare','--enroll'].includes(mode))throw new Error('Use --prepare, --enroll, --status, --start, --stop, --restart, --pause, --resume, --enable-updates or --disable-updates.');
for(const path of [directory,runtimeHome,join(runtimeHome,'.codex')]) {await mkdir(path,{recursive:true,mode:0o700});await chmod(path,0o700);}
const codexBin='/Applications/ChatGPT.app/Contents/Resources/codex';
if(mode==='--prepare') {
 // Refuse any pre-existing label; never replace an unknown service.
 try {await stat(plist);throw new Error('QA label already exists. Inspect it; use service-specific controls.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await writeFile(log,'',{flag:'a',mode:0o600});
 await writeFile(join(directory,'paused'),'1',{flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const agent={Label:label,ProgramArguments:[process.execPath,join(root,'scripts/shared-worker-launch.mjs'),configPath],
 WorkingDirectory:root,RunAtLoad:true,KeepAlive:true,ThrottleInterval:60,ExitTimeOut:30,
 StandardOutPath:log,StandardErrorPath:log,EnvironmentVariables:{HOME:runtimeHome,CODEX_HOME:join(runtimeHome,'.codex'),
 PATH:`${join(directory,'python/bin')}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,PYTHONNOUSERSITE:'1',WORKER_AUTO_UPDATE:'0'}};
 await mkdir(dirname(plist),{recursive:true});
 execFileSync('/usr/bin/plutil',['-convert','xml1','-o',plist,'-'],{input:JSON.stringify(agent)});
 await chmod(plist,0o600);
 console.log(JSON.stringify({label,directory,runtimeHome,configPath,log,prepared:true,paired:false}));
 process.exit(0);
}
// Interactive password stays in memory. No administrator session or service key is saved.
if(!process.stdin.isTTY)throw new Error('Run enrollment directly in Terminal. Do not pass credentials as arguments.');
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const input=createInterface({input:process.stdin,output,terminal:true});
const email=await input.question('QA administrator email: ');
process.stdout.write('QA password (hidden): ');muted=true;
const password=await input.question('');muted=false;process.stdout.write('\n');input.close();
const db=createClient(QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=await db.auth.signInWithPassword({email:email.trim(),password});
if(auth.error || !auth.data.user)throw new Error('QA sign-in failed.');
let config;
try {config=validateSharedWorkerConfig(JSON.parse(await readFile(configPath,'utf8')));}
catch(e){if(e.code!=='ENOENT')throw e;}
if(config && config.ownerId!==auth.data.user.id)throw new Error('Existing pairing belongs to another administrator.');
if(!config) {
 const keys=generateKeyPairSync('rsa',{modulusLength:3072,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 config=validateSharedWorkerConfig({version:1,environment:'qa',url:QA_SUPABASE_URL,anonKey:QA_SUPABASE_ANON_KEY,
 id:randomUUID(),ownerId:auth.data.user.id,token:randomBytes(32).toString('hex'),codexBin,
 scope:'shared',productId:'qa-sample-astrorekha',concurrency:1,runtimeHome,pythonBin:join(directory,'python/bin/python'),deliveryPrivateKey:keys.privateKey});
 // Save before registration, so an uncertain enrollment can be inspected safely.
 await writeFile(configPath,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
}
const registered=await db.rpc('qa_inspiration_workers_list',{p_product_id:config.productId});
if(registered.error)throw new Error('Apply and verify the shared QA migration first.');
if(!registered.data.some(w=>w.id===config.id)) {
 const enrolled=await db.rpc('qa_shared_worker_enroll',{p_id:config.id,p_owner:config.ownerId,
 p_hash:createHash('sha256').update(config.token).digest('hex'),p_public_key:createPublicKey(config.deliveryPrivateKey).export({type:'spki',format:'pem'})});
 if(enrolled.error)throw new Error('Administrator enrollment refused. Verify QA destination and account access.');
}
await db.auth.signOut();
console.log('Shared QA enrollment complete. Use --resume when ready. No administrator credentials were saved.');
