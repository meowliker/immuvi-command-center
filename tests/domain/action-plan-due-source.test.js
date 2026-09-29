import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeActionAd, resolveActionDisplay, isActionOverdue } from '../../lib/domain/action-plan.js';

test('linked creative due dates override stale plan dates and timestamps', () => {
  const action={id:'task',adId:'AD-1',dueDate:'2026-01-01',_dueDateMs:1};
  const ad=normalizeActionAd({id:'AD-1',meta:{dueDate:'2026-12-01',_dueDateMs:Date.parse('2026-12-01T12:00:00Z')}});
  const display=resolveActionDisplay(action,[ad]);
  assert.equal(display.dueDate,'2026-12-01');assert.equal(display.dueAtMs,ad._dueDateMs);
  assert.equal(isActionOverdue(display,Date.parse('2026-11-01')),false);
});

test('an explicit linked date clear cannot resurrect the plan date', () => {
  const action={id:'task',adId:'AD-1',dueDate:'2026-01-01',_dueDateMs:1};
  for(const dueDate of ['',null]) {
    const display=resolveActionDisplay(action,[normalizeActionAd({id:'AD-1',meta:{dueDate,_dueDateMs:1}})]);
    assert.equal(display.dueDate,'');assert.equal(display.dueAtMs,null);
  }
});

test('missing linked date metadata and standalone tasks retain their plan date', () => {
  const action={id:'task',adId:'AD-1',dueDate:'2026-10-10'};
  for(const ads of [[],[normalizeActionAd({id:'AD-1',meta:{}})]]) {
    const display=resolveActionDisplay(action,ads);
    assert.equal(display.dueDate,action.dueDate);assert.ok(display.dueAtMs>0);
  }
});
