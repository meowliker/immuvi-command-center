import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const migration=await readFile(new URL('../supabase/migrations/20261021000200_personal_worker_publishing.sql',import.meta.url),'utf8');
const tables=['products','ads','angles','personas','matrix_cells','manual_actions','inspirations','inspiration_queue','inspiration_results'];
const apply=process.argv.includes('--apply'),rollback=new Error('DRY_RUN_SUCCESS');let report;
try{
  try{await sql.begin('isolation level repeatable read',async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='40s'`;
    const inventory=async()=>{
      const out={};
      for(const table of [...tables,'personal_workers.devices','personal_workers.jobs']){
        const name=table.includes('.')?table:'public.'+table;
        const value=table==='personal_workers.jobs'?"(to_jsonb(t)-'created_page'-'publishing_doc_id'-'verified_page_hash')":'to_jsonb(t)';
        const [row]=await tx.unsafe(`select count(*)::int as count,md5(coalesce(string_agg(md5(${value}::text),'' order by md5(${value}::text)),'')) as digest from ${name} t`);out[table]=row;
      }return out;
    };
    const before=await inventory();await tx.unsafe(migration);await tx.unsafe(migration);assert.deepEqual(await inventory(),before);
    const [permissions]=await tx`select has_function_privilege('authenticated','public.personal_worker_dispatch(text,jsonb)','execute') as app,
      has_function_privilege('anon','public.personal_worker_dispatch(text,jsonb)','execute') as anon,
      has_schema_privilege('authenticated','personal_workers','usage') as schema`;
    assert.deepEqual(permissions,{app:false,anon:false,schema:false});
    if(apply){
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements)
        values('20261021000200','personal_worker_publishing',${[migration]}) on conflict(version) do nothing`;
      await tx`notify pgrst,'reload schema'`;
    }
    report={applied:apply,preserved:before,permissions};if(!apply)throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  if(process.env.IMMUVI_PRIVATE_MIGRATION_REPORT)await writeFile(process.env.IMMUVI_PRIVATE_MIGRATION_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.log(apply?'Publishing migration applied; existing business and private-worker rows preserved.':'Publishing migration dry-run passed; all changes rolled back.');
}finally{await sql.end({timeout:2});}
