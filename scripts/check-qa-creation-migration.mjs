import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version='20260918020000',name='qa_creation_workflow';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const tests=readFileSync('tests/database/creation-workflow.sql','utf8');
const quote=(s) => "'"+s.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply');
const sql=apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name)
 values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; commit;`
 : `begin; ${migration}\n${tests}\nrollback;`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0) { process.stderr.write(result.stderr||result.stdout);process.exit(1); }
console.log(apply ? 'QA creation workflow migration applied and recorded.' : 'QA creation workflow transaction tests passed; all fixtures rolled back.');
