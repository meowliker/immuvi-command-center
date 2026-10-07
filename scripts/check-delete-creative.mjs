import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {targetEnv} from './strategist-env.mjs';
const postgres = createRequire(path.resolve('package.json'))('postgres');
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max: 1, prepare: false, ssl: 'require', connect_timeout: 10, onnotice() {}});
const migration = await readFile(new URL('../supabase/migrations/20261007000100_delete_creative.sql', import.meta.url), 'utf8');
const rollback = new Error('Rollback test fixtures');
let checks = 0;
try {
  try {
    await sql.begin(async tx => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='5s'`;
      await tx.unsafe(migration);
      const [member] = await tx`select id from profiles where is_active and role <> 'admin' limit 1`;
      assert.ok(member);
      const prefix = 'delete-contract-' + randomUUID(), a = prefix + '-A', b = prefix + '-B';
      await tx`insert into products(id,name) values (${a},'Delete contract A'),(${b},'Delete contract B')`;
      await tx`insert into user_products(user_id,product_id) values (${member.id},${a})`;
      for (const [suffix, product, task, parent, meta] of [
        ['parent',a,'cu-'+prefix,null,{}], ['child',a,null,prefix+'-parent',{notes:'Keep'}],
        ['foreign',b,null,null,{}], ['local',a,null,null,{}], ['retired',a,null,null,{_supersededByAdId:prefix+'-parent'}],
        ['conflict',a,'shared-'+prefix,null,{}], ['shared',b,'shared-'+prefix,null,{}],
        ['marker',a,null,null,{}], ['action-only',a,null,null,{}]
      ]) await tx`insert into ads(id,product_id,format_name,clickup_task_id,parent_ad_id,meta)
        values (${prefix+'-'+suffix},${product},${suffix},${task},${parent},${tx.json(meta)})`;
      await tx`insert into deleted_ads(id,product_id,deleted_by) values (${prefix+'-marker'},${b},'contract')`;
      await tx`insert into manual_actions(product_id,payload) values
        (${a},${tx.json({id:'ma',sourceAdId:prefix+'-parent',_clickupId:'cu-'+prefix})}),
        (${a},${tx.json({id:'child-ma',sourceAdId:prefix+'-child'})}),
        (${a},${tx.json({id:'action-only-ma',sourceAdId:prefix+'-action-only',_clickupId:'action-cu-'+prefix})})`;
      const [childBefore] = await tx`select * from ads where id=${prefix+'-child'}`;
      await tx`select set_config('request.jwt.claim.sub',${member.id},true)`;
      await tx`set local role authenticated`;
      const denied = async (id, product, expected, code) => {
        await assert.rejects(tx.savepoint(async t => t`select delete_creative(${id},${product},${expected})`), e => e.code === code);
        checks++;
      };
      await denied(prefix+'-foreign',b,null,'42501');
      await denied(prefix+'-foreign',a,null,'P0002');
      await denied(prefix+'-missing',a,null,'P0002');
      await denied(prefix+'-parent',a,'wrong-task','PT409');
      await denied(prefix+'-retired',a,null,'PT409');
      await denied(prefix+'-conflict',a,'shared-'+prefix,'PT409');
      await denied(prefix+'-marker',a,null,'PT409');
      const [first] = await tx`select delete_creative(${prefix+'-parent'},${a},${'cu-'+prefix}) as result`;
      assert.equal(first.result.id,prefix+'-parent');
      const [deleted] = await tx`select * from ads where id=${prefix+'-parent'}`;
      const [marker] = await tx`select * from deleted_ads where id=${prefix+'-parent'}`;
      assert.ok(deleted.deleted_at); assert.equal(marker.clickup_task_id,'cu-'+prefix); assert.equal(marker.deleted_by,member.id);
      checks++;
      const [second] = await tx`select delete_creative(${prefix+'-parent'},${a},${'cu-'+prefix}) as result`;
      assert.deepEqual(first.result,second.result); checks++;
      const [childAfter] = await tx`select * from ads where id=${prefix+'-child'}`;
      assert.deepEqual(childAfter,childBefore);
      assert.equal((await tx`select id from manual_actions where product_id=${a} and payload->>'id'='ma'`).length,0);
      assert.equal((await tx`select id from manual_actions where product_id=${a} and payload->>'id'='child-ma'`).length,1); checks++;
      await tx`select delete_creative(${prefix+'-local'},${a},null)`; checks++;
      const [actionFirst] = await tx`select delete_creative(${prefix+'-action-only'},${a},${'action-cu-'+prefix}) as result`;
      const [actionSecond] = await tx`select delete_creative(${prefix+'-action-only'},${a},${'action-cu-'+prefix}) as result`;
      assert.deepEqual(actionFirst.result,actionSecond.result); checks++;
      await tx`reset role`;
      const [privilege] = await tx`select has_function_privilege('anon','public.delete_creative(text,text,text)','execute') as allowed`;
      assert.equal(privilege.allowed,false); checks++;
      throw rollback;
    });
  } catch (e) {if (e !== rollback) throw e;}
  console.log(JSON.stringify({checks,fixturesRolledBack:true}));
  if (process.argv.includes('--apply-migration')) {
    const dir = new URL('../backups/delete-creative-' + new Date().toISOString().replaceAll(':','-') + '/', import.meta.url);
    await mkdir(dir,{recursive:true,mode:0o700});
    const before = await sql`select pg_get_functiondef(oid) as definition from pg_proc where oid=to_regprocedure('public.delete_creative(text,text,text)')`;
    await writeFile(new URL('before.json',dir),JSON.stringify(before,null,2),{mode:0o600});
    await sql.begin(async tx => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='5s'`;
      await tx.unsafe(migration);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements)
        values ('20261007000100','delete_creative',${[migration]}) on conflict(version) do nothing`;
    });
    const [verified] = await sql`select p.prosecdef as security_definer,
      has_function_privilege('anon',p.oid,'execute') as anonymous_execute,
      has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
      from pg_proc p where p.oid=to_regprocedure('public.delete_creative(text,text,text)')`;
    assert.deepEqual(verified,{security_definer:false,anonymous_execute:false,authenticated_execute:true});
    await writeFile(new URL('COMMITTED.json',dir),JSON.stringify({checks,...verified},null,2),{mode:0o600});
    console.log(JSON.stringify({migrationApplied:true,backup:dir.pathname,...verified}));
  }
} catch (e) {console.error(e.code || e.message); process.exitCode=1;}
finally {await sql.end({timeout:2});}
