import test from 'node:test';
import assert from 'node:assert/strict';
import { commandHqHealth, verifyClickUpSyncSummary, verifyClickUpConnection } from '../../lib/domain/command-hq-health.js';
import { QA_CLICKUP_LIST_ID } from '../../lib/domain/clickup-sync.js';
const now = Date.parse('2026-09-24T12:00:00Z');
const product = (config = {}) => ({ id: 'qa', config: { clickup_list_id: QA_CLICKUP_LIST_ID, ...config } });

test('HQ health distinguishes blocked, unlinked, missing key, never synced, busy and failed states', () => {
  assert.equal(commandHqHealth(product({ clickup_list_id: '' })).state, 'Not linked');
  assert.equal(commandHqHealth(product({ clickup_list_id: 'production-list' }), { hasKey: true }).canSync, false);
  assert.equal(commandHqHealth(product({ clickup_list_id: 'production-list' }), { hasKey: true }).state, 'Blocked list');
  assert.equal(commandHqHealth(product()).state, 'Session key required');
  assert.equal(commandHqHealth(product(), { hasKey: true }).state, 'Not synced');
  assert.equal(commandHqHealth(product(), { hasKey: true, busy: 'sync' }).state, 'Syncing');
  assert.equal(commandHqHealth(product(), { hasKey: true, busy: 'link' }).canSync, false);
  assert.equal(commandHqHealth(product(), { hasKey: true, error: 'Outage' }).state, 'Needs attention');
});

test('saved sync time and zero count are distinct from missing, invalid and future metadata', () => {
  const health = commandHqHealth(product({ last_synced_at_ms: String(now - 1000), last_synced_count: 0 }), { hasKey: true, now });
  assert.equal(health.state, 'Connected'); assert.equal(health.taskCount, 0); assert.equal(health.syncedAt, now - 1000);
  for (const time of [null, '', 0, -1, true, 'nonsense', now + 600_000]) assert.equal(commandHqHealth(product({ last_synced_at_ms: time }), { now }).syncedAt, null);
  for (const count of [null, '', true, -1, 2.5, 'nonsense']) assert.equal(commandHqHealth(product({ last_synced_at_ms: now, last_synced_count: count }), { now }).taskCount, null);
});

test('field mapping counts respect linked destination and known fields', () => {
  const mapping = { list_id: QA_CLICKUP_LIST_ID, mappings: { angle: 'field-a', persona: '', hookType: 'field-h', unknown: 'field-x' } };
  assert.equal(commandHqHealth(product({ clickup_sync: mapping })).mappedFields, 2);
  assert.equal(commandHqHealth(product({ clickup_sync: { ...mapping, list_id: 'other' } })).mappedFields, 0);
  assert.equal(commandHqHealth({ config: JSON.stringify(product({ clickup_sync: mapping }).config) }).mappedFields, 2);
});

test('sync receipts reject missing, negative, noninteger and impossible counts without rejecting unchanged tasks', () => {
  assert.equal(verifyClickUpSyncSummary({ fetched: 3, imported: 1, updated: 1, skipped: 0 }), '3 tasks checked: 1 imported, 1 updated, 0 skipped.');
  assert.equal(verifyClickUpSyncSummary({ fetched: 0, imported: 0, updated: 0, skipped: 0 }), '0 tasks checked: 0 imported, 0 updated, 0 skipped.');
  for (const value of [null, {}, { fetched: 1, imported: 1, updated: 1, skipped: 0 }, { fetched: 3, imported: -1, updated: 0, skipped: 0 }, { fetched: 3, imported: '1', updated: 0, skipped: 0 }, { fetched: 3, imported: 0.5, updated: 0, skipped: 0 }]) assert.throws(() => verifyClickUpSyncSummary(value), /could not be verified/);
});

test('connection receipts require test destination, field schema, timestamp and verified mappings', () => {
  const value = { list: { id: QA_CLICKUP_LIST_ID, name: 'QA' }, fields: [{ id: 'a', name: 'Angle', type: 'short_text' }], mappings: { angle: 'a' }, productUpdatedAt: new Date(now).toISOString() };
  assert.equal(verifyClickUpConnection(value, QA_CLICKUP_LIST_ID, { angle: 'a' }), value);
  for (const invalid of [null, {}, { ...value, fields: null }, { ...value, fields: [null] }, { ...value, productUpdatedAt: '' }, { ...value, list: { id: 'other', name: 'Other' } }, { ...value, mappings: [] }, { ...value, mappings: { angle: 'missing' } }]) assert.throws(() => verifyClickUpConnection(invalid, QA_CLICKUP_LIST_ID));
  assert.throws(() => verifyClickUpConnection(value, QA_CLICKUP_LIST_ID, { angle: '' }), /Saved ClickUp mappings/);
});

test('connection option payloads and duplicate field identities cannot enter the mapping UI', () => {
  const field = { id: 'a', name: 'Angle', type: 'drop_down' };
  const value = { list: { id: QA_CLICKUP_LIST_ID, name: 'QA' }, fields: [field], mappings: { angle: 'a' }, productUpdatedAt: new Date(now).toISOString() };
  for (const options of ['bad', {}, [null], [3], [{ name: {} }], [{ label: ['bad'] }]]) {
    assert.throws(() => verifyClickUpConnection({ ...value, fields: [{ ...field, type_config: { options } }] }, QA_CLICKUP_LIST_ID), /could not be verified/);
  }
  assert.throws(() => verifyClickUpConnection({ ...value, fields: [field, field] }, QA_CLICKUP_LIST_ID), /could not be verified/);
  assert.equal(verifyClickUpConnection({ ...value, fields: [{ ...field, type_config: { options: [{ name: 'Energy' }] } }] }, QA_CLICKUP_LIST_ID).fields.length, 1);
});
