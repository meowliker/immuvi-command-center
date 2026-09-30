import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import postgres from 'postgres';
import {targetEnv} from './strategist-env.mjs';

const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max:1, prepare:false, connect_timeout:10});
const migration = readFileSync(new URL('../supabase/migrations/20260930000200_nonretrying_edit_conflicts.sql', import.meta.url), 'utf8');
const definitions = tx => tx`select p.oid::regprocedure::text as name, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('guard_inspiration_identity','save_variation_notes') order by p.proname`;
const fingerprint = tx => tx`select 'inspirations' as name,count(*)::int as count,
  md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) as digest from public.inspirations t
  union all select 'ads',count(*)::int,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from public.ads t
  union all select 'products',count(*)::int,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from public.products t`;

try {
  const before = await definitions(sql);
  assert.equal(before.length,2);
  console.log('Live handlers:', before.map(f=>({name:f.name,retryCode:f.definition.includes("'40001'"),conflictCode:f.definition.includes("'PT409'")})));
  console.log('Activity:',await sql`select usename,state,count(*)::int from pg_stat_activity where datname=current_database() group by usename,state`);
  if (process.argv.includes('--apply')) {
    const directory = '/private/tmp/immuvi-conflict-retry-backup-'+Date.now();
    mkdirSync(directory,{mode:0o700});
    writeFileSync(directory+'/functions.json',JSON.stringify(before,null,2),{mode:0o600,flag:'wx'});
    await sql.begin(async tx => {
      await tx`set local statement_timeout='20s'`;
      const dataBefore = await fingerprint(tx);
      writeFileSync(directory+'/data-before.json',JSON.stringify(dataBefore,null,2),{mode:0o600,flag:'wx'});
      await tx.unsafe(migration);
      const after = await definitions(tx);
      for(let i=0;i<before.length;i++) {
        assert.equal(after[i].name,before[i].name);
        assert.equal(after[i].definition,before[i].definition.replaceAll("'40001'","'PT409'"));
      }
      const dataAfter = await fingerprint(tx);
      assert.deepEqual(dataAfter,dataBefore);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements)
        values('20260930000200','nonretrying_edit_conflicts',${[migration]}) on conflict(version) do nothing`;
      writeFileSync(directory+'/verified.json',JSON.stringify({functions:after.map(f=>f.name),dataAfter},null,2),{mode:0o600,flag:'wx'});
    });
    console.log('Applied: only conflict error codes changed. All inspiration, ad and product row hashes unchanged. Backup:',directory);
  }
} finally { await sql.end(); }
