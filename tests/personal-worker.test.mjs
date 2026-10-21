import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePersonalResult,briefContentMatches} from '../tools/personal-worker-result.mjs';
import {createPersonalWorkerHandler} from '../api/personal-worker.js';
const id='11111111-1111-4111-8111-111111111111';
const context={ins_id:'TEST-INS-1',product_id:'test-product',source_url:'https://example.test/ad',no_brief:true,angles:['Useful promise'],personas:['Exact buyer'],created_at:'2026-01-01T00:00:00Z'};
function result(){return {...context,duration_seconds:0,frames_extracted:1,
  metadata:{source_url:context.source_url,media_sha256:'a'.repeat(64),evidence_summary:'Inspected the exact downloaded image and all visible source text.',caption_timeline:[]},
  classification:{brand:'Example',angle:'Useful promise',persona:'Exact buyer',hook_type:'Curiosity',creative_structure:'Static/Photo',production_style:'Static Graphic',funnel_type:'TOF',photo_video:'Photo',media_kind:'image',voice_over:'No voice over',voice_over_timeline:[]},brief:{},markdown:''};}
test('personal result strips caller identity/patch and never promotes taxonomy',()=>{
  const r=result();r.patch={product_id:'foreign'};r.classification.ins_id='foreign';r.metadata.ins_id='foreign';r.metadata._resultProductId='foreign';
  const saved=validatePersonalResult(r,context);
  assert.equal(saved.patch.sourceUrl,context.source_url);assert.equal(saved.patch._angleScope,'product');
  assert.equal(saved.classification.ins_id,undefined);assert.equal(saved.metadata.ins_id,undefined);
  r.classification.angle='New suggestion';const proposed=validatePersonalResult(r,context);
  assert.equal(proposed.patch._angleScope,'inspiration');assert.equal(proposed.patch._needsAngleReview,true);
  assert.equal(saved.patch.nextAdScripts,undefined);assert.equal(saved.patch._clickupDocPageUrl,undefined);
  assert.deepEqual(validatePersonalResult(r,context),validatePersonalResult(r,context));
});
test('source/product mismatches, missing evidence, media inversions and No Brief scripts fail closed',()=>{
  for(const change of [r=>r.product_id='foreign',r=>r.source_url+='x',r=>r.metadata.media_sha256='',
    r=>r.classification.photo_video='Video',r=>r.markdown='Brief',r=>r.brief={next_ad_scripts:[1]}]){
    const r=result();change(r);assert.throws(()=>validatePersonalResult(r,context));
  }
});
test('music-only full brief needs local evidence, eight sections and three complete scripts',()=>{
  const r=result();r.classification.media_kind='video';r.classification.photo_video='Video';r.duration_seconds=10;
  r.metadata.audio_probe={local_only:true,method:'ffmpeg + local AST corroborated by source captions',narration:'absent'};
  const names=['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
  r.markdown=names.map((s,i)=>'## '+(i+1)+'. '+s+'\n'+('Evidence-backed source and proposed product adaptation. '.repeat(8))).join('\n')+'\n'+context.source_url+
    ('\n| Time | Label | Caption / Voice Over | Visual Beat | Editor Notes |\n').repeat(4);
  r.brief={next_ad_scripts:Array.from({length:3},(_,i)=>({name:'Variation '+i,voice_over_script:'Product script',source_format_match:'Same source skeleton',script_breakdown:[{time:'0:00-0:03',caption:'Example'}]}))};
  assert.ok(validatePersonalResult(r,{...context,no_brief:false}));
  r.metadata.audio_probe.narration='uncertain';assert.throws(()=>validatePersonalResult(r,{...context,no_brief:false}),/Narration/);
  r.classification.voice_over='';r.metadata.audio_probe.limitations='Narration cannot be verified; classification uses the observed source visuals only.';
  assert.ok(validatePersonalResult({...r,brief:{},markdown:''},context));
});
test('Facebook exact ID and selected Drive version are mandatory',()=>{
  const r=result(),fb={...context,source_url:'https://www.facebook.com/ads/library/?id=123456789012345'};r.source_url=fb.source_url;r.metadata.source_url=fb.source_url;
  assert.throws(()=>validatePersonalResult(r,fb),/exact requested/);r.metadata.ad_id='123456789012345';assert.ok(validatePersonalResult(r,fb));
  const drive={...context,selection:{file_id:'synthetic-file-id',file_name:'Version 2.mp4',source_url:context.source_url}};
  const d=result();assert.throws(()=>validatePersonalResult(d,drive),/selected Drive/);
  Object.assign(d.metadata,{drive_media_selection:{...drive.selection},selected_drive_file_id:drive.selection.file_id,
    selected_drive_file_name:drive.selection.file_name,selected_drive_file_sha256:d.metadata.media_sha256,source_assets:[drive.selection.file_name]});
  assert.ok(validatePersonalResult(d,drive));d.metadata.source_assets.push('Version 1.mp4');assert.throws(()=>validatePersonalResult(d,drive));
});
function response(data,status=200){return {ok:status<400,status,json:async()=>data};}
async function invoke(body,fetchImpl,headers={}){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  await createPersonalWorkerHandler({env:{SUPABASE_URL:'https://database.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only'},fetchImpl})({method:'POST',body,headers},res);return res;
}
test('browser API requires app JWT plus verified ClickUp ID, never trusts caller identity',async()=>{
  const calls=[];const mock=async(url,opts)=>{
    calls.push({url,opts});
    if(url.includes('/auth/v1/user'))return response({id});
    if(url.endsWith('/api/v2/user'))return response({user:{id:123}});
    const args=JSON.parse(opts.body).p_args;assert.equal(args.owner_id,id);assert.equal(args.clickup_user_id,'123');assert.equal(args.token_hash,undefined);return response({devices:[]});
  };
  assert.equal((await invoke({op:'list'},mock)).code,401);assert.equal(calls.length,0);
  assert.equal((await invoke({op:'list',owner_id:'forged',clickup_user_id:'forged'},mock,{authorization:'Bearer app-session','x-clickup-key':'pk_'+'x'.repeat(25)})).code,200);
  assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length,1);
  assert.equal((await invoke({op:'claim'},mock,{authorization:'Bearer app-session'})).code,401);
});
test('device tokens are hashed and cannot invoke browser management operations',async()=>{
  const token='x'.repeat(43);let seen;
  const result=await invoke({op:'claim'},async(url,opts)=>{seen=JSON.parse(opts.body);return response(null);},{authorization:'Device '+token});
  assert.equal(result.code,200);assert.equal(seen.p_args.token_hash,createHash('sha256').update(token).digest('hex'));
  assert.equal(JSON.stringify(seen).includes(token),false);
  assert.equal((await invoke({op:'list'},async()=>{throw Error('must not fetch');},{authorization:'Device '+token})).code,401);
});
test('completed result replay does not recreate documents or revalidate a changed record',async()=>{
  let calls=0;const out=await invoke({op:'complete',jobId:id,lease:id,result:{}},async()=>{calls++;return response({done:true});},{authorization:'Device '+'x'.repeat(43)});
  assert.equal(out.code,200);assert.deepEqual(out.body,{done:true});assert.equal(calls,1);
});
test('brief readback tolerates formatting whitespace but rejects lost or changed source content',()=>{
  assert.ok(briefContentMatches('## 1. SNAPSHOT\n| A | B |\n','## 1\\. SNAPSHOT\r\n|A|B|'));
  assert.equal(briefContentMatches('Source changed','Source original'),false);
  assert.equal(briefContentMatches('',''),false);
});
test('a publishing reservation is never used to create a duplicate page',async()=>{
  const r=result(),names=['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
  r.markdown=names.map((s,i)=>'## '+(i+1)+'. '+s+'\n'+('Verified source and adapted product script. '.repeat(9))).join('\n')+'\n'+context.source_url+
    ('\n| Time | Label | Caption / Voice Over | Visual Beat | Editor Notes |\n').repeat(4);
  r.brief={next_ad_scripts:Array.from({length:3},()=>({name:'Script',voice_over_script:'Full text',source_format_match:'Reference skeleton',script_breakdown:[{}]}))};
  const operations=[];
  const out=await invoke({op:'complete',jobId:id,lease:id,result:r},async(url,opts)=>{
    if(url.endsWith('/api/v2/user'))return response({user:{id:123}});
    assert.ok(url.includes('/rpc/'));const op=JSON.parse(opts.body).p_op;operations.push(op);
    if(op==='inspect')return response({...context,no_brief:false,clickup_user_id:'123'});
    if(op==='prepare')return response({publishing:true,page:null,artifactHash:'already-reserved'});
    if(op==='review')return response({ok:true});
    throw new Error('Unexpected write');
  },{authorization:'Device '+'x'.repeat(43),'x-clickup-key':'pk_'+'x'.repeat(25)});
  assert.equal(out.code,409);assert.deepEqual(operations,['inspect','prepare','review']);
});
test('personal bundle excludes app/admin credentials and shared queue runners',()=>{
  const worker=readFileSync(new URL('../tools/personal-worker/worker.py',import.meta.url),'utf8');
  assert.doesNotMatch(worker,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|producer_runs|strategist_runs|worker_registry/);
  assert.match(worker,/start_new_session=True/);assert.match(worker,/isolated/);assert.match(worker,/STOP.wait\(60\)/);
  const client=readFileSync(new URL('../public/personal-worker-client.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(client,/\.channel\(|setInterval\(/);
  assert.match(client,/personal-worker-preference\.mjs/);
  const migration=readFileSync(new URL('../supabase/migrations/20261021000100_personal_classification_workers.sql',import.meta.url),'utf8');
  assert.match(migration,/revoke all on schema personal_workers from public, anon, authenticated/);
  assert.doesNotMatch(migration,/insert into (?:public\.)?(?:ads|angles|personas|matrix_cells|manual_actions)\b/i);
});
test('both app entry points restore selection after credentials and guard early submissions',()=>{
  for(const file of ['../immuvi-command-center.html','../public/immuvi-command-center.html']){
    const app=readFileSync(new URL(file,import.meta.url),'utf8');
    const start=app.indexOf('  // Restore saved API key');
    const end=app.indexOf('  // Clean up stale CELL_CREATIVE_ASSIGNMENTS',start);
    assert.ok(start>=0&&end>start);
    assert.match(app.slice(start,end),/CFG\.key = savedKey;[\s\S]*window\._insRefreshRunOnPicker\(\)/);
    assert.match(app,/CFG\.key = keyInput \? keyInput\.value\.trim\(\) : CFG\.key;\s*if \(window\._insRefreshRunOnPicker\)/);
    assert.match(app,/if \(sel && sel\.disabled\).*Worker selection is loading/);
    assert.match(app,/if \(!AUTH\.user \|\| !CFG\.key\)/);
  }
});
