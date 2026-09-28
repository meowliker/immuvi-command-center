import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {targetEnv} from '../../scripts/strategist-env.mjs';

const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15,onnotice(){}});
const migration=await readFile(new URL('../../supabase/migrations/20260928000100_taxonomy_review_jobs.sql',import.meta.url),'utf8');
const rollback=new Error('ROLLBACK_TEST_SUCCESS');
const hash='semantic-taxonomy-v1:'+'f'.repeat(64);
try {
  try {
    await sql.begin(async tx=>{
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='20s'`;
      await tx.unsafe(migration);
      await tx.unsafe(migration);
      const [admin]=await tx`select id from profiles where role='admin' and is_active=true limit 1`;
      const [member]=await tx`select pr.id from profiles pr where role='member' and is_active=true
        and exists(select 1 from user_products up where up.user_id=pr.id) limit 1`;
      assert.ok(admin && member, 'Need existing admin/member accounts for RLS tests');
      const [ins]=await tx`select i.id,i.product_id from inspirations i
        join user_products up on up.product_id=i.product_id where up.user_id=${member.id} limit 1`;
      const [foreign]=await tx`select i.id,i.product_id from inspirations i where i.product_id<>${ins.product_id}
        and not exists(select 1 from user_products up where up.user_id=${member.id} and up.product_id=i.product_id) limit 1`;
      assert.ok(ins && foreign, 'Need separate assigned and unassigned products');
      await tx`select set_config('request.jwt.claim.sub',${member.id},true)`;
      await tx`set local role authenticated`;
      const [one]=await tx`select * from request_taxonomy_review(${ins.product_id},${ins.id},${hash},false)`;
      const [two]=await tx`select * from request_taxonomy_review(${ins.product_id},${ins.id},${hash},false)`;
      assert.equal(one.id,two.id); assert.equal(one.worker_assignment,'gp-mac-mini');
      await assert.rejects(()=>tx.savepoint(sp=>sp`select * from request_taxonomy_review(${foreign.product_id},${foreign.id},${hash},false)`),e=>e.code==='42501');
      await assert.rejects(()=>tx.savepoint(sp=>sp`select * from request_taxonomy_review(${ins.product_id},${foreign.id},${hash},false)`),/does not belong/);
      for (const command of [
        tx=>tx`update taxonomy_review_jobs set status='complete',result='{}'::jsonb where id=${one.id}`,
        tx=>tx`delete from taxonomy_review_jobs where id=${one.id}`,
      ]) await assert.rejects(()=>tx.savepoint(command),e=>e.code==='42501');
      await tx`reset role`;
      await tx`insert into taxonomy_review_jobs(product_id,ins_id,requested_by,requested_signature)
        values(${foreign.product_id},${foreign.id},${admin.id},${hash})`;
      await tx`update taxonomy_review_jobs set status='failed' where id=${one.id}`;
      await tx`set local role authenticated`;
      const visible=await tx`select * from taxonomy_review_jobs where requested_signature=${hash}`;
      assert.ok(visible.every(r=>r.product_id!==foreign.product_id));
      const [retried]=await tx`select * from request_taxonomy_review(${ins.product_id},${ins.id},${hash},true)`;
      assert.equal(retried.id,one.id); assert.equal(retried.status,'pending');
      await tx`set local role anon`;
      await assert.rejects(()=>tx.savepoint(sp=>sp`select * from taxonomy_review_jobs`),e=>e.code==='42501');
      await assert.rejects(()=>tx.savepoint(sp=>sp`select * from request_taxonomy_review(${ins.product_id},${ins.id},${hash},false)`),e=>e.code==='42501');
      throw rollback;
    });
  } catch(e) {if(e!==rollback) throw e;}
  if(process.argv.includes('--apply')) {
    await sql.begin(async tx=>{await tx`set local lock_timeout='5s'`;await tx.unsafe(migration);});
    console.log('Applied additive review queue after rollback-only RLS tests. Existing creative tables untouched.');
  } else console.log('Passed queue deduplication, product authorization, foreign-row rejection, write restrictions, retry and anonymous access tests. All writes rolled back.');
} finally {await sql.end({timeout:2});}
