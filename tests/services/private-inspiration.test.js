import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, publicEncrypt, constants } from 'node:crypto';
import { publicAdUrl, validateBriefMarkdown, validateInspirationResult, deliverPrivateBrief, briefSectionText, briefContentMatches, clickUpBriefMarkdown, verifyLibraryDocument, libraryPages, masterTrackerMarkdown, TEST_LIST, TEST_WORKSPACE } from '../../lib/services/private-inspiration.js';
import { mediaAnalysisInput } from '../../scripts/private-inspiration-runner.mjs';

test('analysis receives timing evidence only for attached frames, without local paths',()=>{
  const media={frames:Array.from({length:8},(_,i)=>`/private/job/frame_${i}.jpg`),
    frame_samples:Array.from({length:8},(_,i)=>({image:i+1,nominal_seconds:i*3})),
    frame_timing:{interval_seconds:3,precision:'Approximate samples'},duration:24};
  const input=mediaAnalysisInput(media);
  assert.equal(input.attached_frame_count,6);
  assert.equal(input.frames,undefined);
  assert.deepEqual(input.frame_samples,media.frame_samples.slice(0,6));
  assert.equal(input.frame_timing.precision,'Approximate samples');
  assert.doesNotMatch(JSON.stringify(input),/\/private\/job/);
  assert.equal(media.frames.length,8);
});

