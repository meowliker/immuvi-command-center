import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260919010000', name = 'qa_plan_checkpoints';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = ['action-plan-checkpoints', 'tracker-mutations', 'action-plan-batch', 'action-plan-creative']
  .map((test) => `savepoint fixture;\n${readFileSync(`tests/database/${test}.sql`, 'utf8')}\nrollback to fixture; release fixture;`).join('\n');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply');
const sql = apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name)
 values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; commit;`
  : `begin; ${migration}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2_000_000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(apply ? 'QA checkpoint migration applied and recorded.' : 'QA checkpoint, Tracker, batch, and creative tests passed; all fixtures rolled back.');
