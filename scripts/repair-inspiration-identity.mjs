import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';

// Raw recovery data is private, never part of the repository. Dry-run by default.
const root='/private/tmp/immuvi-inspiration-recovery-20260929';
const baseline='/private/tmp/immuvi-taxonomy-backup-20260928/after';
const load=(dir,table)=>JSON.parse(fs.readFileSync(path.join(dir,table+'.json'),'utf8'));
const before=load(root+'/pre-repair','inspirations'), prior=load(baseline,'inspirations');
const queue=load(root+'/pre-repair','inspiration_queue'),priorQueue=load(baseline,'inspiration_queue');
const product='prod-1778005514645';
const moved=before.filter(row=>{
  const owners=new Set(queue.filter(q=>q.url && q.ins_id===row.id && q.url===row.url).map(q=>q.product_id));
  return owners.size===1 && owners.has(product) && row.product_id!==product;
});
assert.equal(moved.length,86,'Unexpected recovery scope; review instead of broadening automatically');
const renames=Array.from({length:6},(_,i)=>({from:'P-INS-'+String(i+4).padStart(3,'0'),to:'P-INS-'+(141+i)}));
const restoredIds=['P-INS-004','P-INS-005','P-INS-009'];
const replaceId=(value,from,to)=> {
  if(typeof value==='string')return value.replaceAll(from,to);
  if(Array.isArray(value))return value.map(v=>replaceId(v,from,to));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replaceId(v,from,to)]));
  return value;
};
const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,onnotice(){}});
const rollback=new Error('DRY_RUN_ROLLBACK');
try {
  try {await sql.begin(async tx=>{
    await tx`set local lock_timeout='10s'`;
    await tx`set local statement_timeout='60s'`;
    await tx`lock table inspirations,inspiration_queue,inspiration_results,taxonomy_review_jobs in share row exclusive mode`;
    const live=await tx`select * from inspirations order by id`;
    const allJobs=await tx`select * from taxonomy_review_jobs order by id`;
    fs.writeFileSync(root+'/taxonomy-jobs-before.json',JSON.stringify(allJobs),{mode:0o600});
    for(const old of [...moved,...before.filter(x=>renames.some(r=>r.from===x.id))]) {
      const current=live.find(x=>x.id===old.id);
      assert.ok(current && new Date(current.updated_at).getTime()===new Date(old.updated_at).getTime() && current.url===old.url && current.product_id===old.product_id,'Live row changed; resnapshot '+old.id);
    }
    for(const r of renames)assert.ok(!live.some(x=>x.id===r.to),'Target ID exists '+r.to);
    const adsBefore=await tx`select * from ads order by id`;
    const actionsBefore=await tx`select * from manual_actions order by id`;
    const cellsBefore=await tx`select * from matrix_cells order by id`;
    const updated=[];
    for(const row of moved) {
      const data={...row.data,product_id:product};
      await tx`update inspirations set product_id=${product},data=${tx.json(data)} where id=${row.id}`;
      updated.push({id:row.id,reason:'exact-source queue ownership',from:row.product_id,to:product});
    }
    for(const mapping of renames) {
      const row=live.find(x=>x.id===mapping.from);
      const data=replaceId(row.data,mapping.from,mapping.to);
      Object.assign(data,{id:mapping.to,product_id:product,status:'Classified',reusedIn:[]});
      for(const key of ['_lastImportedResult','_dupeType','_dupeDetail','_dupeSimilar'])delete data[key];
      const added=new Date(data.addedAt).toISOString();
      const copy={...row,id:mapping.to,status:'Classified',created_at:added,data};
      await tx`insert into inspirations ${tx(copy)}`;
      await tx`update inspiration_queue set ins_id=${mapping.to} where ins_id=${mapping.from} and product_id=${product} and url=${row.url}`;
      const results=await tx`select * from inspiration_results where ins_id=${mapping.from} and product_id=${product} and source_url=${row.url}`;
      for(const r of results)await tx`update inspiration_results set ins_id=${mapping.to},metadata=${tx.json(replaceId(r.metadata,mapping.from,mapping.to))},classification=${tx.json(replaceId(r.classification,mapping.from,mapping.to))},brief=${tx.json(replaceId(r.brief,mapping.from,mapping.to))} where id=${r.id}`;
      // Review results are tied to old signatures; don't let them follow a rename.
      await tx`update taxonomy_review_jobs set ins_id=${mapping.to},status='failed',result=null,error_message='Inspiration identity recovered; request a fresh review' where ins_id=${mapping.from} and product_id=${product}`;
      if(restoredIds.includes(mapping.from)) {
        const old=prior.find(x=>x.id===mapping.from);
        assert.ok(old && old.url!==row.url);
        const oldData={...old.data,product_id:product};
        // The worker overwrote the old ClickUp page after the ID collision.
        // Keep its reference for recovery, but never present the new ad's brief as the old one.
        oldData._recoveryPreviousBriefUrl=oldData._clickupDocPageUrl;
        oldData._briefRecoveryNeedsReview=true;
        oldData._clickupDocPageUrl='';oldData._inspoDocCreated=false;
        await tx`update inspirations set product_id=${product},url=${old.url},title=${old.title},platform=${old.platform},added_by=${old.added_by},status=${old.status},data=${tx.json(oldData)} where id=${old.id}`;
        const oldQ=priorQueue.find(q=>q.ins_id===old.id && q.product_id===product && q.url===old.url);
        if(oldQ)await tx`insert into inspiration_queue ${tx({...oldQ,id:randomUUID()})}`;
      } else {
        // These are ID renames, not removal of an inspiration: the full row now exists above.
        await tx`delete from inspirations where id=${mapping.from} and product_id=${product}`;
      }
      updated.push({...mapping,reason:'new source assigned unused historical number'});
    }
    await tx`update taxonomy_review_jobs set status='failed',result=null,error_message='Product ownership recovered; request a fresh review' where ins_id in ${tx(moved.map(r=>r.id))}`;
    const after=await tx`select * from inspirations order by id`;
    assert.equal(after.length,live.length+3);
    assert.equal(after.filter(r=>r.product_id===product).length,98);
    for(const row of live) {
      const mapping=renames.find(r=>r.from===row.id), target=after.find(x=>x.id===(mapping?.to||row.id));
      assert.ok(target && target.url===row.url,'Lost source '+row.id);
      if(!mapping && !moved.some(x=>x.id===row.id))assert.deepEqual(target,row,'Unrelated row changed '+row.id);
    }
    assert.equal(digest(await tx`select * from ads order by id`),digest(adsBefore),'Creative rows changed');
    assert.equal(digest(await tx`select * from manual_actions order by id`),digest(actionsBefore),'Action Plan rows changed');
    assert.equal(digest(await tx`select * from matrix_cells order by id`),digest(cellsBefore),'Matrix rows changed');
    const migration=fs.readFileSync(new URL('../supabase/migrations/20260929000100_inspiration_identity.sql',import.meta.url),'utf8');
    await tx.unsafe(migration);
    // Reserve vacated IDs too: an old browser must never resurrect P-INS-006/007/008.
    for(const mapping of renames.filter(r=>!restoredIds.includes(r.from))) {
      const old=live.find(x=>x.id===mapping.from);
      await tx`insert into inspiration_identity(id,product_id,source_url,deleted_at) values(${old.id},${old.product_id},${old.url},now())`;
    }
    fs.writeFileSync(root+'/recovery-plan.json',JSON.stringify({updated,restoredIds,renames,countBefore:live.length,countAfter:after.length,briefsNeedingReview:restoredIds},null,2),{mode:0o600});
    fs.writeFileSync(root+'/transaction-after.json',JSON.stringify(after),{mode:0o600});
    if(!process.argv.includes('--apply'))throw rollback;
  });}catch(e){if(e!==rollback)throw e;}
  console.log(process.argv.includes('--apply')?'COMMITTED':'DRY RUN PASSED (rolled back)',JSON.stringify({restoredOwnership:86,restoredOverwritten:3,renumberedNew:6,phonicsTotal:98,adsChanged:0,actionPlanChanged:0,matrixChanged:0,briefsNeedingReview:3}));
} finally {await sql.end({timeout:2});}