const headings=['SNAPSHOT','CREATIVE BREAKDOWN','WHY IT WORKS','REPLICATION BRIEF','WHAT TO TEST','COMPETITOR INTEL','OUR NEXT AD','NEXT AD SCRIPTS'];
const scriptTable='| Field | Direction |\n| --- | --- |\n| Source Format Match | Reference faithful |\n\n**Voice-over Script:** Proposed script.\n\n| Time | Label | Caption / Voice Over | Visual Beat | Editor Notes |\n| --- | --- | --- | --- | --- |\n| 0:00-0:03 | HOOK | Words | Scene | Cut |\n';
const markdown=headings.map((text,i)=>`## ${i+1}\\. ${text}`).join('\n')+'\nVoice Over: No voice over\nInspiration Script Skeleton\n\n'+Array(3).fill(scriptTable).join('\n');
const pair=generateKeyPairSync('rsa',{modulusLength:3072});
const token=publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from('test-only-token')).toString('base64');
const job={context:{listId:TEST_LIST},brief_number:1,sealed_clickup_token:token};
test('ClickUp Markdown formatting normalizes without losing brief content or structure',()=>{
  const original='## 1. Snapshot\n\n> [topic]\n\n- **First** item\n- Second item\n\n| Time | Direction |\n| --- | --- |\n| 0:00 | [Source](https://example.com/ad) |\n';
  const saved='## 1\\. Snapshot\n> \\[topic\\]\n\n*   **First** item\n*   Second item\n\n| Time | Direction |\n| ---| --- |\n| 0:00 | [Source](https://example.com/ad) |\n';
  assert.equal(briefContentMatches(original,saved),true);
  for(const changed of [saved.replace('First','Other'),saved.replace('0:00','0:01'),
    saved.replace('https://example.com/ad','https://example.com/other'),
    saved.replace('| 0:00 | [Source](https://example.com/ad) |\n',''),
    saved.replace('## ','### '),saved.replace('*   Second item\n','')]) {
    assert.equal(briefContentMatches(original,changed),false);
  }
  assert.equal(briefContentMatches('1. First\n2. Second','2. First\n3. Second'),false);
  assert.equal(briefContentMatches('',undefined),false);
});
test('private worker uses the exact legacy classification, worker instructions and page template',()=>{
  const source=readFileSync('team-skill/SKILL.md','utf8');
  const contract=JSON.parse(execFileSync('python3',['scripts/private-inspiration-media.py','--contract'],{encoding:'utf8'}));
  assert.equal(contract.classification,source.split('## Step 4')[1].split('## Step 5')[0]);
  assert.equal(contract.template,source.split('### 6c')[1].split('### 6d')[0]);
  assert.match(contract.worker,/Variations 2 and 3 may change wording 20-35%/);
  assert.doesNotMatch(Object.values(contract).join(''),/SUPABASE_SERVICE_ROLE_KEY|hdniumnkprkadlrrataz|90169348848/);
});
test('ClickUp upload keeps separator-adjacent paragraphs from becoming headings',()=>{
  const original='## Snapshot\n\n**Evidence note:** Verified visuals.\n* * *\n\n## Breakdown\n\nNo proof beat is visible.\n***\n\n## Why it works\n';
  const rewrite=value=>value.replace(/^\* \* \*$|^\*\*\*$/gm,'---');
  assert.equal(briefContentMatches(original,rewrite(original)),false);
  const prepared=clickUpBriefMarkdown(original);
  assert.equal(briefContentMatches(original,prepared),true);
  assert.equal(briefContentMatches(original,rewrite(prepared)),true);
  assert.equal(briefContentMatches(original,rewrite(prepared).replace('Verified visuals.','Invented claim.')),false);
});
test('upload formatting preserves code, reference definitions, tables and actual headings',()=>{
  const original='[source]: https://example.com/ad "Source"\n\n# Brief\n\n[Source][source]\n* * *\n\n```text\nexample\n* * *\n```\n\n| Time | Direction |\n| --- | --- |\n| 0:00 | Open |\n\nHeading\n-------\n';
  const prepared=clickUpBriefMarkdown(original);
  assert.equal(briefContentMatches(original,prepared),true);
  assert.ok(prepared.includes('[source]: https://example.com/ad "Source"'));
  assert.ok(prepared.includes('```text\nexample\n* * *\n```'));
  assert.ok(prepared.includes('Heading\n-------'));
  assert.equal(briefContentMatches(original,clickUpBriefMarkdown(original.replaceAll('\n','\r\n'))),true);
});
test('only public supported platforms enter the media downloader',()=>{
  assert.equal(publicAdUrl('https://www.facebook.com/ads/library/?id=2199245117340297'),'https://www.facebook.com/ads/library/?id=2199245117340297');
  for(const url of ['http://facebook.com/a','https://facebook.com.evil.test/a','https://127.0.0.1/a','https://user:pass@facebook.com/a'])assert.throws(()=>publicAdUrl(url));
});
test('Drive video file links reach the same legacy downloader as social ads',()=>{
  const id='10WnqmB11pKx2es0tYY-7is23T3u5ykKu';
  for (const url of [
    `https://drive.google.com/file/d/${id}/view?usp=drive_link`,
    `https://drive.google.com/file/d/${id}/preview`,
    `https://drive.google.com/file/d/${id}`,
    `https://docs.google.com/file/d/${id}/edit`,
    `https://drive.google.com/open?id=${id}`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
  ]) assert.equal(publicAdUrl(url),url);
  for (const url of [
    `https://drive.google.com.evil.test/file/d/${id}/view`,
    `https://evil.drive.google.com/file/d/${id}/view`,
    `http://drive.google.com/file/d/${id}/view`,
    `https://user:pass@drive.google.com/file/d/${id}/view`,
    `https://drive.google.com:8443/file/d/${id}/view`,
    `https://drive.google.com/drive/folders/${id}`,
    `https://docs.google.com/document/d/${id}/edit`,
    `https://drive.google.com/open?id=${id}&id=other`,
    'https://drive.google.com/open?id=short',
    `https://drive.google.com/redirect?id=${id}`,
    `https://drive.google.com/file/d/${id}/view/other`,
    'not a url',
  ]) assert.throws(()=>publicAdUrl(url));
});
test('brief validation rejects incomplete legacy tables',()=>{
  validateBriefMarkdown(markdown);
  assert.throws(()=>validateBriefMarkdown(markdown.replace('## 8\\. NEXT AD SCRIPTS','')));
  assert.throws(()=>validateBriefMarkdown(markdown.replace('Source Format Match','')));
  assert.throws(()=>validateInspirationResult({markdown},{}));
});
test('legacy table aliases and formatting do not cause false failures',()=>{
  for (const first of ['Field','Strategy Snapshot']) for (const second of ['Direction','Value']) {
    validateBriefMarkdown(markdown.replaceAll('| Field | Direction |',`| **${first}** | ${second} |`));
  }
  validateBriefMarkdown(markdown.toLowerCase());
  validateBriefMarkdown(markdown.replaceAll('\\.','.'));
  validateBriefMarkdown(markdown.replaceAll('\\.',''));
  validateBriefMarkdown(markdown.replaceAll('Caption / Voice Over','Caption/Voice Over'));
  validateBriefMarkdown(markdown+'\nSource Format Match is explained in each strategy table.\n');
  assert.throws(()=>validateBriefMarkdown(markdown.replaceAll('| --- | --- |','not a table')));
  assert.throws(()=>validateBriefMarkdown(markdown.replaceAll('| HOOK | Words | Scene | Cut |','| HOOK | Words | Scene | |')));
  assert.throws(()=>validateBriefMarkdown(markdown.replace('## 8\\. NEXT AD SCRIPTS','```md\n## 8\\. NEXT AD SCRIPTS')+'\n```'));
  assert.throws(()=>validateBriefMarkdown(markdown.replaceAll(scriptTable,'')+'\n```md\n'+scriptTable.repeat(3)+'\n```'));
});
test('legacy structured brief sections normalize to prose without dropping content',()=>{
  assert.equal(briefSectionText(['First reason','Second reason']),'- First reason\n- Second reason');
  assert.equal(briefSectionText({talent:'Illustrated figures',editor_brief:['First beat','Final beat']}),
    'talent: Illustrated figures\n\neditor brief: - First beat\n- Final beat');
  assert.equal(briefSectionText('Already prose'),'Already prose');
  assert.equal(briefSectionText({}),'');
  for(const value of [{talent:''},['Valid',''],{claim:false},42]) assert.throws(()=>briefSectionText(value));
  assert.throws(()=>validateInspirationResult({status:'failed'},{}),/could not verify/);
  assert.throws(()=>validateInspirationResult({ready_to_mark_ok:false},{}),/could not verify/);
});
test('narration uses the legacy alias fallback rather than requiring three copies',()=>{
  const script={variation:'One',intent:'Intent',hook_text:'Hook',source_format_match:'Reference faithful',voice_over_script:'Script',cta:'Shop now',what_to_change:'Product',why_it_should_work:'Evidence',script_breakdown:[{time:'0:00-0:03',label:'HOOK',caption_voice_over:'Text',visual_beat:'Scene',editor_note:'Cut'}]};
  const value={metadata:{page_name:'Brand',media_kind:'video',voice_over:'Verified spoken words',caption_timeline:[],voice_over_timeline:[]},
    classification:{hook_type:'Curiosity',creative_structure:'Demo',production_style:'Organic/Raw UGC',funnel_type:'TOF',persona:'Persona',angle:'Angle',creative_usp:'Format',creative_hypothesis:'Hypothesis',notes:'Scene',media_kind:'video',photo_video:'Video'},
    brief:{why_it_works:'Why',replication_brief:'How',what_to_test:'What',competitor_intel:'Intel',our_next_ad:'Next',inspiration_script_skeleton:'Skeleton',frame_by_frame:[{time:'0:00-0:03',label:'HOOK'}],next_ad_scripts:[script,script,script]},markdown};
  const media={media_kind:'video',metadata:{voice_over:'Verified spoken words',audio_probe:{has_audio:true}},duration:3,frames:['frame.jpg']};
  const verified=validateInspirationResult(structuredClone(value),media);
  assert.equal(verified.classification.voice_over,'Verified spoken words');
  assert.equal(verified.brief.voice_over,'Verified spoken words');
  // Observed sample labels and proposed edit ranges need not be identical in legacy.
  const adapted=structuredClone(value);
  adapted.brief.frame_by_frame[0].time='Approx. 0:15 sample';
  adapted.brief.next_ad_scripts[0].script_breakdown[0].time='Approx. 0:15-0:18, proposed';
  validateInspirationResult(adapted,media);
  const differentRows=structuredClone(value);
  differentRows.brief.frame_by_frame.push({time:'Approx. 0:03 sample',label:'BRIDGE'});
  validateInspirationResult(differentRows,media);
  const aliases=structuredClone(value);
  aliases.brief.next_ad_scripts=aliases.brief.next_ad_scripts.map(s=>{
    s=structuredClone(s);
    s.sourceFormatMatch=s.source_format_match;delete s.source_format_match;
    s.scriptBreakdown=s.script_breakdown;delete s.script_breakdown;
    return s;
  });
  assert.equal(validateInspirationResult(aliases,media).brief.next_ad_scripts[0].script_breakdown.length,1);
  for (const scripts of [null,{},[script,script],[script,script,null]]) {
    assert.throws(()=>validateInspirationResult({...structuredClone(value),brief:{...value.brief,next_ad_scripts:scripts}},media),/scripts|script/);
  }
  const structured=structuredClone(value);structured.brief.why_it_works=['Why'];structured.brief.replication_brief={talent:'Illustration'};
  const normalized=validateInspirationResult(structured,media);
  assert.equal(normalized.brief.why_it_works,'- Why');assert.equal(normalized.brief.replication_brief,'talent: Illustration');
  assert.equal(normalized.markdown,markdown);
  const ambient=structuredClone(value);ambient.classification.voice_over='No voice over';ambient.metadata.voice_over_timeline=[{time:'0:00-0:03',voice_over:'Background lyrics'}];
  const noNarration=validateInspirationResult(ambient,media);
  assert.equal(noNarration.metadata.voice_over,'No voice over');assert.deepEqual(noNarration.metadata.voice_over_timeline,[]);
  assert.throws(()=>validateInspirationResult({...value,metadata:{...value.metadata,voice_over:''}},media),/Unverified narration requires/);
  assert.throws(()=>validateInspirationResult(structuredClone(value),{...media,metadata:{audio_probe:{has_audio:true}}}),/Audio transcription is unverified/);
  const uncertain=structuredClone(value);
  uncertain.metadata.voice_over='';uncertain.metadata.caption_timeline=[{time:'0:00-0:03',caption:'Visible hook'}];
  uncertain.classification.notes='Narration cannot be distinguished from background lyrics; brief uses visible captions.';
  uncertain.markdown=markdown.replace('Voice Over: No voice over\n','');
  const accepted=validateInspirationResult(uncertain,{...media,metadata:{audio_probe:{has_audio:true}}});
  assert.equal(accepted.metadata.voice_over,'');assert.equal(accepted.classification.voice_over,'');
  assert.equal(accepted.metadata.audio_verification.status,'unverified');assert.deepEqual(accepted.metadata.voice_over_timeline,[]);
  assert.throws(()=>validateInspirationResult({...structuredClone(uncertain),markdown:'Voice Over: No voice over\n'+uncertain.markdown},media),/must be omitted/);
});
test('delivery creates one private test-list Doc, checkpoints receipts and verifies saved content',async()=>{
  const calls=[],stages=[];
  const responses=[{id:TEST_LIST},{id:'doc-1'},{parent:{id:TEST_LIST,type:6}},{id:'page-1'},{content:markdown}];
  const result=await deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>stages.push(stage),fetchImpl:async(url,init)=>{calls.push({url,...init});return Response.json(responses.shift());}});
  assert.deepEqual(result,{docId:'doc-1',pageId:'page-1'});
  assert.deepEqual(stages,['result','delivery-start','doc','page','complete']);
  assert.equal(calls.filter(c=>c.method==='POST').length,2);
  const body=JSON.parse(calls[1].body);
  assert.deepEqual(body.parent,{id:TEST_LIST,type:6});assert.equal(body.name,'test immuvi brief-1');assert.equal(body.visibility,'PRIVATE');
});
test('uncertain Doc creation never retries and never completes',async()=>{
  let count=0;const stages=[];
  await assert.rejects(deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>stages.push(stage),fetchImpl:async()=>{if(++count===1)return Response.json({id:TEST_LIST});throw new Error('lost response');}}),/lost response/);
  assert.equal(count,2);assert.deepEqual(stages,['result','delivery-start']);
});
test('explicitly configured workspace visibility matches legacy without a fallback',async()=>{
  const calls=[];
  const responses=[{id:TEST_LIST},{id:'doc-1'},{parent:{id:TEST_LIST,type:6}},{id:'page-1'},{content:markdown}];
  await deliverPrivateBrief({job:{...job,context:{...job.context,docVisibility:'PUBLIC'}},result:{markdown},privateKey:pair.privateKey,checkpoint:async()=>{},fetchImpl:async(url,init)=>{calls.push(init);return Response.json(responses.shift());}});
  assert.equal(JSON.parse(calls[1].body).visibility,'PUBLIC');
});
test('403 creates a rejected-delivery receipt, reports the step and never leaks response text',async()=>{
  let count=0;const stages=[];
  await assert.rejects(deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage,value)=>stages.push({stage,value}),fetchImpl:async()=>{
    if(++count===1)return Response.json({id:TEST_LIST});
    return Response.json({ECODE:'DOCS_PERMISSION',err:'Rejected test-only-token',meta:{authorization_failures:[{object_type:'list',object_id:'test-only-token',invalid_permissions:['can_create','test-only-token']},{object_type:'test-only-token',invalid_permissions:['can_read']}] }},{status:403});
  }}),error=>{assert.match(error.message,/create Doc failed \(403, DOCS_PERMISSION\)/);assert.match(error.message,/Missing permission \(list: can_create\)/);assert.match(error.message,/brief is saved/);assert.doesNotMatch(error.message,/test-only-token/);return true;});
  assert.equal(count,2);
  assert.deepEqual(stages.at(-1),{stage:'delivery-rejected',value:{status:403,code:'DOCS_PERMISSION'}});
});
test('server failures and page rejections do not reopen Doc creation',async()=>{
  for(const status of [500,502,503]) {
    let count=0;const stages=[];
    await assert.rejects(deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>stages.push(stage),fetchImpl:async()=>++count===1?Response.json({id:TEST_LIST}):new Response('Unavailable',{status})}));
    assert.deepEqual(stages,['result','delivery-start']);
  }
  const stages=[],responses=[{id:TEST_LIST},{id:'doc-1'},{parent:{id:TEST_LIST,type:6}}];
  await assert.rejects(deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>stages.push(stage),fetchImpl:async()=>responses.length?Response.json(responses.shift()):Response.json({code:'FORBIDDEN'},{status:403})}),/create brief page failed/);
  assert.deepEqual(stages,['result','delivery-start','doc']);
});
test('delivery-only worker reuses saved generation',()=>{
  const source=readFileSync('scripts/private-worker.mjs','utf8');
  assert.match(source,/job\.result \?\? await classifyPrivateInspiration/);
});
test('out-of-scope and repeated delivery are refused before a request',async()=>{
  for(const altered of [{context:{listId:'production'}},{delivery_started:true},{doc_id:'existing'}]) {
    await assert.rejects(deliverPrivateBrief({job:{...job,...altered},result:{markdown},privateKey:pair.privateKey,checkpoint:async()=>{},fetchImpl:()=>assert.fail('network must not run')}));
  }
});
test('wrong document parent cannot receive content',async()=>{
  let count=0;const stages=[];
  const responses=[{id:TEST_LIST},{id:'doc-1'},{parent:{id:'production',type:6}}];
  await assert.rejects(deliverPrivateBrief({job,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>stages.push(stage),fetchImpl:async()=>{count++;return Response.json(responses.shift());}}),/approved test list/);
  assert.equal(count,3);assert.deepEqual(stages,['result','delivery-start','doc']);
});

