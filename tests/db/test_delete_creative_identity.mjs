import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {targetEnv} from '../../scripts/strategist-env.mjs';
const {default:postgres}=await import(process.env.IMMUVI_TEST_POSTGRES_MODULE || 'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{max:1,prepare:false,ssl:'require',connect_timeout:15});
const migration=await readFile(new URL('../../supabase/migrations/20261016000100_delete_creative_task_identity.sql',import.meta.url),'utf8');
const prefix='delete-identity-probe-'+Date.now(), rollback=new Error('ROLLBACK_SUCCESS');
try {
  try {await sql.begin(async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='20s'`;
    await tx.unsafe(migration);await tx.unsafe(migration);
    const [member]=await tx`select p.id,up.product_id from profiles p join user_products up on up.user_id=p.id
      where p.role='member' and p.is_active=true limit 1`;assert.ok(member);
    const [foreign]=await tx`select id from products where not exists(select 1 from user_products up where up.product_id=products.id and up.user_id=${member.id}) limit 1`;assert.ok(foreign);
    const canonical=prefix+'-canonical',child=prefix+'-child',cu=prefix+'-cu';
    await tx`insert into ads(id,product_id,format_name,status,clickup_task_id,meta) values
      (${canonical},${member.product_id},'Synthetic deletion fixture','Testing',${cu},'{}'::jsonb),
      (${child},${member.product_id},'Preserve this independent variation','Winner',${cu+'-child'},'{}'::jsonb)`;
    const [normal]=await tx`insert into manual_actions(product_id,payload) values(${member.product_id},${tx.json({id:prefix+'-ma',sourceAdId:canonical,_clickupId:cu})}) returning id`;
    const [alias]=await tx`insert into manual_actions(product_id,payload) values(${member.product_id},${tx.json({id:prefix+'-alias-ma',sourceAdId:prefix+'-old-alias',_clickupId:cu})}) returning id`;
    const [keep]=await tx`insert into manual_actions(product_id,payload) values(${member.product_id},${tx.json({id:prefix+'-keep-ma',sourceAdId:child,_clickupId:cu+'-child'})}) returning id`;
    const [before]=await tx`select * from ads where id=${canonical}`;
    const [childBefore]=await tx`select * from ads where id=${child}`;
    await tx`select set_config('request.jwt.claim.sub',${member.id},true)`;await tx`set local role authenticated`;
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_creative(${canonical},${foreign.id},${cu})`),e=>e.code==='42501');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_creative(${canonical},${member.product_id},${cu+'-wrong'})`),e=>e.code==='PT409');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_creative(${prefix+'-missing'},${member.product_id},${cu+'-missing'})`),e=>e.code==='P0002');
    const [one]=await tx`select public.delete_creative(${canonical},${member.product_id},${cu}) as result`;
    const [two]=await tx`select public.delete_creative(${canonical},${member.product_id},${cu}) as result`;
    assert.deepEqual(two.result,one.result);assert.equal(one.result.id,canonical);
    assert.deepEqual(one.result.clickupTaskIds,[cu]);
    const [after]=await tx`select * from ads where id=${canonical}`;assert.ok(after.deleted_at);
    const strip=row=>{const copy={...row};delete copy.deleted_at;delete copy.updated_at;return copy;};assert.deepEqual(strip(after),strip(before));
    const [childAfter]=await tx`select * from ads where id=${child}`;assert.deepEqual(childAfter,childBefore);
    const actions=await tx`select id from manual_actions where id in ${tx([normal.id,alias.id,keep.id])}`;
    assert.deepEqual(actions.map(r=>r.id),[keep.id]);
    const markers=await tx`select id,product_id,clickup_task_id from deleted_ads where id like ${prefix+'%'}`;
    assert.deepEqual(Array.from(markers),[{id:canonical,product_id:member.product_id,clickup_task_id:cu}]);
    await tx`set local role anon`;
    await assert.rejects(()=>tx.savepoint(sp=>sp`select public.delete_creative(${child},${member.product_id},${cu+'-child'})`),e=>e.code==='42501');
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  const [remaining]=await sql`select count(*)::int as count from ads where id like ${prefix+'%'}`;assert.equal(remaining.count,0);
  console.log('Passed: member authorization, foreign product rejection, identity conflict, missing-row preservation, idempotence, exact task-action cleanup, independent variation preservation, and anonymous denial. All fixture and function changes rolled back.');
}finally{await sql.end({timeout:2});}
