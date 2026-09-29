import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertRolloutTarget, pendingMigrations, rollbackSuite, rolloutGuard } from './shared-rollout-policy.mjs';

const args = process.argv.slice(2);
assertRolloutTarget(readFileSync('supabase/.temp/project-ref', 'utf8').trim(),
  execFileSync('git', ['branch', '--show-current'], {encoding:'utf8'}).trim(), args);
const cli = process.env.QA_SUPABASE_CLI || 'supabase';
function query(sql) {
  const result = spawnSync(cli, ['db', 'query', '--linked', sql], {encoding:'utf8', timeout:120000, maxBuffer:2_000_000});
  if (result.status !== 0) throw new Error(result.stderr || 'QA SQL gate failed.');
}
try {
  for (const fixture of ['shared-recovery', 'shared-images', 'shared-analysis']) {
    query(rollbackSuite(fixture, {installed:args.includes('--installed')}));
    console.log(`PASS ${fixture}: actual QA schema, fixtures rolled back.`);
  }
  if (args.includes('--apply')) {
    query(`begin; ${rolloutGuard(true)} ${pendingMigrations()} notify pgrst,'reload schema'; commit;`);
    console.log('Three reviewed worker migrations installed in QA. No worker restarted or job requeued.');
  } else console.log('No migrations committed, service changes or external delivery.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
