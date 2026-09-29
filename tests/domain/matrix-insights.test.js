import test from 'node:test';
import assert from 'node:assert/strict';
import { matrixInsights } from '../../lib/domain/matrix-insights.js';
import { normalizeCreativeRow } from '../../lib/domain/creative-tracker.js';
const now=Date.parse('2026-09-26T12:00:00Z');
const ad=(id,status,days=0,meta={},extra={})=>normalizeCreativeRow({id,product_id:'qa',status,created_at:new Date(now-days*86400000).toISOString(),updated_at:new Date(now).toISOString(),funnel_stage:'TOF',meta,...extra});
test('insights separate ready from production, count funnels/sources and use twelve rolling weeks',()=>{
  const result=matrixInsights([ad('a','Testing'),ad('b','Ready to Launch',8,{_fromInspoId:'INS-1'},{funnel_stage:'MOF'}),ad('c','In Production',15,{}, {clickup_task_id:'t',funnel_stage:'BOF'}),ad('d','Untested',84)],now);
  assert.deepEqual(result.counts,{winner:0,testing:1,prelaunch:1,ready:1,untested:1,loser:0});
  assert.deepEqual(result.sources,{app:2,clickup:1,inspo:1});
  assert.deepEqual(result.funnels,{TOF:2,MOF:1,BOF:1});
  assert.equal(result.cadence.length,12);assert.deepEqual(result.cadence.slice(-3),[1,1,1]);
  assert.equal(result.cadence.reduce((sum,n)=>sum+n,0),3);
  assert.equal(result.averageDays,null);
});
test('time-to-result is an estimate over resolved rows with usable timestamps only',()=>{
  const result=matrixInsights([ad('a','Winner',4),ad('b','Loser',8),ad('c','Testing',30),ad('d','Winner',0)],now);
  assert.equal(result.averageDays,6);
});
test('legacy opportunity rules and empty state do not invent results',()=>{
  assert.equal(matrixInsights([],now).total,0);assert.equal(matrixInsights([],now).callout,null);
  assert.equal(matrixInsights([ad('w','Winner')],now).callout.title,'Replication opportunity.');
  assert.equal(matrixInsights([ad('w','Winner'),ad('t','Testing'),ad('x','Untested')],now).callout.title,'Funnel gap.');
  assert.equal(matrixInsights([ad('l','Loser'),ad('l2','Loser')],now).callout.tone,'bad');
  assert.equal(matrixInsights([ad('t','Testing',15)],now).callout.title,'Stale pocket.');
  assert.equal(matrixInsights([ad('w','Winner'),ad('m','Testing',0,{}, {funnel_stage:'MOF'}),ad('b','Testing',0,{}, {funnel_stage:'BOF'})],now).callout.title,'Solid pocket.');
});
