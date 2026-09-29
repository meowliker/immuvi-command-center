import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version = '20260925040000', name = 'qa_worker_controls';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify'), regression = process.argv.includes('--regression');
if ([apply, verify, regression].filter(Boolean).length > 1) throw new Error('Choose one runner mode.');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const sql = verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Migration missing'; end if;
  if not has_function_privilege('authenticated','public.qa_worker_pause(uuid,text,uuid)','EXECUTE')
    or has_function_privilege('anon','public.qa_worker_pause(uuid,text,uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.worker_registry','UPDATE')
    or has_table_privilege('anon','public.worker_registry','SELECT')
    or has_table_privilege('authenticated','public.qa_worker_control_receipts','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.qa_worker_control_receipts'::regclass)
    then raise exception 'Unexpected worker permissions'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.worker_registry'::regclass and tgname='qa_guard_worker_control' and tgenabled='O') then raise exception 'Worker guard missing'; end if;
  if exists(select 1 from public.worker_registry where worker_id like 'qa-controls-fixture-%')
    or exists(select 1 from auth.users where email like 'worker-controls-%@example.test') then raise exception 'Fixture remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}
insert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do update set statements=excluded.statements,name=excluded.name;
notify pgrst,'reload schema'; commit;` : regression ? ['admin-access', 'product-administration', 'stale-ad-cleanup', 'inspiration-recovery', 'production-creation']
  .map((fixture) => `begin; ${migration}\n${readFileSync(`tests/database/${fixture}.sql`, 'utf8')}\nrollback;`).join('\n')
  : `begin; ${migration}\n${readFileSync('tests/database/worker-controls.sql', 'utf8')}\nrollback;`;
const result = spawnSync('supabase', ['db', 'query', '--linked', sql], { encoding: 'utf8', maxBuffer: 2000000 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(1); }
console.log(verify ? 'QA worker installation, permissions and fixture cleanup verified.' : apply ? 'QA worker controls installed; no workers paused or launched.' : regression ? 'Five prior QA database workflows passed; fixtures rolled back.' : 'QA worker controls tests passed; fixtures rolled back.');
