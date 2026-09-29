import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (ref !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA linked Supabase project.');
const version = '20260917040000';
const name = 'qa_tracker_mutations';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = readFileSync('tests/database/tracker-mutations.sql', 'utf8');
const apply = process.argv.includes('--apply');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const sql = apply
  ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name)
     values (${quote(version)}, ARRAY[${quote(migration)}], ${quote(name)}) on conflict (version) do nothing; commit;`
  : `begin; ${migration}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2_000_000 });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'QA database check failed.');
  process.exit(1);
}
console.log(apply ? 'QA Tracker migration applied and recorded.' : 'QA Tracker transaction tests passed; all test changes rolled back.');
