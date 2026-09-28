import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {REVIEW_VERSION, evidenceFor, productContext, reviewInput, hasEvidence, validateAssessment} from '../public/taxonomy-review-core.mjs';
import {createReviewClient, signature} from '../public/taxonomy-review-client.mjs';
import {runReview, reviewCommand} from '../team-skill/taxonomy-review-worker.mjs';

const product = {id:'quilt', name:'Quilting'};
const angles = [{id:'a1', name:'Beginner Confidence', product_id:'quilt'}, {id:'foreign', name:'ADHD tools', product_id:'adhd'}];
const personas = [{id:'p1', name:'Beginner Quilters', product_id:'quilt'}];
const ins = {id:'Q-1', product_id:'quilt', status:'Classified', angle:'Beginner Confidence', persona:'Beginner Quilters', bodyCopy:'New to quilting? Learn to finish your first quilt without frustration.', voiceOver:'No voice over'};
const input = () => reviewInput(product, angles, personas, ins);
function recommendation(kind, overrides = {}) {
  return {decision:'existing', existingId:kind === 'angle' ? 'a1' : 'p1', name:'ignored model spelling', confidence:.92,
    reason:'The creative addresses first-time quilters learning to finish their first project.', distinctReason:'', productFit:'direct', productReason:'Source and target are quilting.',
    evidence:[{field:'bodyCopy',quote:'Learn to finish your first quilt without frustration.'}], ...overrides};
}
function reviewed() {return {version:REVIEW_VERSION, productId:product.id, productName:product.name, insId:ins.id, evidence:evidenceFor(ins), angle:validateAssessment(recommendation('angle'),'angle',input()), persona:validateAssessment(recommendation('persona'),'persona',input())};}

test('source evidence excludes assigned names, briefs, notes, scripts and credentials', () => {
  const evidence = evidenceFor({...ins, persona:'ADHD Adults', angle:'Side hustles', notes:'Mom on screen', nextAdScripts:['Teachers need this'], _customFields:{secret:'token'}, captionTimeline:[{text:'Actual caption', id:'secret'}]});
  assert.equal(evidence.source.captionTimeline, 'Actual caption');
  assert.equal(evidence.source.voiceOver, undefined);
  assert.doesNotMatch(JSON.stringify(evidence), /ADHD|hustle|Mom|Teachers|secret|token/);
  assert.equal(hasEvidence(evidenceFor({angle:'Beginner', persona:'Quilter'})), false);
  assert.doesNotMatch(JSON.stringify(productContext({...product, config:{api_key:'secret', production:{offer:'Guide',token:'secret'}}})), /secret|api_key|token/);
});
test('correct existing category remains eligible and foreign/archived categories do not', () => {
  assert.equal(input().angles.length,1);
  assert.equal(validateAssessment(recommendation('persona'), 'persona', input()).name, 'Beginner Quilters');
  assert.equal(validateAssessment(recommendation('angle',{existingId:'foreign'}), 'angle', input()).decision,'needs_review');
  assert.equal(validateAssessment(recommendation('angle'), 'angle', reviewInput(product,[{...angles[0],archivedAt:1}],personas,ins)).decision,'needs_review');
});
test('genuinely new evidence-backed categories are allowed, exact duplicates reuse canonical spelling', () => {
  const fresh = recommendation('persona',{decision:'new',existingId:'',name:'First-Project Quilters',distinctReason:'The only existing category targets professional sellers.'});
  assert.equal(validateAssessment(fresh,'persona',reviewInput(product,angles,[],ins)).isNew,true);
  const duplicate = validateAssessment({...fresh,name:'beginner quilters'},'persona',input());
  assert.equal(duplicate.isNew,false);
  assert.equal(duplicate.name,'Beginner Quilters');
});
test('fabricated quotes, unsupported product transfers and low-confidence guesses are blocked', () => {
  for (const override of [{evidence:[{field:'bodyCopy',quote:'Moms with ADHD'}]}, {confidence:.79}, {productFit:'unsupported'}, {decision:'new',name:'ADHD Adults',distinctReason:''}]) {
    assert.equal(validateAssessment(recommendation('persona',override),'persona',input()).decision,'needs_review');
  }
  const withHypothesis = reviewInput(product,angles,personas,{...ins,creativeHypothesis:'This ad targets moms with ADHD.'});
  assert.equal(validateAssessment(recommendation('persona',{evidence:[{field:'creativeHypothesis',quote:'This ad targets moms with ADHD.'}]}),'persona',withHypothesis).decision,'needs_review');
});
test('cache signature changes with source, taxonomy or product but not current labels/generated scripts', async () => {
  const original = await signature(input());
  assert.equal(original,await signature(reviewInput(product,angles,personas,{...ins,persona:'Wrong',nextAdScripts:['fake']})));
  assert.notEqual(original,await signature(reviewInput(product,angles,personas,{...ins,bodyCopy:'Different creative'})));
  assert.notEqual(original,await signature(reviewInput({...product,id:'other'},angles,personas,ins)));
  assert.notEqual(original,await signature(reviewInput(product,[...angles,{id:'a2',name:'Relaxation'}],personas,ins)));
});

