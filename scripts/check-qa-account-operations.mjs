import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260925010000', name = 'qa_account_operations';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = readFileSync('tests/database/account-operations.sql', 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify'), regression = process.argv.includes('--regression');
if ([apply, verify, regression].filter(Boolean).length > 1) throw new Error('Choose only one mode.');
const sql = regression ? ['admin-access','product-administration','taxonomy-mutations','tracker-mutations','action-plan-views','production-creation']
  .map((fixture) => `begin; ${migration}\n${readFileSync(`tests/database/${fixture}.sql`, 'utf8')}\nrollback;`).join('\n') : verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Migration missing'; end if;
  if has_function_privilege('authenticated','public.qa_account_prepare(uuid,uuid,jsonb,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.qa_account_prepare(uuid,uuid,jsonb,uuid,text)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_account_operations','SELECT')
    or has_function_privilege('anon','public.qa_account_audit_page(bigint)','EXECUTE')
    or not (select relrowsecurity from pg_class where oid='public.qa_account_operations'::regclass) then raise exception 'Unexpected permissions'; end if;
  if exists(select 1 from auth.users where id in ('00000000-0000-4000-8000-000000000271','00000000-0000-4000-8000-000000000272','00000000-0000-4000-8000-000000000273'))
    or exists(select 1 from public.products where id='qa-account-fixture')
    or exists(select 1 from public.qa_account_operations where actor_id='00000000-0000-4000-8000-000000000271') then raise exception 'Fixtures remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst,'reload schema'; commit;`
  : `begin; ${migration}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA account operation installation, permissions and fixture cleanup verified.' : apply ? 'QA account operations migration applied.' : regression ? 'Six existing database workflows pass under the account guards; fixtures rolled back.' : 'QA account operation tests passed; fixtures rolled back.');
