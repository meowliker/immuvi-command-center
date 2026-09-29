import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationRelativeDate, inspirationUsageCounts, INSPIRATION_OPTIONS } from '../../lib/domain/inspiration-table.js';
import { inspirationDraft,inspirationRequest } from '../../lib/domain/inspiration-editing.js';
test('relative dates handle missing, future and time boundaries',()=>{
  const now=1e12;
  assert.equal(inspirationRelativeDate(0,now),'-');assert.equal(inspirationRelativeDate(now+10000,now),'0s ago');
  for(const [age,expected] of [[59,'59s ago'],[60,'1m ago'],[3600,'1h ago'],[86400,'1d ago'],[604800,'1w ago']])assert.equal(inspirationRelativeDate(now-age*1000,now),expected);
});
test('usage segments retain existing legacy outcome grouping',()=>{
  assert.deepEqual(inspirationUsageCounts({usage:['Winner','Complete','Loser','Testing','Ready to Launch','Untested'].map((status)=>({status}))}),{winner:2,loser:1,testing:2,placed:1});
  assert.ok(INSPIRATION_OPTIONS.adType.includes('AI Style'));assert.ok(INSPIRATION_OPTIONS.hookType.includes('News / Trend'));
});
test('format detail drafts and requests preserve delimiters and cannot change protected fields',()=>{
  const row={id:'INS',productId:'qa',version:'v1',formatDetail:'One \u2014 Two',editFields:{formatName:'Name'}};
  assert.equal(inspirationDraft(row).formatDetail,'One \u2014 Two');
  assert.deepEqual(inspirationRequest('qa','save',row,{formatDetail:'  updated  '}).p_values.fields,{formatDetail:'updated'});
  assert.equal(inspirationRequest('qa','save',row,{formatDetail:''}).p_values.fields.formatDetail,'');
  assert.throws(()=>inspirationRequest('qa','save',row,{creativeUSP:'bypass'}),/Invalid/);
  assert.throws(()=>inspirationRequest('qa','create',null,{formatDetail:'unsupported'}),/Invalid/);
});
