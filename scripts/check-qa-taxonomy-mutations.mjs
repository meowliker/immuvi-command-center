import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260924030000', name = 'qa_taxonomy_mutations';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const tests = readFileSync('tests/database/taxonomy-mutations.sql', 'utf8');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
if (apply) throw new Error('Use check-qa-taxonomy-rename.mjs --apply; refusing to replace newer rename safeguards with this historical migration.');
if (apply && verify) throw new Error('Choose either --apply or --verify.');
const sql = verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}' and name='${name}') then raise exception 'Taxonomy migration is missing'; end if;
  if not has_function_privilege('authenticated','public.qa_taxonomy_mutate(text,uuid,text,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.qa_taxonomy_mutate(text,uuid,text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_taxonomy_retag(jsonb,text,text[],text)','EXECUTE')
    or has_table_privilege('authenticated','public.qa_taxonomy_receipts','SELECT')
    or has_table_privilege('anon','public.qa_taxonomy_receipts','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.qa_taxonomy_receipts'::regclass) then raise exception 'Unexpected taxonomy permissions'; end if;
  if exists(select 1 from public.products where id in ('qa-taxonomy-fixture','qa-taxonomy-foreign'))
    or exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000247') then raise exception 'Taxonomy fixtures were not rolled back'; end if;
end $$; rollback;` : apply ? `begin; ${migration}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing; notify pgrst,'reload schema'; commit;`
  : `begin; ${migration}\n${readFileSync('supabase/migrations/20260925060000_qa_taxonomy_rename_preview.sql', 'utf8')}\n${tests}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA taxonomy installation, permissions and fixture cleanup verified.' : apply ? 'QA taxonomy migration applied.' : 'QA taxonomy tests passed; fixtures rolled back.');
