import { readFile, writeFile, mkdir, rename, chmod } from 'node:fs/promises';
import { createPrivateKey, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import path from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('Provide the local service-account JSON file path.');
let credentials;
try {
  credentials = JSON.parse(await readFile(file, 'utf8'));
  if (credentials.type !== 'service_account' || typeof credentials.client_email !== 'string'
    || credentials.token_uri !== 'https://oauth2.googleapis.com/token'
    || createPrivateKey(credentials.private_key).asymmetricKeyType !== 'rsa') throw new Error();
} catch {
  throw new Error('The file must contain a valid Google service-account JSON key.');
}
const target = path.resolve('.env.strategist.local');
const original = await readFile(target, 'utf8');
const env = parseEnv(original);
env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(credentials);
const text = Object.entries(env).map(([key, value]) => {
  if (value.includes("'")) throw new Error(`Cannot safely serialize ${key}; configuration was not changed.`);
  return `${key}='${value}'`;
}).join('\n') + '\n';
const parsed = parseEnv(text);
if (Object.keys(env).some(key => parsed[key] !== env[key])) throw new Error('Environment round-trip validation failed.');
const backup = path.resolve('backups/strategist-credentials', new Date().toISOString().replaceAll(':', '-'));
await mkdir(backup, { recursive: true, mode: 0o700 });
await writeFile(path.join(backup, 'previous.env'), original, { mode: 0o600 });
const temporary = `${target}.${randomUUID()}.local`;
await writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
await rename(temporary, target);
await chmod(target, 0o600);
console.log('Strategist Drive credential configured privately; previous configuration backed up.');
