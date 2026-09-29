import test from 'node:test';
import assert from 'node:assert/strict';
import { runClickUpCreation,creationMediaKind } from '../../lib/services/clickup-creation.js';
const listId='1301130000002447';
test('creation media evidence reads only the linked inspiration in the current product',async()=>{
  const ad={ad_type:'AI Style',meta:{_fromInspoId:'INS-1'}};
  const reads=[];let row={id:'INS-1',product_id:'qa',data:{mediaKind:'video'}},error=null;
  const db={from(table){assert.equal(table,'inspirations');return {select(columns){assert.equal(columns,'id,product_id,data');return this;},eq(...args){reads.push(args);return this;},maybeSingle:async()=>({data:row,error})};}};
  assert.equal(await creationMediaKind(db,'qa',ad),'video');
  assert.deepEqual(reads,[['product_id','qa'],['id','INS-1']]);
  row={...row,product_id:'other'};assert.equal(await creationMediaKind(db,'qa',ad),'');
  error={message:'unavailable'};await assert.rejects(creationMediaKind(db,'qa',ad),/Nothing was sent/);
  assert.equal(await creationMediaKind({from:()=>assert.fail()},'qa',{ad_type:'Video',meta:{}}),'');
  assert.equal(await creationMediaKind({from:()=>assert.fail()},'qa',{ad_type:'AI Style',meta:{}}),'');
});
function fixture() {
  const f={product:{id:'qa',name:'QA Product',updated_at:'product-version',config:{}},listId,input:{adId:'ad'},job:null,remote:[],posts:0,calls:[],failRecord:false,failFinish:false,createError:null,missingFields:false};
  f.ad={id:'ad',product_id:'qa',format_name:'Own brief',status:'Untested',angle:'Own angle',updated_at:'ad-version',meta:{notes:'Full brief',assignees:[]}};
  f.action={id:'action',product_id:'qa',updated_at:'action-version',payload:{sourceAdId:'ad'}};
  const fields=[{id:'angle',name:'Angle Tag',type:'short_text'}];
  f.db={from(table) { return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:structuredClone(table==='ads' ? f.ad : f.job)};}}; },
    async rpc(name,input) {
      f.calls.push(name);
      if(name==='qa_plan_stage') return {data:structuredClone(f.action)};
      if(name==='qa_creation_claim') {
        if(!f.job || f.job.state==='rejected') f.job={id:input.p_job_id,ad_id:'ad',list_id:listId,state:'sending',payload:input.p_payload,lease_token:input.p_token};
        else {f.job.lease_token=input.p_token;f.job.state=f.job.remote_task_id ? 'created' : 'uncertain';}
      }
      if(name==='qa_creation_record') {
        if(f.failRecord && input.p_state==='created') {f.failRecord=false;return {error:{message:'Synthetic record failure'}};}
        Object.assign(f.job,{state:input.p_state,remote_task_id:input.p_remote_task_id});
      }
      if(name==='qa_creation_finish') {
        if(f.failFinish) {f.failFinish=false;return {error:{message:'Synthetic finalize failure'}};}
        f.job.state='linked';f.ad.clickup_task_id=f.job.remote_task_id;
      }
      return {data:structuredClone(f.job)};
    }};
  f.clickup={async inspect(){return {list:{id:listId,statuses:[{status:'to do'}]},fields};},
    async createTask(id,payload){
      f.posts++;assert.equal(id,listId);
      if(f.createError?.status===400) throw f.createError;
      f.remote.push({id:'remote',list:{id:listId},...payload,status:{status:payload.status},due_date:payload.due_date ?? null,
        custom_fields:f.missingFields ? [] : payload.custom_fields.map((v) => ({...fields.find((field) => field.id===v.id),...v})),
        assignees:payload.assignees.map((id) => ({id}))});
      if(f.createError) throw f.createError;
      return {id:'remote'};
    },
    async tasks(id,options){assert.equal(options.includeArchived,true);return f.remote;},
    async getTask(id,taskId){const task=f.remote.find((t) => t.id===taskId);if(!task) throw new Error('not found');return structuredClone(task);},
    async setField(id,taskId,field,value){f.remote[0].custom_fields.push({...field,value});},
    async updateTask(id,taskId,values){Object.assign(f.remote[0],values);},
    async setAssignees(id,taskId,ids){f.remote[0].assignees=ids.map((id) => ({id}));},
    async addTag(id,taskId,tag){f.remote[0].tags.push({name:tag});},
  };
  return f;
}
test('one create persists its remote identity, verifies fields and atomically finalizes',async () => {
  const f=fixture();assert.deepEqual(await runClickUpCreation(f),{state:'linked',taskId:'remote'});
  assert.equal(f.posts,1);assert.equal(f.job.state,'linked');
  assert.ok(f.calls.indexOf('qa_creation_record')<f.calls.indexOf('qa_creation_finish'));
  await runClickUpCreation(f);assert.equal(f.posts,1);
});
test('lost create response recovers the marked task without a second POST',async () => {
  const f=fixture();f.createError=new Error('network interrupted');
  await assert.rejects(runClickUpCreation(f),/may have created/);assert.equal(f.job.state,'uncertain');
  await runClickUpCreation(f);assert.equal(f.posts,1);assert.equal(f.job.state,'linked');
});
test('remote success followed by failed identity record or failed finalize recovers without duplicates',async () => {
  for(const flag of ['failRecord','failFinish']) {
    const f=fixture();f[flag]=true;await assert.rejects(runClickUpCreation(f),/Synthetic|could not record/);
    await runClickUpCreation(f);assert.equal(f.posts,1);assert.equal(f.job.state,'linked');
  }
});
test('missing or ambiguous recovery markers never trigger a second create',async () => {
  for(const count of [0,2]) {
    const f=fixture();f.createError=new Error('timeout');await assert.rejects(runClickUpCreation(f));
    f.remote=count ? [f.remote[0],{...f.remote[0],id:'duplicate'}] : [];
    await assert.rejects(runClickUpCreation(f),count ? /Multiple/ : /No matching/);
    assert.equal(f.posts,1);assert.equal(f.job.state,'uncertain');
  }
});
test('explicit validation rejection can retry with fresh values, unlike uncertainty',async () => {
  const f=fixture();f.createError=Object.assign(new Error('invalid'),{status:400});
  await assert.rejects(runClickUpCreation(f),/rejected/);assert.equal(f.job.state,'rejected');
  f.createError=null;f.ad.meta.notes='Corrected brief';await runClickUpCreation(f);
  assert.equal(f.posts,2);assert.ok(f.remote[0].description.includes('Corrected brief'));
});
test('missing create-time fields are repaired on the existing task before linking',async () => {
  const f=fixture();f.missingFields=true;await runClickUpCreation(f);
  assert.equal(f.posts,1);assert.equal(f.remote[0].custom_fields[0].value,'Own angle');assert.equal(f.job.state,'linked');
});
test('failed field repair stays recoverable and resumes without another create',async () => {
  const f=fixture();f.missingFields=true;const set=f.clickup.setField;
  f.clickup.setField=async () => {throw new Error('field write failed');};
  await assert.rejects(runClickUpCreation(f),/field write/);assert.equal(f.job.state,'created');
  f.clickup.setField=set;await runClickUpCreation(f);assert.equal(f.posts,1);assert.equal(f.job.state,'linked');
});
test('known recovery ID still needs exact marker and cannot adopt unrelated tasks',async () => {
  const f=fixture();f.createError=new Error('timeout');await assert.rejects(runClickUpCreation(f));
  f.remote[0].description='unrelated';f.input.recoveryTaskId='remote';
  await assert.rejects(runClickUpCreation(f),/No matching/);assert.equal(f.posts,1);
});
test('failed durable claim prevents external creation',async () => {
  const f=fixture(),rpc=f.db.rpc;
  f.db.rpc=async (name,input) => name==='qa_creation_claim' ? {error:{message:'stale snapshot'}} : rpc(name,input);
  await assert.rejects(runClickUpCreation(f),/stale snapshot/);assert.equal(f.posts,0);
});
test('removed tags are repaired and ignored field writes cannot be reported as linked',async () => {
  const f=fixture();f.missingFields=true;f.clickup.setField=async () => {};
  await assert.rejects(runClickUpCreation(f),/not confirmed/);assert.equal(f.job.state,'created');
  f.remote[0].tags=[];
  f.clickup.setField=async (list,task,field,value) => f.remote[0].custom_fields.push({...field,value});
  await runClickUpCreation(f);assert.equal(f.job.state,'linked');assert.equal(f.posts,1);
  assert.deepEqual(f.remote[0].tags,[{name:'production'},{name:'app-created'}]);
});
