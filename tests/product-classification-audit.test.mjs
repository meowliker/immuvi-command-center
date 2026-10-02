import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClassificationAudit} from '../scripts/product-classification-audit.mjs';

const fixture = () => ({
  products:[{id:'p', name:'Product'}],
  angles:[{id:'a',product_id:'p',name:'Love',archived_at:null}],
  personas:[{id:'p1',product_id:'p',name:'Singles',archived_at:null}],
  inspirations:[{id:'I1',product_id:'p',url:'source',data:{angle:'Foreign angle',persona:'Foreign persona'}}],
  ads:[{id:'A1',product_id:'p',angle:'Love',persona:'Singles',ad_link:'source',meta:{}},
    {id:'A2',product_id:'p',angle:'Love',persona:'Singles',parent_ad_id:'A1',meta:{}},
    {id:'D',product_id:'p',deleted_at:'date',meta:{}}]
});

test('audit preserves inputs and inventories every non-deleted creative', () => {
  const input=fixture(), before=structuredClone(input);
  const audit=buildClassificationAudit(input,'p');
  assert.deepEqual(input,before);
  assert.equal(audit.records.length,2);
  assert.equal(audit.summary.preservedDeletedRecords,1);
  assert.deepEqual(audit.records.map(row=>row.id),['A1','A2']);
});
test('foreign product records fail closed across every table', () => {
  for(const table of Object.keys(fixture())) {
    const input=fixture();
    input[table][0][table==='products'?'id':'product_id']='other';
    assert.throws(()=>buildClassificationAudit(input,'p'),/Foreign product/);
  }
});
test('inspiration evidence does not replace classification and variations do not inherit evidence', () => {
  const audit=buildClassificationAudit(fixture(),'p');
  assert.deepEqual(audit.records[0].inspirationIds,['I1']);
  assert.equal(audit.records[0].angle,'Love');
  assert.equal(audit.records[0].persona,'Singles');
  assert.deepEqual(audit.records[1].inspirationIds,[]);
  assert.equal(audit.records[1].reviewStatus,'awaiting_evidence_review');
  assert.ok(audit.records[1].flags.includes('variation_requires_independent_review'));
});
test('duplicate detection is exact normalization, not a semantic merge', () => {
  const input=fixture();
  input.personas.push({id:'p2',product_id:'p',name:'SINGLES'});
  input.personas.push({id:'p3',product_id:'p',name:'Singles Seeking Marriage'});
  input.personas.push({id:'p4',product_id:'p',name:'Singles',archived_at:'date'});
  const audit=buildClassificationAudit(input,'p');
  assert.deepEqual(audit.duplicateNames.personas[0].map(row=>row.id),['p1','p2']);
  assert.equal(audit.duplicateNames.personas.length,1);
});
