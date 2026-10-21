import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {writeFile} from 'node:fs/promises';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';
import {briefContentMatches} from '../tools/personal-worker-result.mjs';
const {values}=parseArgs({options:{job:{type:'string'},doc:{type:'string'},page:{type:'string'},apply:{type:'boolean',default:false}}});
assert.match(values.job||'',/^[0-9a-f-]{36}$/i);
for(const value of [values.doc,values.page])assert.match(value||'',/^[A-Za-z0-9_-]{1,100}$/);
const env=targetEnv(),key=Object.keys(env).find(name=>/^CLICKUP_(API_KEY|API_TOKEN|TOKEN)$/.test(name)&&env[name]);
assert.ok(key,'A local ClickUp REST credential is required; never put it in command arguments');
const sql=postgres(env.STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const base='https://api.clickup.com/api/v3/workspaces/9016762494/docs/'+values.doc;
const receipt={id:values.page,docId:values.doc,url:'https://app.clickup.com/9016762494/docs/'+values.doc+'/'+values.page};
const read=async suffix=>{
  const response=await fetch(base+suffix,{method:'GET',headers:{Authorization:env[key]},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,'ClickUp read failed; recovery stopped');return response.json();
};
function matchingPages(data,ins){
  const matches=[];const walk=value=>{if(!value||typeof value!=='object')return;
    if(typeof value.name==='string'&&value.name.startsWith(ins+' | '))matches.push(value.id);
    for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
  };walk(data);return matches.sort();
}
const rollback=new Error('RECOVERY_DRY_RUN_SUCCESS');let report;
try{
  const [initial]=await sql`select j.*,d.owner_id,d.clickup_user_id,p.config->>'doc_id' as configured_doc
    from personal_workers.jobs j join personal_workers.devices d on d.id=j.device_id
    join products p on p.id=j.product_id where j.id=${values.job}`;
  assert.ok(initial);assert.equal(initial.no_brief,false);assert.equal(initial.configured_doc,values.doc);
  assert.equal(initial.state,'review');assert.ok(initial.artifact?.markdown);
  if(initial.publishing_doc_id)assert.equal(initial.publishing_doc_id,values.doc,'Recovery must use the reserved product library');
  const page=await read('/pages/'+values.page+'?content_format=text%2Fmd');
  assert.equal(page.id,values.page);assert.equal(briefContentMatches(page.content,initial.artifact.markdown),true,'Existing brief content does not match retained analysis');
  const pagesBefore=matchingPages(await read('/page_listing?max_page_depth=-1'),initial.ins_id);
  assert.deepEqual(pagesBefore,[values.page],'Exactly one matching existing brief is required');
  try{await sql.begin('isolation level repeatable read',async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='40s'`;
    await tx`select set_config('request.jwt.claim.role','service_role',true)`;
    const inventory=async()=>{
      const state={};
      for(const table of ['products','ads','angles','personas','matrix_cells','manual_actions','inspirations','inspiration_queue','inspiration_results','personal_workers.jobs']){
        const name=table.includes('.')?table:'public.'+table;
        const filter=table==='inspirations'?'where not(id=$1 and product_id=$2)':
          ['inspiration_queue','inspiration_results'].includes(table)?'where not(ins_id=$1 and product_id=$2)':
          table==='personal_workers.jobs'?'where id<>$1':'';
        const params=table==='personal_workers.jobs'?[values.job]:filter?[initial.ins_id,initial.product_id]:[];
        const [row]=await tx.unsafe(`select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from ${name} t ${filter}`,params);state[table]=row;
      }return state;
    };
    const before=await inventory();
    const [job]=await tx`select * from personal_workers.jobs where id=${values.job} for update`;
    assert.equal(job.state,'review');assert.equal(job.artifact_hash,initial.artifact_hash);assert.deepEqual(job.artifact,initial.artifact);
    assert.equal(job.publishing_doc_id,initial.publishing_doc_id);
    if(job.created_page)assert.deepEqual(job.created_page,receipt);
    const [inspiration]=await tx`select * from inspirations where id=${job.ins_id} and product_id=${job.product_id} for update`;
    const [queue]=await tx`select * from inspiration_queue where ins_id=${job.ins_id} and product_id=${job.product_id} for update`;
    if(process.env.IMMUVI_PRIVATE_RECOVERY_BACKUP)await writeFile(process.env.IMMUVI_PRIVATE_RECOVERY_BACKUP,JSON.stringify({job,inspiration,queue},null,2),{mode:0o600});
    await tx`update personal_workers.jobs set created_page=${tx.json(receipt)},publishing_doc_id=${values.doc} where id=${job.id}`;
    const rpc=async(op,args)=>{const [row]=await tx`select public.personal_worker_dispatch(${op},${tx.json(args)}) as data`;return row.data;};
    const resumed=await rpc('resume_review',{owner_id:initial.owner_id,clickup_user_id:initial.clickup_user_id,
      device_id:job.device_id,job_id:job.id,artifact_hash:job.artifact_hash,page:receipt});
    await rpc('page',{...resumed,page:receipt});assert.equal((await rpc('commit',{...resumed,artifact_hash:job.artifact_hash})).done,true);
    const [saved]=await tx`select i.status,i.url,i.data,r.clickup_doc_page_url,j.state,q.status as queue_status
      from inspirations i join inspiration_results r on r.ins_id=i.id and r.product_id=i.product_id
      join personal_workers.jobs j on j.id=${job.id} join inspiration_queue q on q.ins_id=i.id and q.product_id=i.product_id
      where i.id=${job.ins_id} and i.product_id=${job.product_id}`;
    assert.equal(saved.clickup_doc_page_url,receipt.url);assert.equal(saved.data._clickupDocPageUrl,receipt.url);
    assert.equal(saved.url,inspiration.url);assert.equal(saved.state,'done');assert.equal(saved.queue_status,'classified');
    assert.equal(saved.data.notes,inspiration.data.notes||job.artifact.patch.notes);
    assert.deepEqual(await inventory(),before,'Unrelated records changed');
    report={applied:values.apply,jobId:job.id,insId:job.ins_id,productId:job.product_id,existingBrief:receipt,
      queueStatus:saved.queue_status,inspirationStatus:saved.status,clickupWrites:0,matchingBriefs:pagesBefore.length,unrelatedPreserved:before};
    if(!values.apply)throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  assert.deepEqual(matchingPages(await read('/page_listing?max_page_depth=-1'),initial.ins_id),pagesBefore,'Brief inventory changed');
  assert.equal(briefContentMatches((await read('/pages/'+values.page+'?content_format=text%2Fmd')).content,initial.artifact.markdown),true);
  if(process.env.IMMUVI_PRIVATE_RECOVERY_REPORT)await writeFile(process.env.IMMUVI_PRIVATE_RECOVERY_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.log(values.apply?'Recovered the selected job using its single existing verified brief; zero ClickUp writes; unrelated records preserved.':'Recovery dry-run passed and rolled back; single existing brief verified; zero ClickUp writes.');
}catch(error){
  console.error('Recovery stopped:',error.code||error.name,String(error.message||'').split('\n')[0]);process.exitCode=1;
}finally{await sql.end({timeout:2});}
