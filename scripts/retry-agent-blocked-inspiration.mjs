import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {targetEnv} from './strategist-env.mjs';

// One requested job only. Never create an inspiration, change identity or clear results.
const [insId,output]=process.argv.slice(2);
assert.ok(insId&&output,'Usage: retry-agent-blocked-inspiration.mjs INS_ID PRIVATE_OUTPUT [--apply]');
const {default:postgres}=await import(process.env.POSTGRES_MODULE||'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{max:1,prepare:false,connect_timeout:10});
mkdirSync(output,{recursive:true,mode:0o700});
const record=(name,data)=>writeFileSync(output+'/'+name+'.json',JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
try {
  await sql.begin(async tx=>{
    await tx`set local statement_timeout='15s'`;await tx`set local lock_timeout='5s'`;
    const inspirations=await tx`select * from public.inspirations where id=${insId} for update`;
    assert.equal(inspirations.length,1,'Inspiration identity must be unique');
    const inspiration=inspirations[0];
    const queues=await tx`select * from public.inspiration_queue where ins_id=${insId} and product_id=${inspiration.product_id} for update`;
    assert.equal(queues.length,1,'Existing queue row required');
    const queue=queues[0];
    const results=await tx`select id from public.inspiration_results where ins_id=${insId} and product_id=${inspiration.product_id}`;
    record('before',{inspiration,queue,resultIds:results.map(r=>r.id)});
    assert.equal(results.length,0,'Saved result exists; do not rerun classification');
    assert.equal(queue.url,inspiration.url,'Source identity mismatch');
    assert.ok(['failed','blocked'].includes(queue.status)&&!queue.claimed_by,'Job is no longer blocked');
    assert.match(queue.error_message||'',/agent infrastructure failure.*no usable agent CLI found/i);
    assert.equal(queue.worker_assignment,'auto','Do not redirect explicitly assigned work');
    if(!process.argv.includes('--apply')) {console.log('Backed up '+insId+'; no database changes');return;}
    const workers=await tx`select worker_id,capabilities from public.worker_registry where enabled=true and last_heartbeat>now()-interval '2 minutes' and status in ('idle','busy')`;
    assert.ok(workers.some(w=>w.capabilities?.agent_launcher_revision==='codex-bundle-v2'&&(w.capabilities.codex||w.capabilities.claude)),'Wait for the updated worker to report healthy');
    const changed=await tx`update public.inspiration_queue set status='pending',error_message=null,claimed_at=null,claimed_by=null,processed_at=null where id=${queue.id} and ins_id=${insId} and product_id=${inspiration.product_id} and url=${inspiration.url} and status=${queue.status} and claimed_by is null returning *`;
    assert.equal(changed.length,1);
    const current=(await tx`select * from public.inspirations where id=${insId} and product_id=${inspiration.product_id}`)[0];
    assert.deepEqual(current,inspiration,'Recovery must not modify inspiration data');
    const expected={...queue,status:'pending',error_message:null,claimed_at:null,claimed_by:null,processed_at:null};
    assert.deepEqual(changed[0],expected,'Unexpected queue change');
    record('after',{queue:changed[0],inspirationUnchanged:true,healthyWorkers:workers.map(w=>w.worker_id)});
  });
  record('completed',{applied:process.argv.includes('--apply'),at:new Date().toISOString()});
}finally{await sql.end();}
