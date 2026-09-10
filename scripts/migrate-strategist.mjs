import postgres from 'postgres';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceEnv, targetEnv } from './strategist-env.mjs';

const file = process.argv.find(a => a.startsWith('--source-env='))?.slice(13);
if (!file) throw new Error('Pass --source-env=/path/to/source-env.rtf');
const apply = process.argv.includes('--apply');
const source = sourceEnv(file);
const target = targetEnv();
if (source.SUPABASE_URL === target.SUPABASE_URL) throw new Error('Source and target must be different projects');
const tables = ['tasks', 'creatives', 'transcripts', 'frame_texts', 'observations', 'verdicts', 'keywords', 'sync_runs', 'research', 'synthesis'];
const options = { prepare: false, max: 1, connect_timeout: 20, ssl: 'require', onnotice: () => {} };
const src = postgres(source.DATABASE_URL, options);
const dst = postgres(target.STRATEGIST_DATABASE_URL, options);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `backups/strategist-migration-${stamp}`;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function digest(rows) {
  return createHash('sha256').update(rows.map(row => JSON.stringify(stable(row))).sort().join('\n')).digest('hex');
}
const report = { createdAt: stamp, sourceProject: new URL(source.SUPABASE_URL).hostname, targetProject: new URL(target.SUPABASE_URL).hostname, tables: {}, existingTables: {}, applied: false };
try {
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const data = {};
  await src.begin('isolation level repeatable read read only', async tx => {
    const actual = await tx`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`;
    const unknown = actual.map(r => r.table_name).filter(t => !tables.includes(t));
    if (unknown.length) throw new Error(`Source has additional tables requiring review: ${unknown.join(', ')}`);
    for (const table of tables) {
      data[table] = (await tx`select to_jsonb(t) as row from ${tx('public.' + table)} t`).map(r => r.row);
      const schema = await tx`select column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
      await writeFile(`${backup}/${table}.json`, JSON.stringify(data[table]), { mode: 0o600 });
      await writeFile(`${backup}/${table}.schema.json`, JSON.stringify(schema, null, 2), { mode: 0o600 });
      report.tables[table] = { target: `strategist_${table}`, rows: data[table].length, sha256: digest(data[table]), columns: schema.map(c => c.column_name) };
      console.log(`${table}: ${data[table].length} rows backed up`);
    }
  });
  const existing = await dst`select tablename from pg_tables where schemaname='public'`;
  for (const { tablename } of existing) {
    const [{ count }] = await dst`select count(*)::int as count from ${dst('public.' + tablename)}`;
    report.existingTables[tablename] = count;
  }
  await writeFile(`${backup}/manifest.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  if (apply) {
    const generated = (await readdir('strategist/migrations')).filter(f => f.endsWith('.sql')).sort();
    if (generated.length !== 1) throw new Error('Expected exactly one initial schema migration');
    const ddl = await readFile(`strategist/migrations/${generated[0]}`, 'utf8');
    const support = await readFile('strategist/migrations/support.sql.txt', 'utf8');
    await dst.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('immuvi-strategist-import'))`;
      const collisions = existing.map(r => r.tablename).filter(t => tables.some(s => t === `strategist_${s}`));
      if (collisions.length) throw new Error(`Target tables already exist; use verification instead of overwriting: ${collisions.join(', ')}`);
      for (const statement of ddl.split('--> statement-breakpoint')) if (statement.trim()) await tx.unsafe(statement);
      await tx.unsafe(support);
      for (const table of tables) {
        const dest = `strategist_${table}`;
        const columns = await tx`select column_name from information_schema.columns where table_schema='public' and table_name=${dest} order by ordinal_position`;
        const expected = report.tables[table].columns;
        if (JSON.stringify(columns.map(c => c.column_name).sort()) !== JSON.stringify([...expected].sort())) throw new Error(`Column mismatch: ${table}`);
        for (let offset = 0; offset < data[table].length; offset += 150) {
          await tx`insert into ${tx('public.' + dest)} select * from jsonb_populate_recordset(null::${tx('public.' + dest)}, ${tx.json(data[table].slice(offset, offset + 150))})`;
        }
        const copied = (await tx`select to_jsonb(t) as row from ${tx('public.' + dest)} t`).map(r => r.row);
        if (digest(copied) !== report.tables[table].sha256) throw new Error(`Content verification failed: ${dest}`);
        report.tables[table].verified = true;
        console.log(`${dest}: ${copied.length} rows verified, content matches`);
      }
      await tx`notify pgrst, 'reload schema'`;
    });
    report.applied = true;
    // Destination configuration contains only Immuvi database credentials.
    const env = {
      SUPABASE_URL: target.SUPABASE_URL,
      SUPABASE_ANON_KEY: target.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: target.SUPABASE_SERVICE_ROLE_KEY,
      STRATEGIST_DATABASE_URL: target.STRATEGIST_DATABASE_URL,
      ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY,
      CLICKUP_TOKEN: source.CLICKUP_TOKEN,
      CLICKUP_TEAM_ID: source.CLICKUP_TEAM_ID,
      GOOGLE_SERVICE_ACCOUNT_JSON: source.GOOGLE_SERVICE_ACCOUNT_JSON,
    };
    await writeFile('.env.strategist.local', Object.entries(env).filter(([,v]) => v).map(([k,v]) => `${k}='${String(v).replaceAll("'", "\\'")}'`).join('\n') + '\n', { mode: 0o600 });
  }
  const assets = await src`select count(*) filter (where thumbnail_path is not null)::int as thumbnails from creatives`;
  const frames = await src`select count(*) filter (where frame_path is not null)::int as frames from frame_texts`;
  report.mediaReferences = { ...assets[0], ...frames[0] };
  await writeFile(`${backup}/manifest.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ applied: report.applied, backup, mediaReferences: report.mediaReferences }));
} catch (error) {
  report.error = error.message;
  await writeFile(`${backup}/manifest.json`, JSON.stringify(report, null, 2), { mode: 0o600 }).catch(() => {});
  console.error(`Migration stopped: ${error.message}`);
  process.exitCode = 1;
} finally { await src.end(); await dst.end(); }
