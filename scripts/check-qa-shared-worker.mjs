import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
process.on('uncaughtException',error=>{console.error(error.message,error.where||'');process.exit(1);});
const versions=['20260929150000_qa_shared_worker','20260929160000_qa_shared_worker_visibility','20260929170000_qa_shared_queue_priority'];
const migrations=versions.map(file=>({version:file.slice(0,14),name:file.slice(15),sql:readFileSync(`supabase/migrations/${file}.sql`,'utf8')}));
const tests=readFileSync('tests/database/shared-worker.sql','utf8');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const apply=process.argv.includes('--apply'),applied=process.argv.includes('--test-applied');
if(process.argv.includes('--local')) {
 const {PGlite}=await import(process.env.QA_PGLITE_MODULE || '@electric-sql/pglite');
 const db=new PGlite();
 await db.exec(readFileSync('tests/database/shared-worker-base.sql','utf8'));
 for(const file of ['20260928050000_qa_private_workers','20260928060000_qa_private_inspiration','20260929070000_qa_private_brief_delivery_recovery','20260929090000_qa_inspiration_library','20260929120000_qa_private_queue_controls'])
  await db.exec(readFileSync(`supabase/migrations/${file}.sql`,'utf8'));
 await db.exec(`begin;${migrations.map(m=>m.sql).join('\n')}\n${tests}\nrollback;`);
 await db.close();console.log('Local PostgreSQL fixture: shared routing, authorization, private isolation, priority, capacity, leases and recovery passed.');
} else {
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='entgcnlfsnysnwyadzzp')throw new Error('Refusing non-QA project.');
 const pending=migrations.map(m=>`do $install$ begin if not exists(select 1 from supabase_migrations.schema_migrations where version='${m.version}') then execute ${quote(m.sql)}; insert into supabase_migrations.schema_migrations(version,statements,name) values('${m.version}',array[${quote(m.sql)}],'${m.name}'); end if; end $install$;`).join('\n');
 const privateTests=['private-inspiration','private-brief-recovery','private-inspiration-library','private-queue-controls'].map(file=>readFileSync(`tests/database/${file}.sql`,'utf8')).join('\n');
 const cli=process.env.QA_SUPABASE_CLI || 'supabase';
 function run(sql) {
  const result=spawnSync(cli,['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2_000_000});
  if(result.status!==0){process.stderr.write(result.stderr+'\n'+result.stdout);process.exit(1);}
 }
 run(`begin; set local lock_timeout='5s'; ${applied?'':pending}\n${privateTests}\n${tests}\nrollback;`);
 if(apply)run(`begin; set local lock_timeout='5s'; ${pending}\nnotify pgrst,'reload schema';commit;`);
 console.log(apply?'Missing shared worker migrations applied only to QA after rollback fixtures passed.':'QA shared and private worker fixtures passed and rolled back.');
}
