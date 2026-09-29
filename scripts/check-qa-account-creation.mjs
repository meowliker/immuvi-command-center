import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260925020000', name = 'qa_account_creation';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify'), regression = process.argv.includes('--regression');
if ([apply, verify, regression].filter(Boolean).length > 1) throw new Error('Choose only one mode.');
const sql = regression ? ['account-operations','admin-access','product-administration','taxonomy-mutations','tracker-mutations','action-plan-views','production-creation']
  .map((fixture) => `begin; ${migration}\n${readFileSync(`tests/database/${fixture}.sql`, 'utf8')}\nrollback;`).join('\n') : verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Migration missing'; end if;
  if has_function_privilege('authenticated','public.qa_account_creation_prepare(uuid,uuid,jsonb,uuid,uuid,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.qa_account_creation_finish(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_account_creations','SELECT')
    or has_table_privilege('anon','public.qa_account_creations','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.qa_account_creations'::regclass) then raise exception 'Unexpected permissions'; end if;
  if not exists(select 1 from pg_trigger where tgname='qa_guard_creation_username' and tgrelid='public.profiles'::regclass) then raise exception 'Username guard missing'; end if;
  if exists(select 1 from auth.users where id in ('00000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000292'))
    or exists(select 1 from public.products where id='qa-creation-fixture') then raise exception 'Fixtures remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do update set statements=excluded.statements,name=excluded.name; notify pgrst,'reload schema'; commit;`
  : `begin; ${migration}\n${readFileSync('tests/database/account-creation.sql', 'utf8')}\nrollback;`;
const result = spawnSync('supabase', ['db','query','--linked',sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA account creation installation, permissions and fixture cleanup verified.' : apply ? 'QA account creation migration applied.' : regression ? 'Seven existing database workflows pass under creation guards; fixtures rolled back.' : 'QA account creation SQL tests passed; fixtures rolled back.');
