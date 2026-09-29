import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='entgcnlfsnysnwyadzzp')throw new Error('Refusing a non-QA project.');
const version='20260923040000',name='qa_inspiration_brief';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const tests=readFileSync('tests/database/inspiration-brief.sql','utf8');
const quote=(value)=>"'"+value.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply');
const sql=apply?`begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst, 'reload schema'; commit;`
  :`begin; ${migration}\n${tests}\nrollback;`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(apply?'QA brief-link migration applied; no existing records or workers changed.':'QA brief-link transaction tests passed; fixtures rolled back.');
