import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from '../../scripts/strategist-env.mjs';

const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, { prepare: false, max: 1, ssl: 'require', connect_timeout: 15 });
const suffix = String(Date.now());
const local = `AD-990${suffix}`;
const canonical = `duplicate-probe-${suffix}`;
const rollback = new Error('ROLLBACK_SUCCESSFUL_TEST');
try {
  try {
    await sql.begin(async tx => {
      await tx.unsafe(await readFile('supabase/migrations/20260910090000_scope_duplicate_ad_tombstones.sql', 'utf8'));
      const [product] = await tx`select id, name, config->>'clickup_list_id' as list_id from products
        where id='prod-1776760023723'`;
      assert.equal(product.list_id, '901613534733');
      const meta = { clickupListId: product.list_id, _syncProductId: 'prod-1788261727492',
        _syncProductName: 'Quilting', description: 'Preserve this brief', _fromInspoId: 'test-inspiration' };
      await tx`insert into ads(id,product_id,format_name,status,clickup_task_id,meta)
        values(${local},${product.id},${canonical},'Winner',${canonical},${tx.json(meta)})`;
      const [action] = await tx`insert into manual_actions(product_id,payload,live_status)
        values(${product.id},${tx.json({sourceAdId:local,adId:local,_sourceAdId:local,title:'Keep title',_clickupId:canonical})},'Winner') returning id`;
      const [cell] = await tx`insert into matrix_cells(product_id,angle_id,persona_id,creative_assignments,meta)
        values(${product.id},${canonical},${canonical},${tx.json([local,canonical,'keep-existing'])},
        ${tx.json({per_ad:{[local]:{dueDate:'2026-10-01',status:'Testing'},[canonical]:{status:'Winner'}},keep:'unchanged'})}) returning id`;
      await tx`insert into ads(id,product_id,format_name,status,clickup_task_id,meta)
        values(${canonical},${product.id},${canonical},'Winner',${canonical},${tx.json(meta)})`;

      const [survivor] = await tx`select * from ads where id=${canonical}`;
      const [retired] = await tx`select * from ads where id=${local}`;
      const [tombstone] = await tx`select * from deleted_ads where id=${local}`;
      assert.equal(survivor.deleted_at, null);
      assert.equal(survivor.status, 'Winner');
      assert.equal(survivor.meta._syncProductId, product.id);
      assert.equal(survivor.meta.description, meta.description);
      assert.ok(retired.deleted_at);
      assert.equal(retired.clickup_task_id, null);
      assert.equal(retired.meta._supersededClickUpTaskId, canonical);
      assert.equal(tombstone.clickup_task_id, null);
      const [movedAction] = await tx`select payload from manual_actions where id=${action.id}`;
      assert.equal(movedAction.payload.sourceAdId, canonical);
      assert.equal(movedAction.payload._sourceAdId, canonical);
      assert.equal(movedAction.payload.adId, canonical);
      assert.equal(movedAction.payload.title, 'Keep title');
      const [movedCell] = await tx`select * from matrix_cells where id=${cell.id}`;
      assert.deepEqual(movedCell.creative_assignments, [canonical,'keep-existing']);
      assert.deepEqual(movedCell.meta.per_ad[canonical], {dueDate:'2026-10-01',status:'Winner'});
      assert.equal(movedCell.meta.keep, 'unchanged');

      await tx`update ads set clickup_task_id=${canonical},meta=${tx.json(meta)} where id=${local}`;
      const [staleWrite] = await tx`select * from ads where id=${local}`;
      assert.equal(staleWrite.clickup_task_id, null);
      assert.equal(staleWrite.meta._supersededByAdId, canonical);

      await tx`insert into ads(id,product_id,status,meta) values(${canonical+'-foreign'},${product.id},'Winner',
        ${tx.json({clickupListId:'901616737986',_syncProductId:'prod-1788261727492',_syncProductName:'Quilting'})})`;
      const [foreign] = await tx`select meta from ads where id=${canonical+'-foreign'}`;
      assert.equal(foreign.meta._syncProductId, 'prod-1788261727492');

      const userLocal = `${local}-user`;
      const userCanonical = `${canonical}-user`;
      await tx`insert into ads(id,product_id,status,clickup_task_id) values(${userLocal},${product.id},'Winner',${userCanonical})`;
      await tx`insert into deleted_ads(id,product_id,clickup_task_id,deleted_by)
        values(${userLocal},${product.id},${userCanonical},'explicit-user-deletion')`;
      await tx`insert into ads(id,product_id,status,clickup_task_id) values(${userCanonical},${product.id},'Winner',${userCanonical})`;
      const [userDeletion] = await tx`select clickup_task_id,deleted_by from deleted_ads where id=${userLocal}`;
      assert.equal(userDeletion.clickup_task_id, userCanonical);
      assert.equal(userDeletion.deleted_by, 'explicit-user-deletion');
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  const [remaining] = await sql`select count(*)::int as count from ads where id=${local} or id like ${canonical+'%'}`;
  assert.equal(remaining.count, 0);
  console.log('Passed: surviving winner, row-only tombstones, stale writes, matrix/action links, product isolation, and explicit deletion preservation. All test writes rolled back.');
} finally {
  await sql.end({ timeout: 2 });
}
