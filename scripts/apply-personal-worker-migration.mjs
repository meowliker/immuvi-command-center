import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {targetEnv} from './strategist-env.mjs';
const {default:postgres}=await import(process.env.IMMUVI_TEST_POSTGRES_MODULE||'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const migration=await readFile(new URL('../supabase/migrations/20261021000100_personal_classification_workers.sql',import.meta.url),'utf8');
const tables=['products','ads','angles','personas','matrix_cells','manual_actions','inspirations','inspiration_queue','inspiration_results'];
const rollback=new Error('DRY_RUN_SUCCESS'),apply=process.argv.includes('--apply');
try{
  let report;
  try{await sql.begin('isolation level repeatable read',async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='40s'`;
    const inventory=async()=>{
      const state={};
      for(const table of tables){
        const [row]=await tx.unsafe(`select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from public.${table} t`);
        state[table]=row;
      }return state;
    };
    const before=await inventory();await tx.unsafe(migration);const after=await inventory();assert.deepEqual(after,before);
    const [grants]=await tx`select has_function_privilege('authenticated','public.personal_worker_dispatch(text,jsonb)','execute') as app,
      has_function_privilege('anon','public.personal_worker_dispatch(text,jsonb)','execute') as anon,
      has_schema_privilege('authenticated','personal_workers','usage') as schema`;
    assert.deepEqual(grants,{app:false,anon:false,schema:false});
    if(apply){
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements)
        values('20261021000100','personal_classification_workers',${[migration]}) on conflict(version)
        do update set name=excluded.name,statements=excluded.statements
        where schema_migrations.name='personal_classification_workers'`;
      await tx`notify pgrst,'reload schema'`;
    }
    report={applied:apply,preserved:after,permissions:grants};if(!apply)throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  if(process.env.IMMUVI_PRIVATE_MIGRATION_REPORT)await writeFile(process.env.IMMUVI_PRIVATE_MIGRATION_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.log(apply?'Migration applied. Existing rows across all nine product/content tables are byte-equivalent in the transaction snapshot; private schema/RPC deny app and anonymous access.':'Dry-run migration passed and rolled back; existing records unchanged.');
}finally{await sql.end({timeout:2});}
