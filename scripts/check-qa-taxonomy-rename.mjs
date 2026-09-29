import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260925060000', name = 'qa_taxonomy_rename_preview';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify');
if (apply && verify) throw new Error('Choose one mode.');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const sql = verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}')
    or not has_function_privilege('authenticated','public.qa_taxonomy_rename_preview(text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('anon','public.qa_taxonomy_rename_preview(text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.qa_taxonomy_rename_snapshot(text,text,jsonb,text,boolean)','EXECUTE')
    or position('Rename impact changed' in pg_get_functiondef('public.qa_taxonomy_mutate(text,uuid,text,text,jsonb)'::regprocedure))=0
    or position('qa_taxonomy_rename' in pg_get_functiondef('public.qa_taxonomy_mutate(text,uuid,text,text,jsonb)'::regprocedure))=0
    or has_table_privilege('authenticated','public.qa_taxonomy_receipts','SELECT') then raise exception 'Rename permissions/history mismatch'; end if;
  if exists(select 1 from public.products where id in ('qa-rename-fixture','qa-rename-foreign','qa-taxonomy-fixture','qa-taxonomy-foreign'))
    or exists(select 1 from auth.users where email in ('rename-preview@example.test','taxonomy@example.test')) then raise exception 'Rename fixtures remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}
insert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing;
notify pgrst,'reload schema'; commit;` : ['taxonomy-rename', 'taxonomy-mutations'].map((test) => `begin; ${migration}\n${readFileSync(`tests/database/${test}.sql`, 'utf8')}\nrollback;`).join('\n');
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA rename history, permissions and fixture cleanup verified.' : apply ? 'QA rename safeguard installed; no existing taxonomy renamed.' : 'QA rename and prior taxonomy workflows passed; all fixtures rolled back.');
