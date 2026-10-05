import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, constants, privateDecrypt, publicEncrypt, createHash } from 'node:crypto';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { qaDestination } from '../../lib/domain/qa-destinations.js';
import { APPROVED_PRODUCT_IDS, assertWorkerProduct, assertInspirationJob, attestWorkerDestinations, validateSharedWorkerConfig } from '../../lib/services/shared-worker.js';
import { verifyLibraryDocument, masterTrackerMarkdown, mergeExistingTracker, deliverPrivateBrief } from '../../lib/services/private-inspiration.js';
import { assertSharedImageJob, recoverSharedImages } from '../../lib/services/shared-image-recovery.js';
import { createSharedImageDelivery } from '../../lib/services/shared-image-delivery.js';
import { assertAnalysisJob, recoverAnalysisUnit } from '../../lib/services/shared-analysis-recovery.js';
import { createAnalysisClickUp } from '../../lib/services/shared-analysis.js';
import { POST as inspirationPost } from '../../app/api/workers/inspiration/route.js';
import { POST as imagePost } from '../../app/api/workers/images/route.js';
import { POST as analysisPost } from '../../app/api/workers/analysis/route.js';

const kids=qaDestination('prod-1788597766070'),astro=qaDestination('qa-sample-astrorekha');
const user='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const pair=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'}});
const context={...kids,docVisibility:'EXISTING',product:{id:kids.productId,name:'Kids Encyclopedia'}};
const job={id:'33333333-3333-4333-8333-333333333333',product_id:kids.productId,worker_id:worker,requested_by:user,
  status:'running',lease_id:'lease',inspiration_id:'KIDS-101',brief_number:101,context};
