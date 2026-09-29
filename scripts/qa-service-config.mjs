import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { QA_SUPABASE_URL } from '../lib/qa-supabase-env.js';

export function qaServiceKey({ fromCli = false } = {}) {
  if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp'
    || (process.env.QA_SUPABASE_URL && process.env.QA_SUPABASE_URL.replace(/\/$/, '') !== QA_SUPABASE_URL)) throw new Error('Refusing a non-QA project.');
  let key = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
  if (!key && fromCli) {
    try {
      const rows = JSON.parse(execFileSync('supabase', ['projects','api-keys','--project-ref','entgcnlfsnysnwyadzzp','-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
      key = rows.find((row) => row.name === 'service_role')?.api_key;
    } catch { throw new Error('QA service key lookup failed. Check the Supabase CLI session.'); }
  }
  if (!key) throw new Error('An explicit QA service key is required; --cli-key permits QA-only CLI lookup.');
  if (key.startsWith('eyJ')) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (claims.ref !== 'entgcnlfsnysnwyadzzp' || claims.role !== 'service_role') throw new Error();
    } catch { throw new Error('Service key does not belong to the approved QA project.'); }
  }
  return key;
}
