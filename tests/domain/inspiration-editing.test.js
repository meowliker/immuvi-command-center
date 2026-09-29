import test from 'node:test';
import assert from 'node:assert/strict';
import { inspirationDraft, inspirationRequest, inspirationValues } from '../../lib/domain/inspiration-editing.js';
const row = { id:'INS-1',productId:'qa',version:'2026-09-22T00:00:00Z',queueSnapshot:{id:'job',status:'blocked'},usage:[{id:'B',version:'b'},{id:'A',version:'a'}],editFields:{formatName:'Old',notes:'Existing'} };
test('inspiration edits contain whitelisted deltas and retain queue/children snapshots', () => {
  const request = inspirationRequest('qa','save',row,{notes:''},{},'request');
  assert.deepEqual(request.p_values.fields,{notes:''});
  assert.deepEqual(request.p_values.children,[{id:'A',version:'a'},{id:'B',version:'b'}]);
  assert.deepEqual(request.p_values.queue,row.queueSnapshot);
  assert.equal(inspirationDraft(row).formatName,'Old');
  assert.deepEqual(row.usage.map((ad)=>ad.id),['B','A']);
});
test('inspiration edits reject foreign, unsaved, orphan and unsupported writes', () => {
  for (const invalid of [null,{...row,productId:'other'},{...row,version:null},{...row,queueOnly:true}]) assert.throws(()=>inspirationRequest('qa','save',invalid),/saved inspiration/);
  assert.throws(()=>inspirationRequest('qa','launch',row),/Unsupported/);
  for (const fields of [{_clickupDocPageUrl:''},{sourceUrl:'https://example.test'},{notes:null},{formatName:' '},{notes:'x'.repeat(20001)}]) assert.throws(()=>inspirationValues(fields));
});
test('inspiration intake validates URLs and infers platform only from the hostname', () => {
  for (const url of ['javascript:alert(1)','not a url','https://user:password@example.test']) assert.throws(()=>inspirationValues({sourceUrl:url},true));
  assert.equal(inspirationValues({sourceUrl:'https://www.instagram.com/p/123'},true).platform,'Instagram');
  assert.equal(inspirationValues({sourceUrl:'https://instagram.com.attacker.test/?facebook.com'},true).platform,'Other');
  assert.equal(inspirationValues({sourceUrl:'https://youtu.be/abc'},true).platform,'YouTube');
});
