import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';

const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max:1, prepare:false});
const migration = readFileSync(new URL('../supabase/migrations/20260930000100_variation_notes.sql', import.meta.url), 'utf8');
const adId = '86d2wka6m-V1';
const productId = 'prod-1778009469915';
try {
  const [before] = await sql`select to_jsonb(a) as row from public.ads a where id=${adId} and product_id=${productId}`;
  assert.ok(before);
  if (process.argv.includes('--apply')) {
    const backup = '/private/tmp/immuvi-notes-before-20260930';
    mkdirSync(backup, {recursive:true, mode:0o700});
    const previous = await sql`select pg_get_functiondef(oid) as definition from pg_proc where oid=to_regprocedure('public.save_variation_notes(text,text,text,text)')`;
    writeFileSync(backup+'/before.json', JSON.stringify({ad:before.row, previous}, null,2), {mode:0o600, flag:'wx'});
    await sql.begin(async tx => {
      await tx.unsafe(migration);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements)
        values('20260930000100','variation_notes',${[migration]}) on conflict(version) do nothing`;
    });
    console.log('Migration applied; previous state backed up at '+backup);
  }
  const [admin] = await sql`select id from public.profiles where role='admin' and is_active=true limit 1`;
  assert.ok(admin);
  try {
    await sql.begin(async tx => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:admin.id,role:'authenticated'})},true)`;
      await tx`set local role authenticated`;
      const [baseline] = await tx`select to_jsonb(a) as row from public.ads a where id=${adId} and product_id=${productId} for update`;
      const original = baseline.row.meta.notes ?? baseline.row.meta.variationNotes ?? '';
      const note = 'Verification only - rolled back';
      const [result] = await tx`select public.save_variation_notes(${adId},${productId},${original},${note}) as saved`;
      assert.equal(result.saved.notes,note);
      const [after] = await tx`select to_jsonb(a) as row from public.ads a where id=${adId} and product_id=${productId}`;
      assert.equal(after.row.meta.notes,note);
      assert.equal(after.row.meta.variationNotes,note);
      const normalize = row => {
        const copy = structuredClone(row); delete copy.updated_at;
        delete copy.meta.notes; delete copy.meta.variationNotes; return copy;
      };
      assert.deepEqual(normalize(after.row),normalize(baseline.row));
      const [retry] = await tx`select public.save_variation_notes(${adId},${productId},${original},${note}) as saved`;
      assert.equal(retry.saved.notes,note);
      async function rejected(run, code) {
        try { await tx.savepoint(run); assert.fail('Expected rejection '+code); }
        catch(error) { assert.equal(error.code,code); }
      }
      await rejected(t=>t`select public.save_variation_notes(${adId},${productId},${'stale'},${'Overwrite'})`,'40001');
      await rejected(t=>t`select public.save_variation_notes(${adId},${'wrong-product'},${note},${'Leak'})`,'P0002');
      await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:'00000000-0000-0000-0000-000000000000',role:'authenticated'})},true)`;
      await rejected(t=>t`select public.save_variation_notes(${adId},${productId},${note},${'Unauthorized'})`,'42501');
      console.log('Live DB checks passed: saved/read back, only notes changed, safe retry, conflict, wrong product, unauthorized user.');
      throw new Error('ROLLBACK_VERIFICATION');
    });
  } catch(error) { if(error.message!=='ROLLBACK_VERIFICATION') throw error; }
  const [after] = await sql`select to_jsonb(a) as row from public.ads a where id=${adId} and product_id=${productId}`;
  assert.deepEqual(after.row,before.row);
  console.log('Verified rollback: original creative and notes unchanged.');
} finally { await sql.end(); }
