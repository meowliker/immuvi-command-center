import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const ref = 'entgcnlfsnysnwyadzzp';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== ref
  || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'qa') {
  throw new Error('Only the linked QA project on branch qa is allowed.');
}
const apply = process.argv.includes('--apply'), installed = process.argv.includes('--installed');
if (apply && installed) throw new Error('Choose candidate/apply or installed mode.');
const version = '20260926010000', name = 'qa_product_rls';
const migration = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
function query(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', sql], {
    encoding: 'utf8', maxBuffer: 2000000, timeout: 120000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'QA SQL failed.');
}
const failures = [];
const tests = readdirSync('tests/database').filter((file) => file.endsWith('.sql')).sort();
for (const file of tests) {
  try {
    query(`begin; set local statement_timeout='60s'; set local lock_timeout='5s';
      ${installed ? '' : migration}
      ${file === 'inspiration-placement.sql' ? readFileSync('tests/database/matrix-mutations.sql', 'utf8') : ''}
      ${readFileSync(`tests/database/${file}`, 'utf8')}
      rollback;`);
    console.log(`PASS ${file} (rolled back)`);
  } catch (error) {
    failures.push(file);
    console.error(`FAIL ${file}\n${error.message}`);
  }
}
if (failures.length) throw new Error(`${failures.length}/${tests.length} SQL suites failed; migration not applied.`);
if (apply) {
  query(`begin; set local lock_timeout='5s'; ${migration}
    insert into supabase_migrations.schema_migrations(version,statements,name)
    values(${quote(version)},ARRAY[${quote(migration)}],${quote(name)}) on conflict(version) do nothing;
    notify pgrst,'reload schema'; commit;`);
  console.log('QA RLS migration installed. No application records were changed.');
}
console.log(`${tests.length}/${tests.length} ${installed ? 'installed' : 'candidate'} database suites passed; SQL fixtures rolled back.`);
