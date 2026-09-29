import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { qaServiceKey } from './qa-service-config.mjs';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../lib/qa-supabase-env.js';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(QA_SUPABASE_URL,qaServiceKey({fromCli:true}),options);
const product='qa-sample-astrorekha',stamp=randomUUID(),shared=randomUUID(),privateId=randomUUID(),jobId=randomUUID();
const source=`qa-shared-api-${stamp}`,token=randomBytes(32).toString('hex'),users=[];
const check=(result,label)=>{if(result.error)throw new Error(`${label} failed (${result.error.code||'network'}).`);return result.data;};
try {
 const p=check(await admin.from('products').select('config').eq('id',product).single(),'QA product read');
 assert.equal(p.config.clickup_list_id,'1301130000002447');assert.equal(p.config.qa_brief_doc_id,'8cq1r3y-44896');assert.equal(p.config.qa_brief_tracker_page_id,'8cq1r3y-118036');
 for(const role of ['admin','member','outsider']) {
  const email=`shared-${stamp}-${role}@example.test`,password=randomBytes(24).toString('hex');
  const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{must_change_password:false}}),'Fixture user');
  const user={id:created.user.id,db:createClient(QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY,options)};users.push(user);
  check(await admin.from('profiles').update({is_active:true,must_change_password:false,role:role==='admin'?'admin':'member'}).eq('id',user.id),'Fixture access');
  if(role==='member')check(await admin.from('user_products').insert({user_id:user.id,product_id:product}),'Fixture membership');
  check(await user.db.auth.signInWithPassword({email,password}),'Fixture login');
 }
 check(await admin.from('qa_private_workers').insert([
  {id:shared,owner_id:users[0].id,name:'Disposable shared API fixture',scope:'shared',product_id:product,token_hash:createHash('sha256').update(token).digest('hex'),enabled:true,classifier_available:true,heartbeat_at:new Date().toISOString(),delivery_public_key:'fixture'},
  {id:privateId,owner_id:users[0].id,name:'Disposable private API fixture',scope:'private',product_id:null,token_hash:'a'.repeat(64),enabled:true,classifier_available:true,heartbeat_at:new Date().toISOString(),delivery_public_key:'fixture'},
 ]),'Fixture workers');
 const member=users[1].db;
 const list=check(await member.rpc('qa_inspiration_workers_list',{p_product_id:product}),'Member worker list');
 assert(list.some(w=>w.id===shared));assert(!list.some(w=>w.scope==='private'));
 assert(!JSON.stringify(list).includes('token_hash'));
 assert.deepEqual(check(await member.rpc('qa_private_workers_list'),'Private list'),[]);
 assert((await users[2].db.rpc('qa_inspiration_workers_list',{p_product_id:product})).error);
 assert((await member.rpc('qa_private_worker_set_enabled',{p_id:privateId,p_enabled:false})).error);
 assert((await member.rpc('qa_private_worker_set_enabled',{p_id:shared,p_enabled:false})).error);
 assert((await member.from('qa_private_workers').select('*')).error);
 check(await admin.from('inspirations').insert({id:source,product_id:product,url:'https://www.instagram.com/p/fixture/',status:'Blocked',data:{_qaCreatedBy:users[1].id}}),'Fixture source');
 const args={p_request_id:jobId,p_product_id:product,p_id:source,p_worker_id:shared,p_sealed_token:'a'.repeat(512)};
 assert((await member.rpc('qa_private_inspiration_enqueue',{...args,p_worker_id:privateId})).error);
 const receipt=check(await member.rpc('qa_private_inspiration_enqueue',args),'Shared dispatch');
 assert.equal(receipt.id,jobId);assert.deepEqual(check(await member.rpc('qa_private_inspiration_enqueue',args),'Idempotent dispatch'),receipt);
 const ownerStatus=check(await users[0].db.rpc('qa_private_inspiration_status',{p_product_id:product}),'Shared activity');
 assert(ownerStatus.some(j=>j.id===jobId && j.can_control===false));
 const worker=createClient(QA_SUPABASE_URL,QA_SUPABASE_ANON_KEY,{...options,global:{headers:{'x-immuvi-worker-id':shared,'x-immuvi-worker-token':token}}});
 const claimed=check(await worker.rpc('qa_private_inspiration_claim'),'Scoped claim');
 assert.equal(claimed.id,jobId);assert.equal(claimed.requested_by,users[1].id);
 assert.equal(check(await worker.rpc('qa_private_inspiration_claim'),'Bounded claim'),null);
 check(await worker.rpc('qa_private_inspiration_checkpoint',{p_id:jobId,p_lease:claimed.lease_id,p_stage:'failed',p_value:{error:'Disposable authorization fixture; no generation performed.'}}),'Fixture finish');
 console.log('Real QA HTTP/Auth checks passed: permitted second-user dispatch, shared activity, private-device denial, outsider denial, credential isolation, idempotency and one-slot claim. No AI or ClickUp writes.');
} finally {
 check(await admin.from('qa_private_inspiration_jobs').delete().eq('id',jobId),'Fixture job cleanup');
 check(await admin.from('inspirations').delete().eq('id',source),'Fixture source cleanup');
 check(await admin.from('qa_private_workers').delete().in('id',[shared,privateId]),'Fixture worker cleanup');
 for(const user of users)check(await admin.auth.admin.deleteUser(user.id),'Fixture user cleanup');
}