const libraryDoc={id:'qa-library',workspace_id:TEST_WORKSPACE,parent:{id:TEST_LIST,type:6},public:true};
const libraryJob={...job,inspiration_id:'INS-1',context:{...job.context,docVisibility:'PUBLIC',libraryDocId:'qa-library',libraryTrackerPageId:'tracker',product:{name:'QA'}}};
const trackerPage={id:'tracker',name:'Master Tracker'};
test('legacy library creates a brief page, not another Doc, and updates the tracker',async()=>{
  const calls=[],stages=[];
  const responses=[{id:TEST_LIST},libraryDoc,[trackerPage],{id:'brief'},{content:markdown},{}];
  const value=await deliverPrivateBrief({job:libraryJob,result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>{stages.push(stage);return stage==='tracker-rows'?[]:undefined;},fetchImpl:async(url,init)=>{calls.push({url,...init});return Response.json(responses.shift());}});
  assert.deepEqual(value,{docId:'qa-library',pageId:'brief'});
  assert.equal(calls.filter(call=>call.method==='POST').length,1);
  assert.match(calls.find(call=>call.method==='POST').url,/docs\/qa-library\/pages$/);
  assert.equal(JSON.parse(calls[3].body).name,'test immuvi brief-1');
  assert.match(calls.at(-1).url,/pages\/tracker$/);
  assert.deepEqual(stages,['result','delivery-start','doc','page','tracker-rows','complete']);
});
test('legacy library reuses existing inspiration pages and resumes known receipts',async()=>{
  for(const receipts of [{},{delivery_started:true,doc_id:'qa-library',page_id:'brief'}]) {
    const calls=[],stages=[];
    const responses=[{id:TEST_LIST},libraryDoc,[trackerPage,{id:'brief',name:'test immuvi brief-1'}],null, {content:markdown.replaceAll('\\.','.')},null];
    await deliverPrivateBrief({job:{...libraryJob,...receipts},result:{markdown},privateKey:pair.privateKey,checkpoint:async(stage)=>{stages.push(stage);return stage==='tracker-rows'?[]:undefined;},fetchImpl:async(url,init)=>{calls.push({url,...init});const response=responses.shift();return response===null?new Response(null,{status:200}):Response.json(response);}});
    assert.equal(calls.filter(call=>call.method==='POST').length,0);
    assert.match(calls.find(call=>call.method==='PUT').url,/pages\/brief$/);
    if(receipts.page_id)assert.deepEqual(stages,['result','tracker-rows','complete']);
  }
});
test('uncertain library creation cannot be repeated just because a page is not listed',async()=>{
  const responses=[{id:TEST_LIST},libraryDoc,[trackerPage]];
  await assert.rejects(deliverPrivateBrief({job:{...libraryJob,delivery_started:true,doc_id:'qa-library'},result:{markdown},privateKey:pair.privateKey,checkpoint:async()=>assert.fail('no write'),fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');return Response.json(responses.shift());}}),/uncertain outcome/);
});
test('altered ClickUp content cannot update the tracker or mark the inspiration complete',async()=>{
  const stages=[];
  const responses=[{id:TEST_LIST},libraryDoc,[trackerPage],{id:'brief'},{content:markdown.replace('No voice over','Changed narration')}];
  await assert.rejects(deliverPrivateBrief({job:libraryJob,result:{markdown},privateKey:pair.privateKey,
    checkpoint:async(stage)=>stages.push(stage),fetchImpl:async()=>Response.json(responses.shift())}),/differs/);
  assert.equal(stages.includes('complete'),false);
  assert.equal(stages.includes('tracker-rows'),false);
});
test('production libraries and ambiguous pages fail closed without mistaking the public flag for workspace visibility',()=>{
  verifyLibraryDocument(libraryDoc,'qa-library');
  verifyLibraryDocument({...libraryDoc,public:false},'qa-library');
  for(const patch of [{parent:{id:'production',type:5}},{workspace_id:'other'},{deleted:true},{archived:true}]) assert.throws(()=>verifyLibraryDocument({...libraryDoc,...patch},'qa-library'));
  assert.deepEqual(libraryPages([{id:'parent',pages:[{id:'child'}]}]).map(p=>p.id),['parent','child']);
  assert.throws(()=>libraryPages([{id:'same'},{id:'same'}]));
  assert.throws(()=>libraryPages({}));
  assert.throws(()=>masterTrackerMarkdown('QA',[{url:'https://example.com/'}]));
});
