import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationActivity, activityEstimate, activityStatus } from '../../lib/domain/inspiration-activity.js';

test('finished jobs cannot look blocked because of an old worker assignment', () => {
  for (const status of ['classified', 'done', 'completed']) assert.equal(activityStatus(status, 'blocked:offline'), 'done');
  for (const status of ['failed', 'error', 'cancelled']) assert.equal(activityStatus(status, 'blocked:offline'), 'failed');
  assert.equal(activityStatus('pending', 'blocked:offline'), 'blocked');
});

test('activity scopes both ends of briefs and all other jobs to the current product',()=>{
  const jobs=inspirationActivity({productId:'p',ads:[{id:'a',product_id:'p'},{id:'b',product_id:'p'},{id:'x',product_id:'other'}],
    queue:[{id:'q',insId:'i',productId:'p',status:'pending',workerAssignment:'blocked:qa-isolation'},{id:'foreign',productId:'other'}],
    briefs:[{id:'good',parent_ad_id:'a',target_ad_id:'b',status:'classifying'},{id:'bad',parent_ad_id:'x',target_ad_id:'b'}],
    images:[{id:'img',product_id:'p',status:'running',ad_id:'a'},{id:'no',product_id:'other'}]});
  assert.deepEqual(new Set(jobs.map(job=>job.id)),new Set(['inspiration:q','brief:good','image:img']));
  assert.equal(jobs.find(job=>job.id==='inspiration:q').status,'blocked');
  assert.equal(jobs.find(job=>job.kind==='Variation brief').stage,'Generating variation brief');
});

test('estimates never invent times for blocked jobs, offline workers, or briefs without history',()=>{
  const base={status:'pending',kind:'Inspiration',worker:'',assignment:'auto',queuedAt:10};
  assert.equal(activityEstimate({...base,status:'blocked'},[]).text,'Blocked');
  assert.equal(activityEstimate(base,[]).text,'Waiting for worker');
  assert.equal(activityEstimate({...base,worker:'offline'},[],{classifierWorkers:['live']}).text,'Waiting for worker');
  assert.equal(activityEstimate({...base,kind:'Variation brief'},[],{classifierWorkers:['live']}).text,'Unavailable');
  assert.match(activityEstimate(base,[],{classifierWorkers:['live']}).basis,/Legacy estimate/);
});

test('estimated remaining time accounts for elapsed time and labels overdue runs honestly',()=>{
  const history=[{kind:'Ad images',status:'done',startedAt:1000,finishedAt:121000}];
  const job={id:'x',kind:'Ad images',status:'running',startedAt:100000,assignment:'local-native',worker:'local-native'};
  assert.equal(activityEstimate(job,history,{imageOnline:true,now:160000}).text,'~1 min');
  assert.equal(activityEstimate(job,history,{imageOnline:true,now:250000}).text,'Longer than estimated');
  assert.equal(activityEstimate({...job,status:'done'},history).text,'Finished');
});

test('classified does not imply that a brief link exists',()=>{
  const [job]=inspirationActivity({productId:'p',queue:[{id:'q',insId:'i',productId:'p',status:'classified'}]});
  assert.equal(job.brief,'Brief not available');
});