const document={id:kids.libraryDocId,workspace_id:kids.workspaceId,parent:{id:'90169348848',type:'5'},public:false};
const row=(id='KIDS-101',page='new-page')=>({id,brand:'Brand',platform:'Facebook',angle:'Learning',persona:'Parents',hook:'Curiosity',funnel:'TOF',status:'Saved',url:`https://app.clickup.com/${kids.workspaceId}/docs/${kids.libraryDocId}/${page}`});
const headings=['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
const breakdown='| Time | Label | Caption / Voice Over | What Happens | Emotion Triggered |\n| --- | --- | --- | --- | --- |\n| 0:00 | HOOK | Words | Scene | Curiosity |\n';
const script='| Field | Direction |\n| --- | --- |\n| Source Format Match | Reference faithful |\n\nVoice-over Script: Proposed script.\n\n| Time | Label | Caption / Voice Over | Visual Beat | Editor Notes |\n| --- | --- | --- | --- | --- |\n| 0:00 | HOOK | Words | Scene | Cut |\n';
const markdown=headings.map((h,i)=>`## ${i+1}. ${h}\n\n${i===1?breakdown:i<7?'Evidence.\n':''}`).join('\n')+'\nInspiration Script Skeleton: Hook, proof, CTA.\n\n'+Array(3).fill(script).join('\n');

test('new runtime attests exactly two destinations through a separate credential-bound RPC',async()=>{
  const calls=[];await attestWorkerDestinations(async(...args)=>{calls.push(args);return true;});
  assert.deepEqual(calls,[['qa_worker_destinations_heartbeat',{p_product_ids:[astro.productId,kids.productId]}]]);
  await attestWorkerDestinations(async(name,args)=>{assert.deepEqual(args,{p_product_ids:[]});return true;},true);
  for(const response of [false,1,null])await assert.rejects(attestWorkerDestinations(async()=>response),/contract/);
  const runtime=await readFile(new URL('../../scripts/private-worker.mjs',import.meta.url),'utf8');
  assert.ok(runtime.indexOf('await attestWorkerDestinations(rpc,stopped)')>runtime.indexOf("rpc(shared?'qa_shared_analysis_heartbeat'"));
  assert.doesNotMatch(runtime,/config\.approved_product_ids/);
});

test('old private and shared workers cannot advertise Kids, and foreign products stay protected',()=>{
  for(const scope of ['private','shared']) {
    for(const ids of [undefined,[],[kids.productId],[...APPROVED_PRODUCT_IDS,'foreign']])
      assert.throws(()=>assertWorkerProduct({scope,approved_product_ids:ids},kids.productId),/attested/);
    assert.doesNotThrow(()=>assertWorkerProduct({scope,approved_product_ids:[...APPROVED_PRODUCT_IDS],heartbeat_at:new Date().toISOString()},kids.productId));
    assert.throws(()=>assertWorkerProduct({scope,approved_product_ids:[...APPROVED_PRODUCT_IDS],heartbeat_at:new Date(Date.now()-60000).toISOString()},kids.productId));
    assert.throws(()=>assertWorkerProduct({scope,approved_product_ids:[...APPROVED_PRODUCT_IDS],heartbeat_at:new Date().toISOString(),destinations_heartbeat_at:new Date(Date.now()-60000).toISOString()},kids.productId));
    assert.doesNotThrow(()=>assertWorkerProduct({scope},astro.productId));
    assert.throws(()=>assertWorkerProduct({scope,approved_product_ids:['foreign']},'foreign'));
  }
  assert.throws(()=>validateSharedWorkerConfig({productId:kids.productId}));
});

test('Kids inspiration/image/analysis jobs retain owner, lease and destination boundaries',()=>{
  const config={scope:'shared',id:worker,ownerId:user};
  assert.doesNotThrow(()=>assertInspirationJob(config,job));
  assert.doesNotThrow(()=>assertInspirationJob({...config,scope:'private'},job));
  assert.throws(()=>assertInspirationJob({...config,scope:'private'},{...job,requested_by:'other'}));
  for(const patch of [{product_id:'foreign'},{lease_id:null},{context:{...context,listId:astro.listId}},
    {context:{...context,libraryDocId:astro.libraryDocId}},{context:{...context,libraryTrackerPageId:astro.libraryTrackerPageId}}])
    assert.throws(()=>assertInspirationJob(config,{...job,...patch}));
  const run={...job,private_worker_id:worker,delivery:{protocol:1,list_id:kids.listId,task_id:'task',destination:kids}};
  assert.doesNotThrow(()=>assertSharedImageJob(config,run));
  assert.throws(()=>assertSharedImageJob(config,{...run,delivery:{...run.delivery,list_id:astro.listId}}));
  assert.throws(()=>assertSharedImageJob(config,{...run,delivery:{...run.delivery,destination:null}}));
  assert.throws(()=>assertSharedImageJob(config,{...run,delivery:{...run.delivery,destination:astro}}));
  assert.doesNotThrow(()=>assertAnalysisJob(config,{...job,kind:'strategist'}));
  assert.throws(()=>assertAnalysisJob(config,{...job,kind:'strategist',context:{...context,libraryDocId:astro.libraryDocId}}));
});

test('only the fixed Kids Doc permits the legacy folder, without requiring a visibility change',()=>{
  verifyLibraryDocument(document,kids.libraryDocId,kids);
  verifyLibraryDocument({...document,parent:{id:kids.listId,type:6}},kids.libraryDocId,kids);
  for(const patch of [{id:'other'},{workspace_id:'other'},{parent:{id:'other',type:5}},{parent:{id:'90169348848',type:6}},{archived:true}])
    assert.throws(()=>verifyLibraryDocument({...document,...patch},kids.libraryDocId,kids));
  assert.throws(()=>verifyLibraryDocument({...document,id:astro.libraryDocId},astro.libraryDocId,astro));
});

test('tracker merge preserves live prose and rows, ignoring stale QA rows',()=>{
  const live=masterTrackerMarkdown('Kids',[{...row('KIDS-1','old-page'),status:'Winner',brand:'Edited | Brand'}])+'\n\nHuman notes.\n';
  const merged=mergeExistingTracker(live,row());
  assert.ok(merged.includes(live.split('\n').find(line=>line.includes('KIDS-1 |'))));
  assert.ok(merged.endsWith('\n\nHuman notes.\n'));
  assert.equal(mergeExistingTracker(merged,row()),merged);
  assert.throws(()=>mergeExistingTracker(merged,{...row(),status:'Loser'}),/conflicts/);
  assert.throws(()=>mergeExistingTracker(masterTrackerMarkdown('Kids',[row(),row()]),row()),/duplicate/);
  assert.throws(()=>mergeExistingTracker('No recognized tracker',row()),/ambiguous/);
});

async function deliveryFixture(options={}) {
  let tracker=masterTrackerMarkdown('Kids',[row('KIDS-1','old-page')])+'\n\nKeep human notes.\n',reads=0;
  let page=null;const writes=[],stages=[];
  const sealed=publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from('fixture-key')).toString('base64');
  const fetchImpl=async(url,init)=>{
    const path=new URL(url).pathname;
    assert.equal(init.headers.Authorization,'fixture-key');
    if(init.method!=='GET')writes.push({path,body:JSON.parse(init.body)});
    if(path===`/api/v2/list/${kids.listId}`)return Response.json({id:kids.listId});
    if(path.endsWith(`/docs/${kids.libraryDocId}`))return Response.json(document);
    if(path.endsWith('/page_listing'))return Response.json([{id:kids.libraryTrackerPageId,name:'Master Tracker'},...(page?[page]:[])]);
    if(path.endsWith('/pages') && init.method==='POST'){page={id:'new-page',...JSON.parse(init.body)};return Response.json(page);}
    if(path.endsWith('/pages/new-page'))return Response.json(page);
    if(path.endsWith(`/pages/${kids.libraryTrackerPageId}`)) {
      if(init.method==='PUT')tracker=JSON.parse(init.body).content;
      else {reads++;if(options.concurrent && reads===2)tracker+='Concurrent edit.\n';}
      return Response.json({id:kids.libraryTrackerPageId,content:tracker});
    }
    throw new Error(`Unexpected fixture request ${path}`);
  };
  const deliver=()=>deliverPrivateBrief({job:{...job,sealed_clickup_token:sealed},result:{markdown,metadata:{page_name:'Brand'},classification:{angle:'Learning'}},privateKey:pair.privateKey,fetchImpl,
    checkpoint:async(stage)=>{stages.push(stage);return stage==='tracker-rows'?[row(),{...row('KIDS-1','old-page'),brand:'STALE QA VALUE'}]:undefined;}});
  return {deliver,writes,stages,tracker:()=>tracker};
}

