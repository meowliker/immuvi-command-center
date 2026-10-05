import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, publicEncrypt, constants } from 'node:crypto';
import { recoverAnalysisUnit, assertAnalysisJob } from '../../lib/services/shared-analysis-recovery.js';
import { createAnalysisClickUp, runStrategistAnalysis, validateStrategistBrief } from '../../lib/services/shared-analysis.js';
import { extractWinnerMedia } from '../../scripts/shared-analysis-runner.mjs';
import sharp from 'sharp';

const context={listId:'1301130000002447',libraryDocId:'8cq1r3y-44896',product:{id:'qa-sample-astrorekha',name:'QA'},parentName:'Parent',winnerLabel:'winner.mp4'};
const makeJob=()=>({id:'40000000-0000-4000-8000-000000000001',kind:'strategist',product_id:'qa-sample-astrorekha',worker_id:'worker',lease_id:'lease',status:'running',context:structuredClone(context),started:[],units:{},intents:{},receipts:{}});
const adapt=value=>JSON.parse(execFileSync('python3',['scripts/shared-analysis-contract.py'],{input:JSON.stringify(value),encoding:'utf8'}));
const brief={strategy:{angle_tag:'Offer',persona_tag:'Parents'},creative:{hook_type:'Curiosity'},copy:{lingo:['clear']},production:{person_count:1},why_it_won:'Evidence-supported verdict.'};
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'immuvi-analysis-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
test('named Drive image winners use decoded image evidence without fabricating video or narration',async t=>{
  const directory=await fixture(t),job={...makeJob(),drive_file_id:'f'.repeat(30),context:{...context,winnerLabel:'winner.png'}};
  const bytes=await sharp({create:{width:40,height:60,channels:3,background:'#237c9a'}}).png().toBuffer();
  const media=await extractWinnerMedia({},job,directory,new AbortController().signal,async url=>{assert.match(url,/^https:\/\/drive.google.com\/uc\?export=download&id=f+$/);return bytes;});
  assert.equal(media.media_kind,'image');assert.equal(media.duration,0);assert.equal(media.frames.length,1);
  assert.equal(media.metadata.audio_probe.has_audio,false);assert.equal((await sharp(media.frames[0]).metadata()).height,60);
});

