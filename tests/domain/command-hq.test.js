import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { commandHqSnapshot, HQ_FIELD_OPTIONS } from '../../lib/domain/command-hq.js';
import { normalizeCreativeRow } from '../../lib/domain/creative-tracker.js';

const ad = (id, extra = {}) => ({ id, product_id: 'qa', angle: 'Energy', persona: 'Busy', status: 'Untested', funnel_stage: 'TOF', ...extra });
const axis = (name, extra = {}) => ({ id: name, product_id: 'qa', name, status: 'Untested', ...extra });
const snapshot = (extra = {}) => commandHqSnapshot({ productId: 'qa', ...extra });

test('HQ keeps legacy KPI sets, all live children and production, and total denominator', () => {
  const statuses = ['Winner', 'Mild Winner', 'Scale', 'Testing', 'Ready to Launch', 'In Production', 'Approved', 'Assigned', 'Untested', 'Loser', 'Complete'];
  const ads = statuses.map((status, index) => ad(`${index}`, { status, parent_ad_id: index ? '0' : '', meta: { taskType: 'production' } }));
  assert.deepEqual(snapshot({ ads }).summary, { total: 11, winners: 3, testing: 1, ready: 1, untested: 1, winRate: 3 / 11 * 100, angles: 0, personas: 0 });
});

test('HQ excludes foreign, deleted, quarantine and tombstone identities', () => {
  const ads = [ad('live'), ad('foreign', { product_id: 'prod' }), ad('deleted', { deleted_at: '2026-01-01' }), ad('meta-deleted', { meta: { deletedAt: 'now' } }), ad('quarantined', { meta: { _productBoundaryQuarantined: true } }), ad('tomb'), ad('alias', { clickup_task_id: 'remote' })];
  const tombstones = [ad('tomb'), ad('old', { clickup_task_id: 'remote' }), ad('live', { product_id: 'prod' })];
  assert.equal(snapshot({ ads, tombstones }).summary.total, 1);
});

test('active canonical axes determine denominators and count aliases once', () => {
  const data = snapshot({ angles: [axis('Energy'), axis(' energy '), axis('Archived', { archived_at: 'now' }), axis('Foreign', { product_id: 'prod' })], personas: [axis('Busy'), axis('Other')], ads: [ad('1', { angle: ' ENERGY ' })] });
  assert.equal(data.summary.angles, 1);
  assert.equal(data.coverage[0].percent, 100);
  assert.equal(data.coverage[1].percent, 50);
  assert.ok(data.gaps.includes('1 persona untested.'));
});

test('legacy seed catalogs include only current live product custom fields', () => {
  const data = snapshot({ ads: [ad('1', { meta: { creativeStructure: 'QA custom', hookType: 'Fear' } }), ad('2', { product_id: 'prod', meta: { creativeStructure: 'Foreign custom' } })] });
  const structures = data.coverage[2];
  assert.equal(structures.total, HQ_FIELD_OPTIONS.creativeStructure.length + 1);
  assert.equal(structures.covered, 1);
  assert.equal(structures.items.at(-1).name, 'QA custom');
  assert.equal(data.coverage[3].covered, 1);
});

test('only root Winner recommendations use all live children, not broad winner statuses', () => {
  const ads = [ad('root', { status: 'Winner' }), ad('mild', { status: 'Mild Winner' }), ad('scale', { status: 'Scale' }), ad('child', { status: 'Winner', parent_ad_id: 'root', funnel_stage: 'MOF' }), ad('production', { parent_ad_id: 'root', meta: { taskType: 'production' } }), ad('dead-child', { parent_ad_id: 'root', deleted_at: 'now' })];
  const gaps = snapshot({ ads }).gaps;
  assert.ok(gaps.includes('root needs 3 more variations.'));
  assert.ok(gaps.includes('1 winner combo missing 1 funnel stage.'));
  assert.equal(gaps.filter((gap) => gap.includes('needs')).length, 1);
});

test('winner cells are unique and delimiter-safe, complete funnels and five children close gaps', () => {
  const ads = [ad('first', { status: 'Winner', angle: 'a||b', persona: 'c' }), ad('second', { status: 'Winner', angle: 'a', persona: 'b||c', funnel_stage: 'MOF' })];
  assert.ok(snapshot({ ads }).gaps.includes('2 winner combos missing 4 funnel stages.'));
  const complete = [ad('root', { status: 'Winner' }), ...Array.from({ length: 5 }, (_, index) => ad(`child-${index}`, { parent_ad_id: 'root', funnel_stage: index % 2 ? 'MOF' : 'BOF' }))];
  assert.equal(snapshot({ ads: complete }).gaps.some((gap) => gap.includes('needs') || gap.includes('winner combo')), false);
  complete.push(ad('missing', { status: 'Winner', angle: 'Different' }));
  assert.ok(snapshot({ ads: complete }).gaps.includes('1 winner combo missing 2 funnel stages.'));
});

test('empty or unassigned products never produce invalid percentages or foreign counts', () => {
  const data = snapshot();
  assert.equal(data.summary.winRate, 0);
  assert.ok(data.coverage.every((group) => group.percent === 0));
  assert.equal(commandHqSnapshot({ productId: '', ads: [ad('1')] }).summary.total, 0);
  assert.equal(snapshot({ ads: [ad('1', { status: 'Winner', angle: '' })] }).gaps.some((gap) => gap.includes('winner combo')), false);
});

test('angle not-started gaps follow stored status; inputs remain unchanged', () => {
  const inputs = { angles: [axis('Energy'), axis('Other', { status: 'Testing' })], ads: [ad('1', { status: 'Winner' })] };
  const before = structuredClone(inputs);
  assert.ok(snapshot(inputs).gaps.includes('1 angle not started.'));
  assert.deepEqual(inputs, before);
});

test('HQ metrics and seed catalogs agree with the audited legacy functions', () => {
  const html = readFileSync(new URL('../../immuvi-command-center.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).find((value) => value.includes('function process(ads)'));
  const source = ts.createSourceFile('legacy.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const process = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'process').getText(source);
  const constants = source.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]);
  const ads = ['Winner', 'Mild Winner', 'Scale', 'Testing', 'Untested', 'Ready to Launch', 'In Production', 'Complete'].map((status, index) => ad(`${index}`, { status }));
  // Only the pure summary function and literal arrays execute, never legacy startup.
  const sandbox = { ads: ads.map(normalizeCreativeRow), _isBoundaryQuarantinedAd: () => false };
  vm.runInNewContext(`${process}\nresult = process(ads);`, sandbox, { timeout: 1000 });
  const summary = snapshot({ ads }).summary;
  for (const field of ['total', 'winners', 'testing', 'ready', 'winRate']) assert.equal(summary[field], sandbox.result.s[field]);
  assert.equal(summary.untested, sandbox.result.s.notStarted);
  for (const [field, constant] of [['creativeStructure', 'CREATIVE_STRUCTURES'], ['hookType', 'HOOK_TYPES'], ['productionStyle', 'PRODUCTION_STYLES']]) {
    const literal = constants.find((node) => node.name.getText(source) === constant).initializer.getText(source);
    assert.deepEqual(HQ_FIELD_OPTIONS[field], JSON.parse(vm.runInNewContext(`JSON.stringify(${literal})`, {}, { timeout: 1000 })));
  }
});
