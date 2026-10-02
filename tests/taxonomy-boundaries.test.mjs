import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const load=(c,name)=>{
    const start=html.indexOf('function '+name+'(');
    assert.ok(start>=0,name);
    vm.runInContext((html.slice(start-6,start)==='async '?'async ':'')+html.slice(start,html.indexOf('\n}',start)+2),c);
  };
  test(file+': stale snapshot omissions cannot delete taxonomy',()=>{
    const c=vm.createContext({_readTaxonomyTombstone:(kind,product)=>product==='one'?{removed:123}:{}});
    load(c,'_explicitTaxonomyRemovals');
    const rows=[{id:'a',name:'Other tab added'},{id:'b',name:'Removed'},{id:'c',name:'Kept'}];
    assert.deepEqual(Array.from(c._explicitTaxonomyRemovals('angle','one',rows,new Set(['c']))),['b']);
    assert.deepEqual(Array.from(c._explicitTaxonomyRemovals('angle','two',rows,new Set())),[]);
    assert.doesNotMatch(html,/tasks.push\(SB.from\('(angles|personas)'\).delete\(\).in/);
  });
  test(file+': deletion RPC is product scoped, bounded and fails closed',async()=>{
    const calls=[];
    const c=vm.createContext({SB:{rpc:async(name,args)=>{calls.push({name,args});return {error:null};}}});
    load(c,'_deleteProductTaxonomy');
    const ids=Array.from({length:201},(_,i)=>'id'+i);
    await c._deleteProductTaxonomy('persona','one',ids);
    assert.equal(calls.length,3);
    assert.ok(calls.every(x=>x.name==='delete_product_taxonomy'&&x.args.p_product_id==='one'&&x.args.p_kind==='persona'&&x.args.p_ids.length<=100));
    c.SB.rpc=async()=>{throw new Error('Offline');};
    assert.match((await c._deleteProductTaxonomy('angle','one',['id'])).error.message,/Offline/);
  });
  test(file+': failed snapshot reads and product switches stop before all writes',async()=>{
    const start=html.indexOf('  async saveProductData(productId, state) {');
    const end=html.indexOf('  async listInspirations(',start);
    let fail=true,switchProduct=false;
    const c=vm.createContext({activeProductId:'one',_uiProductGeneration:1,SB:{from:()=>{
      const q={select(){return q;},eq(){return q;},is(){return q;},then(resolve){
        if(switchProduct)c.activeProductId='two';
        resolve({data:[],error:fail?{message:'offline'}:null});
      }};return q;
    }}});
    vm.runInContext('var dbTest={'+html.slice(start,end)+'};',c);
    const state={ANGLES:[{id:'keep'}],PERSONAS:[],ADS:[{id:'creative'}]};
    assert.equal((await c.dbTest.saveProductData('one',state)).ok,false);
    assert.equal(state.ANGLES.length,1);assert.equal(state.ADS.length,1);
    fail=false;switchProduct=true;
    assert.equal((await c.dbTest.saveProductData('one',state)).ok,false);
    assert.equal(state.ANGLES.length,1);assert.equal(state.ADS.length,1);
  });
  for(const kind of ['Angle','Persona']) test(file+': '+kind+' delete failure or product switch cannot clear current data',async()=>{
    const row={id:'id',name:'Name'}, ads=[{angle:'Name',persona:'Name'}], ins=[{angle:'Name',persona:'Name'}];
    const c=vm.createContext({ANGLES:[row],PERSONAS:[row],ADS:ads,INSPIRATIONS:ins,activeProductId:'one',_adsProductId:'one',_uiProductGeneration:1,_productSwitchPending:false,confirm:()=>true,toast(){},_rememberTaxonomyDeletion(){},_deleteProductTaxonomy:async()=>({error:{message:'Offline'}})});
    load(c,'delete'+kind);
    await c['delete'+kind](0);
    assert.equal(c.ANGLES.length,1);assert.equal(c.PERSONAS.length,1);
    assert.equal(ads[0].angle,'Name');assert.equal(ins[0].persona,'Name');
    c._deleteProductTaxonomy=async()=>{c.activeProductId='two';return {error:null};};
    await c['delete'+kind](0);
    assert.equal(c.ANGLES.length,1);assert.equal(c.PERSONAS.length,1);
    assert.equal(ads[0].angle,'Name');assert.equal(ins[0].persona,'Name');
  });
  test(file+': mapping confirmation cannot cross products or product generations',()=>{
    let callbacks=0;
    const c=vm.createContext({window:{_insMatchContext:{productId:'one',generation:1},_insMatchCallback:()=>callbacks++},activeProductId:'two',_inspirationsProductId:'two',_uiProductGeneration:1,_productSwitchPending:false,closeInsMatchModal(){},document:{querySelector:()=>({value:'custom'})}});
    for(const name of ['_insMatchContextIsCurrent','confirmInsMatch','skipInsMatch']) load(c,name);
    c.confirmInsMatch('Angle','New');c.skipInsMatch('Angle','New');assert.equal(callbacks,0);
    c.activeProductId='one';c._inspirationsProductId='one';c._uiProductGeneration=2;
    c.confirmInsMatch('Angle','New');assert.equal(callbacks,0);
    c._uiProductGeneration=1;c.confirmInsMatch('Angle','New');assert.equal(callbacks,1);
    assert.match(html,/value="custom" checked/);assert.doesNotMatch(html,/value="new" checked/);
  });
  test(file+': matrix assignment cannot manufacture missing categories',()=>{
    const c=vm.createContext({ANGLES:[{name:'A'}],PERSONAS:[],toast(){}});
    load(c,'assignAndExpandCell');c.assignAndExpandCell('A','Foreign');assert.equal(c.PERSONAS.length,0);
  });
  test(file+': explicit inspiration category creation has unique ID and local approval',()=>{
    const c=vm.createContext({_insMatchContextIsCurrent:()=>true,ANGLES:[],PERSONAS:[],ADS:[],_newTaxonomyId:kind=>kind+'-unique',process:()=>({}),renderAngles(){},renderPersonas(){},updateTabCounts(){},saveState(){},toast(){}});
    load(c,'addEntityFromInspiration');c.addEntityFromInspiration('Angle','New',{id:'INS-1'});
    assert.equal(c.ANGLES[0].id,'angle-unique');assert.equal(c.ANGLES[0]._localNew,true);
    c._insMatchContextIsCurrent=()=>false;c.addEntityFromInspiration('Persona','Other',{id:'INS-2'});assert.equal(c.PERSONAS.length,0);
  });
}
