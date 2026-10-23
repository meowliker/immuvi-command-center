import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  function setup() {
    const confirmations=[];
    const context = vm.createContext({
      ANGLES: [{id:'a',name:'Existing'}, {id:'old',name:'Archived angle',archivedAt:1}],
      PERSONAS: [{id:'p',name:'Baby cloth Quilters'}, {id:'old-p',name:'Archived persona',archivedAt:1}],
      activeProductId:'quilting',
      _inspirationsProductId:'quilting',_productSwitchPending:false,
      confirmations,confirm(message) {confirmations.push(message);return true;},
      _isBoundaryQuarantinedTaxonomy:(_, name) => name === 'Foreign',
      _isTaxonomyTombstoned:(_, __, name) => name === 'Deleted',
      _forgetTaxonomyDeletion() {},
      _canonicalTaxonomyName(name, list) {return list.find(row => row.name.toLowerCase() === name.toLowerCase())?.name || name;},
      toast() {}, esc:String, escAttr:String,
    });
    for (const name of ['_normalizeTaxonomyName','_taxonomyLookupKey','_newTaxonomyId','_ensureTaxonomyItem','_taxonomyItemIsActive','_activeTaxonomyItems','_inspirationTaxonomyOptions','_prepareInspirationCell']) {
      const start = html.indexOf('function ' + name + '(');
      assert.ok(start >= 0, name);
      vm.runInContext(html.slice(start, html.indexOf('\n}', start) + 2), context);
    }
    return context;
  }

  test(file + ': confirmed placement creates only the missing category and reuses its canonical name', () => {
    const c = setup();
    const ins = {id:'Q-INS-064',angle:'Preserve baby-clothes memories',persona:'Baby cloth Quilters',_angleScope:'inspiration'};
    assert.equal(c._ensureTaxonomyItem('angle',ins.angle,'Implicit'), '');
    const cell = c._prepareInspirationCell(ins, ins.angle, ins.persona);
    assert.equal(cell.angle, ins.angle);
    assert.equal(ins._angleScope, 'product');
    assert.equal(c.ANGLES.at(-1)._localNew, true);
    assert.equal(c._taxonomyItemIsActive('angle', cell.angle, false), true);
    c._prepareInspirationCell(ins, ins.angle.toUpperCase(), ins.persona);
    assert.equal(c.ANGLES.length, 3);
    assert.equal(c.PERSONAS.length, 2);
    assert.equal(c.confirmations.length,1);
    assert.match(c.confirmations[0],/quilting/);
    assert.match(c.confirmations[0],/angle: Preserve baby-clothes memories/);
    assert.doesNotMatch(c.confirmations[0],/persona:/);
    assert.match(c.ANGLES.at(-1).notes,/^Manually approved from inspiration/);
  });

  test(file + ': explicit placement approves exactly the requested categories in each product', () => {
    for (const product of ['astro-rekha','quilting','other-product']) {
      const c = setup();c.activeProductId=product;
      const ins={id:'TEST-INS-1',angle:'New angle',persona:'New persona',_angleScope:'inspiration',_personaScope:'inspiration'};
      assert.ok(c._prepareInspirationCell(ins,ins.angle,ins.persona));
      assert.equal(c.ANGLES.length,3);assert.equal(c.PERSONAS.length,3);
      assert.equal(c.confirmations.length,1);assert.ok(c.confirmations[0].includes(product));
      assert.match(c.confirmations[0],/angle: New angle\npersona: New persona/);
      assert.equal(ins._angleScope,'product');assert.equal(ins._personaScope,'product');
      assert.equal(c.ANGLES[1].archivedAt,1);assert.equal(c.PERSONAS[1].archivedAt,1);
    }
  });

  test(file + ': inline custom Add remains explicit while unknown selection cannot promote taxonomy', () => {
    const c=setup();c.INSPIRATIONS=[{id:'i',persona:'Baby cloth Quilters'}];c._insSaveTs=0;
    let saves=0;c.saveState=()=>saves++;c.saveInspirations=()=>{};c.renderInspirations=()=>{};c.prompt=()=> 'Explicit new persona';
    const start=html.indexOf('function updateInsField(');vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    c.updateInsField('i','persona','Implicit unknown');assert.equal(c.PERSONAS.length,2);assert.equal(saves,0);
    c.updateInsField('i','persona','__custom__');assert.equal(c.PERSONAS.length,3);assert.equal(saves,1);
    assert.equal(c.PERSONAS.at(-1).name,'Explicit new persona');assert.equal(c.PERSONAS.at(-1)._localNew,true);
  });

  test(file + ': retag cannot create a missing category or partially alter the creative', () => {
    const c=setup();c.ADS=[{id:'winner',angle:'Existing',persona:'Baby cloth Quilters',status:'Winner'}];
    c._mxv4={taxonomyDrafts:{winner:{angle:'Existing',persona:'Unknown persona'}}};
    const start=html.indexOf('function saveMxv4CreativeTaxonomy(');vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    const before=JSON.stringify([c.ADS,c.ANGLES,c.PERSONAS]);c.saveMxv4CreativeTaxonomy('winner','Existing','Baby cloth Quilters');
    assert.equal(JSON.stringify([c.ADS,c.ANGLES,c.PERSONAS]),before);
  });

  test(file + ': existing category placement needs no new-category confirmation', () => {
    const c=setup();c.confirm=()=>{throw Error('Existing categories must not prompt');};
    const ins={id:'TEST-INS-1',angle:'Existing',persona:'Baby cloth Quilters'};
    assert.ok(c._prepareInspirationCell(ins,ins.angle,ins.persona));
    assert.equal(c.ANGLES.length,2);assert.equal(c.PERSONAS.length,2);
  });

  test(file + ': cancelled category approval stops creative placement before any save or assignment', () => {
    const c=setup();c.confirm=()=>false;
    c.INSPIRATIONS=[{id:'TEST-INS-1',angle:'New angle',persona:'New persona',status:'Classified'}];
    c.ADS=[{id:'kept',persona:'Baby cloth Quilters'}];c.CELL_CREATIVE_ASSIGNMENTS={kept:['kept']};
    c.saveState=()=>{throw Error('Cancelled placement must not save');};
    const start=html.indexOf('function addInspoToCell(');
    vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    const before=JSON.stringify([c.ANGLES,c.PERSONAS,c.INSPIRATIONS,c.ADS,c.CELL_CREATIVE_ASSIGNMENTS]);
    c.addInspoToCell('TEST-INS-1','New angle','New persona');
    assert.equal(JSON.stringify([c.ANGLES,c.PERSONAS,c.INSPIRATIONS,c.ADS,c.CELL_CREATIVE_ASSIGNMENTS]),before);
  });

  test(file + ': a product change during confirmation prevents all category mutations', () => {
    const c=setup();c.confirm=()=>{c.activeProductId='another';return true;};
    const ins={id:'TEST-INS-1',angle:'New angle',persona:'New persona'};
    assert.equal(c._prepareInspirationCell(ins,ins.angle,ins.persona),null);
    assert.equal(c.ANGLES.length,2);assert.equal(c.PERSONAS.length,2);
    assert.equal(ins._angleScope,undefined);assert.equal(ins._personaScope,undefined);
  });

  test(file + ': invalid or archived placement cannot partially create categories', () => {
    for (const persona of ['Archived persona', 'Deleted', 'Foreign', '', 'Invalid||cell']) {
      const c = setup();
      const ins = {id:'i',angle:'New angle',persona};
      const before = JSON.stringify([c.ANGLES,c.PERSONAS,ins]);
      assert.equal(c._prepareInspirationCell(ins, ins.angle, persona), null);
      assert.equal(JSON.stringify([c.ANGLES,c.PERSONAS,ins]), before);
    }
  });

  test(file + ': placement refuses stale product arrays before any mutation', () => {
    for(const pending of [false,true]) {
      const c=setup();c._productSwitchPending=pending;c._inspirationsProductId=pending?'quilting':'another';
      c.INSPIRATIONS=[{id:'i',angle:'Existing',persona:'Baby cloth Quilters'}];
      const start=html.indexOf('function addInspoToCell(');
      vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
      assert.equal(c.addInspoToCell('i','Existing','Baby cloth Quilters'),null);
      assert.equal(c.confirmations.length,0);
    }
  });

  test(file + ': drawer never reports success or refreshes usage after rejected placement', () => {
    const calls=[];
    const c=vm.createContext({window:{},_findIns:()=>({angle:'New angle',persona:'New persona'}),addInspoToCell:()=>null,
      toast:(...args)=>calls.push(args),setTimeout:()=>{throw Error('Rejected placement cannot update usage');},
      document:{getElementById:()=>({value:'Selected'})}});
    for(const name of ['_insPlaceSuggested','_insPlaceCustom']) {
      const start=html.indexOf('window.'+name+' = function');
      vm.runInContext(html.slice(start,html.indexOf('\n  };',start)+5),c);
      c.window[name]('i');
    }
    assert.deepEqual(calls,[]);
  });

  test(file + ': cancelled placement resets the picker checkbox without removing a task', () => {
    const c=vm.createContext({addInspoToCell:()=>null,removeInspoFromCell:()=>{throw Error('Must not delete');}});
    const start=html.indexOf('function toggleInspoInCell(');
    vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    const checkbox={checked:true,style:{}};
    c.toggleInspoInCell(checkbox,'i','New angle','New persona');
    assert.equal(checkbox.checked,false);assert.equal(checkbox.style.accentColor,'');
  });

  test(file + ': confirmed photo placement preserves brief and type and is idempotent in the same cell', () => {
    const c=setup();const writes=[];
    c.INSPIRATIONS=[{id:'i',angle:'New angle',persona:'New persona',adType:'Photo',status:'Classified',_clickupDocPageUrl:'https://example.test/existing-brief'}];
    c.ADS=[];c.CELL_CREATIVE_ASSIGNMENTS={};c.P={};
    c.generateTaskName=()=> 'PHOTO-TEST';c.nextSerialId=()=> 'new-ad';c._seedCuMirrorsFromTypedFields=()=>{};
    c.process=()=>({});
    for(const name of ['saveState','saveInspirations','deriveWinners','genActions','buildCreativeUsageIndex','populateFilterOptions','renderAll'])c[name]=()=>{};
    c._writeAdRowDirect=ad=>writes.push(ad.id);c._writeMatrixCellDirect=key=>writes.push(key);
    const start=html.indexOf('function addInspoToCell(');vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    assert.equal(c.addInspoToCell('i','New angle','New persona'),'new-ad');
    assert.equal(c.addInspoToCell('i','New angle','New persona'),'new-ad');
    assert.equal(c.ADS.length,1);assert.equal(c.ADS[0].adType,'Photo');assert.equal(c.ADS[0].taskType,'production');
    assert.equal(c.ADS[0]._sourceInspirationBriefUrl,'https://example.test/existing-brief');
    assert.equal(c.CELL_CREATIVE_ASSIGNMENTS['New angle||New persona'].length,1);
    assert.equal(c.ANGLES.length,3);assert.equal(c.PERSONAS.length,3);assert.equal(c.confirmations.length,1);
    assert.deepEqual(writes,['new-ad','New angle||New persona']);
  });

  test(file + ': only active options are selectable, preserving archived current value as disabled', () => {
    const c = setup();
    c.ANGLES.push({name:'Deleted'}, {name:'Foreign'});
    assert.deepEqual(Array.from(c._activeTaxonomyItems('angle'), row => row.name), ['Existing']);
    assert.deepEqual(Array.from(c._activeTaxonomyItems('persona'), row => row.name), ['Baby cloth Quilters']);
    const choices = c._inspirationTaxonomyOptions('angle', 'Archived angle');
    assert.match(choices, /value="Archived angle" selected disabled/);
    assert.match(choices, /value="Existing"/);
    assert.doesNotMatch(choices, /Deleted|Foreign/);
    assert.doesNotMatch(c._inspirationTaxonomyOptions('angle', 'Existing'), /Archived angle/);
  });

  test(file + ': placement and selectors use the guarded active-category paths', () => {
    const start = html.indexOf('function addInspoToCell(');
    const placement = html.slice(start, html.indexOf('\n}', start));
    assert.ok(placement.indexOf('_prepareInspirationCell(') < placement.indexOf('ADS.push('));
    assert.match(html, /var angleOpts = _inspirationTaxonomyOptions\('angle', ins.angle\)/);
    assert.match(html, /var personaOpts = _inspirationTaxonomyOptions\('persona', ins.persona\)/);
    assert.match(html, /options = _activeTaxonomyItems\(fieldKey === 'angle tag'/);
    assert.match(html, /var allAngles\s*= _activeTaxonomyItems\('angle'\)/);
    assert.match(html, /var allPersonas\s*= _activeTaxonomyItems\('persona'\)/);
  });
}
