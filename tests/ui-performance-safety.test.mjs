import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  function load(c, start, end) {
    const a = html.indexOf(start), b = html.indexOf(end, a);
    assert.ok(a >= 0 && b > a, start);
    vm.runInContext(html.slice(a, b), c);
  }
  function context() {
    const timers = [];
    const calls = {computed: 0, saved: 0, rendered: 0, deleted: 0};
    const c = vm.createContext({console, activeProductId: 'A', _adsProductId: 'A',
      PRODUCTS: [{id: 'A', name: 'Quilting'}, {id: 'B', name: 'ADHD'}],
      ANGLES: [], PERSONAS: [], ADS: [], INSPIRATIONS: [], _renderedTabs: {},
      _taxonomyEvidenceLastRefreshMs: 0, _taxonomyEvidenceProfilesCache: {},
      setTimeout: fn => {timers.push(fn); return timers.length;}, clearTimeout() {},
      document: {hidden: false, getElementById: () => ({classList: {contains: () => true}})},
      _creativeEvidenceText: (ad, ins) => (ad || ins).text || '',
      _calculateTaxonomySuggestionsForInspiration: () => {calls.computed++; return [{name: 'Beginner', score: 0.8}];},
      renderInspirations: () => {calls.rendered++;}, saveInspirations: () => {calls.saved++;},
      showInsStatus() {}, refreshAllDupeChecks() {}, sanitizeInspirationText: String,
      normalizeInspirationVoiceOver: x => x,
      DB: {ready: true, clearResults() {calls.deleted++; throw new Error('Unexpected deletion');}}
    });
    c.window = c;
    load(c, 'var _cloudLoadFailed = false;', 'function _calculateCreativeEvidenceTokens(');
    c._inspirationsProductId = 'A';
    async function turn() {const fn = timers.shift(); if (fn) fn(); for (let i = 0; i < 8; i++) await Promise.resolve();}
    return {c, calls, timers, turn};
  }
  test(file + ': hidden tab guards prevent work and invalidate next open', () => {
    const {c} = context();
    c.document.getElementById = () => ({classList: {contains: () => false}});
    for (const [fn, tab] of Object.entries({renderHQ:'hq', renderAngles:'angles', renderPersonas:'personas', renderCreatives:'creatives', renderMatrix:'matrix', renderActionPlan:'actions', renderProduction:'production'})) {
      const a = html.indexOf(`function ${fn}() {`);
      const b = html.indexOf('\n', html.indexOf('\n', a) + 1);
      vm.runInContext(html.slice(a, b) + '\nthrow new Error("Hidden render executed");}', c);
      assert.equal(c[fn](), false);
      assert.equal(c._renderedTabs[tab], false);
    }
  });
  test(file + ': suggestion cache is product scoped and invalidates changed evidence', () => {
    const {c, calls} = context();
    const ins = {id:'same-id', product_id:'A', text:'quilting', status:'Classified'};
    c.INSPIRATIONS = [ins];
    c._syncSuggestionContext();
    c._taxonomySuggestionsForInspiration('angle', ins, '', 4);
    c._taxonomySuggestionsForInspiration('angle', ins, '', 4);
    assert.equal(calls.computed, 1);
    ins.text = 'changed evidence';
    c._syncSuggestionContext();
    c._taxonomySuggestionsForInspiration('angle', ins, '', 4);
    assert.equal(calls.computed, 2);
    c.activeProductId = 'B'; c._syncSuggestionContext();
    assert.equal(c._taxonomySuggestionsForInspiration('angle', ins, '', 4).length, 0);
    c._taxonomySuggestionsForInspiration('angle', {...ins, product_id:'B'}, '', 4);
    assert.equal(calls.computed, 3);
  });
  test(file + ': token cache preserves results without sharing mutable arrays', () => {
    const {c} = context();
    let count = 0;
    c._calculateCreativeEvidenceTokens = () => {count++; return ['quilt'];};
    c._creativeEvidenceTokens('fabric').push('bad');
    assert.deepEqual(Array.from(c._creativeEvidenceTokens('fabric')), ['quilt']);
    assert.equal(count, 1);
    c.activeProductId = 'B'; c._creativeEvidenceTokens('fabric');
    assert.equal(count, 2);
  });
  test(file + ': background suggestions yield, cancel on switch, and never persist or mutate records', async () => {
    const {c, calls, turn} = context();
    c.INSPIRATIONS = [{id:'1', product_id:'A', text:'fabric', status:'Classified'}];
    const before = JSON.stringify(c.INSPIRATIONS);
    c._queueInspirationSuggestions();
    assert.equal(calls.computed, 0);
    await turn();
    assert.equal(calls.computed, 1);
    c.activeProductId = 'B';
    await turn();
    assert.equal(calls.computed, 1);
    assert.equal(calls.saved, 0);
    assert.equal(calls.rendered, 0);
    assert.equal(JSON.stringify(c.INSPIRATIONS), before);
  });
  test(file + ': completed suggestion batches repaint once and reuse cache', async () => {
    const {c, calls, turn} = context();
    c.INSPIRATIONS = [{id:'1', product_id:'A', text:'fabric', status:'Classified'}];
    c._queueInspirationSuggestions();
    await turn(); await turn();
    assert.equal(calls.computed, 2);
    assert.equal(calls.rendered, 1);
    c._queueInspirationSuggestions();
    assert.equal(c._suggestionJob, null);
    assert.equal(calls.saved, 0);
  });
  test(file + ': timeout rejects, success remains usable', async () => {
    const {c, timers} = context();
    const pending = c._withCloudTimeout(new Promise(() => {}), 'Test', 10);
    const rejected = assert.rejects(pending, /Test timed out/);
    timers.shift()(); await rejected;
    assert.equal(await c._withCloudTimeout(Promise.resolve(42), 'Test'), 42);
  });
  test(file + ': load failure presents Retry and blocks saves without clearing records', () => {
    const {c} = context();
    const elements = new Map(); let reloaded = false, focused = false;
    c.ADS = [{id:'preserve'}];
    c.document = {body: {classList:{remove(){}}, appendChild(el){elements.set(el.id, el);}},
      getElementById: id => elements.get(id), createElement: () => ({setAttribute(){}, style:{}})};
    elements.set('cloudLoadRetry', {focus(){focused = true;}});
    c.location = {reload(){reloaded = true;}};
    c._showCloudLoadFailure();
    assert.equal(c._cloudLoadFailed, true);
    assert.equal(c._adsProductId, null);
    assert.equal(c.ADS[0].id, 'preserve');
    assert.match(elements.get('cloudLoadFailure').innerHTML, /Retry/);
    elements.get('cloudLoadRetry').onclick();
    assert.ok(reloaded && focused);
    assert.match(html, /if \(_cloudLoadFailed \|\| !_adsProductId \|\| _adsProductId !== pid\)/);
  });
  test(file + ': partial cloud failures reject instead of returning empty state', async () => {
    const {c} = context();
    c.SB = {from: table => {
      const query = {select(){return this;}, eq(){return this;}, is(){return this;},
        then(resolve, reject){return Promise.resolve({data:[], error:table === 'ads' ? new Error('offline') : null}).then(resolve,reject);}};
      return query;
    }};
    const a = html.indexOf('  async loadProductData(productId) {');
    const b = html.indexOf('  // Full-sync write', a);
    vm.runInContext('var dbTest = {' + html.slice(a,b) + '};', c);
    await assert.rejects(c.dbTest.loadProductData('A'), /offline/);
  });
  function loadImporter(c) {
    load(c, 'async function applyClassificationResults(', '// ── Auto-add new Angle or Persona');
  }
  test(file + ': replay fills only missing brief fields, preserving manual taxonomy and status', async () => {
    const {c,calls,turn} = context(); loadImporter(c);
    const ins = {id:'1', product_id:'A', status:'Testing', angle:'Manual angle', persona:'Manual persona', noBrief:true, classifiedAt:123, _needsAngleReview:true, voiceOverTimeline:[]};
    c.INSPIRATIONS = [ins];
    const result = {ins_id:'1', _resultProductId:'A', angle:'Wrong', persona:'Wrong', hook_text:'new hook', voiceOverTimeline:[], nextAdScripts:[]};
    const first = c.applyClassificationResults([result], true, 'A');
    assert.equal(calls.saved, 0); await turn(); assert.equal(await first, 1);
    assert.equal(ins.angle, 'Manual angle'); assert.equal(ins.persona, 'Manual persona');
    assert.equal(ins.status, 'Testing'); assert.equal(ins.classifiedAt, 123); assert.equal(ins.noBrief, true);
    const replay = c.applyClassificationResults([result], true, 'A'); await turn();
    assert.equal(await replay, 0); assert.equal(calls.saved, 1); assert.equal(calls.deleted, 0);
  });
  test(file + ': classification batches cannot touch another product or fallback to a wrong URL match', async () => {
    const {c,calls,turn} = context(); loadImporter(c);
    c.INSPIRATIONS = [{id:'1', product_id:'A', sourceUrl:'same', status:'Testing'}];
    const before = JSON.stringify(c.INSPIRATIONS);
    const work = c.applyClassificationResults([
      {ins_id:'1', _resultProductId:'B', hook_text:'foreign'},
      {ins_id:'missing', source_url:'same', _resultProductId:'A', hook_text:'wrong id'}
    ], true, 'A');
    await turn(); await turn(); assert.equal(await work, 0);
    assert.equal(JSON.stringify(c.INSPIRATIONS), before); assert.equal(calls.saved, 0);
  });
  test(file + ': switching away and back invalidates an in-flight batch', async () => {
    const {c,calls,turn} = context(); loadImporter(c);
    c.INSPIRATIONS = [{id:'1', product_id:'A', status:'Testing'}];
    const work = c.applyClassificationResults([{ins_id:'1',hook_text:'stale'}], true, 'A');
    c._uiProductGeneration += 2;
    await turn(); assert.equal(await work, 0); assert.equal(calls.saved, 0);
  });
  test(file + ': polling is single-flight and ignores responses from the previous product', async () => {
    const {c} = context();
    load(c, 'async function pollCloudResults()', '// Map Supabase inspiration_results');
    let finish, reads = 0;
    c.DB.getResults = () => {reads++; return new Promise(resolve => {finish = resolve;});};
    c.applyClassificationResults = () => {throw new Error('Stale response applied');};
    const first = c.pollCloudResults(); await c.pollCloudResults();
    assert.equal(reads, 1);
    c.activeProductId = 'B'; finish([{product_id:'A'}]); await first;
    assert.equal(c._resultPollBusy, false);
  });
  test(file + ': a new classification is imported once, preserving its no-brief choice', async () => {
    const {c,calls,turn} = context(); loadImporter(c);
    Object.assign(c, {extractFormatName:String, normalizeToOption:x=>x, HOOK_TYPES:[], CREATIVE_STRUCTURES:[], PRODUCTION_STYLES:[], FUNNEL_STAGES:[],
      deriveInspirationMediaKind:()=> 'video', normalizeInspirationAdType:()=> 'Video', normalizeInspirationCta:x=>x,
      _storeInspirationTaxonomySuggestions:()=>[], _canonicalTaxonomyName:x=>x});
    c.INSPIRATIONS = [{id:'new', product_id:'A', status:'Queued', noBrief:true}];
    const result = {ins_id:'new', _resultProductId:'A', creative_usp:'Lesson', angle:'Beginner', persona:'Quilter', angle_matched:true, persona_matched:true};
    const work = c.applyClassificationResults([result], true, 'A');
    await turn(); assert.equal(await work, 1);
    assert.equal(c.INSPIRATIONS[0].status, 'Classified');
    assert.equal(c.INSPIRATIONS[0].noBrief, true);
    assert.equal(c.INSPIRATIONS[0].angle, 'Beginner');
    const repeat = c.applyClassificationResults([result], true, 'A');
    await turn(); assert.equal(await repeat, 0);
    assert.equal(calls.saved, 1); assert.equal(calls.deleted, 0);
  });
  test(file + ': late inspiration reads cannot overwrite a newer product load', async () => {
    const {c} = context();
    load(c, 'async function loadInspirations(', '// One-time migration: set ClickUp doc page URLs');
    const pending = [];
    c.DB.listInspirations = () => new Promise(resolve => pending.push(resolve));
    c.DB.getQueue = async () => [];
    c.migrateInspirationDocUrls = () => {};
    c.startResultPolling = () => {};
    c.INSPIRATIONS = [{id:'keep', product_id:'A'}];
    const old = c.loadInspirations('A');
    c._uiProductGeneration += 2;
    const latest = c.loadInspirations('A');
    pending[1]([{id:'latest', product_id:'A'}]); await latest;
    pending[0]([{id:'stale', product_id:'A'}]); await old;
    assert.equal(c.INSPIRATIONS[0].id, 'latest');
  });
  test(file + ': failed inspiration fetch retains the previous records', async () => {
    const {c} = context();
    load(c, 'async function loadInspirations(', '// One-time migration: set ClickUp doc page URLs');
    c.DB.listInspirations = async () => {throw new Error('offline');};
    c.INSPIRATIONS = [{id:'preserved'}];
    await assert.rejects(c.loadInspirations('A', true), /offline/);
    assert.equal(c.INSPIRATIONS[0].id, 'preserved');
  });
}
