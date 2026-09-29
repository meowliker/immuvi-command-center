import { execFileSync, spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { createServer } from 'node:net';
import { qaServiceKey } from './qa-service-config.mjs';
import { QA_SUPABASE_URL } from '../lib/qa-supabase-env.js';

if (execFileSync('git', ['branch','--show-current'], { encoding: 'utf8' }).trim() !== 'qa') throw new Error('Start this server only on qa.');
const requested = Number(process.argv[process.argv.indexOf('--port') + 1] || 3001);
let port = process.argv.includes('--port') ? requested : 3001;
if (!Number.isInteger(port) || port < 1024 || port > 65000) throw new Error('Invalid QA port.');
async function available(value) {
  return new Promise((resolve) => { const server = createServer(); server.once('error', () => resolve(false)); server.listen(value, '127.0.0.1', () => server.close(() => resolve(true))); });
}
while (!(await available(port))) { port++; if (port > 65000) throw new Error('No QA port available.'); }
const key = qaServiceKey({ fromCli: true });
const logPath = `/tmp/immuvi-qa-next-${port}.log`, fd = openSync(logPath, 'a', 0o600);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)], {
  detached: true, stdio: ['ignore',fd,fd],
  env: { ...process.env, QA_SUPABASE_URL, QA_SUPABASE_SERVICE_ROLE_KEY: key,
    SUPABASE_URL: QA_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: key, QA_NEXT_DIST_DIR: `.next-qa-${port}` },
});
child.unref(); closeSync(fd);
console.log(`QA server starting at http://127.0.0.1:${port}/ (PID ${child.pid}). Log: ${logPath}. Credentials stay in process memory.`);
console.log('Private workers run independently through their per-user LaunchAgent; this server does not start a shared worker.');
