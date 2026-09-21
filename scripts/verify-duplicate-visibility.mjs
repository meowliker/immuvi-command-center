import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';

const directory=process.argv.find(arg=>arg.startsWith('--repair='))?.slice(9);
if (!directory) throw new Error('Provide --repair=<committed backup directory>');
const auditDirectory=path.dirname(directory);
const read=(dir,name)=>readFile(path.join(dir,`${name}.json`),'utf8').then(JSON.parse);
const committed=await read(directory,'COMMITTED');
const before=await read(directory,'before');
const snapshot=await read(auditDirectory,'snapshot');
const verified=await read(auditDirectory,'clickup');
const allBlocked=await read(auditDirectory,'all-blocked');
const repairs=before.plan.repairs;
assert.equal(committed.applied,true);
const ids=repairs.map(r=>r.taskId);
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
try {
  const results=await sql.begin(async tx=>{
    await tx`set transaction isolation level repeatable read read only`;
    await tx`set local statement_timeout='30s'`;
    const ads=await tx`select id,product_id,format_name,status,clickup_task_id,deleted_at,meta->>'_syncProductId' as sync_product
      from ads where id=any(${ids}::text[])`;
    const markers=await tx`select * from deleted_ads`;
    const retired=await tx`select id,product_id,clickup_task_id from ads where deleted_at is not null and clickup_task_id=any(${ids}::text[])`;
    const cells=await tx`select product_id,angle_id,persona_id,creative_assignments from matrix_cells where creative_assignments ?| ${ids}::text[]`;
    const [guard]=await tx`select count(*)::int as count from pg_trigger where tgrelid='public.deleted_ads'::regclass
      and tgname='deleted_ads_scope_duplicate_retirement' and tgenabled='O'`;
    assert.equal(guard.count,1);
    for (const repair of repairs) {
      const ad=ads.find(row=>row.id===repair.taskId);
      assert.equal(ad?.product_id,repair.productId);
      assert.equal(ad.deleted_at,null);
      assert.equal(ad.clickup_task_id,repair.taskId);
      assert.ok(!ad.sync_product||ad.sync_product===repair.productId);
      assert.equal(markers.filter(m=>m.product_id===repair.productId&&(m.id===repair.taskId||m.clickup_task_id===repair.taskId)).length,0);
      assert.equal(retired.filter(r=>r.product_id===repair.productId&&r.clickup_task_id===repair.taskId).length,0);
    }
    // Every pre-existing non-automatic marker is intentionally outside the repair.
    for (const marker of snapshot.markers.filter(m=>m.deleted_by!=='trigger:collapse_local_dup_on_sync')) {
      const current=markers.find(m=>m.id===marker.id);
      assert.deepEqual(JSON.parse(JSON.stringify(current)),marker,`Preserved deletion changed: ${marker.id}`);
    }
    return {ads,cells};
  });
  const repairedIds=new Set(ids);
  const automaticTargets=new Set(snapshot.markers.filter(m=>m.deleted_by==='trigger:collapse_local_dup_on_sync').map(m=>m.clickup_task_id));
  const ambiguous=allBlocked.filter(ad=>!automaticTargets.has(ad.clickup_task_id)&&!repairedIds.has(ad.id));
  const verifiedReview=ambiguous.filter(ad=>verified[ad.clickup_task_id]&&!verified[ad.clickup_task_id].error);
  const inaccessibleReview=ambiguous.filter(ad=>!verified[ad.clickup_task_id]||verified[ad.clickup_task_id].error);
  const productNames=new Map(snapshot.products.map(p=>[p.id,p.name]));
  const exceptionReason=repair=>{
    const ad=snapshot.ads.find(row=>row.id===repair.taskId);
    return ad && !ad.deleted_at && ad.clickup_task_id!==repair.taskId
      ? 'Canonical row points to a different ClickUp task; identity repair requires review'
      : repair.reason;
  };
  const escape=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
  const rows=repairs.map(r=>{
    const ad=results.ads.find(a=>a.id===r.taskId);
    const cells=results.cells.filter(c=>c.product_id===r.productId&&c.creative_assignments.includes(r.taskId));
    return `| ${escape(r.product)} | ${escape(ad.format_name)} | ${escape(ad.status)} | ${cells.map(c=>`${escape(c.angle_id)} x ${escape(c.persona_id)}`).join('; ')||'No stored cell assignment'} |`;
  });
  const lines=['# All-product missing-task audit','',`Verified: ${new Date().toISOString()}`,'',
    `- Products audited: ${snapshot.products.length}.`,
    `- Confirmed duplicate visibility repairs committed: ${repairs.length}.`,
    `- Corrected stale product-routing metadata: ${committed.routingCorrections}.`,
    `- Matrix references repaired: ${committed.cellsChanged}; action records changed: ${committed.actionsChanged}.`,
    '- Fresh database verification: no deletion blockers or wrong routing remain for the repaired tasks.',
    '- All pre-existing non-automatic deletion markers are unchanged.',
    '- No browser test was performed. Refresh Immuvi to clear the old in-memory deletion cache.','',
    '## Repairs by product','',...Object.entries(committed.byProduct).map(([name,count])=>`- ${name}: ${count}`),'',
    '## Preserved for review','',
    `The user explicitly chose to preserve the ${verifiedReview.length} ClickUp-accessible tasks below because their self-heal markers do not establish the original deletion intent.`,'',
    '| Product | Task | ClickUp ID |','| --- | --- | --- |',
    ...verifiedReview.map(ad=>`| ${escape(productNames.get(ad.product_id))} | ${escape(ad.format_name)} | ${ad.clickup_task_id} |`),'',
    '## Other exceptions','',...before.plan.skipped.map(r=>`- ${r.product}: ${r.task} (${r.taskId}) - ${exceptionReason(r)}.`),
    ...inaccessibleReview.map(ad=>`- ${productNames.get(ad.product_id)}: ${ad.format_name} (${ad.clickup_task_id}) - self-heal deletion preserved; ClickUp access unavailable.`),'',
    '## Repaired tasks','', '| Product | Task | Status | Stored matrix cells |','| --- | --- | --- | --- |',...rows,'',
    '## Recovery','',`Private before/after snapshots and commit record: ${path.resolve(directory)}`,
    'Restore only recorded changed fields after comparing current values with after.json; do not overwrite later user edits. Restoring old task-wide deletion links reintroduces this bug.',''];
  await writeFile(path.join(auditDirectory,'report.md'),lines.join('\n'),{mode:0o600});
  const summary={repairsVerified:repairs.length,preservedForReview:verifiedReview.length,
    inaccessibleSelfHeal:inaccessibleReview.length,otherExceptions:before.plan.skipped.length,
    task227:results.ads.find(ad=>ad.format_name==='CA-227-INS-054'),report:path.resolve(auditDirectory,'report.md')};
  await writeFile(path.join(directory,'VERIFIED.json'),JSON.stringify(summary,null,2),{mode:0o600});
  console.log(JSON.stringify(summary,null,2));
} finally {await sql.end({timeout:2});}
