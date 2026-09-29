import test from 'node:test';
import assert from 'node:assert/strict';
import { taxonomyRelationships, taxonomyWorkspace, taxonomyWorkspaceSummary } from '../../lib/domain/taxonomy-workspace.js';

const productId = 'qa';
const axis = (id, name, extra = {}) => ({ id, name, product_id: productId, ...extra });
const ad = (id, extra = {}) => ({ id, product_id: productId, angle: 'Energy', persona: 'Busy people', status: 'Winner', ...extra });
const snapshot = (input = {}) => taxonomyWorkspace({ productId, kind: 'angle', angles: [axis('a', 'Energy')], personas: [axis('p', 'Busy people')], ads: [ad('ad')], ...input });

test('taxonomy reads isolate products and suppress child, deleted, quarantined and tombstoned identities', () => {
  const result = snapshot({ angles: [axis('a', 'Energy'), axis('other', 'Foreign', { product_id: 'other' })],
    ads: [ad('live'), ad('foreign', { product_id: 'other' }), ad('child', { parent_ad_id: 'live' }), ad('deleted', { deleted_at: 'now' }),
      ad('quarantined', { meta: { _productBoundaryQuarantined: true } }), ad('alias', { clickup_task_id: 'remote' }), ad('other-tombstone')],
    tombstones: [axis('gone', '', { clickup_task_id: 'remote' }), axis('other-tombstone', '', { product_id: 'other' })] });
  assert.deepEqual(result.creatives.map((row) => row.id), ['live', 'other-tombstone']);
  assert.deepEqual(result.rows.map((row) => row.id), ['a']);
});

test('canonical relationships agree with stats without changing stored row names', () => {
  const data = snapshot({ ads: [ad('a', { angle: '1. energy', persona: 'BUSY PEOPLE' }), ad('b', { persona: '- Busy people', status: 'Scale' }), ad('c', { persona: '', status: 'Loser' })] });
  const relation = taxonomyRelationships('angle', data.rows[0], data.creatives, data.oppositeRows);
  assert.equal(relation.groups.length, 1);
  assert.equal(relation.groups[0].row.id, 'p');
  assert.equal(relation.groups[0].creatives.length, 2);
  assert.equal(relation.status, 'Winner');
  assert.deepEqual(relation.stats, { creatives: 3, relatedCount: 1, winners: 2, winRate: 67 });
  assert.equal(data.creatives[0].angle, '1. energy');
});

test('archived and missing catalog relationships remain inspectable and foreign metadata cannot leak', () => {
  const data = snapshot({ ads: [ad('a'), ad('b', { persona: 'Unknown' })], personas: [axis('p', 'Busy people', { archived_at: 'now', notes: 'Retained' }), axis('foreign', 'Unknown', { product_id: 'other', notes: 'secret' })] });
  const relation = taxonomyRelationships('angle', data.rows[0], data.creatives, data.oppositeRows);
  assert.equal(relation.groups[0].row.archivedAt, 'now');
  assert.equal(relation.groups[1].row, null);
  assert.equal(relation.groups[1].name, 'Unknown');
});

test('persona direction and unique total prevent alias rows from double-counting creatives', () => {
  const data = snapshot({ kind: 'persona', personas: [axis('p', 'Busy people'), axis('p2', 'busy people', { archived_at: 'now' })] });
  const relations = new Map(data.rows.map((row) => [row.id, taxonomyRelationships('persona', row, data.creatives, data.oppositeRows)]));
  assert.equal(relations.get('p').groups[0].name, 'Energy');
  assert.deepEqual(taxonomyWorkspaceSummary(data.rows, relations), { total: 2, active: 1, archived: 1, winners: 2, testing: 0, untested: 0, totalCreatives: 1 });
});

test('empty and unnamed axes do not manufacture relationships or mutate inputs', () => {
  const input = { angles: [axis('a', '')], ads: [ad('a', { angle: '' })] };
  const before = structuredClone(input);
  const data = snapshot(input);
  const relation = taxonomyRelationships('angle', data.rows[0], data.creatives, data.oppositeRows);
  assert.equal(relation.stats.creatives, 0);
  assert.equal(relation.status, 'Untested');
  assert.deepEqual(input, before);
});
