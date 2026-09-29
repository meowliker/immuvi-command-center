import test from 'node:test';
import assert from 'node:assert/strict';
import { constants,generateKeyPairSync,privateDecrypt } from 'node:crypto';
import { POST } from '../../app/api/workers/images/route.js';

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const user='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const input={requestId:'33333333-3333-4333-8333-333333333333',productId:'qa-sample-astrorekha',adId:'ad',workerId:worker,options:{count:2}};
const jwt=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
async function fixture(t,overrides={}) {
 const calls=[];const original=global.fetch;
 global.fetch=async(raw,init={})=>{
  const url=new URL(raw.url || raw),path=url.pathname,body=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({host:url.hostname,path,body});
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(url.hostname==='entgcnlfsnysnwyadzzp.supabase.co') {
   if(path==='/auth/v1/user')return overrides.authFailure?response({message:'expired'},401):response({id:user,aud:'authenticated',role:'authenticated',email:'fixture@example.test'});
   if(path.endsWith('/qa_image_workers_list'))return response([{id:worker,scope:overrides.scope || 'shared',enabled:true,image_protocol:1,generation_available:true,heartbeat_at:new Date().toISOString(),delivery_public_key:publicKey}]);
   if(path==='/rest/v1/ads')return response({clickup_task_id:'qa-task',meta:{}});
   if(path.endsWith('/qa_shared_image_enqueue') || path.endsWith('/qa_shared_image_retry'))return response({id:body.p_id || body.p_request_id,status:'pending'});
  }
  if(url.hostname==='api.clickup.com') {
   if(path==='/api/v2/task/qa-task')return response({id:'qa-task',list:{id:overrides.list || '1301130000002447'}});
   if(path.endsWith('/field'))return response({fields:[]});
   if(path==='/api/v2/list/1301130000002447')return response({id:'1301130000002447',statuses:overrides.noStatus?[]:[{status:'Ready to Launch'}]});
  }
  throw new Error(`Unexpected mocked request: ${url.hostname}${path}`);
 };
 t.after(()=>{global.fetch=original;});
 const send=(body=input,authorized=true)=>POST(new Request('http://localhost/api/workers/images',{method:'POST',headers:{...(authorized?{Authorization:`Bearer ${jwt}`} : {}),'X-ClickUp-Token':'fixture-clickup-key','Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {calls,send};
}
test('shared image route verifies account, task/list and readiness, sealing the token for only that worker',async t=>{
 const {calls,send}=await fixture(t),response=await send();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const queued=calls.find(c=>c.path.endsWith('/qa_shared_image_enqueue')).body;
 assert.equal(queued.p_worker_id,worker);assert.equal(queued.p_task_id,'qa-task');assert.notEqual(queued.p_sealed_token,'fixture-clickup-key');
 assert.equal(privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(queued.p_sealed_token,'base64')).toString(),'fixture-clickup-key');
 assert.equal(calls.some(c=>c.host.includes('hdniumnkprkadlrrataz')),false);
});
test('missing or expired QA sessions cannot query worker jobs',async t=>{
 const {calls,send}=await fixture(t,{authFailure:true});assert.equal((await send(input,false)).status,401);assert.equal(calls.length,0);
 assert.equal((await send()).status,401);assert.equal(calls.length,1);
});
for(const [name,overrides,body] of [
 ['production product',{}, {...input,productId:'production'}],
 ['private target',{scope:'private'},input],
 ['task outside list',{list:'production'},input],
 ['missing launch status',{noStatus:true},input],
])test(`shared image route refuses ${name} before enqueue`,async t=>{
 const {calls,send}=await fixture(t,overrides);assert.equal((await send(body)).status,400);
 assert.equal(calls.some(c=>c.path.endsWith('/qa_shared_image_enqueue')),false);
});
test('resume routes to the original run identity rather than enqueueing another generation',async t=>{
 const {calls,send}=await fixture(t);const response=await send({...input,recoveryId:'saved-run'});assert.equal(response.status,200);
 assert.equal(calls.find(c=>c.path.endsWith('/qa_shared_image_retry')).body.p_id,'saved-run');
 assert.equal(calls.some(c=>c.path.endsWith('/qa_shared_image_enqueue')),false);
});
