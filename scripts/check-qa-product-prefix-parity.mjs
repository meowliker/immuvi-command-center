import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'entgcnlfsnysnwyadzzp') throw new Error('Refusing a non-QA project.');
const version='20260925050000', name='qa_product_prefix_parity';
const migration=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const apply=process.argv.includes('--apply'), verify=process.argv.includes('--verify');
if (apply && verify) throw new Error('Choose one mode.');
const quote=(s)=>"'"+s.replaceAll("'","''")+"'";
const sql=verify ? `begin read only; do $$ begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}')
    or public.qa_product_initials('Astro Rekha')<>'AR'
    or has_function_privilege('authenticated','public.qa_product_initials(text)','EXECUTE')
    or has_function_privilege('anon','public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.qa_product_mutate(uuid,text,text,timestamptz,jsonb)','EXECUTE') then raise exception 'Prefix installation/permissions mismatch'; end if;
  if exists(select 1 from auth.users where email='prefix-parity@example.test')
    or exists(select 1 from public.products where id='qa-prod-00000000-0000-4000-8000-000000000292') then raise exception 'Fixture remained'; end if;
end $$; rollback;` : apply ? `begin; ${migration}
insert into supabase_migrations.schema_migrations(version,statements,name) values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do update set statements=excluded.statements,name=excluded.name;
notify pgrst,'reload schema'; commit;` : ['product-prefix-parity','product-administration','stale-ad-cleanup'].map((test)=>`begin; ${migration}\n${readFileSync(`tests/database/${test}.sql`,'utf8')}\nrollback;`).join('\n');
const result=spawnSync('supabase',['db','query','--linked',sql],{encoding:'utf8',maxBuffer:2000000});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(1);}
console.log(verify?'QA prefix migration, grants and fixture cleanup verified.':apply?'QA prefix migration installed; existing products and receipts unchanged.':'Prefix parity and two prior QA workflows passed; fixtures rolled back.');
