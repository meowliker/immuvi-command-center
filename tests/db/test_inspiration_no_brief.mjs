import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {targetEnv} from '../../scripts/strategist-env.mjs';

const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15,onnotice(){}});
const migration=await readFile(new URL('../../supabase/migrations/20260923090000_inspiration_no_brief.sql',import.meta.url),'utf8');
const prefix='no-brief-probe-'+Date.now();
const rollback=new Error('ROLLBACK_SUCCESS');
try {
  try {
    await sql.begin(async tx=>{
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='20s'`;
      await tx.unsafe(migration);
      await tx.unsafe(migration);
      const [product]=await tx`select id from products order by id limit 1`;
      await tx`insert into worker_registry(worker_id,status,capabilities) values
        (${prefix+'-old'},'offline','{}'::jsonb),
        (${prefix+'-new'},'offline','{"classification_only":true}'::jsonb)`;
      const [normal]=await tx`insert into inspiration_queue(ins_id,product_id,url,worker_assignment)
        values(${prefix+'-normal'},${product.id},'https://example.com/normal',${prefix}) returning *`;
      const [skip]=await tx`insert into inspiration_queue(ins_id,product_id,url,worker_assignment,no_brief)
        values(${prefix+'-skip'},${product.id},'https://example.com/skip',${prefix},true) returning *`;
      assert.equal(normal.no_brief,false);
      assert.equal(skip.no_brief,true);
      for(const worker of [prefix+'-old',prefix+'-unregistered',null]) {
        await assert.rejects(()=>tx.savepoint(sp=>sp`update inspiration_queue set status='claimed',claimed_by=${worker},attempts=1 where id=${skip.id}`),
          error=>error.code==='23514');
      }
      const [notClaimed]=await tx`select * from inspiration_queue where id=${skip.id}`;
      assert.equal(notClaimed.claimed_by,null);
      assert.equal(notClaimed.attempts,0);
      const [claimed]=await tx`update inspiration_queue set status='claimed',claimed_by=${prefix+'-new'},no_brief=false
        where id=${skip.id} returning *`;
      assert.equal(claimed.no_brief,true);
      await tx`update inspiration_queue set status='classifying' where id=${skip.id}`;
      await tx`update inspiration_queue set status='classified',claimed_by=null where id=${skip.id}`;
      const [retry]=await tx`update inspiration_queue set status='pending',claimed_by=null,no_brief=false where id=${skip.id} returning *`;
      assert.equal(retry.no_brief,true);
      const [legacy]=await tx`update inspiration_queue set status='claimed',claimed_by=${prefix+'-old'} where id=${normal.id} returning *`;
      assert.equal(legacy.no_brief,false);
      throw rollback;
    });
  } catch(error) {if(error!==rollback) throw error;}
  const [remaining]=await sql`select count(*)::int as count from inspiration_queue where ins_id like ${prefix+'%'}`;
  assert.equal(remaining.count,0);
  console.log('Passed: default brief behavior, No Brief persistence, stale/unknown worker rejection, capable worker claim/completion, retries, and idempotent migration. All writes rolled back.');
} finally {await sql.end({timeout:2});}
