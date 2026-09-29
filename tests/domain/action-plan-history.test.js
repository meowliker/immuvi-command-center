import test from 'node:test';
import assert from 'node:assert/strict';
import { planHistoryTimeline } from '../../lib/domain/action-plan-history.js';
test('history retains all legacy entries, metadata, old/new values and explicit source provenance', () => {
  const rows = [{ id: 'a', event_type: 'status_changed', field_name: 'status', old_value: 'Testing', new_value: 'Winner', actor: 'Reviewer', source: 'qa-next', created_at: '2026-09-16T12:00:00Z' }];
  const payload = { _history: Array.from({ length: 50 }, (_, i) => ({ ts: i + 1, type: 'tag_added', detail: 'production', by: 'Worker' })) };
  const before = structuredClone({ rows, payload }), timeline = planHistoryTimeline(rows, payload);
  assert.equal(timeline.length, 51); assert.equal(timeline[0].detail, 'status: Testing -> Winner');
  assert.equal(timeline.at(-1).source, 'Legacy history'); assert.deepEqual({ rows, payload }, before);
});
test('adoption/push milestones are gated accurately and do not duplicate known events', () => {
  assert.equal(planHistoryTimeline([], { _adoptedAt: 100, _origin: 'promoted' }).length, 0);
  assert.equal(planHistoryTimeline([], { _adoptedAt: 100, _origin: 'adopted', _pushedAt: 200 }).length, 2);
  const result = planHistoryTimeline([{ id: 'push', event_type: 'clickup_task_created', created_at: '2026-09-16' }], { _origin: 'adopted', _adoptedAt: 100, _pushedAt: 200, _history: [{ ts: 100, type: 'adopted' }] });
  assert.equal(result.length, 2); assert.equal(result.some((e) => e.id.startsWith('milestone:')), false);
});
test('malformed dates stay undated and text remains untrusted, including prototype-like names', () => {
  const result = planHistoryTimeline([], { _history: [null, false, {}, { type: 'constructor', ts: 1e100, detail: '<img src=x onerror=alert(1)>' }, { type: 'tag_added', ts: 100 }] });
  assert.equal(result.length, 2); assert.equal(result.at(-1).ts, null); assert.equal(result.at(-1).title, 'constructor');
  assert.equal(result.at(-1).detail, '<img src=x onerror=alert(1)>');
});
test('equal JavaScript timestamps retain database microsecond and ID ordering', () => {
  const rows = [{ id: 'z', event_type: 'created', created_at: '2026-09-16T12:00:00.123456Z' }, { id: 'a', event_type: 'created', created_at: '2026-09-16T12:00:00.123123Z' }];
  assert.deepEqual(planHistoryTimeline(rows).map((row) => row.id), ['event:z', 'event:a']);
});
