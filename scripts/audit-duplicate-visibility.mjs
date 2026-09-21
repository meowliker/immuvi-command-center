import { mkdir, readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { targetEnv } from './strategist-env.mjs';

const env = targetEnv();
const sql = postgres(env.STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const resume = process.argv.find(arg=>arg.startsWith('--resume='))?.slice(9);
const directory = resume || `backups/duplicate-visibility-audit-${new Date().toISOString().replaceAll(':','-')}`;
const automatic = 'trigger:collapse_local_dup_on_sync';
const save = (name,value)=>writeFile(`${directory}/${name}.json`,JSON.stringify(value,null,2),{mode:0o600});
const sleep = ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  const snapshot = resume ? JSON.parse(await readFile(`${directory}/snapshot.json`,'utf8')) : await sql.begin(async tx=>{
    await tx`set transaction isolation level repeatable read read only`;
    await tx`set local statement_timeout='30s'`;
    return {
      products:await tx`select id,name,config->>'clickup_list_id' as list_id from products order by id`,
      ads:await tx`select id,product_id,format_name,status,clickup_task_id,deleted_at,angle,persona,
        meta->>'_supersededByAdId' as superseded_by,
        meta->>'_supersededClickUpTaskId' as superseded_task,
        meta->>'_syncProductId' as sync_product,
        coalesce(meta->>'clickupListId',meta->>'listId') as source_list
        from ads order by product_id,id`,
      markers:await tx`select * from deleted_ads order by product_id,id`,
    };
  });
  await mkdir(directory,{recursive:true,mode:0o700});
  await save('snapshot',snapshot);
  const adById = new Map(snapshot.ads.map(ad=>[ad.id,ad]));
  const candidates = snapshot.markers.filter(marker=>marker.deleted_by===automatic).map(marker=>{
    const duplicate = adById.get(marker.id);
    const taskId = marker.clickup_task_id || duplicate?.clickup_task_id || duplicate?.superseded_task;
    const canonical = taskId && adById.get(taskId);
    return {marker,duplicate,taskId,canonical};
  }).filter(item=>item.taskId && (item.marker.clickup_task_id || item.duplicate?.clickup_task_id));
  const otherBlocked = snapshot.ads.filter(ad=>!ad.deleted_at && ad.clickup_task_id &&
    (snapshot.markers.some(marker=>marker.product_id===ad.product_id && (marker.id===ad.id || marker.clickup_task_id===ad.clickup_task_id)) ||
      snapshot.ads.some(retired=>retired.product_id===ad.product_id && retired.deleted_at && retired.clickup_task_id===ad.clickup_task_id)));
  const verified = resume ? JSON.parse(await readFile(`${directory}/clickup.json`,'utf8')) : {};
  const taskIds = [...new Set([...candidates.map(item=>item.taskId),...otherBlocked.map(ad=>ad.clickup_task_id)])].filter(id=>!verified[id]);
  await save('all-blocked',otherBlocked);
  console.log(JSON.stringify({directory,products:snapshot.products.length,automaticCandidates:candidates.length,tasksToVerify:taskIds.length}));
  for (const [index,id] of taskIds.entries()) {
    for (let attempt=0;attempt<3;attempt++) {
      try {
        const response = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(id)}`,{
          headers:{Authorization:env.CLICKUP_TOKEN},signal:AbortSignal.timeout(20000),
        });
        if (response.status===429 || response.status>=500) {
          if (attempt<2) { await sleep(10000*(attempt+1)); continue; }
        }
        if (!response.ok) {verified[id]={id,error:`HTTP ${response.status}`};break;}
        const task = await response.json();
        verified[id]={id:task.id,name:task.name,listId:task.list?.id,listName:task.list?.name,
          status:task.status?.status,archived:task.archived,url:task.url,verifiedAt:new Date().toISOString()};
        break;
      } catch (error) {
        if (attempt===2) verified[id]={id,error:error.name};
        else await sleep(3000*(attempt+1));
      }
    }
    await save('clickup',verified);
    if ((index+1)%20===0 || index===taskIds.length-1) console.log(`Verified ${index+1}/${taskIds.length} ClickUp tasks`);
    await sleep(700);
  }
  await save('candidates',candidates);
  console.log(JSON.stringify({directory,verified:Object.values(verified).filter(v=>!v.error).length,errors:Object.values(verified).filter(v=>v.error)}));
} finally {
  await sql.end({timeout:2});
}
