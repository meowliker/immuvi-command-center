import test from 'node:test';
import assert from 'node:assert/strict';

import {
  actionPlanBucket,
  findLinkedAd,
  isActionOverdue,
  isFinalActionStatus,
  normalizeActionAd,
  normalizeManualActionRow,
  resolveActionDisplay,
  summarizeActionPlan,
  timestampMs,
} from '../../lib/domain/action-plan.js';

test('normalizeManualActionRow merges payload with database identity and live status', () => {
  const action = normalizeManualActionRow({
    id: 'ma-1',
    product_id: 'immuvi',
    payload: {
      id: 'local-1',
      title: 'Build UGC variation',
      liveStatus: 'Approved',
      _clickupTaskDeleted: true,
    },
    live_status: 'Testing',
    updated_at: '2026-08-31T10:00:00.000Z',
  });

  assert.equal(action.id, 'local-1');
  assert.equal(action._dbId, 'ma-1');
  assert.equal(action.productId, 'immuvi');
  assert.equal(action.liveStatus, 'Testing');
  assert.equal(action.clickupTaskDeleted, true);
  assert.equal(action.updatedAt, '2026-08-31T10:00:00.000Z');
});

test('normalizeActionAd folds meta fields back into the ad view shape', () => {
  const ad = normalizeActionAd({
    id: 'AD-1',
    product_id: 'immuvi',
    format_name: 'AR-101',
    ad_link: 'https://example.com/ad',
    drive_link: 'https://drive.test/file',
    ad_type: 'UGC',
    funnel_stage: 'MOF',
    status: 'Winner',
    angle: 'Calm mornings',
    persona: 'Parents',
    clickup_task_id: '86abc',
    created_at: '2026-08-31T10:00:00.000Z',
    meta: {
      dueDate: '2026-09-03',
      hookType: 'Problem first',
      creativeStructure: 'Demo',
      _fromInspoId: 'INS-008',
    },
  });

  assert.equal(ad.id, 'AD-1');
  assert.equal(ad.clickupTaskId, '86abc');
  assert.equal(ad.dueDate, '2026-09-03');
  assert.equal(ad.hookType, 'Problem first');
  assert.equal(ad._fromInspoId, 'INS-008');
  assert.equal(ad.createdAt, Date.parse('2026-08-31T10:00:00.000Z'));
});

test('findLinkedAd prefers source ad id and falls back to ClickUp id', () => {
  const ads = [
    { id: 'AD-1', clickupTaskId: 'cu-1' },
    { id: 'AD-2', clickupTaskId: 'cu-2' },
  ];

  assert.equal(findLinkedAd({ sourceAdId: 'AD-2', _clickupId: 'cu-1' }, ads).id, 'AD-2');
  assert.equal(findLinkedAd({ _clickupId: 'cu-1' }, ads).id, 'AD-1');
});

test('resolveActionDisplay prefers live ad status over action snapshot', () => {
  const display = resolveActionDisplay({
    id: 'ma-local',
    _dbId: 'ma-1',
    title: 'Old title',
    sourceAdId: 'AD-1',
    sourceAngle: 'Anxiety relief',
    sourcePersona: 'Teachers',
    liveStatus: 'Approved',
  }, [
    {
      id: 'AD-1',
      formatName: 'AR-101',
      status: 'In Production',
      clickupTaskId: 'cu-1',
      dueDate: '2026-09-02',
      adType: 'UGC',
    },
  ]);

  assert.equal(display.title, 'AR-101');
  assert.equal(display.status, 'In Production');
  assert.equal(display.clickupUrl, 'https://app.clickup.com/t/cu-1');
  assert.equal(display.angle, 'Anxiety relief');
  assert.equal(display.persona, 'Teachers');
});

test('summarizeActionPlan groups statuses and overdue rows', () => {
  const nowMs = Date.parse('2026-08-31T12:00:00.000Z');
  const rows = [
    { status: 'Untested', dueDate: '2026-08-30' },
    { status: 'In Production', dueDate: '2026-08-31' },
    { status: 'Testing', dueDate: '2026-09-01' },
    { status: 'Winner', dueDate: '2026-08-01' },
    { status: 'Loser', dueDate: '2026-08-01' },
  ].map((row) => ({ ...row, dueAtMs: timestampMs(`${row.dueDate}T23:59:59`) }));

  assert.deepEqual(summarizeActionPlan(rows, nowMs), {
    total: 5,
    backlog: 1,
    production: 1,
    testing: 1,
    winners: 1,
    losers: 1,
    overdue: 1,
  });
  assert.equal(isActionOverdue(rows[0], nowMs), true);
  assert.equal(isActionOverdue(rows[3], nowMs), false);
});

test('status bucket helpers classify final and active statuses', () => {
  assert.equal(actionPlanBucket('Ready to Launch'), 'production');
  assert.equal(actionPlanBucket('Mild Winner'), 'winners');
  assert.equal(actionPlanBucket('Killed'), 'losers');
  assert.equal(isFinalActionStatus('Complete'), true);
  assert.equal(isFinalActionStatus('Testing'), false);
});
