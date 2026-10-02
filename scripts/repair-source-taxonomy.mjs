import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {targetEnv} from './strategist-env.mjs';
import {buildSourceRepairPlan,auditAllProducts} from './taxonomy-source-repair-plan.mjs';

const [snapshot,output]=process.argv.slice(2);
assert.ok(snapshot&&output,'Usage: repair-source-taxonomy.mjs SNAPSHOT PRIVATE_OUTPUT [--apply]');
const tables=Object.fromEntries(['products','angles','personas','ads','inspirations'].map(t=>[t,JSON.parse(readFileSync(snapshot+'/'+t+'.json','utf8'))]));
const plan=buildSourceRepairPlan(tables);
const migration=readFileSync(new URL('../supabase/migrations/20261002000100_explicit_taxonomy_deletion.sql',import.meta.url),'utf8');
const {default:postgres}=await import(process.env.POSTGRES_MODULE||'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{max:1,prepare:false,connect_timeout:10});
mkdirSync(output,{recursive:true,mode:0o700});
const record=(name,data)=>writeFileSync(output+'/'+name+'.json',JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
record('plan',plan);record('all-products-audit',auditAllProducts(tables,plan));
const protectedTables=['products','ads','manual_actions','matrix_cells','inspirations','inspiration_results','inspiration_queue','deleted_ads','deleted_angles','deleted_personas'];
async function fingerprints(tx) {
  const result=[];
  for(const table of protectedTables) {
    const [row]=await tx.unsafe(`SELECT count(*)::int AS count,md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) AS digest FROM public.${table} t`);
    result.push({table,...row});
  }
  return result;
}
async function contracts(tx) {
  const rollback=new Error('Rollback contract fixtures');
  try {await tx.savepoint(async inner=>{
    const [product,other]=tables.products.map(p=>p.id);
    const [privilege]=await inner`select has_function_privilege('anon','public.delete_product_taxonomy(text,text,text[])','EXECUTE') AS anon,has_function_privilege('authenticated','public.delete_product_taxonomy(text,text,text[])','EXECUTE') AS member`;
    assert.equal(privilege.anon,false);assert.equal(privilege.member,true);
    for(const table of ['angles','personas']) {
      const kind=table==='angles'?'angle':'persona',id='taxonomy-contract-'+randomUUID();
      const get=async()=> (await inner.unsafe(`SELECT * FROM public.${table} WHERE id=$1`,[id]))[0];
      await inner.unsafe(`INSERT INTO public.${table}(id,product_id,name,status) VALUES($1,$2,$1,'Untested')`,[id,product]);
      assert.ok((await get()).archived_at);assert.equal((await get()).creation_approved,false);
      const ignored=await inner.unsafe(`DELETE FROM public.${table} WHERE id=$1 RETURNING id`,[id]);
      assert.equal(ignored.length,0,'Stale delete must not remove category');
      await inner.unsafe(`INSERT INTO public.${table}(id,product_id,name,status,creation_approved,archived_at) VALUES($1,$2,$1,'Untested',true,NULL) ON CONFLICT(id) DO UPDATE SET creation_approved=excluded.creation_approved,archived_at=excluded.archived_at`,[id,product]);
      assert.ok((await get()).archived_at);assert.equal((await get()).creation_approved,false);
      const [wrong]=await inner`select public.delete_product_taxonomy(${other},${kind},${[id]}) AS removed`;
      assert.equal(wrong.removed,0);assert.ok(await get());
      await assert.rejects(inner.savepoint(child=>child`select public.delete_product_taxonomy(${product},NULL,${[id]})`),{code:'PT400'});
      await inner.unsafe(`UPDATE public.${table} SET creation_approved=true,archived_at=NULL WHERE id=$1`,[id]);
      assert.equal((await get()).archived_at,null);
      const [removed]=await inner`select public.delete_product_taxonomy(${product},${kind},${[id]}) AS removed`;
      assert.equal(removed.removed,1);assert.equal(await get(),undefined);
      const [marker]=await inner.unsafe(`SELECT * FROM public.deleted_${table} WHERE id=$1 AND product_id=$2`,[id,product]);
      assert.ok(marker);
    }
    const cascadeId='taxonomy-cascade-'+randomUUID();
    await inner`insert into public.products(id,name) values(${cascadeId},'Rollback-only contract fixture')`;
    await inner`insert into public.angles(id,product_id,name) values(${cascadeId},${cascadeId},'Rollback-only contract fixture')`;
    await inner`delete from public.products where id=${cascadeId}`;
    assert.equal((await inner`select id from public.angles where id=${cascadeId}`).length,0,'Authorized whole-product cascade must remain functional');
    throw rollback;
  });}catch(error){if(error!==rollback) throw error;}
}
const rehearsal=new Error('Verified rehearsal rollback');
let verification;
try {
  await sql.begin('isolation level repeatable read',async tx=>{
    await tx`set local statement_timeout='30s'`;await tx`set local lock_timeout='5s'`;
    await tx.unsafe('LOCK TABLE public.angles,public.personas IN SHARE ROW EXCLUSIVE MODE');
    const before={};
    for(const table of ['angles','personas']) before[table]=await tx.unsafe(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`);
    record('taxonomy-before',before);
    const protectedBefore=await fingerprints(tx);record('data-before',protectedBefore);
    for(const {table,row} of plan) {
      const live=before[table].find(x=>x.row.id===row.id)?.row;
      assert.deepEqual({...live,updated_at:null},{...row,updated_at:null},'Target changed since backup: '+row.id);
    }
    await tx.unsafe(migration);
    await contracts(tx);
    for(const table of ['angles','personas']) {
      // Administrative quarantine preserves content/identity and is transactionally verified.
      await tx.unsafe(`ALTER TABLE public.${table} DISABLE TRIGGER trg_taxonomy_explicit_creation`);
      const ids=plan.filter(x=>x.table===table).map(x=>x.row.id);
      const changed=await tx.unsafe(`UPDATE public.${table} SET archived_at=now(),creation_approved=false WHERE id=ANY($1::text[]) RETURNING id`,[ids]);
      assert.equal(changed.length,ids.length);
      await tx.unsafe(`ALTER TABLE public.${table} ENABLE TRIGGER trg_taxonomy_explicit_creation`);
    }
    const after={};
    for(const table of ['angles','personas']) {
      after[table]=await tx.unsafe(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`);
      assert.equal(after[table].length,before[table].length);
      for(let i=0;i<before[table].length;i++) {
        const original=before[table][i].row,current={...after[table][i].row};
        if(plan.some(x=>x.table===table&&x.row.id===original.id)) {
          assert.ok(current.archived_at);assert.equal(current.creation_approved,false);
          current.archived_at=original.archived_at;current.creation_approved=original.creation_approved;current.updated_at=original.updated_at;
        }
        assert.deepEqual(current,original,'Unexpected category change: '+original.id);
      }
    }
    const protectedAfter=await fingerprints(tx);assert.deepEqual(protectedAfter,protectedBefore,'Protected data changed');
    record('taxonomy-after',after);
    verification={mode:process.argv.includes('--apply')?'apply':'rehearsal',archived:plan.length,protectedTables:protectedAfter,contracts:'passed; fixtures rolled back',products:tables.products.map(p=>({id:p.id,name:p.name,...Object.fromEntries(['angles','personas'].map(t=>[t,after[t].filter(x=>x.row.product_id===p.id&&!x.row.archived_at).length]))}))};
    record('verified',verification);
    const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
    const rollback=['BEGIN;',"SET LOCAL lock_timeout='5s';",'LOCK TABLE public.angles,public.personas IN SHARE ROW EXCLUSIVE MODE;'];
    for(const {table,row} of plan) {
      const expected={...after[table].find(x=>x.row.id===row.id).row};delete expected.updated_at;
      rollback.push(`DO $restore$ BEGIN IF (SELECT to_jsonb(t)-'updated_at' FROM public.${table} t WHERE id=${quote(row.id)}) IS DISTINCT FROM ${quote(JSON.stringify(expected))}::jsonb THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Category edited since repair; review rollback'; END IF; END $restore$;`);
      rollback.push(`UPDATE public.${table} SET archived_at=NULL,creation_approved=true WHERE id=${quote(row.id)} AND product_id=${quote(row.product_id)};`);
    }
    rollback.push('COMMIT;');writeFileSync(output+'/rollback-data.sql',rollback.join('\n')+'\n',{mode:0o600,flag:'wx'});
    if(!process.argv.includes('--apply')) throw rehearsal;
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values('20261002000100','explicit_taxonomy_deletion',${[migration]})`;
  });
  record('committed',{at:new Date().toISOString()});
}catch(error){
  record('rolled-back',{reason:error===rehearsal?'Successful rehearsal':error.message});
  if(error!==rehearsal)throw error;
}finally{await sql.end();}
console.log(JSON.stringify(verification,null,2));
