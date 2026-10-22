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

  test(file + ': only separate explicit category creation permits later placement', () => {
    const c = setup();
    const ins = {id:'Q-INS-064',angle:'Preserve baby-clothes memories',persona:'Baby cloth Quilters',_angleScope:'inspiration'};
    assert.equal(c._prepareInspirationCell(ins, ins.angle, ins.persona),null);
    assert.equal(c._ensureTaxonomyItem('angle',ins.angle,'Implicit'), '');
    assert.equal(c._ensureTaxonomyItem('angle',ins.angle,'Explicit add',true),ins.angle);
    const cell = c._prepareInspirationCell(ins, ins.angle, ins.persona);
    assert.equal(cell.angle, ins.angle);
    assert.equal(ins._angleScope, 'product');
    assert.equal(c.ANGLES.at(-1)._localNew, true);
    assert.equal(c._taxonomyItemIsActive('angle', cell.angle, false), true);
    c._prepareInspirationCell(ins, ins.angle.toUpperCase(), ins.persona);
    assert.equal(c.ANGLES.length, 3);
    assert.equal(c.PERSONAS.length, 2);
    assert.equal(c.confirmations.length,0);
  });

  test(file + ': placement cannot create new categories in any product', () => {
    for (const product of ['astro-rekha','quilting','other-product']) {
      const c = setup();c.activeProductId=product;
      c.confirm=()=>{throw Error('Placement must not offer category creation');};
      const ins={id:'TEST-INS-1',angle:'New angle',persona:'New persona',_angleScope:'inspiration',_personaScope:'inspiration'};
      const before=JSON.stringify([c.ANGLES,c.PERSONAS,ins]);
      assert.equal(c._prepareInspirationCell(ins,ins.angle,ins.persona),null);
      assert.equal(JSON.stringify([c.ANGLES,c.PERSONAS,ins]),before);
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

  test(file + ': a blanket confirmation cannot approve missing placement categories', () => {
    const c=setup();c.confirm=()=>true;
    const ins={id:'TEST-INS-1',angle:'New angle',persona:'New persona'};
    assert.equal(c._prepareInspirationCell(ins,ins.angle,ins.persona),null);
    assert.equal(c.ANGLES.length,2);assert.equal(c.PERSONAS.length,2);
    assert.equal(ins._angleScope,undefined);assert.equal(ins._personaScope,undefined);
  });

  test(file + ': invalid or archived placement cannot partially create categories', () => {
    for (const persona of ['Archived persona', 'Deleted', 'Foreign', '']) {
      const c = setup();
      const ins = {id:'i',angle:'New angle',persona};
      const before = JSON.stringify([c.ANGLES,c.PERSONAS,ins]);
      assert.equal(c._prepareInspirationCell(ins, ins.angle, persona), null);
      assert.equal(JSON.stringify([c.ANGLES,c.PERSONAS,ins]), before);
    }
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
