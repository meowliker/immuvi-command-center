import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from '../../scripts/strategist-env.mjs';

const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {
  prepare:false,max:1,ssl:'require',connect_timeout:15,onnotice() {},
});
const prefix = `marker-probe-${Date.now()}`;
const rollback = new Error('ROLLBACK_SUCCESSFUL_TEST');
const migration = await readFile(new URL('../../supabase/migrations/20260921090000_guard_duplicate_deletion_markers.sql',import.meta.url),'utf8');
const automatic = 'trigger:collapse_local_dup_on_sync';
let checks = 0;
try {
  try {
    await sql.begin(async tx=>{
      await tx`set local statement_timeout='20s'`;
      await tx`set local lock_timeout='5s'`;
      await tx.unsafe(migration);
      await tx.unsafe(migration); // Reapplying the schema guard is harmless.
      const products = await tx`select id from products order by id limit 2`;
      assert.equal(products.length,2);
      const productId = products[0].id;
      const otherProductId = products[1].id;
      const marker = async (suffix,reason,product=productId)=>{
        const [row] = await tx`insert into deleted_ads(id,product_id,clickup_task_id,deleted_by)
          values(${prefix+suffix},${product},${prefix+'-task'},${reason}) returning *`;
        return row;
      };
      const get = async suffix=>(await tx`select * from deleted_ads where id=${prefix+suffix}`)[0];
      const retired = async (suffix,deleted=true)=>tx`insert into ads(id,product_id,status,deleted_at,meta)
        values(${prefix+suffix},${productId},'Winner',${deleted?new Date():null},
          ${tx.json({_supersededByAdId:prefix+'-task',_supersededClickUpTaskId:prefix+'-task'})})`;

      assert.equal((await marker('-automatic',automatic)).clickup_task_id,null); checks++;
      await tx`update deleted_ads set clickup_task_id=${prefix+'-task'} where id=${prefix+'-automatic'}`;
      assert.equal((await get('-automatic')).clickup_task_id,null); checks++;

      await retired('-retired');
      const healed = await marker('-retired','self-heal');
      assert.equal(healed.clickup_task_id,null);
      assert.equal(healed.deleted_by,automatic); checks++;
      await tx`update deleted_ads set clickup_task_id=${prefix+'-task'},deleted_by='self-heal' where id=${prefix+'-retired'}`;
      assert.equal((await get('-retired')).clickup_task_id,null); checks++;

      const deliberate = await marker('-user','explicit-user-deletion');
      assert.equal(deliberate.clickup_task_id,prefix+'-task'); checks++;
      for (const reason of [automatic,'self-heal']) {
        await tx`insert into deleted_ads(id,product_id,clickup_task_id,deleted_by)
          values(${prefix+'-user'},${productId},${prefix+'-task'},${reason})
          on conflict(id) do update set clickup_task_id=excluded.clickup_task_id,deleted_by=excluded.deleted_by`;
        assert.deepEqual(await get('-user'),deliberate); checks++;
      }
      // A later deliberate deletion still has task-wide semantics.
      await tx`update deleted_ads set clickup_task_id=${prefix+'-task'},deleted_by='explicit-user-deletion'
        where id=${prefix+'-automatic'}`;
      assert.equal((await get('-automatic')).clickup_task_id,prefix+'-task'); checks++;

      assert.equal((await marker('-ordinary','self-heal')).clickup_task_id,prefix+'-task'); checks++;
      await retired('-foreign');
      assert.equal((await marker('-foreign','self-heal',otherProductId)).clickup_task_id,prefix+'-task'); checks++;
      await retired('-live',false);
      assert.equal((await marker('-live','self-heal')).clickup_task_id,prefix+'-task'); checks++;
      throw rollback;
    });
  } catch (error) {
    if (error!==rollback) throw error;
  }
  const [remaining] = await sql`select
    (select count(*) from ads where id like ${prefix+'%'}) +
    (select count(*) from deleted_ads where id like ${prefix+'%'}) as count`;
  assert.equal(Number(remaining.count),0);
  console.log(`Passed ${checks} checks: automatic retirement, stale writes/upserts, deliberate deletions, self-heal, product isolation, and idempotent migration. All test writes rolled back.`);
} finally {
  await sql.end({timeout:2});
}
