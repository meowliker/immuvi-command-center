import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing non-QA project.');
const version='20260929090000',name='qa_inspiration_library';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply'),applied=process.argv.includes('--test-applied');
const tests=['private-inspiration','private-brief-recovery','private-inspiration-library'].map(name=>readFileSync(`tests/database/${name}.sql`,'utf8')).join('\n');
const sql=`begin; ${applied?'':migration}\n${apply?`insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(migration)}],'${name}'); notify pgrst,'reload schema'; commit;`:`${tests}\nrollback;`}`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(apply?'QA library-page delivery migration applied.':'QA library, recovery and isolation checks passed; fixtures rolled back.');
