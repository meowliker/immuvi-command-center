import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {targetEnv} from './strategist-env.mjs';

// Requires a private, complete snapshot; defaults to a rolled-back rehearsal.
const [snapshot, output] = process.argv.slice(2);
assert.ok(snapshot && output, 'Usage: repair-taxonomy-imports.mjs SNAPSHOT OUTPUT [--apply]');
const {default: postgres} = await import(process.env.POSTGRES_MODULE || 'postgres');
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max:1, prepare:false, connect_timeout:10});
const migration = readFileSync(new URL('../supabase/migrations/20261001000100_explicit_taxonomy_creation.sql', import.meta.url), 'utf8');
const read = table => JSON.parse(readFileSync(snapshot+'/'+table+'.json', 'utf8'));
const products = read('products');
const selected = [];
for (const table of ['angles','personas']) {
  for (const row of read(table)) {
    const quilting = row.product_id === 'prod-1788261727492' && row.created_at.startsWith('2026-10-01T05:42:50.');
    const kids = table === 'personas' && row.product_id === 'prod-1776424382708' && row.created_at === '2026-09-28T12:40:10.683359+00:00';
    const phonics = table === 'personas' && row.product_id === 'prod-1778005514645' && ['per-manual-muml7rw3-yb4gcn','per-manual-muml7rw8-d7wkdl'].includes(row.id);
    if (quilting || kids || phonics) selected.push({table, row});
  }
}
assert.equal(selected.filter(x=>x.table==='angles').length,20);
assert.equal(selected.filter(x=>x.table==='personas').length,28);
assert.ok(selected.every(x=>!x.row.archived_at && !x.row.notes && !x.row.source_link));
mkdirSync(output,{recursive:true,mode:0o700});
const record = (name,data) => writeFileSync(output+'/'+name+'.json',JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
record('plan',selected);
const protectedTables = ['products','ads','manual_actions','matrix_cells','inspirations','inspiration_results','inspiration_queue','deleted_ads','deleted_angles','deleted_personas'];
async function fingerprints(tx) {
  const result=[];
  for (const table of protectedTables) {
    const [row] = await tx.unsafe(`SELECT count(*)::int AS count, md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id)) AS digest FROM public.${table} t`);
    result.push({table,...row});
  }
  return result;
}
async function contractTests(tx) {
  await tx.unsafe('SAVEPOINT taxonomy_contract_tests');
  try {
    for (const table of ['angles','personas']) {
      const id='taxonomy-test-'+randomUUID(), manualId='taxonomy-test-'+randomUUID();
      const product=products[0].id, other=products[1].id;
      const get=async()=> (await tx.unsafe(`SELECT * FROM public.${table} WHERE id=$1`,[id]))[0];
      await tx.unsafe(`INSERT INTO public.${table}(id,product_id,name,status) VALUES($1,$2,$3,'Untested')`,[id,product,id]);
      let row=await get(); assert.equal(row.creation_approved,false); assert.ok(row.archived_at);
      await tx.unsafe(`INSERT INTO public.${table}(id,product_id,name,status,archived_at,creation_approved) VALUES($1,$2,$3,'Untested',NULL,true) ON CONFLICT(id) DO UPDATE SET archived_at=excluded.archived_at,creation_approved=excluded.creation_approved`,[id,product,id]);
      row=await get(); assert.equal(row.creation_approved,false); assert.ok(row.archived_at);
      await tx.unsafe(`UPDATE public.${table} SET archived_at=NULL,creation_approved=true WHERE id=$1`,[id]);
      row=await get(); assert.equal(row.creation_approved,true); assert.equal(row.archived_at,null);
      await tx.unsafe(`UPDATE public.${table} SET archived_at=now() WHERE id=$1`,[id]);
      const archived=(await get()).archived_at.toISOString();
      await tx.unsafe(`INSERT INTO public.${table}(id,product_id,name,status,archived_at) VALUES($1,$2,$3,'Untested',NULL) ON CONFLICT(id) DO UPDATE SET archived_at=excluded.archived_at,creation_approved=excluded.creation_approved`,[id,product,id]);
      row=await get(); assert.equal(row.archived_at.toISOString(),archived); assert.equal(row.creation_approved,true);
      await tx.unsafe(`INSERT INTO public.${table}(id,product_id,name,status,creation_approved) VALUES($1,$2,$3,'Untested',true)`,[manualId,product,manualId]);
      const [manual]=await tx.unsafe(`SELECT * FROM public.${table} WHERE id=$1`,[manualId]);
      assert.equal(manual.creation_approved,true); assert.equal(manual.archived_at,null);
      await assert.rejects(tx.savepoint(async inner => {
        await inner.unsafe(`UPDATE public.${table} SET product_id=$2 WHERE id=$1`,[id,other]);
      }), {code:'PT409'});
    }
  } finally {await tx.unsafe('ROLLBACK TO SAVEPOINT taxonomy_contract_tests');}
}
let verification;
const rehearsal = new Error('Verified rehearsal: rollback');
try {
  await sql.begin('isolation level repeatable read', async tx => {
    await tx`set local statement_timeout='30s'`;
    await tx`set local lock_timeout='5s'`;
    await tx.unsafe('LOCK TABLE public.angles, public.personas IN SHARE ROW EXCLUSIVE MODE');
    const before = {};
    for (const table of ['angles','personas']) before[table]=await tx.unsafe(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`);
    record('taxonomy-before',before);
    record('triggers-before',await tx`select c.relname, t.tgname, pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.oid in ('public.angles'::regclass,'public.personas'::regclass) and not t.tgisinternal`);
    const dataBefore=await fingerprints(tx);
    record('data-before',dataBefore);
    for (const {table,row} of selected) {
      const live=before[table].find(x=>x.row.id===row.id)?.row;
      // Background snapshots touch updated_at even when no content changed.
      assert.deepEqual({...live,updated_at:null},{...row,updated_at:null},'Taxonomy changed since backup: '+row.id);
    }
    await tx.unsafe(migration);
    // Scoped administrative repair only. Existing deletion/updated_at guards stay on.
    for (const table of ['angles','personas']) {
      await tx.unsafe(`ALTER TABLE public.${table} DISABLE TRIGGER trg_taxonomy_explicit_creation`);
      const ids=selected.filter(x=>x.table===table).map(x=>x.row.id);
      const changed=await tx.unsafe(`UPDATE public.${table} SET archived_at=now(),creation_approved=false WHERE id=ANY($1::text[]) RETURNING id`,[ids]);
      assert.equal(changed.length,ids.length);
      await tx.unsafe(`ALTER TABLE public.${table} ENABLE TRIGGER trg_taxonomy_explicit_creation`);
    }
    await contractTests(tx);
    const after={};
    for (const table of ['angles','personas']) {
      after[table]=await tx.unsafe(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY id`);
      assert.equal(after[table].length,before[table].length);
      for(let i=0;i<before[table].length;i++) {
        const original=before[table][i].row, current={...after[table][i].row};
        const target=selected.some(x=>x.table===table && x.row.id===original.id);
        assert.equal(current.creation_approved,!target);
        delete current.creation_approved;
        if(target) {assert.ok(current.archived_at); current.archived_at=original.archived_at;current.updated_at=original.updated_at;}
        assert.deepEqual(current,original,'Unexpected taxonomy modification: '+original.id);
      }
    }
    const dataAfter=await fingerprints(tx);
    assert.deepEqual(dataAfter,dataBefore,'Protected data changed');
    verification={mode:process.argv.includes('--apply')?'apply':'rehearsal',archived:48,protectedTables:dataAfter,products:products.map(p=>({id:p.id,name:p.name,...Object.fromEntries(['angles','personas'].map(table=>[table,after[table].filter(x=>x.row.product_id===p.id&&!x.row.archived_at).length]))})),contractTests:'passed; fixtures rolled back'};
    record('taxonomy-after',after);record('verified',verification);
    const quote = value => "'"+String(value).replaceAll("'","''")+"'";
    const rollback = ['-- Data-only rollback. Aborts if any affected category was edited since repair.', 'BEGIN;', "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='30s';", 'LOCK TABLE public.angles, public.personas IN SHARE ROW EXCLUSIVE MODE;'];
    for(const {table,row} of selected) {
      const expected={...after[table].find(x=>x.row.id===row.id).row};delete expected.updated_at;
      rollback.push(`DO $restore$ BEGIN IF (SELECT to_jsonb(t)-'updated_at' FROM public.${table} t WHERE id=${quote(row.id)}) IS DISTINCT FROM ${quote(JSON.stringify(expected))}::jsonb THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Taxonomy changed after repair; review before rollback'; END IF; END $restore$;`);
      rollback.push(`UPDATE public.${table} SET archived_at=NULL, creation_approved=true WHERE id=${quote(row.id)} AND product_id=${quote(row.product_id)};`);
    }
    rollback.push('COMMIT;');
    writeFileSync(output+'/rollback-data.sql',rollback.join('\n')+'\n',{mode:0o600,flag:'wx'});
    if(!process.argv.includes('--apply')) throw rehearsal;
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values('20261001000100','explicit_taxonomy_creation',${[migration]}) on conflict(version) do nothing`;
  });
  record('committed',{at:new Date().toISOString()});
} catch(error) {
  record('rolled-back',{at:new Date().toISOString(),reason:error===rehearsal?'Successful rehearsal':error.message});
  if(error!==rehearsal) throw error;
}
finally {await sql.end();}
console.log(JSON.stringify(verification,null,2));
