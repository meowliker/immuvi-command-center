import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { POST } from '../../app/api/workers/analysis/route.js';

const pair=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'}});
const user='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const jwt=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
const input={id:'33333333-3333-4333-8333-333333333333',workerId:worker,productId:'qa-sample-astrorekha',kind:'strategist'};
function fixture(t,options={}) {
  const calls=[],original=global.fetch;t.after(()=>global.fetch=original);
  global.fetch=async(raw,init={})=>{
    const url=new URL(raw.url || raw),body=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({host:url.hostname,path:url.pathname,body});
    if(url.hostname==='entgcnlfsnysnwyadzzp.supabase.co') {
      if(url.pathname==='/auth/v1/user')return Response.json(options.expired?{message:'expired'}:{id:user,aud:'authenticated',role:'authenticated'},{status:options.expired?401:200});
      if(url.pathname.endsWith('/qa_analysis_workers'))return Response.json([{id:worker,enabled:!options.disabled,analysis_protocol:options.old?0:1,delivery_public_key:pair.publicKey}]);
      if(url.pathname.endsWith('/qa_analysis_enqueue'))return Response.json({id:body.p_id,status:'pending'});
    }
    if(url.hostname==='api.clickup.com') {
      if(options.denied)return Response.json({err:'denied'},{status:403});
      if(url.pathname.endsWith('/field'))return Response.json({fields:[]});
      if(url.pathname==='/api/v2/list/1301130000002447')return Response.json({id:'1301130000002447',statuses:[]});
    }
    throw new Error('Unexpected mocked request');
  };
  return {calls,send:(body=input,authorized=true)=>POST(new Request('http://localhost/api/workers/analysis',{method:'POST',headers:{...(authorized?{Authorization:`Bearer ${jwt}`} : {}),'X-ClickUp-Token':'fixture-only-key','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
test('analysis API seals delivery authorization and keeps a supplied retry identity',async t=>{
  const {calls,send}=fixture(t);const response=await send();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const queued=calls.find(c=>c.path.endsWith('/qa_analysis_enqueue')).body;
  assert.equal(queued.p_id,input.id);assert.equal(queued.p_worker_id,worker);assert.equal(queued.p_sealed_token.length,512);
  assert.equal(privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(queued.p_sealed_token,'base64')).toString(),'fixture-only-key');
  assert.deepEqual(await response.json(),{id:input.id,status:'pending'});
});
for(const [name,options,body,auth] of [
  ['no session',{},input,false],['expired session',{expired:true},input,true],['old runtime',{old:true},input,true],
  ['disabled runtime',{disabled:true},input,true],['denied list',{denied:true},input,true],['production',{}, {...input,productId:'production'},true],
  ['unknown workflow',{}, {...input,kind:'shell'},true],
])test(`analysis API refuses ${name} before queue mutation`,async t=>{
  const {calls,send}=fixture(t,options),response=await send(body,auth);assert.ok(response.status>=400);
  assert.equal(calls.some(c=>c.path.endsWith('/qa_analysis_enqueue')),false);
  assert.equal(calls.some(c=>c.host.includes('hdniumnkprkadlrrataz')),false);
});