test('Kids delivery merges the original tracker, uses legacy names, and never writes Doc settings',async()=>{
  const f=await deliveryFixture();await f.deliver();
  assert.equal(f.writes.length,2);assert.ok(f.writes.every(write=>write.path.includes('/pages')));
  assert.match(f.writes[0].body.name,/^KIDS-101 .*Brand \| Learning$/);
  assert.ok(f.writes.every(write=>!('visibility' in write.body)));
  assert.match(f.tracker(),/Keep human notes/);assert.doesNotMatch(f.tracker(),/STALE QA VALUE/);
  assert.equal(f.stages.at(-1),'complete');
});

test('concurrent original-tracker edits prevent overwrite and completion',async()=>{
  const f=await deliveryFixture({concurrent:true});await assert.rejects(f.deliver(),/changed during delivery/);
  assert.equal(f.writes.length,1);assert.ok(!f.stages.includes('complete'));assert.match(f.tracker(),/Concurrent edit/);
});

for(const [name,post,rpc] of [['inspiration',inspirationPost,'qa_private_inspiration_enqueue'],['images',imagePost,'qa_shared_image_enqueue'],['analysis',analysisPost,'qa_analysis_enqueue']]) {
  for(const capable of [false,true])test(`Kids ${name} API ${capable?'seals the token for an attested worker':'rejects an old worker before queueing'}`,async t=>{
    const original=global.fetch,calls=[];t.after(()=>global.fetch=original);
    global.fetch=async(raw,init={})=>{
      const url=new URL(raw.url || raw),path=url.pathname,body=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({path,body});
      if(path==='/auth/v1/user')return Response.json({id:user,aud:'authenticated',role:'authenticated'});
      if(/qa_(?:inspiration_workers_list|image_workers_list|analysis_workers)$/.test(path))return Response.json([{id:worker,scope:'shared',enabled:true,
        heartbeat_at:new Date().toISOString(),recovery_protocol:2,image_protocol:1,analysis_protocol:1,generation_available:true,delivery_public_key:pair.publicKey,
        ...(capable?{approved_product_ids:[...APPROVED_PRODUCT_IDS]}:{})}]);
      if(path==='/rest/v1/inspirations')return Response.json({url:'https://facebook.com/ads/library/?id=123',data:{_qaCreatedBy:user}});
      if(path==='/rest/v1/products')return Response.json({config:{clickup_list_id:kids.listId,qa_brief_doc_id:kids.libraryDocId,qa_brief_tracker_page_id:kids.libraryTrackerPageId,qa_brief_visibility:'EXISTING'}});
      if(path==='/rest/v1/ads')return Response.json({clickup_task_id:'kids-task',meta:{}});
      if(path.endsWith('/'+rpc))return Response.json({status:'pending'});
      if(path.endsWith('/field'))return Response.json({fields:[]});
      if(path===`/api/v2/list/${kids.listId}`)return Response.json({id:kids.listId,statuses:[{status:'Ready to Launch'}]});
      if(path==='/api/v2/task/kids-task')return Response.json({id:'kids-task',list:{id:kids.listId}});
      if(path.endsWith(`/docs/${kids.libraryDocId}`))return Response.json(document);
      throw new Error(`Unexpected mocked request ${path}`);
    };
    const response=await post(new Request('http://localhost/api/workers/'+name,{method:'POST',headers:{Authorization:'Bearer fixture','X-ClickUp-Token':'fixture-key'},
      body:JSON.stringify({id:job.id,requestId:job.id,productId:kids.productId,workerId:worker,inspirationId:job.inspiration_id,adId:'ad',kind:'strategist',options:{count:1}})}));
    assert.equal(response.status,capable?200:400,JSON.stringify(await response.json()));
    const queued=calls.find(call=>call.path.endsWith('/'+rpc));
    if(!capable)assert.equal(queued,undefined);
    else {
      assert.equal(queued.body.p_product_id,kids.productId);
      assert.equal(privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(queued.body.p_sealed_token,'base64')).toString(),'fixture-key');
      assert.ok(!calls.some(call=>call.path.includes(astro.listId)||call.path.includes(astro.libraryDocId)));
    }
  });
}

