import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing non-QA project.');
const version='20260928060000', name='qa_private_inspiration';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply'), applied=process.argv.includes('--test-applied');
const sql=`begin; ${applied?'':migration}\n${apply?`insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(migration)}],'${name}'); notify pgrst,'reload schema'; commit;`:`${readFileSync('tests/database/private-inspiration.sql','utf8')}\nrollback;`}`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(apply?'Private inspiration migration applied to QA.':'Private inspiration isolation, idempotency and delivery checks passed; fixtures rolled back.');
