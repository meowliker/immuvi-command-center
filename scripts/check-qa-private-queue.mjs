import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='entgcnlfsnysnwyadzzp')throw new Error('Refusing non-QA project.');
const version='20260929120000',name='qa_private_queue_controls';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply'),applied=process.argv.includes('--test-applied');
const tests=['private-inspiration','private-brief-recovery','private-inspiration-library','private-queue-controls'].map(name=>readFileSync(`tests/database/${name}.sql`,'utf8')).join('\n');
const sql=`begin; set local lock_timeout='5s'; ${applied?'':migration}\n${apply?`insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(migration)}],'${name}'); notify pgrst,'reload schema'; commit;`:`${tests}\nrollback;`}`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(apply?'Private queue controls applied to QA.':'Private queue priority, two-job capacity, delivery locking and owner isolation passed; fixtures rolled back.');