test('analysis and image checkpoints reject product/destination transplants without regenerating',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'kids-checkpoints-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const analysisJob={...job,kind:'strategist'};
  const args={job:analysisJob,key:'unit',input:{a:1},directory:join(directory,'analysis'),signal:new AbortController().signal,checkpoint:async()=>{},validate:v=>v,generate:async()=>({done:true})};
  await recoverAnalysisUnit(args);
  for(const patch of [{product_id:astro.productId},{worker_id:'other'},{drive_file_id:'different'},{context:{...context,listId:astro.listId}}])
    await assert.rejects(recoverAnalysisUnit({...args,job:{...analysisJob,...patch},generate:async()=>assert.fail('must not regenerate')}),/input changed|Unapproved worker destination/);
  const run={id:job.id,product_id:kids.productId,private_worker_id:worker,request:{options:{count:0}},delivery:{protocol:1,task_id:'task',list_id:kids.listId}};
  const imageArgs={run,directory:join(directory,'images'),signal:new AbortController().signal,prepare:async()=>({taskName:'Kids',referenceFiles:[]})};
  await recoverSharedImages(imageArgs);
  for(const patch of [{product_id:astro.productId},{delivery:{...run.delivery,list_id:astro.listId}}])
    await assert.rejects(recoverSharedImages({...imageArgs,run:{...run,...patch}}),/context changed|Unapproved worker destination/);
});

