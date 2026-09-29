import test from 'node:test';
import assert from 'node:assert/strict';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../lib/qa-supabase-env.js';
import { validatePrivateWorkerConfig, assertPrivateJob, privateWorkerHeaders, finishPrivateImages } from '../../lib/services/private-worker.js';
const config = { version: 1, environment: 'qa', url: QA_SUPABASE_URL, anonKey: QA_SUPABASE_ANON_KEY,
  id: '00000000-0000-4000-8000-000000000083', ownerId: '00000000-0000-4000-8000-000000000081', token: 'a'.repeat(64), codexBin: '/bin/codex' };
test('private pairing rejects implicit production, broad credentials and invalid device identity', () => {
  assert.equal(validatePrivateWorkerConfig(config), config);
  for (const patch of [{environment:'production'}, {url:'https://production.supabase.co'}, {ownerId:'display-name'}, {token:'short'}, {codexBin:'codex'},
    {anonKey:`x.${Buffer.from(JSON.stringify({role:'service_role',ref:'entgcnlfsnysnwyadzzp'})).toString('base64url')}.x`}]) {
    assert.throws(() => validatePrivateWorkerConfig({...config,...patch}));
  }
});
test('runtime rechecks owner and exact assignment, never accepts Auto or another user', () => {
  const job = { id: 'run', private_worker_id: config.id, requested_by: config.ownerId, status: 'running', lease_id: 'lease', product_id: 'qa', request: {options:{}} };
  assertPrivateJob(config, job);
  for(const patch of [{private_worker_id:null}, {requested_by:'another-user'}, {status:'pending'}, {lease_id:null}]) assert.throws(() => assertPrivateJob(config,{...job,...patch}));
  assert.equal(privateWorkerHeaders(config,'lease')['x-immuvi-worker-lease'],'lease');
});
test('private publishing retries finalization without replaying uploads or generation', async () => {
  let uploads=0, attempts=0;
  const db={storage:{from:()=>({upload:async(_path,_bytes,options)=>{assert.equal(options.upsert,false); uploads++; return {};}})},
    rpc:async(name,args)=>{assert.equal(name,'qa_private_image_finish');assert.equal(args.p_lease,'lease'); attempts++;return attempts===1?{error:{code:'network'}}:{data:'done'};}};
  const result=await finishPrivateImages(db,{id:'run',lease_id:'lease'},[{bytes:Buffer.from('test'),metadata:{filename:'1.png'}}]);
  assert.equal(result[0].path,'run/1.png');assert.equal(uploads,1);assert.equal(attempts,2);
});
test('private publishing never reports successful generation after failure or an incomplete upload', async()=>{
  let finalized=false;
  const db={storage:{from:()=>({upload:async()=>({error:{message:'fail'}})})},rpc:async()=>{finalized=true;return{data:'done'};}};
  await assert.rejects(finishPrivateImages(db,{id:'run',lease_id:'lease'},[{bytes:Buffer.from('test'),metadata:{filename:'1.png'}}]),/upload failed/);
  assert.equal(finalized,false);
});
