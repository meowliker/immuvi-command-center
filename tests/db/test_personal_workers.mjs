import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {targetEnv} from '../../scripts/strategist-env.mjs';
import {validatePersonalResult} from '../../tools/personal-worker-result.mjs';
const {default:postgres}=await import(process.env.IMMUVI_TEST_POSTGRES_MODULE||'postgres');
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,ssl:'require',connect_timeout:15});
const migration=await readFile(new URL('../../supabase/migrations/20261021000100_personal_classification_workers.sql',import.meta.url),'utf8');
const prefix='personal-worker-probe-'+Date.now(),rollback=new Error('ROLLBACK_SUCCESS');
try{
  try{await sql.begin(async tx=>{
    await tx`set local lock_timeout='5s'`;await tx`set local statement_timeout='30s'`;
    await tx.unsafe(migration);await tx.unsafe(migration);
    const [owner]=await tx`select id from profiles where role='admin' and is_active limit 1`;assert.ok(owner);
    await tx`select set_config('request.jwt.claim.role','service_role',true)`;
    const rpc=async(op,args)=>{
      const [row]=await tx`select public.personal_worker_dispatch(${op},${tx.json(args)}) as data`;return row.data;
    };
    const bad=(op,args,code)=>assert.rejects(()=>tx.savepoint(async sp=>{
      await sp`select public.personal_worker_dispatch(${op},${sp.json(args)})`;
    }),e=>e.code===code);
    const own={owner_id:owner.id,clickup_user_id:'synthetic-owner'},other={owner_id:owner.id,clickup_user_id:'synthetic-colleague'};
    const a=await rpc('create',{...own,name:'Private Mac A',pair_hash:'pair-a'});
    const b=await rpc('create',{...other,name:'Private Mac B',pair_hash:'pair-b'});
    await bad('pair',{device_id:a.id,pair_hash:'pair-a',token_hash:'token-a',clickup_user_id:other.clickup_user_id},'42501');
    await rpc('pair',{device_id:a.id,pair_hash:'pair-a',token_hash:'token-a',clickup_user_id:own.clickup_user_id});
    await bad('pair',{device_id:a.id,pair_hash:'pair-a',token_hash:'token-a',clickup_user_id:own.clickup_user_id},'42501');
    await rpc('pair',{device_id:b.id,pair_hash:'pair-b',token_hash:'token-b',clickup_user_id:other.clickup_user_id});
    assert.deepEqual((await rpc('list',own)).devices.map(d=>d.id),[a.id]);
    assert.deepEqual((await rpc('list',other)).devices.map(d=>d.id),[b.id]);
    await bad('revoke',{...other,device_id:a.id},'42501');
    await tx`insert into products(id,name,config) values(${prefix},'Synthetic private worker product','{}')`;
    const [member]=await tx`select id from profiles where role='member' and is_active limit 1`;assert.ok(member);
    const restricted={owner_id:member.id,clickup_user_id:'synthetic-member'};
    const memberDevice=await rpc('create',{...restricted,name:'Restricted fixture Mac',pair_hash:'member-pair'});
    await rpc('pair',{device_id:memberDevice.id,pair_hash:'member-pair',token_hash:'member-token',clickup_user_id:restricted.clickup_user_id});
    await bad('enqueue',{...restricted,device_id:memberDevice.id,product_id:prefix,items:[{id:'missing',url:'https://example.test/restricted',no_brief:true}]},'42501');
    const ins=prefix+'-INS-1',second=prefix+'-INS-2',url='https://example.test/synthetic-ad';
    const before={notes:'Keep notes',_clickupDocPageUrl:'https://example.test/old-brief',nextAdScripts:['Keep existing work'],angle:'Existing manual angle',_angleLocked:true,_angleScope:'product'};
    await tx`insert into inspirations(id,product_id,url,title,status,data) values
      (${ins},${prefix},${url},'Keep source title','Testing',${tx.json(before)}),
      (${second},${prefix},${url+'-2'},'Unrelated inspiration','Saved','{}')`;
    await bad('enqueue',{...other,device_id:a.id,product_id:prefix,items:[{id:ins,url,no_brief:true}]},'42501');
    await bad('enqueue',{...own,device_id:a.id,product_id:prefix,items:[{id:ins,url:url+'wrong',no_brief:true}]},'PT409');
    await rpc('enqueue',{...own,device_id:a.id,product_id:prefix,items:[{id:ins,url,no_brief:true}]});
    await tx`select set_config('request.jwt.claim.role','authenticated',true)`;await tx`set local role authenticated`;
    await assert.rejects(()=>tx.savepoint(sp=>sp`select * from personal_workers.devices`),e=>e.code==='42501');
    await assert.rejects(()=>tx.savepoint(sp=>sp`select personal_worker_dispatch('list','{}')`),e=>e.code==='42501');
    await tx`select set_config('request.jwt.claim.sub',${owner.id},true)`;
    await assert.rejects(()=>tx.savepoint(sp=>sp`update inspiration_queue set worker_assignment='auto' where ins_id=${ins}`),e=>e.code==='PT409');
    await assert.rejects(()=>tx.savepoint(sp=>sp`delete from inspiration_queue where ins_id=${ins}`),e=>e.code==='PT409');
    await tx`reset role`;await tx`select set_config('request.jwt.claim.role','service_role',true)`;
    const device={token_hash:'token-a',contract:'personal-artifact-v1'};
    assert.equal(await rpc('claim',{token_hash:'token-b',contract:'personal-artifact-v1'}),null);
    const job=await rpc('claim',device);assert.equal(job.ins_id,ins);assert.equal(job.no_brief,true);
    const [heartbeatBefore]=await tx`select ctid::text as position from personal_workers.devices where id=${a.id}`;
    assert.equal(await rpc('claim',device),null);
    const [heartbeatAfter]=await tx`select ctid::text as position from personal_workers.devices where id=${a.id}`;
    assert.deepEqual(heartbeatAfter,heartbeatBefore);
    await bad('inspect',{token_hash:'token-b',job_id:job.id,lease:job.lease},'PT409');
    const scope={...device,job_id:job.id,lease:job.lease};
    const context=await rpc('inspect',scope);
    const result={ins_id:ins,product_id:prefix,source_url:url,duration_seconds:0,frames_extracted:1,
      metadata:{source_url:url,media_sha256:'a'.repeat(64),evidence_summary:'Synthetic image evidence from the exact fixture source, not a real ad.',caption_timeline:[]},
      classification:{brand:'Synthetic',angle:'Proposed local angle',persona:'Proposed local persona',hook_type:'Curiosity',creative_structure:'Static/Photo',production_style:'Static Graphic',funnel_type:'TOF',photo_video:'Photo',media_kind:'image',voice_over:'No voice over',voice_over_timeline:[]},brief:{},markdown:''};
    const artifact=validatePersonalResult(result,context);
    assert.equal((await rpc('prepare',{...scope,artifact,artifact_hash:'fixture-hash'})).reserved,true);
    assert.equal((await rpc('prepare',{...scope,artifact,artifact_hash:'fixture-hash'})).publishing,true);
    assert.equal((await rpc('commit',{...scope,artifact_hash:'fixture-hash'})).done,true);
    assert.equal((await rpc('inspect',scope)).done,true);
    const [saved]=await tx`select * from inspirations where id=${ins}`;
    assert.equal(saved.status,'Testing');assert.equal(saved.url,url);assert.equal(saved.product_id,prefix);
    assert.equal(saved.data.notes,'Keep notes');assert.equal(saved.data._clickupDocPageUrl,before._clickupDocPageUrl);
    assert.deepEqual(saved.data.nextAdScripts,before.nextAdScripts);assert.equal(saved.data._angleScope,'product');assert.equal(saved.data.angle,before.angle);
    const [untouched]=await tx`select * from inspirations where id=${second}`;assert.equal(untouched.title,'Unrelated inspiration');assert.deepEqual(untouched.data,{});
    await rpc('enqueue',{...own,device_id:a.id,product_id:prefix,items:[{id:second,url:url+'-2',no_brief:true}]});
    const expired=await rpc('claim',device);
    await tx`update personal_workers.jobs set lease_until=now()-interval '1 second' where id=${expired.id}`;
    const recovered=await rpc('claim',device);assert.equal(recovered.id,expired.id);assert.notEqual(recovered.lease,expired.lease);
    await bad('prepare',{...device,job_id:expired.id,lease:expired.lease,artifact,artifact_hash:'wrong'},'PT409');
    await rpc('revoke',{...own,device_id:a.id});await bad('claim',device,'42501');
    const [cancelled]=await tx`select status from inspiration_queue where ins_id=${second}`;assert.equal(cancelled.status,'blocked');
    const [global]=await tx`select count(*)::int as n from worker_registry where worker_id in (${a.id},${b.id})`;assert.equal(global.n,0);
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  const [left]=await sql`select count(*)::int as count from products where id=${prefix}`;assert.equal(left.count,0);
  console.log('Passed private identity, one-use pairing, colleague isolation, database denial, queue protection, single lease, result replay, No Brief preservation, product boundaries, expired-lease fencing and revocation. All fixture/schema changes rolled back.');
}finally{await sql.end({timeout:2});}