test('analysis job boundary excludes private devices and production',()=>{
  assert.doesNotThrow(()=>assertAnalysisJob({scope:'shared',id:'worker'},makeJob()));
  for(const change of [{product_id:'production'},{worker_id:'other'},{context:{...context,listId:'production'}},{status:'done'}])
    assert.throws(()=>assertAnalysisJob({scope:'shared',id:'worker'},{...makeJob(),...change}));
  assert.throws(()=>assertAnalysisJob({scope:'private',id:'worker'},makeJob()));
});
test('winner contract is exact legacy creative section without service-write instructions',()=>{
  const text=adapt({operation:'winner-contract'});
  assert.match(text,/WINNING variation/);assert.match(text,/exactly 3 complete/);assert.match(text,/Source Format Match/);
  assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|MANDATORY DB WRITE|sync_classify_skill_files/);
});
test('Strategist uses legacy taxonomy, hash, prompt, aggregate and ROI without a model call',()=>{
  const prepared=adapt({operation:'task',task:{id:'t1',name:'Winner',description:'Source',status:{status:'winner'},custom_fields:[{name:'Spend',type:'number',value:'10'},{name:'Revenue',type:'number',value:'30'}]},comments:[{comment_text:'Review'}]});
  assert.match(prepared.prompt,/why_it_won/);assert.match(prepared.prompt,/Review/);assert.equal(prepared.row.spend,10);
  assert.match(prepared.row.content_hash,/^[a-f0-9]{64}$/);
  assert.equal(adapt({operation:'task',task:{id:'t1',status:{status:'testing'}}}),null);
  const memory=adapt({operation:'memory',product:context.product,rows:[{...prepared.row,brief_json:brief}]});
  assert.equal(memory.json.stats.roi_overall,3);assert.equal(memory.json.stats.winner,1);
  assert.equal(memory.json.winner_briefs[0].task_id,'t1');assert.match(memory.prompt,/Full losers log/);
});
test('accepted unit survives lost database acknowledgment without generation again',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0,fail=true;
  const args={job,key:'task-one',input:{a:1},directory,signal:new AbortController().signal,
    checkpoint:async stage=>{if(stage==='unit'&&fail)throw new Error('lost acknowledgment');},generate:async()=>{calls++;return brief;},validate:validateStrategistBrief};
  await assert.rejects(recoverAnalysisUnit(args),/lost acknowledgment/);fail=false;
  assert.deepEqual(await recoverAnalysisUnit(args),brief);assert.equal(calls,1);
  await assert.rejects(recoverAnalysisUnit({...args,input:{a:2}}),/input changed/);
});
test('lost generation-start acknowledgment never repeats an uncertain generation',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0;
  const args={job,key:'task-one',input:{a:1},directory,signal:new AbortController().signal,validate:validateStrategistBrief,
    checkpoint:async(stage,v)=>{if(stage==='start'){job.started.push(v.key);job.intents[v.key]=v.identity;throw new Error('lost start');}},
    generate:async()=>{calls++;return brief;}};
  await assert.rejects(recoverAnalysisUnit(args),/lost start/);
  await assert.rejects(recoverAnalysisUnit(args),/interrupted without a completed result/);assert.equal(calls,0);
});
test('PostgreSQL JSON key ordering does not invalidate an accepted unit',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0;
  const args={job,key:'task-one',input:{z:1,a:{y:2,b:3}},directory,signal:new AbortController().signal,
    checkpoint:async()=>{},generate:async()=>{calls++;return brief;},validate:validateStrategistBrief};
  await recoverAnalysisUnit(args);
  const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reorder(v)])):value;
  assert.deepEqual(await recoverAnalysisUnit({...args,job:reorder(job),input:reorder(args.input)}),brief);assert.equal(calls,1);
});
test('completed CLI last message recovers after process termination',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0;
  const args={job,key:'task-one',input:{a:1},directory,signal:new AbortController().signal,validate:validateStrategistBrief,checkpoint:async()=>{},
    generate:async dir=>{calls++;await writeFile(join(dir,'last-message.txt'),'```json\n'+JSON.stringify(brief)+'\n```');throw new Error('process stopped');}};
  await assert.rejects(recoverAnalysisUnit(args),/process stopped/);
  assert.deepEqual(await recoverAnalysisUnit(args),brief);assert.equal(calls,1);
});
test('Strategist checkpoints incremental synthesis and only publishes complete memory',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0,reads=0,complete=0;
  const source={task:{id:'t1',name:'Winner',description:'source',status:{status:'winner'}},comments:[]};
  const args={job,directory,signal:new AbortController().signal,adapt,clickup:{snapshot:async()=>{reads++;return [source];}},
    checkpoint:async stage=>{if(stage==='complete')complete++;},generate:async(_p,_dir,markdown)=>{calls++;return markdown?{markdown:'# Strategist Memory - QA'}:brief;}};
  await runStrategistAnalysis(args);await runStrategistAnalysis(args);
  assert.equal(calls,2);assert.equal(reads,1);assert.equal(complete,2);
  assert.equal(job.units.memory.value.json.stats.winner,1);assert.equal(job.units.memory.value.processed,1);
});
test('unchanged task cache is reused and deleted/unjudged tasks are excluded from new memory',async t=>{
  const directory=await fixture(t),job=makeJob();let calls=0;
  const source={task:{id:'t1',name:'Winner',status:{status:'winner'}},comments:[]};
  const prepared=adapt({operation:'task',...source});
  job.context.cached=[{...prepared.row,brief_json:brief},{...prepared.row,clickup_task_id:'deleted',brief_json:brief}];
  await runStrategistAnalysis({job,directory,signal:new AbortController().signal,adapt,clickup:{snapshot:async()=>[source]},checkpoint:async()=>{},generate:async(_p,_d,markdown)=>{assert.equal(markdown,true);calls++;return {markdown:'# Strategist Memory - QA'};}});
  assert.equal(calls,1);assert.equal(job.units.memory.value.processed,0);assert.equal(job.units.memory.value.json.stats.judged_total,1);
});

