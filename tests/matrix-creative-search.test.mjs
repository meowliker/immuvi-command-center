import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = ['immuvi-command-center.html', 'public/immuvi-command-center.html'];

function cell(key) {
  const classes = new Set(['existing-class']);
  return {
    classes,
    scrolls: 0,
    getAttribute: () => key,
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    scrollIntoView() { this.scrolls++; }
  };
}

async function setup(file) {
  const html = await readFile(file, 'utf8');
  const start = html.indexOf('var _mxv4CreativeSearch =');
  const end = html.indexOf('function renderMxv4Filters()', start);
  assert.ok(start > 0 && end > start);
  const cells = [cell('Angle A||Beginner'), cell('Angle B||Beginner'), cell('Angle C||Seller')];
  const count = { textContent: '' };
  const jump = { disabled: true };
  const results = {hidden:true,children:[],replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);}};
  const root = { querySelectorAll: () => cells };
  const context = vm.createContext({
    activeProductId: 'quilting',
    ADS: [
      { id: 'AD-1', taskName: 'Q-14021', formatName: 'Fabric Choice Confidence', product_id: 'quilting' },
      { id: 'AD-2', taskName: 'Q-14022', formatName: 'Beginner Guide', _clickupId: '86abc' },
      { id: 'AD-3', taskName: 'Foreign Creative', product_id: 'therapy' },
      { id: 'AD-4', taskName: 'Quarantined Creative', quarantined: true },
      { id: 'AD-5', taskName: 'Deleted Creative', deleted_at: '2026-09-15' }
    ],
    CELL_CREATIVE_ASSIGNMENTS: {
      'Angle A||Beginner': ['AD-1', 'AD-2'],
      'Angle B||Beginner': ['AD-1'],
      'Angle C||Seller': ['AD-3', 'AD-4', 'AD-5', 'missing']
    },
    MATRIX_CELL_META: { 'AD-1||Angle B||Beginner': { uniqueName: '14021-2' } },
    _adPassesProductBoundaryForTaxonomy: ad => !ad.quarantined,
    document: {
      getElementById: id => ({ matrixGrid: root, mxCreativeSearchCount: count, mxCreativeSearchJump: jump, mxCreativeSearchResults:results })[id],
      createElement:()=>({children:[],setAttribute(){},appendChild(child){this.children.push(child);},addEventListener(type,fn){this[type]=fn;}})
    },
    renderMatrix() { throw new Error('Typing must not redraw the matrix'); },
    saveState() { throw new Error('Search must not save data'); }
  });
  vm.runInContext(html.slice(start, end), context);
  context._mxv4BuildSearchIndex();
  return { context, cells, count, jump, html, results };
}

