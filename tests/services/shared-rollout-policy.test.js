import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_REF, assertRolloutTarget, pendingMigrations, rollbackSuite, rolloutGuard} from '../../scripts/shared-rollout-policy.mjs';

test('rollout refuses foreign projects, branches and ambiguous modes', () => {
  assert.doesNotThrow(() => assertRolloutTarget(QA_REF, 'qa', []));
  for (const [ref, branch, args] of [['production','qa',[]], [QA_REF,'main',[]], [QA_REF,'qa',['--apply','--installed']], [QA_REF,'qa',['--force']]]) {
    assert.throws(() => assertRolloutTarget(ref, branch, args));
  }
});
test('rollout checks pause and drain without pausing devices or discarding work itself', () => {
  const guard = rolloutGuard(true);
  assert.match(guard, /scope='shared' and enabled/);
  assert.match(guard, /qa_private_inspiration_jobs where status='running'/);
  assert.match(guard, /qa_image_runs where status='running'/);
  assert.match(guard, /qa_shared_analysis_jobs where status='running'/);
  assert.doesNotMatch(guard, /update |delete |truncate /i);
  assert.doesNotMatch(rolloutGuard(), /Pause shared QA claims/);
});
test('hosted rehearsals roll back and never execute local fake base schemas', () => {
  const paths = [];
  const read = path => {paths.push(path); return '-- fixture';};
  const sql = rollbackSuite('shared-images', {read});
  assert.match(sql, /^begin;/); assert.match(sql, /rollback;$/);
  assert.doesNotMatch(sql, /commit;/);
  assert.ok(paths.includes('tests/database/shared-worker.sql'));
  assert.ok(!paths.some(p => p.includes('base.sql')));
  assert.throws(() => rollbackSuite('../other', {read}));
  paths.length = 0;
  rollbackSuite('shared-analysis', {installed:true, read});
  assert.ok(paths.every(p => p.startsWith('tests/database/')));
});
test('migration installation is ordered and refuses same-version source drift', () => {
  const sql = pendingMigrations(() => "select 'quoted';");
  assert.ok(sql.indexOf('20260929200000') < sql.indexOf('20260929210000'));
  assert.ok(sql.indexOf('20260929210000') < sql.indexOf('20260930010000'));
  assert.match(sql, /Installed migration differs/);
  assert.match(sql, /select ''quoted''/);
});
