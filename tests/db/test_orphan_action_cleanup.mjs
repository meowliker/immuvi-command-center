import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {targetEnv} from '../../scripts/strategist-env.mjs';
const {default:postgres}=await import(process.env.IMMUVI_TEST_POSTGRES_MODULE||'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const migration=await readFile(new URL('../../supabase/migrations/20261016000200_confirmed_orphan_action_cleanup.sql',import.meta.url),'utf8');
const prefix='orphan-confirm-probe-'+Date.now(),rollback=new Error('ROLLBACK_SUCCESS');
try{
  try{await sql.begin(async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='20s'`;
    await tx.unsafe(migration);await tx.unsafe(migration);
    const [member]=await tx`select p.id,up.product_id from profiles p join user_products up on up.user_id=p.id where p.role='member' and p.is_active=true limit 1`;
    const [foreign]=await tx`select id from products where not exists(select 1 from user_products up where up.product_id=products.id and up.user_id=${member.id}) limit 1`;
    assert.ok(member&&foreign);
    const source=prefix+'-shared-source',cu=prefix+'-task';
    await tx`insert into ads(id,product_id,format_name,clickup_task_id,status,deleted_at,meta) values
      (${source},${foreign.id},'Do not touch this foreign creative',${cu+'-foreign'},'Winner',now(),'{"notes":"preserve"}'::jsonb),
      (${prefix+'-saved'},${member.product_id},'Keep this local creative',${cu+'-saved'},'Testing',null,'{}'::jsonb)`;
    await tx`insert into deleted_ads(id,product_id,clickup_task_id,deleted_by) values(${source},${foreign.id},${cu+'-foreign'},'fixture-explicit-user')`;
    const [target]=await tx`insert into manual_actions(product_id,payload) values(${member.product_id},${tx.json({id:prefix+'-target',sourceAdId:source,adId:source,_clickupId:cu,clickupTaskId:cu,title:'Synthetic orphan'})}) returning *`;
    const [other]=await tx`insert into manual_actions(product_id,payload) values(${member.product_id},${tx.json({id:prefix+'-keep',sourceAdId:prefix+'-saved',_clickupId:cu+'-saved'})}) returning *`;
    const [foreignAdBefore]=await tx`select * from ads where id=${source}`;
    const [foreignMarkerBefore]=await tx`select * from deleted_ads where id=${source}`;
    const [localAdBefore]=await tx`select * from ads where id=${prefix+'-saved'}`;
    await tx`select set_config('request.jwt.claim.sub',${member.id},true)`;await tx`set local role authenticated`;
    const [p]=await tx`select public.delete_orphan_action(${member.product_id},${source},${cu},${target.id},false) as result`;
    assert.equal(p.result.preview,true);assert.equal(p.result.deletedAt,null);assert.equal(p.result.actionId,target.id);
    assert.equal(p.result.markerId,'orphan-action:'+member.product_id+':'+target.id);
    const [stillThere]=await tx`select * from manual_actions where id=${target.id}`;assert.deepEqual(stillThere,target);
    const [noMarker]=await tx`select count(*)::int as count from deleted_ads where id=${p.result.markerId}`;assert.equal(noMarker.count,0);
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${member.product_id},${source},${cu},null,true)`),e=>e.code==='PT409');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${foreign.id},${source},${cu},${target.id},true)`),e=>e.code==='42501');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${member.product_id},${source},${cu+'-wrong'},${target.id},true)`),e=>e.code==='PT409');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${member.product_id},${source},${cu+'-saved'},${target.id},true)`),e=>e.code==='PT409');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${member.product_id},${source},${cu+'-foreign'},${target.id},true)`),e=>e.code==='PT409');
    const [saved]=await tx`select public.delete_orphan_action(${member.product_id},${source},${cu},${target.id},true) as result`;
    const [again]=await tx`select public.delete_orphan_action(${member.product_id},${source},${cu},${target.id},true) as result`;
    assert.equal(again.result.alreadyDeleted,true);assert.equal(again.result.deletedAt,saved.result.deletedAt);
    const [removed]=await tx`select count(*)::int as count from manual_actions where id=${target.id}`;assert.equal(removed.count,0);
    const [marker]=await tx`select * from deleted_ads where id=${p.result.markerId}`;
    assert.equal(marker.product_id,member.product_id);assert.equal(marker.clickup_task_id,cu);assert.equal(marker.deleted_by,member.id);
    await tx`reset role`;
    const [foreignAdAfter]=await tx`select * from ads where id=${source}`;assert.deepEqual(foreignAdAfter,foreignAdBefore);
    const [foreignMarkerAfter]=await tx`select * from deleted_ads where id=${source}`;assert.deepEqual(foreignMarkerAfter,foreignMarkerBefore);
    const [localAdAfter]=await tx`select * from ads where id=${prefix+'-saved'}`;assert.deepEqual(localAdAfter,localAdBefore);
    const [otherAfter]=await tx`select * from manual_actions where id=${other.id}`;assert.deepEqual(otherAfter,other);
    await tx`set local role anon`;
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_orphan_action(${member.product_id},${source},${cu},${target.id},true)`),e=>e.code==='42501');
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  const [left]=await sql`select count(*)::int as count from ads where id like ${prefix+'%'}`;assert.equal(left.count,0);
  console.log('Passed: read-only preview, explicit confirmation, exact saved action, member authorization, source/task conflicts, foreign creative and deletion-marker preservation, independent entry preservation, idempotence and anonymous denial. All fixture and function changes rolled back.');
}finally{await sql.end({timeout:2});}
