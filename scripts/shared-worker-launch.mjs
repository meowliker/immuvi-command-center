import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
process.umask(0o077);
const path=process.argv[2];
if(!path)throw new Error('Shared QA configuration path required.');
console.log('Shared QA launcher started; awaiting local pairing if needed.');
for(;;){try{await access(path);break;}catch{await sleep(10000);}}
await import('./private-worker.mjs');
