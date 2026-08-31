import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isActiveQueueStatus,
  isClaimStale,
  normalizeQueueJob,
  normalizeWorker,
  summarizeQueue,
  workerHealth,
} from '../../lib/domain/worker-queue.js';

const nowMs = Date.parse('2026-08-31T10:00:00.000Z');

test('normalizeQueueJob maps database fields to UI fields', () => {
  assert.deepEqual(normalizeQueueJob({
    id: 'job-1',
    ins_id: 'IM-INS-001',
    product_id: 'immuvi',
    url: 'https://example.com/ad',
    platform: 'tiktok',
    status: 'classifying',
    error_message: 'retrying',
    queued_at: '2026-08-31T09:00:00.000Z',
    processed_at: null,
    claimed_by: 'worker-1',
    claimed_at: '2026-08-31T09:55:00.000Z',
    worker_assignment: 'auto',
    attempts: 2,
  }), {
    id: 'job-1',
    insId: 'IM-INS-001',
    productId: 'immuvi',
    url: 'https://example.com/ad',
    platform: 'tiktok',
    status: 'classifying',
    errorMessage: 'retrying',
    queuedAt: '2026-08-31T09:00:00.000Z',
    processedAt: '',
    claimedBy: 'worker-1',
    claimedAt: '2026-08-31T09:55:00.000Z',
    workerAssignment: 'auto',
    attempts: 2,
  });
});

test('summarizeQueue groups pending, active, classified, and failed jobs', () => {
  assert.deepEqual(summarizeQueue([
    { status: 'pending' },
    { status: 'claimed' },
    { status: 'classifying' },
    { status: 'processing' },
    { status: 'classified' },
    { status: 'failed' },
  ]), {
    total: 6,
    pending: 1,
    active: 3,
    classified: 1,
    failed: 1,
  });
});

test('workerHealth detects disabled, stale, busy, paused, and online workers', () => {
  assert.equal(workerHealth({ enabled: false, last_heartbeat: '2026-08-31T10:00:00.000Z' }, nowMs), 'disabled');
  assert.equal(workerHealth({ enabled: true, status: 'offline', last_heartbeat: '2026-08-31T10:00:00.000Z' }, nowMs), 'offline');
  assert.equal(workerHealth({ enabled: true, status: 'busy', last_heartbeat: '2026-08-31T09:59:00.000Z' }, nowMs), 'busy');
  assert.equal(workerHealth({ enabled: true, status: 'paused', last_heartbeat: '2026-08-31T09:59:00.000Z' }, nowMs), 'paused');
  assert.equal(workerHealth({ enabled: true, status: 'idle', last_heartbeat: '2026-08-31T09:55:00.000Z' }, nowMs), 'stale');
  assert.equal(workerHealth({ enabled: true, status: 'idle', last_heartbeat: '2026-08-31T09:59:00.000Z' }, nowMs), 'online');
});

test('normalizeWorker includes heartbeat age and normalized health', () => {
  const worker = normalizeWorker({
    worker_id: 'worker-1',
    hostname: 'qa-mac',
    status: 'idle',
    enabled: true,
    last_heartbeat: '2026-08-31T09:59:00.000Z',
    jobs_completed_total: 5,
    jobs_failed_total: 1,
    capabilities: { ffmpeg: true },
  }, nowMs);

  assert.equal(worker.workerId, 'worker-1');
  assert.equal(worker.heartbeatAgeMs, 60000);
  assert.equal(worker.health, 'online');
  assert.deepEqual(worker.capabilities, { ffmpeg: true });
});

test('isActiveQueueStatus and isClaimStale identify abandoned active claims', () => {
  assert.equal(isActiveQueueStatus('classifying'), true);
  assert.equal(isActiveQueueStatus('classified'), false);
  assert.equal(isClaimStale({ status: 'classifying', claimedAt: '2026-08-31T09:40:00.000Z' }, nowMs), true);
  assert.equal(isClaimStale({ status: 'pending', claimedAt: '2026-08-31T09:40:00.000Z' }, nowMs), false);
});
