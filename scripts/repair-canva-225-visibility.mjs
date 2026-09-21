import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';

const apply = process.argv.includes('--apply');
const productId = 'prod-1776684457079';
const canonicalId = '86d3f25z1';
const duplicateId = 'AD-1781785866609';
const reason = 'trigger:collapse_local_dup_on_sync';
const migration = await readFile(new URL('../supabase/migrations/20260921090000_guard_duplicate_deletion_markers.sql', import.meta.url), 'utf8');
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
      ? await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId}) order by id for update`
      : await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId}) order by id`;
    const tombstones = apply
      ? await tx`select * from deleted_ads where product_id=${productId} and (id in (${canonicalId},${duplicateId}) or clickup_task_id=${canonicalId}) order by id for update`
      : await tx`select * from deleted_ads where product_id=${productId} and (id in (${canonicalId},${duplicateId}) or clickup_task_id=${canonicalId}) order by id`;
    const readCells = () => tx`select * from matrix_cells where product_id=${productId}
      and (creative_assignments ?| ${[canonicalId,duplicateId]}::text[] or (meta->'per_ad') ?| ${[canonicalId,duplicateId]}::text[]) order by id`;
    const readActions = () => tx`select * from manual_actions where product_id=${productId}
      and (payload->>'sourceAdId' in (${canonicalId},${duplicateId})
        or payload->>'_sourceAdId' in (${canonicalId},${duplicateId})
        or payload->>'adId' in (${canonicalId},${duplicateId})) order by id`;
    const cells = await readCells();
    const actions = await readActions();
    const functions = await tx`select p.proname,pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('ads_normalize_sync_identity','deleted_ads_scope_duplicate_retirement')`;
    const triggers = await tx`select tgname,pg_get_triggerdef(oid) as definition from pg_trigger
      where tgrelid='public.deleted_ads'::regclass and not tgisinternal`;
    assert.ok(functions.find(f=>f.proname==='ads_normalize_sync_identity')?.definition.includes('_supersededByAdId'));
    const canonical = ads.find(ad=>ad.id===canonicalId);
    const duplicate = ads.find(ad=>ad.id===duplicateId);
    assert.equal(canonical?.format_name,'CA-225-INS-051');
    assert.equal(canonical?.status,'Winner');
    assert.equal(canonical?.deleted_at,null);
    assert.equal(canonical?.clickup_task_id,canonicalId);
    assert.equal(duplicate?.format_name,canonical.format_name);
    assert.ok(duplicate?.deleted_at);
    assert.ok(duplicate.clickup_task_id===canonicalId || (duplicate.clickup_task_id===null && duplicate.meta?._supersededByAdId===canonicalId));
    assert.equal(tombstones.length,1,'Unexpected deletion markers; stop for review');
    assert.equal(tombstones[0].id,duplicateId);
    assert.equal(tombstones[0].deleted_by,reason,'Never reverse a user deletion');
    assert.ok(cells.some(cell=>cell.creative_assignments.includes(canonicalId)),'Canonical matrix membership must already exist');
    const summary = {task:canonical.format_name,product:'Canva',status:canonical.status,
      canonicalId,duplicateId,matrixCells:cells.length,applied:false};
    if (!apply) return summary;

    backupDirectory = `backups/canva-225-visibility-${new Date().toISOString().replaceAll(':','-')}`;
    await mkdir(backupDirectory,{recursive:true,mode:0o700});
    await writeFile(`${backupDirectory}/before.json`,JSON.stringify({ads,tombstones,cells,actions,functions,triggers},null,2),{mode:0o600});
    await tx.unsafe(migration);
    await tx`update ads set clickup_task_id=null,meta=coalesce(meta,'{}'::jsonb) ||
      ${tx.json({_supersededByAdId:canonicalId,_supersededClickUpTaskId:canonicalId})}
      where product_id=${productId} and id=${duplicateId} and deleted_at is not null`;
    await tx`update deleted_ads set clickup_task_id=null
      where product_id=${productId} and id=${duplicateId} and deleted_by=${reason}`;

    const afterAds = await tx`select * from ads where product_id=${productId} and id in (${canonicalId},${duplicateId}) order by id`;
    assert.deepEqual(afterAds.find(ad=>ad.id===canonicalId),canonical,'Canonical task must remain unchanged');
    assert.deepEqual(await readCells(),cells,'Matrix cells must remain unchanged');
    assert.deepEqual(await readActions(),actions,'Action plan records must remain unchanged');
    assert.equal(afterAds.find(ad=>ad.id===duplicateId).clickup_task_id,null);
    assert.deepEqual(afterAds.find(ad=>ad.id===duplicateId).deleted_at,duplicate.deleted_at);
    const blocking = await tx`select id from deleted_ads where product_id=${productId} and (id=${canonicalId} or clickup_task_id=${canonicalId})
      union all select id from ads where product_id=${productId} and deleted_at is not null and (id=${canonicalId} or clickup_task_id=${canonicalId})`;
    assert.equal(blocking.length,0,'Original must not be blocked by deletion caches');
    const afterTombstones = await tx`select * from deleted_ads where id=${duplicateId} and product_id=${productId}`;
    await writeFile(`${backupDirectory}/after.json`,JSON.stringify({ads:afterAds,tombstones:afterTombstones,blocking},null,2),{mode:0o600});
    return {...summary,applied:true,backupDirectory};
  });
  if (result.applied) await writeFile(`${backupDirectory}/COMMITTED.json`,JSON.stringify(result,null,2),{mode:0o600});
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode=1;
} finally {
  await sql.end({timeout:2});
}
