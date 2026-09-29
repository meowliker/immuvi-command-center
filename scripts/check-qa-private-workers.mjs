import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing non-QA project.');
const version = '20260928050000', name = 'qa_private_workers';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply'), applied = process.argv.includes('--test-applied');
const sql = `begin; ${applied ? '' : migration}\n${apply ? `insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(migration)}],'${name}'); notify pgrst,'reload schema'; commit;` : `${readFileSync('tests/database/private-workers.sql', 'utf8')}\nrollback;`}`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2_000_000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(apply ? 'Private-worker QA migration applied.' : 'Private-worker owner, queue, lease and storage tests passed; fixtures rolled back.');
