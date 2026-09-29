import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';

const apply = process.argv.includes('--apply');
const productId = 'prod-1776684457079';
const canonicalId = '86d3zdxfq';
const duplicateId = 'AD-1785216614574';
const reason = 'trigger:collapse_local_dup_on_sync';
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {
  prepare: false, max: 1, ssl: 'require', connect_timeout: 15, onnotice() {},
});
let backupDirectory;
try {
  const result = await sql.begin(async tx => {
    if (!apply) await tx`set transaction read only`;
    await tx`set local statement_timeout='20s'`;
    await tx`set local lock_timeout='5s'`;
    const ads = apply
      ? await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId}) for update`
      : await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId})`;
    const tombstones = await tx`select * from deleted_ads where product_id=${productId}
      and (id in (${canonicalId},${duplicateId}) or clickup_task_id=${canonicalId})`;
    const cells = await tx`select * from matrix_cells where product_id=${productId}
      and (creative_assignments ?| ${[canonicalId, duplicateId]}::text[] or (meta->'per_ad') ?| ${[canonicalId, duplicateId]}::text[])`;
    const actions = await tx`select * from manual_actions where product_id=${productId}
      and (payload->>'sourceAdId' in (${canonicalId},${duplicateId})
        or payload->>'_sourceAdId' in (${canonicalId},${duplicateId})
        or payload->>'adId' in (${canonicalId},${duplicateId}))`;
    const [guard] = await tx`select pg_get_functiondef(p.oid) as definition from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='ads_normalize_sync_identity'`;
    assert.ok(guard?.definition.includes('_supersededByAdId'), 'Missing stale-client guard');
    const canonical = ads.find(ad => ad.id === canonicalId);
    const duplicate = ads.find(ad => ad.id === duplicateId);
    assert.equal(canonical?.format_name, 'CA-259-INS-085');
    assert.equal(canonical?.status, 'Winner');
    assert.equal(canonical?.deleted_at, null);
    assert.equal(canonical?.clickup_task_id, canonicalId);
    assert.ok(duplicate?.deleted_at);
    assert.equal(duplicate?.clickup_task_id, canonicalId);
    assert.equal(tombstones.length, 1, 'Unexpected deletion markers; stop for review');
    assert.equal(tombstones[0].id, duplicateId);
    assert.equal(tombstones[0].deleted_by, reason, 'Never reverse a user deletion');
    const summary = { task: canonical.format_name, product: 'Canva', status: canonical.status,
      duplicateCleanupAt: duplicate.deleted_at, cells: cells.map(c => ({angle:c.angle_id,persona:c.persona_id,ids:c.creative_assignments})),
      actionCount: actions.length, applied: false };
    if (!apply) return summary;

    backupDirectory = `backups/canva-259-visibility-${new Date().toISOString().replaceAll(':', '-')}`;
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await writeFile(`${backupDirectory}/before.json`, JSON.stringify({ads,tombstones,cells,actions},null,2), {mode:0o600});
    await tx`update ads set clickup_task_id=null, meta=coalesce(meta,'{}'::jsonb) ||
      ${tx.json({_supersededByAdId:canonicalId,_supersededClickUpTaskId:canonicalId})}
      where product_id=${productId} and id=${duplicateId} and deleted_at is not null`;
    await tx`update deleted_ads set clickup_task_id=null
      where product_id=${productId} and id=${duplicateId} and deleted_by=${reason}`;

    // Preserve the same cells and metadata, replacing only the retired row ID.
    for (const cell of cells) {
      const ids = [...new Set(cell.creative_assignments.map(id => id === duplicateId ? canonicalId : id))];
      const meta = structuredClone(cell.meta || {});
      if (meta.per_ad?.[duplicateId]) {
        meta.per_ad[canonicalId] = {...meta.per_ad[duplicateId], ...meta.per_ad[canonicalId]};
        delete meta.per_ad[duplicateId];
      }
      if (JSON.stringify(ids) !== JSON.stringify(cell.creative_assignments) || JSON.stringify(meta) !== JSON.stringify(cell.meta)) {
        await tx`update matrix_cells set creative_assignments=${tx.json(ids)},meta=${tx.json(meta)} where id=${cell.id} and product_id=${productId}`;
      }
    }
    for (const action of actions) {
      const payload = {...action.payload};
      for (const key of ['sourceAdId','_sourceAdId','adId']) if (payload[key] === duplicateId) payload[key] = canonicalId;
      if (JSON.stringify(payload) !== JSON.stringify(action.payload)) {
        await tx`update manual_actions set payload=${tx.json(payload)} where id=${action.id} and product_id=${productId}`;
      }
    }
    const afterAds = await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId})`;
    assert.deepEqual(afterAds.find(ad => ad.id === canonicalId), canonical, 'Canonical task must remain unchanged');
    const afterDuplicate = afterAds.find(ad => ad.id === duplicateId);
    assert.equal(afterDuplicate.clickup_task_id, null);
    assert.deepEqual(afterDuplicate.deleted_at, duplicate.deleted_at);
    const blocking = await tx`select id from deleted_ads where product_id=${productId} and (id=${canonicalId} or clickup_task_id=${canonicalId})
      union all select id from ads where product_id=${productId} and deleted_at is not null and (id=${canonicalId} or clickup_task_id=${canonicalId})`;
    assert.equal(blocking.length, 0, 'Original must not be blocked by deletion caches');
    await writeFile(`${backupDirectory}/after.json`, JSON.stringify({ads:afterAds,blocking},null,2), {mode:0o600});
    return {...summary, applied:true, backupDirectory};
  });
  if (result.applied) await writeFile(`${backupDirectory}/COMMITTED.json`, JSON.stringify(result,null,2), {mode:0o600});
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
} finally {
  await sql.end({timeout:2});
}
