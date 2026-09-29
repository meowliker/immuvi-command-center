import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACKER_BULK_FIELDS, trackerBulkSelection, trackerBulkValues } from '../../lib/domain/tracker-bulk-push.js';

test('bulk push uses exactly the six legacy fields and excludes empty placeholders', () => {
  const html = readFileSync(new URL('../../immuvi-command-center.html', import.meta.url), 'utf8');
  const legacy = html.slice(html.indexOf('function pushAllToClickUp()')).match(/var fields = \[([^\]]+)\]/)[1].match(/'[^']+'/g).map((field) => field.slice(1, -1));
  assert.deepEqual(TRACKER_BULK_FIELDS, legacy);
  assert.deepEqual(trackerBulkValues({ angle: 'Energy', persona: '\u2014', hookType: ' ', productionStyle: '', status: 'Winner', adLink: 'https://example.test' }), { angle: 'Energy' });
});
test('selection includes filtered-out and child creatives but skips unlinked, empty, foreign and blocked rows', () => {
  const base = { id: 'one', formatName: 'One', productId: 'qa', version: 'v1', clickupTaskId: 'task', angle: 'Energy' };
  const result = trackerBulkSelection([base, { ...base, id: 'child', parentAdId: 'one', clickupTaskId: 'child' },
    { ...base, clickupTaskId: '' }, { ...base, deletedAt: 'now' }, { ...base, productBoundaryQuarantined: true },
    { ...base, angle: '' }, { ...base, productId: 'foreign' }], 'qa');
  assert.deepEqual(result.items.map((item) => item.id), ['one', 'child']);
  assert.equal(result.skipped, 4);
  assert.throws(() => trackerBulkSelection([base, { ...base, id: 'duplicate' }], 'qa'), /duplicate link/);
  assert.throws(() => trackerBulkSelection([{ ...base, version: '' }], 'qa'), /saved version/);
});