function clientFixture() {
  let c = {product, userId:'user', generation:1, angles, personas, inspirations:[structuredClone(ins)]};
  const jobs=[], calls=[], applied=[]; let confirmation = false;
  c.sb={rpc:async (name,args) => {
    calls.push({name,args});
    const job={id:'job'+calls.length,product_id:args.p_product_id,ins_id:args.p_ins_id,requested_signature:args.p_signature,status:'complete',result:reviewed()};
    jobs.push(job); return {data:job};
  },from:() => ({select(){return this;},eq(){return this;},in(){return Promise.resolve({data:jobs});}})};
  const client=createReviewClient({context:()=>c,paint(){},apply:(...args)=>applied.push(args),confirm:()=>confirmation,notify(){},later:()=>1});
  return {client,calls,applied,jobs,get c(){return c;},switchTo(x){c=x;},allow(){confirmation=true;}};
}
test('review rendering confirms an existing fit, caches results and does not mutate inspiration records', async () => {
  const f=clientFixture(), before=JSON.stringify(f.c.inspirations);
  await f.client.pump(); await f.client.pump();
  assert.equal(f.calls.length,1);
  assert.match(f.client.render(f.c.inspirations[0],'persona'),/Match confirmed/);
  assert.equal(JSON.stringify(f.c.inspirations),before);
  assert.deepEqual(f.applied,[]);
});
test('new suggestion requires confirmation and no cross-product response can be accepted', async () => {
  const f=clientFixture();
  f.c.inspirations[0].persona='Wrong';
  await f.client.pump();
  f.client.accept(ins.id,'persona'); assert.equal(f.applied.length,0);
  f.allow(); f.client.accept(ins.id,'persona'); assert.deepEqual(f.applied,[[ins.id,'persona','Beginner Quilters']]);
  f.jobs[0].result.productId='adhd';
  f.client.accept(ins.id,'persona'); assert.equal(f.applied.length,1);
});
test('evidence changes and product switches invalidate visible suggestions', async () => {
  const f=clientFixture(); await f.client.pump();
  f.c.inspirations[0].bodyCopy='Changed source';
  assert.equal(f.client.assessment(f.c.inspirations[0],'persona'),null);
  f.switchTo({...f.c,product:{id:'adhd',name:'ADHD'},generation:2});
  assert.equal(f.client.assessment(ins,'persona'),null);
});
test('only four current-product review jobs are queued at a time', async () => {
  const f=clientFixture();
  f.c.inspirations=Array.from({length:9},(_,i)=>({...ins,id:'Q-'+i})).concat({...ins,id:'foreign',product_id:'adhd'});
  f.c.sb.rpc=async(name,args)=>{f.calls.push(args);return {data:{id:args.p_ins_id,ins_id:args.p_ins_id,product_id:args.p_product_id,requested_signature:args.p_signature,status:'pending'}};};
  await f.client.pump(); assert.equal(f.calls.length,4);
  await f.client.pump(); assert.equal(f.calls.length,4);
  assert.ok(f.calls.every(x=>x.p_product_id==='quilt' && x.p_ins_id!=='foreign'));
});
test('product switch while queue request is in flight cannot apply its result', async () => {
  const f=clientFixture(); let finish;
  f.c.sb.rpc=()=>new Promise(resolve=>finish=resolve);
  const work=f.client.pump();
  while(!finish) await new Promise(r=>setTimeout(r,5));
  f.switchTo({...f.c,product:{id:'other',name:'Other'},generation:2});
  finish({data:{product_id:'quilt',ins_id:ins.id,status:'complete',result:reviewed()}});
  await work;
  assert.equal(f.client.assessment(ins,'angle'),null); assert.equal(f.applied.length,0);
});

