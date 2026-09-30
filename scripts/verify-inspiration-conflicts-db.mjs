import assert from 'node:assert/strict';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';

const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{max:1,prepare:false,connect_timeout:10});
try {
  const [admin]=await sql`select id from public.profiles where role='admin' and is_active=true limit 1`;
  const [row]=await sql`select to_jsonb(i) as data from public.inspirations i order by id limit 1`;
  assert.ok(admin && row);
  const original=row.data;
  try {
    await sql.begin(async tx=>{
      await tx`set local statement_timeout='5s'`;
      await tx`select set_config('request.jwt.claims',${JSON.stringify({sub:admin.id,role:'authenticated'})},true)`;
      await tx`set local role authenticated`;
      async function rejected(action,code) {
        try {await tx.savepoint(action);assert.fail('Expected conflict');}
        catch(error){assert.equal(error.code,code);}
      }
      const stale={...original.data,_baseUpdatedAt:'2000-01-01T00:00:00Z'};
      await rejected(t=>t`insert into public.inspirations(id,product_id,url,title,platform,added_by,status,data)
        values(${original.id},${original.product_id},${original.url},${original.title},${original.platform},${original.added_by},${original.status},${stale})
        on conflict(id) do update set data=excluded.data`,'PT409');
      await rejected(t=>t`update public.inspirations set product_id='wrong-product' where id=${original.id}`,'23514');
      await rejected(t=>t`update public.inspirations set url='https://invalid.example/source-change' where id=${original.id}`,'23514');
      console.log('Stale UPSERT returns PT409; cross-product and source changes still rejected.');
      throw new Error('ROLLBACK_VERIFICATION');
    });
  } catch(error) {if(error.message!=='ROLLBACK_VERIFICATION') throw error;}
  const [after]=await sql`select to_jsonb(i) as data from public.inspirations i where id=${original.id}`;
  assert.deepEqual(after.data,original);
  console.log('Original inspiration verified unchanged.');
  console.log('Remaining public functions using retryable application conflicts:',await sql`
    select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.prosrc like '%40001%'`);
  console.log('Database startup:',await sql`select pg_postmaster_start_time() as started_at`);
} finally {await sql.end();}
