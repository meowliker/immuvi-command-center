import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  function setup() {
    const context = vm.createContext({
      ANGLES: [{id:'a',name:'Existing'}, {id:'old',name:'Archived angle',archivedAt:1}],
      PERSONAS: [{id:'p',name:'Baby cloth Quilters'}, {id:'old-p',name:'Archived persona',archivedAt:1}],
      activeProductId:'quilting',
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

  test(file + ': explicit placement registers missing angle once and adopts inspiration scope', () => {
    const c = setup();
    const ins = {id:'Q-INS-064',angle:'Preserve baby-clothes memories',persona:'Baby cloth Quilters',_angleScope:'inspiration'};
    const cell = c._prepareInspirationCell(ins, ins.angle, ins.persona);
    assert.equal(cell.angle, ins.angle);
    assert.equal(ins._angleScope, 'product');
    assert.equal(c.ANGLES.at(-1)._localNew, true);
    assert.equal(c._taxonomyItemIsActive('angle', cell.angle, false), true);
    c._prepareInspirationCell(ins, ins.angle.toUpperCase(), ins.persona);
    assert.equal(c.ANGLES.length, 3);
    assert.equal(c.PERSONAS.length, 2);
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
