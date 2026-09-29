import test from 'node:test';
import assert from 'node:assert/strict';
import {createProduction,editProduction} from '../../lib/services/production.js';
import {productionDraft,productionRequest} from '../../lib/domain/production-creation.js';
import {QA_SUPABASE_URL} from '../../lib/qa-supabase-env.js';
const id='00000000-0000-4000-8000-000000000001';
const request=productionRequest('qa',{...productionDraft(),formatName:'Task',notes:'Keep'},id);
const ad={id:'AD',product_id:'qa',updated_at:'stamp',status:'Untested',...request.p_values};
const action={id:'ACT',product_id:'qa',updated_at:'stamp',payload:{sourceAdId:'AD',title:'Task',format:''}};
const saved={productId:'qa',requestId:id,ad,action};
const client=(result)=>({supabaseUrl:QA_SUPABASE_URL,rpc:async()=>result});
const snapshot={display:{productId:'qa',dbId:'ACT',linkedAdId:'AD',clickupTaskId:''},payload:action.payload,actionVersion:'stamp',adVersion:'stamp'};
test('production draft validates names, dates and URLs and excludes protected metadata',()=>{
 assert.equal(request.p_values.status,undefined);assert.equal(request.p_values.meta.notes,'Keep');
 for(const patch of [{formatName:''},{formatName:'x'.repeat(501)},{dueDate:'2026-02-30'},{driveLink:'javascript:alert(1)'}])assert.throws(()=>productionRequest('qa',{...productionDraft(),formatName:'Task',...patch},id));
});
test('production intake preserves exact older pending request identity',()=>{
 const draft=productionDraft();delete draft.format;
 assert.equal(Object.hasOwn(productionRequest('qa',{...draft,formatName:'Old'},id).p_values,'format'),false);
 assert.equal(productionRequest('qa',{...productionDraft(),formatName:'New',format:'Teacher Angle'},id).p_values.format,'Teacher Angle');
});
test('production format is verified against the action rather than the creative ad type',async()=>{
 const result={...saved,action:{...action,payload:{...action.payload,format:'Teacher Angle'}}};
 assert.equal((await editProduction(client({data:result}),'qa',snapshot,'format',{format:'Teacher Angle'})).ad.ad_type,'Video');
 await assert.rejects(editProduction(client({data:saved}),'qa',snapshot,'format',{format:'Teacher Angle'}),/fields could not be verified/);
 await assert.rejects(createProduction(client({data:saved}),{...request,p_values:{...request.p_values,format:'Teacher Angle'}}),/verified/);
});
test('production creation verifies receipt, source, fields and versions',async()=>{
 assert.deepEqual(await createProduction(client({data:saved}),request),saved);
 for(const patch of [{requestId:'other'},{productId:'other'},{ad:{...ad,format_name:'Wrong'}},{ad:{...ad,meta:{}}},{action:{...action,product_id:'foreign'}},{action:{...action,payload:{sourceAdId:'wrong'}}}])await assert.rejects(createProduction(client({data:{...saved,...patch}}),request),/verified/);
});
test('production creation differentiates definite rejection from uncertain acknowledgement',async()=>{
 await assert.rejects(createProduction(client({error:{code:'P0001',message:'Invalid axis'}}),request),(error)=>error.definite===true);
 await assert.rejects(createProduction(client({data:null}),request),(error)=>!error.definite);
 await assert.rejects(createProduction({supabaseUrl:'https://production.test',rpc:()=>assert.fail()},request),/restricted to QA/);
});
test('production detail saves verify exact fields and preserve remote identity',async()=>{
 assert.equal((await editProduction(client({data:saved}),'qa',snapshot,'details',{format_name:'Task',meta:{notes:'Keep'}})).ad.id,'AD');
 await assert.rejects(editProduction(client({data:saved}),'qa',snapshot,'details',{format_name:'Wrong'}),/fields could not be verified/);
 await assert.rejects(editProduction(client({data:{...saved,ad:{...ad,clickup_task_id:'unexpected'}}}),'qa',snapshot,'details',{}),/link changed/);
 await assert.rejects(editProduction(client({data:saved}),'foreign',snapshot,'details',{}),/source is unresolved/);
});
test('production assignment saves verify raw values including clears and false',async()=>{
 const data={...saved,ad:{...ad,meta:{_customFieldsRaw:{reviewer:[],flag:false}}}};
 assert.equal((await editProduction(client({data}),'qa',snapshot,'fields',{review:{name:'Reviewer',value:[]},flag:{name:'Flag',value:false}})).ad.id,'AD');
 await assert.rejects(editProduction(client({data}),'qa',snapshot,'fields',{review:{name:'Reviewer',value:[1]}}),/fields could not be verified/);
});
