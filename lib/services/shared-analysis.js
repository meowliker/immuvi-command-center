import { privateDecrypt, constants } from 'node:crypto';
import { recoverAnalysisUnit } from './shared-analysis-recovery.js';
import { briefContentMatches, clickUpBriefMarkdown, libraryPages, validateBriefMarkdown, verifyLibraryDocument } from './private-inspiration.js';

export function validateStrategistBrief(value) {
  for (const key of ['strategy','creative','copy','production']) {
    if (!value?.[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error('Strategist returned an incomplete task brief.');
  }
  if (![value.why_it_won,value.why_it_died].some(v=>typeof v==='string' && v.trim())) throw new Error('Strategist verdict is missing.');
  if (value.copy.lingo != null && (!Array.isArray(value.copy.lingo) || value.copy.lingo.some(v=>typeof v!=='string'))) throw new Error('Invalid Strategist vocabulary.');
  return value;
}

export function createAnalysisClickUp({job, privateKey, signal, checkpoint, fetchImpl=fetch}) {
  if (job.context.listId!=='1301130000002447' || job.context.libraryDocId!=='8cq1r3y-44896') throw new Error('Invalid QA destination.');
  const token=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(job.sealed_token,'base64')).toString();
  async function request(path,method='GET',body) {
    signal.throwIfAborted();
    await checkpoint('heartbeat');
    const response=await fetchImpl(`https://api.clickup.com/api/${path}`,{method,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)]),
      headers:{Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if (!response.ok) throw Object.assign(new Error(`ClickUp analysis request failed (${response.status}). Saved work is retained.`),{status:response.status});
    const text=await response.text();return text.trim()?JSON.parse(text):{};
  }
  async function task(id) {
    if (!/^[\w-]+$/.test(id || '')) throw new Error('Invalid ClickUp task identity.');
    const value=await request(`v2/task/${id}?include_subtasks=false&custom_task_ids=false`);
    if (value.id!==id || String(value.list?.id)!==job.context.listId) throw new Error('Task moved outside the QA list.');
    return value;
  }
  return {
    async snapshot() {
      const tasks=[],seen=new Set();
      for(let page=0;page<100;page++) {
        const data=await request(`v2/list/${job.context.listId}/task?page=${page}&page_size=100&subtasks=true&include_closed=true`);
        if (!Array.isArray(data.tasks)) throw new Error('ClickUp task listing is incomplete.');
        if (!data.tasks.length) return tasks;
        for (const short of data.tasks) {
          if(seen.has(short.id)) throw new Error('Task listing changed while scanning; retry before generation.');
          seen.add(short.id);
          if (!['winner','mild winner','scale','complete','loser','killed'].includes(String(short.status?.status).trim().toLowerCase())) continue;
          const full=await task(short.id);
          const comments=await request(`v2/task/${short.id}/comment`);
          if (!Array.isArray(comments.comments)) throw new Error('Task comments are unavailable.');
          tasks.push({task:full,comments:comments.comments.slice(0,30)});
        }
      }
      throw new Error('ClickUp listing exceeded the scan limit; memory was not replaced.');
    },
    async deliverWinner(result) {
      validateBriefMarkdown(result.markdown);
      if(job.context.targetTask) await task(job.context.targetTask);
      const root='v3/workspaces/9016762494/docs/8cq1r3y-44896';
      verifyLibraryDocument(await request(root),'8cq1r3y-44896');
      const title=`Winner Brief \u2014 ${job.context.parentName} \u2014 ${job.context.winnerLabel}`;
      const marker=`Immuvi QA winner ${job.id}`;
      const pages=libraryPages(await request(`${root}/page_listing?max_page_depth=-1`));
      const matches=pages.filter(p=>p.id===job.receipts?.id || p.name===title);
      if(matches.length>1) throw new Error('Multiple winner pages match. Review before writing.');
      let page=matches[0];
      if(job.receipts?.id && page?.id!==job.receipts.id) throw new Error('Saved winner page is missing.');
      if(page) {
        const saved=await request(`${root}/pages/${page.id}?content_format=text%2Fmd`);
        // A title alone does not authorize overwriting somebody else's page.
        if(!job.receipts?.started || (!job.receipts?.id && saved.sub_title!==marker)
          || !briefContentMatches(result.markdown,saved.content)) throw new Error('Winner page identity or content differs; review required.');
      } else {
        if(job.receipts?.started) throw new Error('Page creation outcome is uncertain; refusing a duplicate.');
        await checkpoint('page-start');job.receipts={...job.receipts,started:true};
        page=await request(`${root}/pages`,'POST',{name:title,sub_title:marker,content:clickUpBriefMarkdown(result.markdown),content_format:'text/md'});
      }
      if(!/^[\w-]+$/.test(page?.id || '')) throw new Error('ClickUp did not return a page receipt.');
      await checkpoint('page',{id:page.id});job.receipts.id=page.id;
      const saved=await request(`${root}/pages/${page.id}?content_format=text%2Fmd`);
      validateBriefMarkdown(saved.content || '');
      if(!briefContentMatches(result.markdown,saved.content)) throw new Error('Winner page readback differs from the saved brief.');
      // Revalidate the target after delivery as well as before it.
      if(job.context.targetTask) await task(job.context.targetTask);
      await checkpoint('complete',{verified:true});
    },
  };
}

export async function runStrategistAnalysis({job,directory,checkpoint,signal,clickup,adapt,generate}) {
  const unit=(key,input,make,validate,replaySafe=false,decodeRaw)=>recoverAnalysisUnit({job,key,input,directory,checkpoint,signal,generate:make,validate,replaySafe,decodeRaw});
  const snapshot=await unit('source',{product:job.product_id},()=>clickup.snapshot(),v=>{
    if(!Array.isArray(v))throw new Error('Invalid task snapshot.');return v;
  },true);
  const rows=[],cache=new Map((job.context.cached || []).map(row=>[row.clickup_task_id,row]));
  let processed=0;
  for(const source of snapshot) {
    signal.throwIfAborted();
    const prepared=await adapt({operation:'task',...source});
    if(!prepared)continue;
    const prior=cache.get(prepared.row.clickup_task_id);
    if(prior?.content_hash===prepared.row.content_hash) {rows.push(prior);continue;}
    const brief=await unit(`task-${prepared.row.clickup_task_id}`,prepared,
      dir=>generate(prepared.prompt,dir),validateStrategistBrief);
    rows.push({...prepared.row,brief_json:brief});processed++;
  }
  // The aggregate timestamp is generated once and checkpointed with the prompt.
  const aggregate=await unit('aggregate',{rows},()=>adapt({operation:'memory',product:job.context.product,rows}),v=>{
    if(v?.json?.product_id!==job.product_id || typeof v.prompt!=='string')throw new Error('Invalid memory aggregate.');return v;
  },true);
  await unit('memory',aggregate,async dir=>{
    const value=await generate(aggregate.prompt,dir,true);
    return {json:aggregate.json,markdown:value.markdown,rows,processed,skipped:0};
  },v=>{
    if(typeof v?.markdown!=='string' || !v.markdown.trim()) throw new Error('Invalid memory output.');
    return {json:aggregate.json,markdown:v.markdown,rows,processed,skipped:0};
  },false,text=>{
    try {const parsed=JSON.parse(text);if(typeof parsed.markdown==='string')return parsed;}catch{}
    return {markdown:text.trim()};
  });
  await checkpoint('complete');
}
