import test from 'node:test';
import assert from 'node:assert/strict';
import { projectInspirationLibrary, inspirationQueueStatus, inspirationMediaType, inspirationLink, filterInspirations, INSPIRATION_FILTERS } from '../../lib/domain/inspiration-library.js';
const row = { id: 'INS-1', product_id: 'qa', title: 'Source format', status: 'classified', url: 'https://example.test/ad', created_at: '2026-09-22T10:00:00Z', data: { angle: 'Energy', persona: 'Parents', adType: 'Video' } };
const project = (rows = [row], queue = [], ads = [], deleted = [], cells = []) => projectInspirationLibrary('qa', rows, queue, ads, deleted, cells);
test('library identity is canonical and foreign/deleted rows cannot enter the projection', () => {
  const rows = project([{ ...row, data: { ...row.data, id: 'spoof', product_id: 'foreign' } }, { ...row, product_id: 'foreign' }, { ...row, id: 'gone', deleted_at: 'now' }], [{ ins_id: 'gone', product_id: 'qa', status: 'pending' }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'INS-1'); assert.equal(rows[0].productId, 'qa');
  assert.equal(rows[0].formatName, 'Source format'); assert.equal(rows[0].status, 'Classified');
});
test('latest queue state overrides stale Queued labels and queue-only records remain visible', () => {
  const queues = [{ ins_id: 'INS-1', product_id: 'qa', status: 'failed', error_message: 'Decoder failed', queued_at: '2026-09-22' },
    { ins_id: 'INS-1', product_id: 'qa', status: 'pending', queued_at: '2026-09-21' }, { ins_id: 'ONLY', product_id: 'qa', status: 'blocked' },
    { ins_id: 'FOREIGN', product_id: 'foreign', status: 'pending' }];
  const rows = project([{ ...row, status: 'Queued' }], queues);
  assert.equal(rows.length, 2); assert.equal(rows[0].status, 'Failed'); assert.equal(rows[0].adType, ''); assert.equal(rows[0].queueError, 'Decoder failed');
  assert.equal(rows[1].status, 'Blocked'); assert.equal(rows[1].queueOnly, true);
  assert.equal(inspirationQueueStatus('Queued', { status: 'failed', worker_assignment: 'blocked:auto' }), 'Blocked');
  assert.equal(inspirationQueueStatus('Queued', { status: 'error', error_message: 'Agent infrastructure failure' }), 'Blocked');
  for (const [status, expected] of [['claimed', 'Classifying'], ['classifying', 'Classifying'], ['processing', 'Queued'], ['done', 'Classified'], ['error', 'Failed']])
    assert.equal(inspirationQueueStatus('Queued', { status }), expected);
});
test('usage counts only same-product live creatives and distinct cells', () => {
  const ad = { id: 'AD', product_id: 'qa', meta: { _fromInspoId: row.id }, status: 'Winner' };
  const rows = project([row], [], [ad, ad, { ...ad, id: 'LOSER', status: 'Loser' }, { ...ad, id: 'DELETED' }, { ...ad, id: 'REMOTE', clickup_task_id: 'deleted-task' }, { ...ad, id: 'SOFT', deleted_at: 'now' }, { ...ad, id: 'QUARANTINE', meta: { ...ad.meta, _productBoundaryQuarantined: true } }, { ...ad, id: 'FOREIGN', product_id: 'foreign' }],
    [{ product_id: 'qa', id: 'DELETED' }, { product_id: 'qa', clickup_task_id: 'deleted-task' }],
    [{ id: 'CELL', product_id: 'qa', creative_assignments: ['AD', 'LOSER'] }, { id: 'FOREIGN', product_id: 'foreign', creative_assignments: ['AD'] }]);
  assert.equal(rows[0].usage.length, 2); assert.equal(rows[0].cellCount, 1); assert.equal(rows[0].performance, 'mixed');
});
test('media evidence corrects inversion without guessing types while classification is pending', () => {
  assert.equal(inspirationMediaType({ adType: 'Video', mediaKind: 'image' }, 'Classified'), 'Photo');
  assert.equal(inspirationMediaType({ adType: 'Photo', is_video: true }, 'Classified'), 'Video');
  assert.equal(inspirationMediaType({ adType: 'Video', mediaKind: 'carousel' }, 'Classified'), 'Carousel');
  for (const status of ['Queued', 'Classifying', 'Failed', 'Blocked']) assert.equal(inspirationMediaType({ adType: 'Video' }, status), '');
  assert.equal(inspirationMediaType({}, 'Classified'), '');
});
test('filters compose, include identifiers in search, and sort stably without mutating records', () => {
  const rows = project([row, { ...row, id: 'INS-2', platform: 'Instagram', data: { ...row.data, _sourceProductId: 'other' } }]);
  assert.equal(filterInspirations(rows, { ...INSPIRATION_FILTERS, query: 'ins-2', source: 'imported', platform: 'Instagram' }).length, 1);
  assert.equal(filterInspirations(rows, { ...INSPIRATION_FILTERS, query: 'ins-2', source: 'original' }).length, 0);
  assert.deepEqual(filterInspirations(rows, INSPIRATION_FILTERS, { key: 'id', direction: -1 }).map((r) => r.id), ['INS-2', 'INS-1']);
  assert.equal(rows[0].id, 'INS-1');
});
test('brief text stays plain text and dangerous source/brief protocols are omitted', () => {
  const item = project([{ ...row, url: 'javascript:alert(1)', data: { bodyCopy: '<b>Literal</b><br>Line two', voiceOver: 'Voice over present - transcript unavailable', _clickupDocPageUrl: 'data:text/html,test' } }])[0];
  assert.equal(item.bodyCopy, '<b>Literal</b>\nLine two'); assert.equal(item.voiceOver, ''); assert.equal(item.sourceUrl, ''); assert.equal(item.briefUrl, '');
  assert.equal(inspirationLink('https://user:password@example.test'), '');
  assert.equal(inspirationLink('https://example.test/brief'), 'https://example.test/brief');
});
