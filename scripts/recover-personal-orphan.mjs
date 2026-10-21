import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {writeFile} from 'node:fs/promises';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';
const {values}=parseArgs({options:{job:{type:'string'},apply:{type:'boolean',default:false}}});
assert.match(values.job||'',/^[0-9a-f-]{36}$/i);
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const rollback=new Error('DRY_RUN_SUCCESS');let report;
try{
  try{await sql.begin('isolation level repeatable read',async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='30s'`;
    const [job]=await tx`select * from personal_workers.jobs where id=${values.job} for update`;
    assert.ok(job);assert.ok(['pending','running','blocked','cancelled'].includes(job.state));
    assert.equal(job.artifact,null);assert.equal(job.created_page,null);assert.equal(job.page,null);
    const [source]=await tx`select count(*)::int as n from inspirations where id=${job.ins_id} and product_id=${job.product_id}`;
    assert.equal(source.n,0,'Source still exists; cancellation is not authorized by this repair');
    const [queue]=await tx`select * from inspiration_queue where ins_id=${job.ins_id} and product_id=${job.product_id} for update`;
    if(queue){assert.equal(queue.worker_assignment,'private');assert.equal(queue.url,job.source_url);}
    const inventory=async()=>{
      const out={};for(const table of ['products','ads','angles','personas','matrix_cells','manual_actions','inspirations',
        'inspiration_queue','inspiration_results','personal_workers.devices','personal_workers.jobs']){
        const name=table.includes('.')?table:'public.'+table;
        const filter=table==='personal_workers.jobs'?'where id<>$1':table==='inspiration_queue'?'where not(ins_id=$1 and product_id=$2)':'';
        const params=table==='personal_workers.jobs'?[job.id]:filter?[job.ins_id,job.product_id]:[];
        const [row]=await tx.unsafe(`select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from ${name} t ${filter}`,params);out[table]=row;
      }return out;
    };
    const before=await inventory();
    if(process.env.IMMUVI_PRIVATE_RECOVERY_BACKUP)await writeFile(process.env.IMMUVI_PRIVATE_RECOVERY_BACKUP,JSON.stringify({job,queue},null,2),{mode:0o600});
    await tx`update personal_workers.jobs set state='cancelled',cancel_requested=true,error_code='ORPHANED_SOURCE' where id=${job.id}`;
    await tx`delete from inspiration_queue where ins_id=${job.ins_id} and product_id=${job.product_id} and worker_assignment='private'`;
    assert.deepEqual(await inventory(),before,'Unrelated records changed');
    report={applied:values.apply,jobId:job.id,state:'cancelled',clickupWrites:0,unrelatedPreserved:before};
    if(!values.apply)throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  if(process.env.IMMUVI_PRIVATE_RECOVERY_REPORT)await writeFile(process.env.IMMUVI_PRIVATE_RECOVERY_REPORT,JSON.stringify(report,null,2),{mode:0o600});
  console.log(values.apply?'Selected orphan lease cancelled; zero ClickUp writes; unrelated records preserved.':'Orphan repair dry-run passed; all changes rolled back.');
}finally{await sql.end({timeout:2});}