for (const file of files) {
  test(`${file}: restoring an existing category returns its task to ordinary grid search`, async () => {
    const {context:c,cells,count,results,html}=await setup(file);
    c.ANGLES=[{name:'Existing angle'}];
    c.PERSONAS=[{name:'Existing persona',archivedAt:1},{name:'Unrelated archived persona',archivedAt:2}];
    c.ANGLE_PERSONAS={};
    c._isBoundaryQuarantinedTaxonomy=()=>false;
    c._isTaxonomyTombstoned=()=>false;
    for(const name of ['_normalizeTaxonomyName','_taxonomyLookupKey','_taxonomyNameExists','_taxonomyArchivedByName','_matrixTaxonomyAllowed','deriveMasterPersonas','isPersonaActive','_apResolveCellIdentity']) {
      const start=html.indexOf('function '+name+'(');
      assert.ok(start>=0,name);
      vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
    }
    const ad={id:'restore-winner',formatName:'TEST-RESTORED',status:'Winner',angle:'Existing angle',persona:'Existing persona',product_id:'quilting'};
    const action={angle:ad.angle,persona:ad.persona,sourceAngle:ad.angle,sourcePersona:ad.persona};
    c.ADS.push(ad);
    const key=ad.angle+'||'+ad.persona;
    c.CELL_CREATIVE_ASSIGNMENTS[key]=[ad.id];
    const before=JSON.stringify({ad,action,assignments:c.CELL_CREATIVE_ASSIGNMENTS});
    c._mxv4BuildSearchIndex();c.setMxv4CreativeSearch(ad.formatName);
    assert.equal(count.textContent,'1 task outside visible matrix');
    assert.equal(c.isPersonaActive(ad.persona),false);
    assert.deepEqual(Array.from(c.deriveMasterPersonas()),[]);

    // An explicit restore reuses the original master row and assignment.
    c.PERSONAS[0].archivedAt=null;
    c.PERSONAS[0].creationApproved=true;
    assert.equal(c.isPersonaActive(ad.persona),true);
    assert.deepEqual(Array.from(c.deriveMasterPersonas()),[ad.persona]);
    const restoredCell=cell(key);cells.push(restoredCell);
    c._mxv4BuildSearchIndex();c._mxv4ApplyCreativeSearch();
    assert.equal(count.textContent,'1 matching cell');
    assert.equal(results.hidden,true);
    assert.equal(results.children.length,0);
    assert.equal(restoredCell.classes.has('mx-search-match'),true);
    const identity=c._apResolveCellIdentity(action,null);
    assert.equal(identity.angle,ad.angle);assert.equal(identity.persona,ad.persona);
    assert.equal(c.PERSONAS[1].archivedAt,2);
    assert.equal(c.PERSONAS.length,2);
    assert.equal(JSON.stringify({ad,action,assignments:c.CELL_CREATIVE_ASSIGNMENTS}),before);
  });

  test(`${file}: hidden-category tasks are searchable without restoring taxonomy`, async () => {
    const {context:c,count,results}=await setup(file);
    c.ADS.push({id:'AD-hidden',formatName:'TEST-354-INS-220',status:'Winner',persona:'Archived persona'});
    c.CELL_CREATIVE_ASSIGNMENTS['Existing angle||Archived persona']=['AD-hidden'];
    c._mxv4BuildSearchIndex();c.setMxv4CreativeSearch('TEST-354-INS-220');
    assert.equal(count.textContent,'1 task outside visible matrix');assert.equal(results.hidden,false);
    assert.equal(results.children[0].textContent,'TEST-354-INS-220');
    const filters={};let opened;
    c._mxv4={cell:null};c._productSwitchPending=false;
    c.openMxv4Modal=(a,p,options)=>{opened={a,p,options};c._mxv4.cell=a+'||'+p;};
    c._mxv4GetCellFilters=()=>filters;c.renderMxv4Modal=()=>{};
    results.children[0].click();
    assert.equal(opened.p,'Archived persona');assert.equal(opened.options.searchResult,true);
    assert.equal(c._mxv4.selectedAdId,'AD-hidden');assert.equal(filters.search,'AD-hidden');assert.equal(filters.dateRange,'all');
    assert.equal(c.ADS.at(-1).status,'Winner');assert.equal(c.ADS.at(-1).persona,'Archived persona');
    c.setMxv4CreativeSearch('');assert.equal(results.hidden,true);assert.equal(results.children.length,0);
  });

  test(`${file}: stale search callbacks cannot cross products or open removed assignments`, async () => {
    const {context:c,results}=await setup(file);
    c.ADS.push({id:'hidden',formatName:'Hidden winner'});c.CELL_CREATIVE_ASSIGNMENTS['A||Archived']=['hidden'];
    c._mxv4BuildSearchIndex();c.setMxv4CreativeSearch('hidden winner');const click=results.children[0].click;
    c._productSwitchPending=false;c.openMxv4Modal=()=>{throw Error('Stale result must not open');};
    c.activeProductId='therapy';click();c.activeProductId='quilting';
    c.CELL_CREATIVE_ASSIGNMENTS['A||Archived']=[];click();
  });

  test(`${file}: a task already found in a visible cell is not duplicated in hidden results`, async () => {
    const {context:c,count,results}=await setup(file);
    c.CELL_CREATIVE_ASSIGNMENTS['Hidden||Archived']=['AD-1'];c._mxv4BuildSearchIndex();c.setMxv4CreativeSearch('fabric choice');
    assert.equal(count.textContent,'2 matching cells');assert.equal(results.hidden,true);
  });

  test(`${file}: name and ID search highlights every assigned cell without rebuilding`, async () => {
    const { context: c, cells, count, jump } = await setup(file);
    c.setMxv4CreativeSearch('  FABRIC\t choice  ');
    assert.equal(count.textContent, '2 matching cells');
    assert.equal(jump.disabled, false);
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [true, true, false]);
    c.setMxv4CreativeSearch('q-14021');
    assert.equal(count.textContent, '2 matching cells');
    c._mxv4NextSearchMatch();
    c._mxv4NextSearchMatch();
    c._mxv4NextSearchMatch();
    assert.deepEqual(cells.map(el => el.scrolls), [2, 1, 0]);
    c.setMxv4CreativeSearch('14021-2');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [false, true, false]);
    c.setMxv4CreativeSearch('86abc');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [true, false, false]);
  });

  test(`${file}: excludes foreign, deleted, missing and quarantined records`, async () => {
    const { context: c, count } = await setup(file);
    for (const query of ['Foreign', 'Quarantined', 'Deleted', 'missing', 'fabric guide']) {
      c.setMxv4CreativeSearch(query);
      assert.equal(count.textContent, 'No matching cells', query);
    }
  });

  test(`${file}: clear and product switching remove stale highlights`, async () => {
    const { context: c, cells, count, jump } = await setup(file);
    c.setMxv4CreativeSearch('fabric');
    c.setMxv4CreativeSearch('');
    assert.equal(count.textContent, '');
    assert.equal(jump.disabled, true);
    assert.ok(cells.every(el => !el.classes.has('mx-search-match') && el.classes.has('existing-class')));
    c.setMxv4CreativeSearch('fabric');
    c.activeProductId = 'therapy';
    c._mxv4BuildSearchIndex();
    c._mxv4ApplyCreativeSearch();
    assert.equal(c._mxv4SearchState().query, '');
    assert.ok(cells.every(el => !el.classes.has('mx-search-match')));
  });

  test(`${file}: refresh rebuilds membership and preserves the current query`, async () => {
    const { context: c, cells, count } = await setup(file);
    c.setMxv4CreativeSearch('fabric');
    c.CELL_CREATIVE_ASSIGNMENTS['Angle A||Beginner'] = ['AD-2'];
    c._mxv4BuildSearchIndex();
    c._mxv4ApplyCreativeSearch();
    assert.equal(c._mxv4SearchState().query, 'fabric');
    assert.equal(count.textContent, '1 matching cell');
    assert.deepEqual(cells.map(el => el.classes.has('mx-search-match')), [false, true, false]);
  });

  test(`${file}: inline JavaScript parses and render hooks are present`, async () => {
    const { html } = await setup(file);
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|type\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1])) continue;
      new vm.Script(match[2]);
    }
    assert.match(html, /data-mx-search-key=/);
    assert.match(html, /el\.innerHTML = html;\s*_mxv4BuildSearchIndex\(\);\s*_mxv4ApplyCreativeSearch\(\);/);
    assert.match(html, /oninput="setMxv4CreativeSearch\(this\.value\)"/);
    assert.match(html,/!\(options && options\.searchResult\) && typeof _mxv4LazyBackfillStatusHistory/);
    assert.match(html,/_mxv4\.searchResultCell !== _mxv4\.cell && typeof _mxv4MaybeMigrateLocalSavedViews/);
  });
}
