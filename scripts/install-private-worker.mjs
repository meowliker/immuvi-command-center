import { mkdir, readFile, writeFile, chmod, stat, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { qaServiceKey } from './qa-service-config.mjs';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
import { validatePrivateWorkerConfig } from '../lib/services/private-worker.js';
import { discoverCodexExecutable } from '../lib/services/codex-executable.js';

if (process.platform !== 'darwin') throw new Error('This installer is for a per-user macOS LaunchAgent.');
process.umask(0o077);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const label = 'com.immuvi.personal-worker.qa', domain = `gui/${process.getuid()}`;
const directory = join(homedir(), 'Library/Application Support/Immuvi/Workers/qa-personal');
const configPath = join(directory, 'device.json');
const plist = join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
if (process.argv.includes('--stop')) {
  execFileSync('launchctl', ['bootout', `${domain}/${label}`]);
  console.log('Private QA worker stopped. Existing strategist and legacy services were not changed.');
  process.exit(0);
}
if (process.argv.includes('--start')) {
  execFileSync('launchctl', ['bootstrap', domain, plist]);
  console.log('Private QA worker started.');
  process.exit(0);
}
if (process.argv.includes('--status')) {
  const output = execFileSync('launchctl', ['print', `${domain}/${label}`], { encoding: 'utf8' });
  console.log(output.split('\n').filter(line => /^\s*(state|pid|runs|last exit code) =/.test(line)).join('\n'));
  process.exit(0);
}
const username = process.argv.find(value => value.startsWith('--owner='))?.slice(8);
if (!username) throw new Error('Specify the exact QA login with --owner=<username>.');
const db = createClient(QA_SUPABASE_URL, qaServiceKey({ fromCli: true }), { auth: { persistSession: false, autoRefreshToken: false } });
const profile = await db.from('profiles').select('id,is_active,must_change_password').eq('username', username).single();
if (profile.error || !profile.data.is_active || profile.data.must_change_password) throw new Error('Owner must be an active, password-cleared QA account.');
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
let config;
try { config = validatePrivateWorkerConfig(JSON.parse(await readFile(configPath, 'utf8'))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (config && config.ownerId !== profile.data.id) throw new Error('This device is already paired to another owner; refusing reassignment.');
if (!config) {
  const codexBin = await discoverCodexExecutable();
  config = validatePrivateWorkerConfig({ version: 1, environment: 'qa', url: QA_SUPABASE_URL, anonKey: QA_SUPABASE_ANON_KEY,
    id: randomUUID(), ownerId: profile.data.id, token: randomBytes(32).toString('hex'), codexBin });
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
await chmod(configPath, 0o600);
if (!config.deliveryPrivateKey) {
  const pair = generateKeyPairSync('rsa', { modulusLength:3072, privateKeyEncoding:{type:'pkcs8',format:'pem'}, publicKeyEncoding:{type:'spki',format:'pem'} });
  config.deliveryPrivateKey = pair.privateKey;
}
config.pythonBin = join(directory,'python/bin/python');
await writeFile(configPath + '.next', JSON.stringify(config,null,2)+'\n',{mode:0o600});
await rename(configPath + '.next',configPath);
const deliveryPublicKey = createPublicKey(config.deliveryPrivateKey).export({type:'spki',format:'pem'});
const existing = await db.from('qa_private_workers').select('id,owner_id,name').eq('id', config.id).maybeSingle();
if (existing.error) throw new Error('Apply the private-worker migration before installing.');
if (existing.data && existing.data.owner_id !== config.ownerId) throw new Error('Registered device owner mismatch.');
const name = process.argv.find(value => value.startsWith('--name='))?.slice(7) || existing.data?.name || `${username}'s Mac (private)`;
if (!name.trim() || name.length > 100) throw new Error('Worker name must be 1-100 characters.');
const record = { id: config.id, owner_id: config.ownerId, name, delivery_public_key:deliveryPublicKey,
  token_hash: createHash('sha256').update(config.token).digest('hex') };
const registration = existing.data
  ? await db.from('qa_private_workers').update({ name: record.name, token_hash: record.token_hash,delivery_public_key:deliveryPublicKey }).eq('id', config.id).eq('owner_id', config.ownerId)
  : await db.from('qa_private_workers').insert(record);
if (registration.error) throw new Error('Private device registration failed.');
await mkdir(dirname(plist), { recursive: true });
const log = join(directory, 'worker.log');
try { if ((await stat(log)).size > 5 * 1024 * 1024) await rename(log, log + '.previous'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(log, '', { flag: 'a', mode: 0o600 });
await chmod(log, 0o600);
const agent = { Label: label, ProgramArguments: [process.execPath, join(root, 'scripts/private-worker.mjs'), configPath],
  WorkingDirectory: root, RunAtLoad: true, KeepAlive: true, ThrottleInterval: 60, ExitTimeOut: 20,
  StandardOutPath: log, StandardErrorPath: log,
  EnvironmentVariables: { HOME: homedir(), PATH: `${dirname(config.codexBin)}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin` } };
execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', plist, '-'], { input: JSON.stringify(agent) });
await chmod(plist, 0o600);
// Only replace our exact private label. Never pkill workers or unload legacy agents.
try { execFileSync('launchctl', ['bootout', `${domain}/${label}`], { stdio: 'pipe' }); } catch {}
// launchd may retain an exiting job briefly after bootout returns.
for (let attempt=0;;attempt++) {
  try { execFileSync('launchctl', ['bootstrap', domain, plist],{stdio:'pipe'});break; }
  catch { if(attempt===5)throw new Error('Private service registration is still busy. Run this installer with --start after the old process exits.');await sleep(2000); }
}
console.log(JSON.stringify({ installed: true, environment: 'qa', owner: username, deviceId: config.id, label, log,
  launch: 'Starts at macOS login; restarts after failure. No shared/Auto queue access.' }, null, 2));
