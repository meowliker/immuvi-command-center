import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260924050000', name = 'qa_admin_access';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = readFileSync('tests/database/admin-access.sql', 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify');
const regression = process.argv.includes('--regression');
if ([apply, verify, regression].filter(Boolean).length > 1) throw new Error('Choose only one runner mode.');
const sql = regression ? ['product-administration','taxonomy-mutations','tracker-mutations','action-plan-views','production-creation']
  .map((fixture) => `begin; ${migration}\n${readFileSync(`tests/database/${fixture}.sql`, 'utf8')}\nrollback;`).join('\n') : verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Migration missing'; end if;
  if not has_function_privilege('authenticated','public.qa_admin_access_mutate(uuid,uuid,text,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.qa_admin_access_mutate(uuid,uuid,text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_admin_user_snapshot(uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_admin_access_receipts','SELECT')
    or has_table_privilege('authenticated','public.user_products','DELETE')
    or has_table_privilege('authenticated','public.profiles_with_products','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.qa_admin_access_receipts'::regclass) then raise exception 'Unexpected permissions'; end if;
  if exists(select 1 from public.products where id in ('qa-access-one','qa-access-two'))
    or exists(select 1 from auth.users where id in ('00000000-0000-4000-8000-000000000261','00000000-0000-4000-8000-000000000262','00000000-0000-4000-8000-000000000263') or email like 'access-page-%@example.test') then raise exception 'Fixtures remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst,'reload schema'; commit;`
  : `begin; ${migration}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA admin access installation, permissions and fixture cleanup verified.' : apply ? 'QA admin access migration applied.' : regression ? 'Five existing QA database workflows pass under the new access controls; fixtures rolled back.' : 'QA admin access tests passed; fixtures rolled back.');
