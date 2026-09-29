import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationText,reloadState,syncAge} from '../../lib/domain/workspace-header.js';

test('routine ClickUp refresh summaries are not notifications; errors remain visible', () => {
  assert.equal(notificationText('1 Tasks checked: 0 imported, 0 updated, 0 skipped.'), '');
  assert.equal(notificationText('20 Tasks checked: 1 imported, 2 updated, 3 skipped.'), '');
  assert.equal(notificationText('ClickUp sync failed. Retry.'), 'ClickUp sync failed. Retry.');
});
test('reload reads reject malformed time and markers',()=>{
  assert.throws(()=>reloadState(null));assert.throws(()=>reloadState({serverNow:'invalid'}));
  assert.throws(()=>reloadState({serverNow:'2026-09-28',latest:{id:'1',triggered_at:'bad'}}));
  assert.equal(reloadState({serverNow:'2026-09-28',latest:null}).latest,null);
});
test('notifications redact credentials and bound message size',()=>{
  assert.equal(notificationText('Key pk_secret123 Bearer eySecret'),'Key [hidden key] Bearer [hidden]');
  assert.equal(notificationText('a'.repeat(2000)).length,1200);
});
test('sync labels distinguish never synced and elapsed time',()=>{
  assert.equal(syncAge(0,10000),'Not synced');assert.equal(syncAge(9000,10000),'just now');assert.equal(syncAge(1000,62000),'1m ago');
});
