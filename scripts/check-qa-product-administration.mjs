import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260924040000', name = 'qa_product_administration';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = readFileSync('tests/database/product-administration.sql', 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify');
if (apply && verify) throw new Error('Choose either --apply or --verify.');
const sql = verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Migration missing'; end if;
  if not has_function_privilege('authenticated','public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_product_manifest(text,boolean)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_product_admin_receipts','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.qa_product_admin_receipts'::regclass) then raise exception 'Unexpected permissions'; end if;
  if exists(select 1 from public.products where id in ('qa-product-admin-fixture','qa-product-admin-other'))
    or exists(select 1 from auth.users where id in ('00000000-0000-4000-8000-000000000249','00000000-0000-4000-8000-000000000250')) then raise exception 'Fixtures remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst,'reload schema'; commit;`
  : `begin; ${migration}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA product administration installation, permissions and fixture cleanup verified.' : apply ? 'QA product administration migration applied.' : 'QA product administration tests passed; fixtures rolled back.');