const headings=['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
const table='| Field | Direction |\n| --- | --- |\n| Source Format Match | Reference faithful |\n\nVoice-over Script: Proposed script.\n\n| Time | Label | Caption / Voice Over | Visual Beat | Editor Notes |\n| --- | --- | --- | --- | --- |\n| 0:00 | HOOK | Words | Scene | Cut |\n';
const breakdown='| Time | Label | Caption / Voice Over | What Happens | Emotion Triggered |\n| --- | --- | --- | --- | --- |\n| 0:00-0:03 | HOOK | Words | Scene | Curiosity |\n';
const markdown=headings.map((h,i)=>`## ${i+1}. ${h}\n\n${i===1?breakdown:i<7?'Evidence.\n':''}`).join('\n')+'\nInspiration Script Skeleton: Hook, proof, CTA.\n\n'+Array(3).fill(table).join('\n');
const pair=generateKeyPairSync('rsa',{modulusLength:3072});
const sealed=publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from('fixture-token')).toString('base64');
test('winner delivery reconciles lost page creation response, verifies readback and creates only one page',async()=>{
  const job={...makeJob(),kind:'variation',sealed_token:sealed};let page=null,posts=0,done=0,lose=true;
  const fetchImpl=async(url,opts)=>{
    const path=new URL(url).pathname;
    assert.equal(opts.headers.Authorization,'fixture-token');
    if(path.endsWith('/page_listing'))return Response.json(page?[page]:[]);
    if(path.endsWith('/pages')&&opts.method==='POST') {posts++;page={id:'qa-page',...JSON.parse(opts.body)};if(lose){lose=false;throw new TypeError('fetch failed');}return Response.json(page);}
    if(path.endsWith('/pages/qa-page'))return Response.json(page);
    return Response.json({id:'8cq1r3y-44896',workspace_id:'9016762494',parent:{id:'1301130000002447',type:6}});
  };
  const client=()=>createAnalysisClickUp({job,privateKey:pair.privateKey,fetchImpl,signal:new AbortController().signal,checkpoint:async stage=>{if(stage==='complete')done++;}});
  await assert.rejects(client().deliverWinner({markdown}),/fetch failed/);
  await client().deliverWinner({markdown});assert.equal(posts,1);assert.equal(done,1);
  page.content+='\nChanged';await assert.rejects(client().deliverWinner({markdown}),/differs/);assert.equal(done,1);
});
test('uncertain winner page absent from readback never causes another POST',async()=>{
  const job={...makeJob(),kind:'variation',sealed_token:sealed,receipts:{started:true}};
  const client=createAnalysisClickUp({job,privateKey:pair.privateKey,signal:new AbortController().signal,checkpoint:async()=>{},fetchImpl:async(url,opts)=>{
    assert.equal(opts.method,'GET');return Response.json(url.includes('page_listing')?[]:{id:'8cq1r3y-44896',workspace_id:'9016762494',parent:{id:'1301130000002447',type:6}});
  }});
  await assert.rejects(client.deliverWinner({markdown}),/refusing a duplicate/);
});
test('moved target and wrong library fail before any external write',async()=>{
  const job={...makeJob(),kind:'variation',sealed_token:sealed,context:{...context,targetTask:'t1'}};
  const client=createAnalysisClickUp({job,privateKey:pair.privateKey,signal:new AbortController().signal,checkpoint:async()=>{},fetchImpl:async(_url,opts)=>{assert.equal(opts.method,'GET');return Response.json({id:'t1',list:{id:'production'}});}});
  await assert.rejects(client.deliverWinner({markdown}),/outside the QA list/);
});
