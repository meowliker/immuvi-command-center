import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing non-QA project.');
const name='qa_image_producer', version='20260928010000';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply');
const tests=apply?'':readFileSync('tests/database/qa-image-producer.sql','utf8');
const sql=`begin; ${process.argv.includes('--test-applied')?'':migration}\n${tests}\n${apply ? `insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(migration)}],'${name}') on conflict(version) do nothing; commit;` : 'rollback;'}`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(apply?'QA image producer migration applied.':'QA image producer database tests passed; fixtures rolled back.');
