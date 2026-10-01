import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {targetEnv} from './strategist-env.mjs';
import {planVariationLinks,inspectLivePair,relatedTaskIds} from './lib/variation-link-plan.mjs';

const env=targetEnv();
const applyDirectory=process.argv.find(a=>a.startsWith('--apply='))?.slice(8);
const verifyDirectory=process.argv.find(a=>a.startsWith('--verify='))?.slice(9);
assert.ok(!(applyDirectory&&verifyDirectory),'Choose either --apply or --verify');
const directory=applyDirectory||verifyDirectory||path.join(homedir(),'.codex','backups','immuvi-all-variation-links-'+Date.now());
mkdirSync(directory,{mode:0o700,recursive:true});
const write=(file,data)=>writeFileSync(path.join(directory,file),JSON.stringify(data,null,2),{mode:0o600});
const journal=data=>appendFileSync(path.join(directory,'repair-journal.jsonl'),JSON.stringify(data)+'\n',{mode:0o600});
async function db(table,params) {
  const url=new URL('/rest/v1/'+table,env.SUPABASE_URL);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const r=await fetch(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Database read failed '+r.status);
  return r.json();
}
async function all(table,select,extra={}) {
  let rows=[];
  for(let offset=0;;offset+=500){const page=await db(table,{select,order:'id',limit:'500',offset:String(offset),...extra});rows.push(...page);if(page.length<500)return rows;}
}
async function cu(route,method='GET') {
  for(let attempt=0;attempt<3;attempt++) {
    await new Promise(r=>setTimeout(r,700));
    const r=await fetch('https://api.clickup.com/api/v2'+route,{method,headers:{Authorization:env.CLICKUP_TOKEN,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(20000)});
    if(r.status===429&&method==='GET'&&attempt<2){await new Promise(r=>setTimeout(r,30000));continue;}
    if(r.status===404&&method==='GET')return null;
    if(!r.ok)throw new Error('ClickUp '+method+' '+r.status+' '+route);
    return r.json();
  }
}
const digest=t=>createHash('sha256').update(JSON.stringify([t.name,t.description,t.status,t.assignees,t.custom_fields,t.parent,t.due_date,t.start_date,t.archived])).digest('hex');
const snapshot=t=>({id:t.id,name:t.name,listId:String(t.list?.id),links:relatedTaskIds(t),digest:digest(t)});
const columns='id,product_id,format_name,parent_ad_id,clickup_task_id,deleted_at,quarantined:meta->>_productBoundaryQuarantined';
async function listTasks(listId) {
  const tasks=new Map();
  for(let page=0;page<=200;page++) {
    const result=await cu('/list/'+listId+'/task?include_closed=true&subtasks=true&page='+page);
    assert.ok(result&&Array.isArray(result.tasks),'Invalid ClickUp list response');
    for(const task of result.tasks)tasks.set(String(task.id),task);
    if(result.last_page===true||result.tasks.length===0)return tasks;
  }
  throw new Error('List pagination exceeded safe bound');
}

if(verifyDirectory) {
  // Read-only follow-up: keep the original warnings rather than erasing evidence
  // of concurrent edits just because the relationship itself now verifies.
  const results=JSON.parse(readFileSync(path.join(directory,'repair-results.json'),'utf8'));
  const entries=readFileSync(path.join(directory,'repair-journal.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const checks=[];
  for(const pair of results.failed) {
    const before=entries.findLast(e=>e.stage==='before'&&e.pair.taskId===pair.taskId&&e.pair.parentTaskId===pair.parentTaskId);
    try {
      const child=await cu('/task/'+pair.taskId),parent=await cu('/task/'+pair.parentTaskId);
      const state=inspectLivePair(pair,child,parent);
      const after=child&&parent?{child:snapshot(child),parent:snapshot(parent)}:null;
      const existingLinksPreserved=!!before&&!!after&&['child','parent'].every(k=>before[k].links.every(id=>after[k].links.includes(id)));
      const contentUnchanged=!!before&&!!after&&['child','parent'].every(k=>before[k].digest===after[k].digest);
      checks.push({pair,state,existingLinksPreserved,contentUnchanged,before,after,checkedAt:new Date().toISOString()});
    }catch(error){checks.push({pair,error:error.message,checkedAt:new Date().toISOString()});}
  }
  write('followup-verification.json',{checks});
  console.log(JSON.stringify({stage:'followup-verification',checked:checks.length,linksVerified:checks.filter(c=>c.state==='linked'&&c.existingLinksPreserved).length,contentReview:checks.filter(c=>!c.contentUnchanged).length,directory}));
} else if(!applyDirectory) {
  const products=await all('products','id,name,config');
  const ads=await all('ads',columns);
  const tombstones=await all('deleted_ads','id,product_id,clickup_task_id');
  const plan=planVariationLinks(products,ads,tombstones);
  write('database-before.json',{products:products.map(p=>({id:p.id,name:p.name,config:{clickup_list_id:p.config?.clickup_list_id}})),ads,tombstones});
  console.log(JSON.stringify({stage:'inventory',products:products.length,activeVariations:ads.filter(a=>a.parent_ad_id&&!a.deleted_at).length,candidates:plan.pairs.length,skipped:plan.skipped.length,directory}));
  const tasks=new Map(),failures=[];
  for(const listId of new Set(plan.pairs.map(p=>p.listId))) {
    try {
      let page=0;
      while(true) {
        const response=await cu('/list/'+listId+'/task?include_closed=true&subtasks=true&page='+page);
        assert.ok(response&&Array.isArray(response.tasks),'Invalid list response');
        for(const t of response.tasks)tasks.set(String(t.id),t);
        if(response.last_page===true||response.tasks.length===0)break;
        if(++page>200)throw new Error('List pagination exceeded safe bound');
      }
      console.log(JSON.stringify({stage:'list-read',listId,products:products.filter(p=>String(p.config?.clickup_list_id)===listId).map(p=>p.name)}));
    }catch(error){failures.push({listId,error:error.message});}
  }
  const ids=new Set(plan.pairs.flatMap(p=>[p.taskId,p.parentTaskId]));
  for(const id of ids)if(!tasks.has(id)||!Array.isArray(tasks.get(id)?.linked_tasks)) {
    try {tasks.set(id,await cu('/task/'+id));}catch(error){failures.push({taskId:id,error:error.message});}
  }
  const linked=[],missing=[],review=[...plan.skipped];
  for(const pair of plan.pairs) {
    const state=inspectLivePair(pair,tasks.get(pair.taskId),tasks.get(pair.parentTaskId));
    if(state==='linked')linked.push(pair);else if(state==='missing')missing.push(pair);else review.push({...pair,reason:state});
  }
  const summary=products.map(p=>({productId:p.id,name:p.name,activeVariations:ads.filter(a=>a.product_id===p.id&&a.parent_ad_id&&!a.deleted_at).length,
    linked:linked.filter(a=>a.productId===p.id).length,missing:missing.filter(a=>a.productId===p.id).length,review:review.filter(a=>a.productId===p.id).length}));
  const report={createdAt:new Date().toISOString(),directory,products:summary,linked,missing,review,failures};
  write('clickup-before.json',[...ids].map(id=>tasks.get(id)).filter(Boolean).map(snapshot));
  write('audit.json',report);
  console.log(JSON.stringify({stage:'audit-complete',products:summary,linked:linked.length,missing:missing.length,review:review.length,failures,directory}));
} else {
  const audit=JSON.parse(readFileSync(path.join(directory,'audit.json'),'utf8'));
  const applied=[],alreadyLinked=[],review=[],failed=[];
  console.log(JSON.stringify({stage:'repair-start',candidates:audit.missing.length,directory}));
  for(const productId of new Set(audit.missing.map(p=>p.productId))) {
    const productPairs=audit.missing.filter(p=>p.productId===productId);
    // Fresh list snapshots bound each batch and verify both link directions
    // without making thousands of redundant per-task reads on a 100/min API.
    for(let offset=0;offset<productPairs.length;offset+=20) {
      const batch=productPairs.slice(offset,offset+20),pending=[];
      const products=await db('products',{select:'id,name,config',id:'eq.'+productId});
      const rows=await all('ads',columns,{product_id:'eq.'+productId});
      const tombs=await all('deleted_ads','id,product_id,clickup_task_id',{product_id:'eq.'+productId});
      const currentPlan=planVariationLinks(products,rows,tombs);
      const beforeTasks=await listTasks(batch[0].listId);
      for(const pair of batch) {
        try {
          const fresh=currentPlan.pairs.find(p=>p.adId===pair.adId);
          if(!fresh||JSON.stringify(fresh)!==JSON.stringify(pair)){review.push({...pair,reason:'identity-changed-or-protected'});continue;}
          const child=beforeTasks.get(pair.taskId),parent=beforeTasks.get(pair.parentTaskId);
          const state=inspectLivePair(pair,child,parent);
          if(state==='linked'){alreadyLinked.push(pair);continue;}
          if(state!=='missing'){review.push({...pair,reason:state});continue;}
          journal({stage:'before',pair,child:snapshot(child),parent:snapshot(parent),at:new Date().toISOString()});
          // Only an additive task relationship. Never create, delete or update a task.
          await cu('/task/'+pair.taskId+'/link/'+pair.parentTaskId,'POST');
          journal({stage:'added',pair,at:new Date().toISOString()});pending.push(pair);
        }catch(error){failed.push({...pair,error:error.message});journal({stage:'failed',pair,error:error.message});}
      }
      const afterTasks=pending.length?await listTasks(batch[0].listId):beforeTasks;
      for(const pair of pending) {
        try {
          const afterChild=afterTasks.get(pair.taskId),afterParent=afterTasks.get(pair.parentTaskId);
          assert.equal(inspectLivePair(pair,afterChild,afterParent),'linked','Relationship readback failed');
          for(const id of [pair.taskId,pair.parentTaskId]) {
            const before=beforeTasks.get(id),after=afterTasks.get(id);
            for(const existing of relatedTaskIds(before))assert.ok(relatedTaskIds(after).includes(existing),'Existing link missing');
            assert.equal(digest(after),digest(before),'Task content changed concurrently; review, never overwrite');
          }
          applied.push(pair);journal({stage:'verified',pair,child:snapshot(afterChild),parent:snapshot(afterParent)});
        }catch(error){failed.push({...pair,error:error.message});journal({stage:'verification-failed',pair,error:error.message});}
      }
      const processed=applied.length+alreadyLinked.length+review.length+failed.length;
      write('repair-results.json',{applied,alreadyLinked,review,failed,total:audit.missing.length,processed});
      console.log(JSON.stringify({stage:'repair-progress',product:products[0]?.name,processed,total:audit.missing.length,added:applied.length,alreadyLinked:alreadyLinked.length,review:review.length,failed:failed.length}));
    }
  }
  console.log(JSON.stringify({stage:'repair-complete',added:applied.length,alreadyLinked:alreadyLinked.length,review:review.length,failed:failed.length,directory}));
}