function workerFixture() {
  const calls=[], modelInputs=[];
  const job={id:'job',product_id:'quilt',ins_id:ins.id,requested_by:'user',claimed_at:'2026-09-28T00:00:00Z'};
  let rows={profiles:[{id:'user',role:'member',is_active:true}],user_products:[{product_id:'quilt'}],products:[product],inspirations:[{...ins,data:ins}],angles,personas};
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options}); const u=new URL(url), table=u.pathname.split('/').pop();
    const data=table==='taxonomy_review_jobs' ? (u.searchParams.get('status')==='eq.complete' ? [] : [job]) : rows[table];
    return {ok:true,json:async()=>data};
  };
  const agent=async input=>{modelInputs.push(input);return {angle:recommendation('angle'),persona:recommendation('persona')};};
  return {calls,modelInputs,rows,options:{env:{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private'},fetchImpl,agent}};
}
test('Mac mini runner scopes all evidence reads and writes ONLY its review job', async () => {
  const f=workerFixture(); const result=await runReview('job','gp-mac-mini',f.options);
  assert.equal(result.persona.name,'Beginner Quilters');
  assert.equal(f.modelInputs.length,1);
  assert.equal(f.modelInputs[0].angles.length,1);
  const writes=f.calls.filter(c=>c.options.method);
  assert.equal(writes.length,1); assert.match(writes[0].url,/\/taxonomy_review_jobs\?/);
  assert.match(writes[0].url,/claimed_at=eq\./);
  assert.doesNotMatch(JSON.stringify(f.modelInputs),/private|SUPABASE/);
  for(const table of ['inspirations','angles','personas']) assert.match(f.calls.find(c=>c.url.includes('/'+table+'?')).url,/product_id=eq.quilt/);
});
test('revoked access or cross-product inspiration prevents model use', async () => {
  for(const change of [f=>f.rows.user_products=[],f=>f.rows.inspirations=[{...ins,product_id:'adhd'}]]) {
    const f=workerFixture(); change(f);
    await assert.rejects(runReview('job','gp-mac-mini',f.options));
    assert.equal(f.modelInputs.length,0);
    assert.ok(f.calls.filter(c=>c.options.method).every(c=>c.url.includes('/taxonomy_review_jobs?')));
  }
});
test('review agent has no write tools, shared config, browser, or bypass permissions', () => {
  const cmd=reviewCommand('codex','schema','result').join(' ');
  assert.match(cmd,/--ignore-user-config/); assert.match(cmd,/--sandbox read-only/);
  assert.match(cmd,/--disable shell_tool/); assert.match(cmd,/--disable apps/); assert.match(cmd,/--disable plugins/);
  assert.doesNotMatch(cmd,/dangerously|bypassPermissions/);
});
for(const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  test(file+': canonical matching never silently maps nearby names or meanings',()=>{
    const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    const start=html.indexOf('function _canonicalTaxonomyName('), end=html.indexOf('\n}\n',start)+2;
    const c=vm.createContext({_normalizeTaxonomyName:x=>x.trim(),_taxonomyLookupKey:x=>x.toLowerCase(),_preferredTaxonomyItem:x=>x});
    vm.runInContext(html.slice(start,end),c);
    const list=[{name:'ADHD Adults Seeking Tools'},{name:'Beginner Quilter'}];
    assert.equal(c._canonicalTaxonomyName('Quilters Seeking Relaxation',list),'Quilters Seeking Relaxation');
    assert.equal(c._canonicalTaxonomyName('beginner quilter',list),'Beginner Quilter');
    const renderer=html.slice(html.indexOf('function _renderInspirationTaxonomySuggestion('),html.indexOf('function _taxonomyCreativeCount('));
    assert.doesNotMatch(renderer,/_personaSuggestions|_angleSuggestions|updateInsField/);
  });
}
