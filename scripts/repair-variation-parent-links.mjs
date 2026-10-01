import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {targetEnv} from './strategist-env.mjs';

const env=targetEnv();
const rootId=process.argv.find(a=>a.startsWith('--root='))?.slice(7);
if(!rootId)throw new Error('Supply --root=<exact Immuvi parent ad ID>; default is read-only.');
const apply=process.argv.includes('--apply');
const directory=path.join(homedir(),'.codex','backups','immuvi-variation-links-'+Date.now());
mkdirSync(directory,{mode:0o700,recursive:true});
const backup=(name,data)=>writeFileSync(directory+'/'+name,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
async function db(table,params) {
  const url=new URL('/rest/v1/'+table,env.SUPABASE_URL);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const r=await fetch(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Database read failed: '+r.status);
  return r.json();
}
async function cu(path,method='GET') {
  await new Promise(r=>setTimeout(r,700));
  const r=await fetch('https://api.clickup.com/api/v2'+path,{method,headers:{Authorization:env.CLICKUP_TOKEN,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('ClickUp '+method+' failed: '+r.status+' '+path);
  return r.json();
}
const links=t=>(t.linked_tasks||[]).map(l=>String(l.task_id)===String(t.id)?String(l.link_id):String(l.task_id));
const digest=t=>createHash('sha256').update(JSON.stringify([t.name,t.description,t.status,t.assignees,t.custom_fields,t.parent,t.due_date,t.start_date,t.archived])).digest('hex');
const [root]=await db('ads',{id:'eq.'+rootId,select:'id,product_id,clickup_task_id,deleted_at'});
assert.ok(root&&!root.deleted_at&&root.clickup_task_id,'Parent must exist and have a ClickUp task');
const [product]=await db('products',{id:'eq.'+root.product_id,select:'id,name,config'});
const listId=String(product.config.clickup_list_id||'');assert.ok(listId);
let rows=[];
for(let offset=0;;offset+=500) {
  const page=await db('ads',{product_id:'eq.'+root.product_id,deleted_at:'is.null',select:'id,product_id,format_name,parent_ad_id,clickup_task_id',order:'id',limit:'500',offset:String(offset)});
  rows.push(...page);if(page.length<500)break;
}
const family=new Set([rootId]),pairs=[];
for(let changed=true;changed;) {
  changed=false;
  for(const child of rows)if(child.parent_ad_id&&family.has(child.parent_ad_id)&&!family.has(child.id)) {
    family.add(child.id);changed=true;
    const parent=rows.find(x=>x.id===child.parent_ad_id);
    assert.ok(parent&&parent.product_id===child.product_id);
    if(child.clickup_task_id&&parent.clickup_task_id) {
      assert.notEqual(child.clickup_task_id,parent.clickup_task_id,'Self-link is not a variation');
      pairs.push({adId:child.id,parentAdId:parent.id,taskId:child.clickup_task_id,parentTaskId:parent.clickup_task_id});
    }
  }
}
const tasks=new Map();
for(const id of new Set(pairs.flatMap(p=>[p.taskId,p.parentTaskId]))) {
  const task=await cu('/task/'+id);
  assert.equal(task.id,id);assert.equal(String(task.list?.id),listId,'Cross-product task list');assert.ok(!task.archived);
  tasks.set(id,task);
}
const plan=pairs.filter(p=>!links(tasks.get(p.taskId)).includes(p.parentTaskId));
backup('before.json',{productId:product.id,rootId,listId,plan,tasks:[...tasks.values()].map(t=>({id:t.id,name:t.name,links:links(t),digest:digest(t)}))});
console.log(JSON.stringify({mode:apply?'apply':'audit',product:product.name,rootId,expectedRelationships:pairs.length,missing:plan.length,plan,backup:directory}));
if(apply) {
  const added=[];
  for(const p of plan) {
    // Re-read both database identities before each external write.
    const [child]=await db('ads',{id:'eq.'+p.adId,select:'id,product_id,parent_ad_id,clickup_task_id,deleted_at'});
    const [parent]=await db('ads',{id:'eq.'+p.parentAdId,select:'id,product_id,clickup_task_id,deleted_at'});
    assert.ok(child&&parent&&!child.deleted_at&&!parent.deleted_at);
    assert.equal(child.product_id,root.product_id);assert.equal(parent.product_id,root.product_id);
    assert.equal(child.parent_ad_id,parent.id);assert.equal(child.clickup_task_id,p.taskId);assert.equal(parent.clickup_task_id,p.parentTaskId);
    const currentParent=await cu('/task/'+p.parentTaskId),current=await cu('/task/'+p.taskId);
    assert.equal(String(currentParent.list?.id),listId);assert.equal(String(current.list?.id),listId);
    assert.ok(!current.archived&&!currentParent.archived);
    if(links(current).includes(p.parentTaskId))continue;
    backup('pre-link-'+p.taskId+'.json',{child:{id:current.id,links:links(current),digest:digest(current)},parent:{id:currentParent.id,links:links(currentParent),digest:digest(currentParent)}});
    await cu('/task/'+p.taskId+'/link/'+p.parentTaskId,'POST');
    added.push(p);backup('added-'+p.taskId+'.json',p);
  }
  const after=[];
  for(const [id,before] of tasks) {
    const t=await cu('/task/'+id);
    for(const existing of links(before))assert.ok(links(t).includes(existing),'An existing relationship disappeared');
    for(const p of pairs.filter(p=>p.taskId===id))assert.ok(links(t).includes(p.parentTaskId),'Missing parent link');
    for(const p of pairs.filter(p=>p.parentTaskId===id))assert.ok(links(t).includes(p.taskId),'Missing child link');
    assert.equal(digest(t),digest(before),'Task content changed during repair; inspect before/after, do not overwrite');
    after.push({id,links:links(t),digest:digest(t)});
  }
  backup('verified.json',{added,after});
  console.log('Verified '+pairs.length+' relationships; added '+added.length+'. Existing links, task names, statuses, descriptions and custom fields unchanged. No Supabase writes.');
}
