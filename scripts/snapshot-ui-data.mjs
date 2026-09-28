import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

// Read-only audit. Raw backups stay outside the repository and are never logged.
const [envPath, destination, previous] = process.argv.slice(2);
if (!envPath || !destination) throw new Error('Usage: snapshot-ui-data.mjs ENV DEST [PREVIOUS]');
const env = parseEnv(readFileSync(envPath, 'utf8'));
mkdirSync(destination, {recursive: true, mode: 0o700});
const tables = ['products', 'angles', 'personas', 'ads', 'manual_actions', 'matrix_cells', 'inspirations', 'inspiration_results', 'inspiration_queue', 'deleted_ads'];
const manifest = {at: new Date().toISOString(), tables: {}};
for (const table of tables) {
  const rows = [];
  for (let offset = 0;; offset += 500) {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=500`, {
      headers: {apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 500) break;
  }
  const content = JSON.stringify(rows);
  writeFileSync(join(destination, table + '.json'), content, {mode: 0o600});
  const info = {count: rows.length, sha256: createHash('sha256').update(content).digest('hex'), missing: [], moved: [], changed: 0, added: 0};
  if (previous) {
    const before = JSON.parse(readFileSync(join(previous, table + '.json'), 'utf8'));
    const after = new Map(rows.map(row => [String(row.id), row]));
    const priorIds = new Set(before.map(row => String(row.id)));
    for (const row of before) {
      const now = after.get(String(row.id));
      if (!now) info.missing.push(row.id);
      else {
        if (row.product_id !== now.product_id) info.moved.push(row.id);
        if (JSON.stringify(row) !== JSON.stringify(now)) info.changed++;
      }
    }
    info.added = rows.filter(row => !priorIds.has(String(row.id))).length;
  }
  manifest.tables[table] = info;
  console.log(table, JSON.stringify({count: info.count, missing: info.missing.length, moved: info.moved.length, changed: info.changed, added: info.added}));
}
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), {mode: 0o600});
