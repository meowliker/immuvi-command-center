import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';

const apply = process.argv.includes('--apply');
const expected = new Map([['86d3bxgpb','AT-206-INS-121'],['86d3tv2f2','AT-242-INS-133']]);
const productId = 'prod-1776760023723';
const listId = '901613534733';
const cleanupReason = 'trigger:collapse_local_dup_on_sync';
const env = targetEnv();
const verifiedTasks = [];
for (const [id, name] of expected) {
  const response = await fetch(`https://api.clickup.com/api/v2/task/${id}`, {
    headers: { Authorization: env.CLICKUP_TOKEN }, signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, `ClickUp lookup failed for ${name}`);
  const task = await response.json();
  assert.equal(task.name, name);
  assert.equal(task.list.id, listId);
  assert.equal(task.status.status.toLowerCase(), 'winner');
  verifiedTasks.push(task);
}

const sql = postgres(env.STRATEGIST_DATABASE_URL, { prepare: false, max: 1, ssl: 'require', connect_timeout: 15, onnotice: () => {} });
const taskIds = [...expected.keys()];
let backupDirectory;
try {
  const result = await sql.begin(async tx => {
    await tx`set local lock_timeout='8s'`;
    await tx`set local statement_timeout='30s'`;
    const [product] = await tx`select id,name,config->>'clickup_list_id' as list_id from products where id=${productId}`;
    assert.equal(product.list_id, listId);
    const ads = await tx`select * from ads where product_id=${productId}
      and (clickup_task_id in ${tx(taskIds)} or id in ${tx(taskIds)}
        or meta->>'_supersededClickUpTaskId' in ${tx(taskIds)}) for update`;
    const rowIds = ads.map(ad => ad.id);
    const tombstones = await tx`select * from deleted_ads where product_id=${productId}
      and (id in ${tx(rowIds)} or clickup_task_id in ${tx(taskIds)}) for update`;
    const actions = await tx`select * from manual_actions where product_id=${productId}
      and (payload->>'_clickupId' in ${tx(taskIds)} or payload->>'clickupTaskId' in ${tx(taskIds)}
        or payload->>'sourceAdId' in ${tx(rowIds)} or payload->>'adId' in ${tx(rowIds)}) for update`;
    const cells = await tx`select * from matrix_cells where product_id=${productId}
      and (creative_assignments ?| ${rowIds}::text[] or (meta->'per_ad') ?| ${rowIds}::text[]) for update`;
    const functions = await tx`select p.proname,pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('ads_collapse_local_dup_on_sync','ads_normalize_sync_identity')`;
    const triggers = await tx`select tgname,pg_get_triggerdef(oid) as definition from pg_trigger
      where tgrelid='public.ads'::regclass and not tgisinternal`;
    for (const [id,name] of expected) {
      const canonical = ads.find(ad => ad.id === id);
      assert.ok(canonical, `Missing canonical record: ${name}`);
      assert.equal(canonical.format_name, name);
      assert.equal(canonical.status, 'Winner');
      assert.equal(canonical.deleted_at, null);
      assert.equal(canonical.meta.clickupListId || canonical.meta.listId, listId);
      assert.ok(!tombstones.some(t => (t.id === id || t.clickup_task_id === id) && t.deleted_by !== cleanupReason),
        `Explicit deletion exists for ${name}; do not restore automatically`);
    }
    const summary = { tasks: [...expected.values()], adRows: ads.length, cleanupMarkers: tombstones.length,
      actionRows: actions.length, matrixCells: cells.length };
    if (!apply) return { ...summary, applied: false };

    backupDirectory = `backups/art-therapy-winner-visibility-${new Date().toISOString().replaceAll(':','-')}`;
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await writeFile(`${backupDirectory}/before.json`, JSON.stringify({product,ads,tombstones,actions,cells,functions,triggers,verifiedTasks},null,2), {mode:0o600});
    await tx.unsafe(await readFile('supabase/migrations/20260910090000_scope_duplicate_ad_tombstones.sql','utf8'));

    for (const [id] of expected) {
      const canonical = ads.find(ad => ad.id === id);
      const siblings = ads.filter(ad => ad.clickup_task_id === id && ad.id !== id);
      const mergedMeta = Object.assign({}, ...siblings.map(ad => ad.meta || {}), canonical.meta || {});
      // Updating the canonical identity invokes the corrected duplicate cleanup.
      await tx`update ads set meta=${tx.json(mergedMeta)},clickup_task_id=${id} where id=${id} and product_id=${productId}`;
      for (const sibling of siblings.filter(ad => ad.deleted_at)) {
        const tombstone = tombstones.find(t => t.id === sibling.id);
        if (tombstone?.deleted_by !== cleanupReason) continue;
        await tx`update ads set clickup_task_id=null,meta=coalesce(meta,'{}'::jsonb)||
          ${tx.json({_supersededByAdId:id,_supersededClickUpTaskId:id})}
          where id=${sibling.id} and product_id=${productId} and deleted_at is not null`;
        await tx`update deleted_ads set clickup_task_id=null where id=${sibling.id}
          and product_id=${productId} and deleted_by=${cleanupReason}`;
      }
    }

    const afterAds = await tx`select * from ads where id in ${tx(rowIds)}`;
    const afterTombstones = await tx`select * from deleted_ads where product_id=${productId}
      and (id in ${tx(rowIds)} or clickup_task_id in ${tx(taskIds)})`;
    const afterActions = actions.length ? await tx`select * from manual_actions where id in ${tx(actions.map(a=>a.id))}` : [];
    const afterCells = cells.length ? await tx`select * from matrix_cells where id in ${tx(cells.map(c=>c.id))}` : [];
    for (const [id] of expected) {
      const before = ads.find(ad => ad.id === id);
      const live = afterAds.filter(ad => ad.clickup_task_id === id && ad.deleted_at === null);
      assert.equal(live.length, 1, 'Exactly one live record must remain per task');
      const [after] = live;
      for (const key of ['id','product_id','format_name','status','angle','persona','ad_link','drive_link','ad_type','funnel_stage']) {
        assert.deepEqual(after[key],before[key],`Creative field changed: ${key}`);
      }
      assert.equal(after.meta.description, before.meta.description);
      assert.equal(after.meta._syncProductId, productId);
      assert.equal(after.meta._syncProductName, 'Art Therapy');
      assert.ok(!afterTombstones.some(t => t.clickup_task_id === id));
      assert.ok(!afterAds.some(ad => ad.deleted_at && ad.clickup_task_id === id));
      assert.ok(afterCells.some(cell => cell.creative_assignments.includes(id)), 'Winner must remain assigned to its matrix cell');
    }
    await writeFile(`${backupDirectory}/after.json`,JSON.stringify({ads:afterAds,tombstones:afterTombstones,actions:afterActions,cells:afterCells},null,2),{mode:0o600});
    return {...summary,applied:true,backupDirectory};
  });
  if (apply) await writeFile(`${backupDirectory}/COMMITTED.json`,JSON.stringify({committedAt:new Date().toISOString(),...result},null,2),{mode:0o600});
  console.log(JSON.stringify(result));
} finally {
  await sql.end({timeout:2});
}
