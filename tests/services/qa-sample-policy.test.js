import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, assertPlan, SOURCE_REF } from '../../scripts/qa-sample-policy.mjs';

test('sample sanitizer removes credentials, integration metadata and external URLs recursively', () => {
  const result = sanitize({ title:'Copied brief', clickupTaskId:'live-task', api_key:'secret', storeId:'store', data:{ _clickupDocPageUrl:'https://app.clickup.com/x', assignees:[{email:'person@example.com'}], notes:`See https://${SOURCE_REF}.supabase.co/file and person@example.com` } });
  assert.deepEqual(result, {title:'Copied brief',data:{notes:'See https://example.invalid/qa-reference and qa-sample@example.test'}});
});
test('sample references are remapped and unknown identities cleared', () => {
  assert.deepEqual(sanitize({ id:'old',product_id:'prod',parentAdId:'missing',items:['old'] },new Map([['old','new'],['prod','qa-sample-canva']])),{id:'new',product_id:'qa-sample-canva',parentAdId:null,items:['new']});
});
test('sample plan refuses account imports, foreign products and connected products', () => {
  assert.throws(()=>assertPlan({profiles:[{}]}));
  assert.throws(()=>assertPlan({ads:[{product_id:'production'}]}));
  assert.throws(()=>assertPlan({products:[{id:'qa-sample-canva',config:{clickup_list_id:'1301130000002447'}}]}));
});
test('sample plan refuses executable jobs and live remote identities', () => {
  assert.throws(()=>assertPlan({inspiration_queue:[{status:'pending'}]}));
  assert.throws(()=>assertPlan({worker_registry:[{enabled:true,status:'offline'}]}));
  assert.throws(()=>assertPlan({ads:[{clickup_task_id:'live'}]}));
  assert.throws(()=>assertPlan({strategist_processed:[{clickup_task_id:'live'}]}));
  assert.throws(()=>assertPlan({inspirations:[{url:'https://app.clickup.com/t/task'}]}));
  assert.doesNotThrow(()=>assertPlan({inspiration_queue:[{status:'cancelled'}],worker_registry:[{enabled:false,status:'offline'}]}));
});
