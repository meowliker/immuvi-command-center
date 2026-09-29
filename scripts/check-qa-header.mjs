import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='entgcnlfsnysnwyadzzp')throw new Error('Refusing non-QA project');
const presence=process.argv.includes('--presence');
const clickupPresence=process.argv.includes('--clickup-presence');
const version=clickupPresence?'20260928040000':presence?'20260928023000':'20260928020000',name=clickupPresence?'qa_clickup_presence':presence?'qa_header_presence':'qa_header_reload',migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote=s=>"'"+s.replaceAll("'","''")+"'",apply=process.argv.includes('--apply');
const sql=apply?`begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst,'reload schema'; commit;`
 :`begin; ${migration}\n${readFileSync(`tests/database/header-${clickupPresence?'clickup-presence':presence?'presence':'reload'}.sql`,'utf8')}\nrollback;`;
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2000000});
if(result.status!==0){process.stderr.write(result.stderr || result.stdout);process.exit(1);}
console.log(apply?`QA ${name} schema installed. No reload request sent.`:`QA ${name} database tests passed; rolled back without broadcasts.`);