test('Kids analysis uses its fixed library and refuses an Astro library before network access',()=>{
  const sealed=publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from('fixture-key')).toString('base64');
  assert.doesNotThrow(()=>createAnalysisClickUp({job:{...job,sealed_token:sealed},privateKey:pair.privateKey}));
  assert.throws(()=>createAnalysisClickUp({job:{...job,context:{...context,libraryDocId:astro.libraryDocId}}}),/destination/);
});

test('Kids Producer prepares only its own linked library and rejects an Astro brief',async()=>{
  const run={id:job.id,product_id:kids.productId,request:{options:{count:1},creative:{}},
    delivery:{task_id:'kids-task',list_id:kids.listId,destination:kids}};
  let library=kids.libraryDocId;const reads=[];
  const client=()=>createSharedImageDelivery({run,token:'fixture-key',signal:new AbortController().signal,checkpoint:async()=>{},fetchImpl:async url=>{
    const path=new URL(url).pathname;reads.push(path);
    if(path.endsWith('/comment'))return Response.json({comments:[]});
    if(path.includes('/docs/'))return Response.json({name:'Kids Brief',content:'Verified Kids context.'});
    return Response.json({id:'kids-task',name:'Kids Task',list:{id:kids.listId},description:`https://app.clickup.com/${kids.workspaceId}/docs/${library}/page`});
  }});
  const prepared=await client().prepare('/unused-no-downloads');
  assert.equal(prepared.briefPages[0].name,'Kids Brief');
  assert.ok(reads.includes(`/api/v3/workspaces/${kids.workspaceId}/docs/${kids.libraryDocId}/pages/page`));
  library=astro.libraryDocId;reads.length=0;
  await assert.rejects(client().prepare('/unused-no-downloads'),/outside the approved QA library/);
  assert.ok(!reads.some(path=>path.includes('/docs/')));
});

test('older Astro analysis and image checkpoints still resume only in their original destination',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'astro-old-checkpoints-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const oldJob={...job,product_id:astro.productId,kind:'strategist',context:{listId:astro.listId,libraryDocId:astro.libraryDocId}};
  const identity=hash(canonical([oldJob.id,oldJob.kind,oldJob.context,{a:1}]));
  oldJob.started=['unit'];oldJob.intents={unit:identity};
  await mkdir(join(directory,'unit'));await writeFile(join(directory,'unit','last-message.txt'),'{"done":true}');
  await recoverAnalysisUnit({job:oldJob,key:'unit',input:{a:1},directory,signal:new AbortController().signal,validate:v=>v,
    generate:async()=>assert.fail('old accepted output must not regenerate'),checkpoint:async(stage,value)=>{assert.equal(stage,'unit');assert.equal(value.identity,identity);}});
  assert.deepEqual(oldJob.units.unit,{identity,value:{done:true}});
  const run={id:job.id,product_id:astro.productId,private_worker_id:worker,request:{options:{count:0}},delivery:{protocol:1,task_id:'task',list_id:astro.listId}};
  const imageIdentity=hash({id:run.id,worker:run.private_worker_id,request:run.request,task:run.delivery.task_id});
  await writeFile(join(directory,'producer-context.json'),JSON.stringify({identity:imageIdentity,context:{taskName:'Astro',referenceFiles:[]}}));
  const args={run,directory,signal:new AbortController().signal,prepare:async()=>assert.fail('old context must be reused')};
  await recoverSharedImages(args);
  await assert.rejects(recoverSharedImages({...args,run:{...run,product_id:kids.productId,delivery:{...run.delivery,list_id:kids.listId,destination:kids}}}),/context changed/);
});
