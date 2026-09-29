import test from 'node:test';
import assert from 'node:assert/strict';
import { planLink, planPresentation, planSourceLabel, resolvePlanMatrixCell } from '../../lib/domain/action-plan-presentation.js';

const action = (meta = {}) => ({ display: { productId: 'qa', status: 'Winner', source: { kind: 'tracker', label: 'Source', refUrl: 'javascript:alert(1)' } }, payload: {}, linkedAdMeta: meta });
test('reference links reject executable, relative and credential-bearing URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,Hi', '//example.test', '/api/delete', 'https://name:secret@example.test', {}, null]) assert.equal(planLink(value), '');
  assert.equal(planLink('https://example.test/brief'), 'https://example.test/brief');
});
test('verified winner brief is shown without replacing the inspiration source',()=>{
  const a=action({winnerBriefUrl:'https://app.clickup.com/9016762494/docs/8cq1r3y-44896/page',_sourceInspirationBriefUrl:'https://example.test/source'});
  assert.equal(planPresentation(a).briefUrl,'https://app.clickup.com/9016762494/docs/8cq1r3y-44896/page');
  assert.equal(a.linkedAdMeta._sourceInspirationBriefUrl,'https://example.test/source');
  a.linkedAdMeta.winnerBriefUrl='javascript:alert(1)';assert.equal(planPresentation(a).briefUrl,'https://example.test/source');
});
test('brief/ref provenance only resolves exact eligible IDs in the task product', () => {
  const a = action({ sourceFormatId: 'source', _fromTrackerAdId: 'ref', _fromInspoId: 'inspo' });
  const ads = [{ productId: 'other', id: 'source', briefUrl: 'https://wrong.test' }, { productId: 'qa', id: 'source', briefUrl: 'https://right.test' },
    { productId: 'qa', id: 'ref', clickupTaskId: 'task-id' }];
  assert.equal(planPresentation(a, ads).briefUrl, 'https://right.test/');
  assert.equal(planPresentation(a, ads).refUrl, 'https://app.clickup.com/t/task-id');
  assert.equal(planPresentation(a, ads).sourceUrl, '');
  const inspirations = [{ id: 'inspo', product_id: 'other', data: { _clickupDocPageUrl: 'https://wrong.test/doc' } },
    { id: 'inspo', product_id: 'qa', data: { _clickupDocPageUrl: 'https://right.test/doc' } }];
  assert.equal(planPresentation(a, ads, inspirations).briefUrl, 'https://right.test/doc');
  ads[1].deletedAt = '2026-09-22'; ads[2].deletedAt = '2026-09-22';
  assert.equal(planPresentation(a, ads).briefUrl, ''); assert.equal(planPresentation(a, ads).refUrl, '');
});
test('drawer reads strategy fields, approved dates and winner status', () => {
  const p = planPresentation(action({ creativeHypothesis: 'Hypothesis', creativeUSP: 'USP', productionStyle: 'UGC', notes: 'Line one\nLine two',
    _customFields: { 'approved date': '2026-09-16', 'hook type': 'Question' } }));
  assert.equal(p.hypothesis, 'Hypothesis'); assert.equal(p.usp, 'USP'); assert.equal(p.productionStyle, 'UGC');
  assert.equal(p.approvedDate, '2026-09-16'); assert.equal(p.hookType, 'Question'); assert.equal(p.notes, 'Line one\nLine two');
  assert.equal(p.winner, true);
  assert.equal(planPresentation({ ...action(), display: { ...action().display, status: 'Complete' } }).winner, false);
});
test('Origin uses the legacy single source title and links stay distinct and product-scoped', () => {
  const a = action({ _fromInspoId: 'i' });
  a.display.source = { kind: 'inspo', label: 'i', refUrl: '' };
  a.display.adLink = 'https://example.test/fallback';
  const inspirations = [{ id: 'i', product_id: 'other', title: 'Wrong product', url: 'https://wrong.test' },
    { id: 'i', product_id: 'qa', title: 'Original inspiration', url: 'https://example.test/ad', data: { _clickupDocPageUrl: 'https://example.test/brief' } }];
  const detail = planPresentation(a, [], inspirations);
  assert.equal(detail.originLabel, 'Original inspiration');
  assert.equal(detail.sourceUrl, 'https://example.test/brief');
  assert.equal(detail.adSourceUrl, 'https://example.test/ad');
  assert.equal(detail.briefUrl, 'https://example.test/brief');
  assert.equal(planPresentation(a, [], inspirations.slice(0, 1)).originLabel, 'i');
  assert.equal(planPresentation(a, [], inspirations.slice(0, 1)).adSourceUrl, 'https://example.test/fallback');
});
test('Drive column uses ClickUp data, respects cleared values, and rejects unsafe links', () => {
  const a = action();
  a.display.driveLink = 'https://drive.google.com/local';
  assert.equal(planPresentation(a).clickupDriveUrl, '');
  a.display.clickupTaskId = 'task';
  assert.equal(planPresentation(a).clickupDriveUrl, 'https://drive.google.com/local');
  a.linkedAdMeta._customFields = { 'drive link': 'https://drive.google.com/remote' };
  assert.equal(planPresentation(a).clickupDriveUrl, 'https://drive.google.com/remote');
  for (const value of ['', null, 'javascript:alert(1)', 'https://user:secret@example.test']) {
    a.linkedAdMeta._customFields['drive link'] = value;
    assert.equal(planPresentation(a).clickupDriveUrl, '');
  }
});
test('canonical clears do not resurrect stale mirrored strategy fields', () => {
  const a = action({ notes: '', hookType: '', creativeHypothesis: '' });
  a.payload = { notes: 'Old notes', hookType: 'Old hook', creativeHypothesis: 'Old hypothesis' };
  a.display.hookType = 'Stale custom field';
  const p = planPresentation(a);
  assert.equal(p.notes, ''); assert.equal(p.hookType, ''); assert.equal(p.hypothesis, '');
});
test('virtual plan rows preserve the creative source instead of relabeling it adopted', () => {
  const a = action(); a.display.isVirtual = true;
  assert.deepEqual(planSourceLabel(a), { kind: 'tracker', label: 'From Tracker' });
  a.display.source.kind = 'inspo';
  assert.deepEqual(planSourceLabel(a), { kind: 'inspo', label: 'From Inspiration' });
  a.display.source.kind = 'manual';
  assert.deepEqual(planSourceLabel(a), { kind: 'manual', label: 'Manual entry' });
});
test('matrix jump rejects missing, archived and ambiguous cells without fuzzy matching', () => {
  const target = { angle: 'Energy', persona: 'Busy people' }, angles = [{ id: 'a', name: 'Energy' }], personas = [{ id: 'p', name: 'Busy people' }];
  assert.deepEqual(resolvePlanMatrixCell(target, angles, personas), { angleId: 'a', personaId: 'p' });
  assert.equal(resolvePlanMatrixCell({ ...target, angle: 'Energy boost' }, angles, personas), null);
  assert.equal(resolvePlanMatrixCell(target, [...angles, { id: 'duplicate', name: 'Energy' }], personas), null);
  assert.equal(resolvePlanMatrixCell(target, [{ ...angles[0], archivedAt: '2026-09-22' }], personas), null);
});
