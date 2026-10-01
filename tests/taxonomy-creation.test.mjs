import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function load(context,name) {
    const start=html.indexOf('function '+name+'(');
    assert.ok(start>=0);
    const end=html.indexOf('\n}',start)+2;
    vm.runInContext((html.slice(start-6,start)==='async '?'async ':'')+html.slice(start,end),context);
  }
  test(file+': sync never creates taxonomy or changes creative evidence in any product',()=>{
    const c=vm.createContext({ANGLES:[{id:'a',name:'Existing'}],PERSONAS:[{id:'p',name:'Existing'}],ADS:[{id:'ad',angle:'New',persona:'New'}],CELL_CREATIVE_ASSIGNMENTS:{cell:['ad']},activeProductId:'one'});
    load(c,'autoDiscoverTaxonomy');
    for(const product of ['one','two','three']) {
      c.activeProductId=product;
      const before=JSON.stringify(c);
      assert.equal(JSON.stringify(c.autoDiscoverTaxonomy(c.ADS)),JSON.stringify({addedAngles:[],addedPersonas:[]}));
      assert.equal(JSON.stringify(c),before);
    }
  });
  test(file+': active taxonomy counts exclude archives without hiding creatives or actions',()=>{
    const els={};
    const c=vm.createContext({ANGLES:[{name:'A'},{name:'Archived',archivedAt:1}],PERSONAS:[{name:'P'},{name:'Old',archivedAt:1}],ADS:[{angle:'A',persona:'P'},{angle:'Archived',persona:'Old'},{angle:'New',persona:'New'}],MANUAL_ACTIONS:[{id:1}],document:{getElementById:id=>els[id]||=( {})},_isBoundaryQuarantinedAd:()=>false,_isBoundaryQuarantinedAction:()=>false,_isBoundaryQuarantinedTaxonomy:()=>false});
    load(c,'updateTabCounts');c.updateTabCounts();
    assert.equal(els.anglesCount.innerHTML,1);assert.equal(els.personasCount.innerHTML,1);
    assert.equal(els.matrixCount.innerHTML,'1/1');assert.equal(els.creativesCount.innerHTML,3);assert.equal(els.actionsCount.innerHTML,1);
  });
  for(const kind of ['Angle','Persona']) {
    test(file+': '+kind+' explicit restore confirms unapproved entries and preserves failed edits',async()=>{
      const row={id:'id',name:'New',archivedAt:123,creationApproved:false}, calls=[];
      let allowed=false,fail=false;
      const c=vm.createContext({ANGLES:[row],PERSONAS:[row],activeProductId:'product',confirm:()=>allowed,saveState(){},renderAngles(){},renderPersonas(){},updateTabCounts(){},toast(){},SB:{from:table=>({update:values=>{const call={table,values,filters:[]};calls.push(call);return {eq(k,v){call.filters.push([k,v]);return this;},then(resolve){resolve({error:fail?{message:'Offline'}:null});}};}})}});
      load(c,'unarchive'+kind);
      await c['unarchive'+kind](0);assert.equal(calls.length,0);assert.equal(row.archivedAt,123);
      allowed=true;fail=true;await c['unarchive'+kind](0);assert.equal(row.archivedAt,123);assert.equal(row.creationApproved,false);
      fail=false;await c['unarchive'+kind](0);assert.equal(row.archivedAt,null);assert.equal(row.creationApproved,true);
      assert.equal(calls.at(-1).values.creation_approved,true);
      assert.deepEqual(calls.at(-1).filters,[['id','id'],['product_id','product']]);
    });
  }
  test(file+': only explicit new rows carry creation approval in snapshot writes',()=>{
    assert.ok(html.includes('creation_approved: a._localNew === true && a._autoDiscovered !== true'));
    assert.ok(html.includes('creation_approved: p._localNew === true && p._autoDiscovered !== true'));
    assert.ok(html.includes('creationApproved: a.creation_approved !== false'));
    assert.ok(html.includes('creationApproved: p.creation_approved !== false'));
  });
}

test('database guard is additive, preserves stale-upsert archives and rejects product changes without retry loops',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261001000100_explicit_taxonomy_creation.sql',import.meta.url),'utf8');
  assert.match(sql,/NEW\.archived_at := existing\.archived_at/);
  assert.match(sql,/NEW\.creation_approved := existing\.creation_approved/);
  assert.match(sql,/SET DEFAULT false/);
  assert.match(sql,/RAISE SQLSTATE 'PT409'/);
  assert.doesNotMatch(sql,/40001|DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.(ads|inspirations|matrix_cells)/i);
});
