import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {targetEnv} from '../../scripts/strategist-env.mjs';
const sql=postgres(targetEnv().STRATEGIST_DATABASE_URL,{prepare:false,max:1,onnotice(){}});
const migration=await readFile(new URL('../../supabase/migrations/20260929000100_inspiration_identity.sql',import.meta.url),'utf8');
const rollback=new Error('ROLLBACK_TEST_SUCCESS');
try {
  try { await sql.begin(async tx=>{
    await tx`set local lock_timeout='5s'`;
    await tx.unsafe(migration);
    const [admin]=await tx`select id from profiles where role='admin' and is_active=true limit 1`;
    const products=await tx`select id from products order by id limit 2`;
    await tx`select set_config('request.jwt.claim.sub',${admin.id},true)`;
    await tx`select set_config('request.jwt.claim.role','authenticated',true)`;
    await tx`set local role authenticated`;
    const request=randomUUID(), source={sourceUrl:'https://example.com/identity-test',status:'Queued',noBrief:true};
    const [a]=await tx`select * from create_inspiration(${products[0].id},${request},${tx.json(source)})`;
    const [again]=await tx`select * from create_inspiration(${products[0].id},${request},${tx.json(source)})`;
    assert.equal(a.id,again.id);assert.equal(a.data.noBrief,true);
    const [b]=await tx`select * from create_inspiration(${products[0].id},${randomUUID()},${tx.json(source)})`;
    assert.notEqual(a.id,b.id);
    const reject=fn=>assert.rejects(()=>tx.savepoint(fn));
    await reject(sp=>sp`update inspirations set product_id=${products[1].id} where id=${a.id}`);
    await reject(sp=>sp`update inspirations set url='https://example.com/different' where id=${a.id}`);
    await reject(sp=>sp`update inspirations set status='Testing' where id=${a.id}`);
    await reject(sp=>sp`insert into inspirations(id,product_id,url) values('OLD-INS-001',${products[0].id},'https://example.com')`);
    await reject(sp=>sp`insert into inspiration_queue(ins_id,product_id,url) values(${a.id},${products[1].id},${source.sourceUrl})`);
    await reject(sp=>sp`insert into inspiration_queue(ins_id,product_id,url) values(${a.id},${products[0].id},'https://example.com/wrong')`);
    await tx`update inspirations set status='Classified',data=data||jsonb_build_object('_baseUpdatedAt',updated_at::text) where id=${a.id}`;
    await tx`insert into inspirations(id,product_id,url,status,data)
      select id,product_id,url,'Classified',data||jsonb_build_object('_baseUpdatedAt',updated_at::text)
      from inspirations where id=${a.id} on conflict(id) do update set status=excluded.status,data=excluded.data`;
    // Force the clock forward inside the transaction to test revision mismatch.
    await tx`reset role`;
    await tx`select set_config('request.jwt.claim.role','service_role',true)`;
    await tx`update inspirations set status='Testing' where id=${a.id}`;
    await tx`select set_config('request.jwt.claim.role','authenticated',true)`;
    await tx`set local role authenticated`;
    await reject(sp=>sp`update inspirations set data=data||jsonb_build_object('_baseUpdatedAt','2000-01-01T00:00:00Z') where id=${a.id}`);
    await tx`delete from inspirations where id=${b.id}`;
    await reject(sp=>sp`insert into inspirations(id,product_id,url,data) values(${b.id},${b.product_id},${b.url},${sp.json(b.data)})`);
    const [c]=await tx`select * from create_inspiration(${products[0].id},${randomUUID()},${tx.json(source)})`;
    assert.ok(Number(c.id.split('-').at(-1))>Number(b.id.split('-').at(-1)));
    await reject(sp=>sp`select * from inspiration_history`);
    await tx`set local role anon`;
    await reject(sp=>sp`select * from create_inspiration(${products[0].id},${randomUUID()},${tx.json(source)})`);
    throw rollback;
  }); } catch(e) {if(e!==rollback)throw e;}
  console.log('PASS: server allocation, retry idempotency, no ID reuse, stale-save rejection, source/product guards, queue guards, audit isolation. Test writes rolled back.');
} finally {await sql.end({timeout:2});}
