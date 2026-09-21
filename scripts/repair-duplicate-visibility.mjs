import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';
import { automaticDeletionReason,planDuplicateVisibility,remapCell,remapAction } from './lib/duplicate-visibility-plan.mjs';

const apply = process.argv.includes('--apply');
const rehearse = process.argv.includes('--rehearse');
assert.ok(!(apply&&rehearse),'Choose either --apply or --rehearse');
const mutate = apply||rehearse;
const rollback = new Error('ROLLBACK_VERIFIED_REHEARSAL');
let rehearsalResult;
const auditDirectory = process.argv.find(arg=>arg.startsWith('--audit='))?.slice(8);
if (!auditDirectory) throw new Error('Provide --audit=<private audit directory>; defaults to read-only');
const snapshot = JSON.parse(await readFile(path.join(auditDirectory,'snapshot.json'),'utf8'));
const verified = JSON.parse(await readFile(path.join(auditDirectory,'clickup.json'),'utf8'));
const expectedPlan = planDuplicateVisibility(snapshot,verified);
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15,onnotice() {}});
const directory = path.join(auditDirectory,`repair-${new Date().toISOString().replaceAll(':','-')}`);
const save = (name,value)=>writeFile(path.join(directory,`${name}.json`),JSON.stringify(value,null,2),{mode:0o600});
const plain = value=>JSON.parse(JSON.stringify(value));
const omit = (value,keys)=>Object.fromEntries(Object.entries(plain(value)).filter(([key])=>!keys.includes(key)));
try {
  const result = await sql.begin(async tx=>{
    await tx`set transaction isolation level serializable`;
    if (!mutate) await tx`set transaction read only`;
    await tx`set local statement_timeout='30s'`;
    await tx`set local lock_timeout='5s'`;
    const fresh = {
      products:await tx`select id,name,config->>'clickup_list_id' as list_id from products order by id`,
      ads:await tx`select id,product_id,format_name,status,clickup_task_id,deleted_at,angle,persona,
        meta->>'_supersededByAdId' as superseded_by,meta->>'_supersededClickUpTaskId' as superseded_task,
        meta->>'_syncProductId' as sync_product,coalesce(meta->>'clickupListId',meta->>'listId') as source_list
        from ads order by product_id,id`,
      markers:await tx`select * from deleted_ads order by product_id,id`,
    };
    const plan = planDuplicateVisibility(fresh,verified);
    const summary = {productsAudited:fresh.products.length,repairs:plan.repairs.length,
      routingCorrections:plan.repairs.filter(r=>r.normalizeRouting).length,
      byProduct:Object.fromEntries([...new Set(plan.repairs.map(r=>r.product))].map(name=>[name,plan.repairs.filter(r=>r.product===name).length])),
      skipped:plan.skipped,applied:false};
    if (!mutate) {console.log(JSON.stringify(summary,null,2));return;}
    assert.deepEqual(plan,expectedPlan,'Audit changed; rerun read-only audit before applying');
    assert.ok(plan.repairs.length,'No confirmed repair candidates');
    for (const repair of plan.repairs) {
      const age=Date.now()-Date.parse(verified[repair.taskId].verifiedAt);
      assert.ok(Number.isFinite(age)&&age>=0&&age<24*60*60*1000,'ClickUp evidence must be less than 24 hours old');
    }
    const ids=[...new Set(plan.repairs.flatMap(r=>[r.taskId,r.duplicateId]))];
    const products=[...new Set(plan.repairs.map(r=>r.productId))];
    const before = {
      ads:await tx`select * from ads where id=any(${ids}::text[]) order by id for update`,
      markers:await tx`select * from deleted_ads where product_id=any(${products}::text[])
        and (id=any(${ids}::text[]) or clickup_task_id=any(${ids}::text[])) order by id for update`,
      cells:await tx`select * from matrix_cells where product_id=any(${products}::text[]) and
        (creative_assignments ?| ${ids}::text[] or (meta->'per_ad') ?| ${ids}::text[]) order by id for update`,
      actions:await tx`select * from manual_actions where product_id=any(${products}::text[]) and
        (payload->>'sourceAdId'=any(${ids}::text[]) or payload->>'_sourceAdId'=any(${ids}::text[]) or payload->>'adId'=any(${ids}::text[])) order by id for update`,
    };
    const [guard] = await tx`select count(*)::int as count from pg_trigger where tgrelid='public.deleted_ads'::regclass
      and tgname='deleted_ads_scope_duplicate_retirement' and tgenabled='O'`;
    assert.equal(guard.count,1,'Preventive marker guard must already be installed');
    await mkdir(directory,{recursive:true,mode:0o700});
    await save('before',{...before,plan,verified});

    const replacements = new Map(products.map(id=>[id,new Map()]));
    for (const repair of plan.repairs) {
      const {productId,taskId,duplicateId}=repair;
      replacements.get(productId).set(duplicateId,taskId);
      if (repair.hasDuplicate) {
        const changed = await tx`update ads set clickup_task_id=null,meta=coalesce(meta,'{}'::jsonb) ||
          ${tx.json({_supersededByAdId:taskId,_supersededClickUpTaskId:taskId})}
          where id=${duplicateId} and product_id=${productId} and deleted_at is not null returning id`;
        assert.equal(changed.length,1);
      }
      const changed = await tx`update deleted_ads set clickup_task_id=null where id=${duplicateId}
        and product_id=${productId} and deleted_by=${automaticDeletionReason} returning id`;
      assert.equal(changed.length,1);
      if (repair.normalizeRouting) {
        await tx`update ads set meta=coalesce(meta,'{}'::jsonb) ||
          ${tx.json({_syncProductId:productId,_syncProductName:repair.product})}
          where id=${taskId} and product_id=${productId} and deleted_at is null`;
      }
    }
    let cellsChanged=0,actionsChanged=0;
    for (const cell of before.cells) {
      const mapped=remapCell(cell,replacements.get(cell.product_id));
      if (JSON.stringify(mapped)!==JSON.stringify(cell)) {
        await tx`update matrix_cells set creative_assignments=${tx.json(mapped.creative_assignments)},meta=${tx.json(mapped.meta)}
          where id=${cell.id} and product_id=${cell.product_id}`;
        cellsChanged++;
      }
    }
    for (const action of before.actions) {
      const mapped=remapAction(action,replacements.get(action.product_id));
      if (JSON.stringify(mapped)!==JSON.stringify(action)) {
        await tx`update manual_actions set payload=${tx.json(mapped.payload)} where id=${action.id} and product_id=${action.product_id}`;
        actionsChanged++;
      }
    }
    const after = {
      ads:await tx`select * from ads where id=any(${ids}::text[]) order by id`,
      markers:await tx`select * from deleted_ads where id=any(${before.markers.map(r=>r.id)}::text[]) order by id`,
      cells:await tx`select * from matrix_cells where id=any(${before.cells.map(r=>r.id)}::uuid[]) order by id`,
      actions:await tx`select * from manual_actions where id=any(${before.actions.map(r=>r.id)}::uuid[]) order by id`,
    };
    const afterAds=new Map(after.ads.map(ad=>[ad.id,ad]));
    for (const old of before.ads) {
      const current=afterAds.get(old.id);
      const routing=plan.repairs.find(r=>r.taskId===old.id&&r.normalizeRouting);
      const retirement=plan.repairs.find(r=>r.duplicateId===old.id&&r.productId===old.product_id&&r.hasDuplicate);
      if (!routing&&!retirement) {assert.deepEqual(current,old);continue;}
      assert.deepEqual(omit(current,['meta','updated_at','clickup_task_id']),omit(old,['meta','updated_at','clickup_task_id']));
      const mutableMeta=retirement?['_syncProductId','_syncProductName','_supersededByAdId','_supersededClickUpTaskId']:['_syncProductId','_syncProductName'];
      assert.deepEqual(omit(current.meta||{},mutableMeta),omit(old.meta||{},mutableMeta),'Brief and other metadata must be preserved');
      assert.equal(current.clickup_task_id,retirement?null:old.clickup_task_id);
    }
    for (const old of before.cells) assert.deepEqual(omit(after.cells.find(r=>r.id===old.id),['updated_at']),omit(remapCell(old,replacements.get(old.product_id)),['updated_at']));
    for (const old of before.actions) assert.deepEqual(omit(after.actions.find(r=>r.id===old.id),['updated_at']),omit(remapAction(old,replacements.get(old.product_id)),['updated_at']));
    for (const repair of plan.repairs) {
      const blockers=await tx`select id from deleted_ads where product_id=${repair.productId} and (id=${repair.taskId} or clickup_task_id=${repair.taskId})
        union all select id from ads where product_id=${repair.productId} and deleted_at is not null and (id=${repair.taskId} or clickup_task_id=${repair.taskId})`;
      assert.equal(blockers.length,0,`Unresolved deletion blocker: ${repair.taskId}`);
      const canonical=afterAds.get(repair.taskId);
      assert.ok(!canonical.meta?._syncProductId || canonical.meta._syncProductId===repair.productId);
    }
    await save('after',after);
    const outcome={...summary,applied:apply,cellsChanged,actionsChanged,backupDirectory:directory};
    if (rehearse) {rehearsalResult=outcome;throw rollback;}
    return outcome;
  });
  if (result) {await save('COMMITTED',result);console.log(JSON.stringify(result,null,2));}
} catch (error) {
  if (error===rollback) {
    await save('ROLLED_BACK',rehearsalResult);
    console.log(JSON.stringify({...rehearsalResult,rehearsalPassed:true},null,2));
  } else {
    console.error(error.code || error.message);
    process.exitCode=1;
  }
} finally {
  await sql.end({timeout:2});
}
