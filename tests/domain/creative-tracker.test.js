import test from 'node:test';
import assert from 'node:assert/strict';

import {
  creativeFilterOptions,
  creativeMatchesDateRange,
  creativeStatusBucket,
  filterCreativeTrackerRows,
  isCreativeTrackerVisible,
  normalizeCreativeRow,
  sortCreativeTrackerRows,
  summarizeCreativeTracker,
  usageCountForCreative,
  variationCountForCreative,
} from '../../lib/domain/creative-tracker.js';

const nowMs = Date.parse('2026-08-31T12:00:00.000Z');

test('normalizeCreativeRow maps database and meta fields to tracker shape', () => {
  const creative = normalizeCreativeRow({
    id: 'AD-1',
    product_id: 'immuvi',
    format_name: 'AR-101',
    ad_link: 'https://example.com/ad',
    drive_link: 'https://drive.test/file',
    ad_type: 'UGC',
    funnel_stage: 'TOF',
    status: 'Testing',
    angle: 'Calm mornings',
    persona: 'Parents',
    parent_ad_id: null,
    ad_origin: 'New Find',
    clickup_task_id: 'cu-1',
    created_at: '2026-08-31T10:00:00.000Z',
    meta: {
      hookType: 'Problem first',
      creativeStructure: 'Demo',
      productionStyle: 'Founder UGC',
      taskType: 'production',
      sourceFormatId: 'AD-0',
    },
  });

  assert.equal(creative.id, 'AD-1');
  assert.equal(creative.clickupTaskId, 'cu-1');
  assert.equal(creative.hookType, 'Problem first');
  assert.equal(creative.creativeStructure, 'Demo');
  assert.equal(creative.productionStyle, 'Founder UGC');
  assert.equal(creative.taskType, 'production');
  assert.equal(creative.sourceFormatId, 'AD-0');
  assert.equal(creative.createdAt, Date.parse('2026-08-31T10:00:00.000Z'));
});

test('isCreativeTrackerVisible mirrors legacy skip rules', () => {
  assert.equal(isCreativeTrackerVisible({ id: 'AD-1' }), true);
  assert.equal(isCreativeTrackerVisible({ id: 'AD-1', deletedAt: '2026-08-01' }), false);
  assert.equal(isCreativeTrackerVisible({ id: 'AD-1', trackerRefId: 'cell-ref' }), false);
  assert.equal(isCreativeTrackerVisible({ id: 'AD-1', parentAdId: 'AD-0', adOrigin: 'New Find' }), false);
  assert.equal(isCreativeTrackerVisible({ id: 'AD-1', parentAdId: 'AD-0', adOrigin: 'Winner Variation' }), true);
});

test('filterCreativeTrackerRows applies legacy filters and task type toggle', () => {
  const rows = [
    { id: 'AD-1', angle: 'A', persona: 'P', adType: 'UGC', funnelStage: 'TOF', status: 'Testing', creativeStructure: 'Demo', hookType: 'Hook', productionStyle: 'Raw', taskType: '' },
    { id: 'AD-2', angle: 'A', persona: 'P', adType: 'Video', funnelStage: 'MOF', status: 'Winner', creativeStructure: 'Story', hookType: 'Open', productionStyle: 'Studio', taskType: 'production' },
  ];

  assert.deepEqual(filterCreativeTrackerRows(rows, { taskType: 'format' }).map((row) => row.id), ['AD-1']);
  assert.deepEqual(filterCreativeTrackerRows(rows, { taskType: 'production' }).map((row) => row.id), ['AD-2']);
  assert.deepEqual(filterCreativeTrackerRows(rows, { funnelStage: 'MOF', status: 'Winner' }).map((row) => row.id), ['AD-2']);
});

test('summarizeCreativeTracker counts visible statuses and task classes', () => {
  const summary = summarizeCreativeTracker([
    { id: 'AD-1', status: 'Winner', adLink: 'https://example.com' },
    { id: 'AD-2', status: 'Testing', taskType: 'production', _clickupUrl: 'https://clickup.test' },
    { id: 'AD-3', status: 'Ready to Launch', adOrigin: 'Winner Variation', parentAdId: 'AD-1' },
    { id: 'AD-4', status: 'Loser', trackerRefId: 'cell-ref' },
  ]);

  assert.deepEqual(summary, {
    total: 3,
    formats: 2,
    production: 1,
    winnerVariations: 1,
    winners: 1,
    testing: 1,
    ready: 1,
    missingLinks: 1,
  });
});

test('creativeFilterOptions returns sorted visible values only', () => {
  const options = creativeFilterOptions([
    { id: 'AD-1', angle: 'B', persona: 'P2', formatName: 'Fmt 2', status: 'Testing' },
    { id: 'AD-2', angle: 'A', persona: 'P1', formatName: 'Fmt 1', status: 'Winner' },
    { id: 'AD-3', angle: 'Z', deletedAt: '2026-08-01' },
  ]);

  assert.deepEqual(options.angles, ['A', 'B']);
  assert.deepEqual(options.personas, ['P1', 'P2']);
  assert.deepEqual(options.formats, ['Fmt 1', 'Fmt 2']);
  assert.deepEqual(options.statuses, ['Testing', 'Winner']);
});

test('variation and usage counts derive tracker context', () => {
  const rows = [
    { id: 'AD-1' },
    { id: 'AD-2', parentAdId: 'AD-1' },
    { id: 'AD-3', sourceFormatId: 'AD-1' },
  ];
  const cells = [{ creative_assignments: ['AD-1', 'AD-9'] }];

  assert.equal(variationCountForCreative(rows[0], rows), 1);
  assert.equal(usageCountForCreative(rows[0], rows, cells), 2);
});

test('sort and date helpers behave deterministically', () => {
  const rows = [
    { id: 'AD-2', formatName: 'Beta', dateCreated: Date.parse('2026-08-01T00:00:00.000Z') },
    { id: 'AD-1', formatName: 'Alpha', dateCreated: Date.parse('2026-08-31T00:00:00.000Z') },
  ];

  assert.deepEqual(sortCreativeTrackerRows(rows, { col: 'formatName', dir: 1 }).map((row) => row.id), ['AD-1', 'AD-2']);
  assert.equal(creativeMatchesDateRange(rows[1], 'today', nowMs), true);
  assert.equal(creativeMatchesDateRange(rows[0], 'today', nowMs), false);
  assert.equal(creativeStatusBucket('Mild Winner'), 'winner');
  assert.equal(creativeStatusBucket('In Production'), 'ready');
});
