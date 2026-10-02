import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('source/production mirrors preserve their asset path and existing product-boundary protections', () => {
  const source = readFileSync(new URL('../immuvi-command-center.html', import.meta.url), 'utf8');
  const deployed = readFileSync(new URL('../public/immuvi-command-center.html', import.meta.url), 'utf8');
  assert.equal(source.replace('src="public/taxonomy-review-client.mjs"', 'src="taxonomy-review-client.mjs"'), deployed);
  for (const html of [source, deployed]) {
    assert.ok(html.includes("if (_isBoundaryQuarantinedTaxonomy('angle', a.name)) return false"));
    assert.ok(html.includes("if (_isBoundaryQuarantinedTaxonomy('persona', p.name)) return false"));
    assert.ok(html.includes('!_adPassesProductBoundaryForTaxonomy(a, productId)'));
  }
});

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  function code(start, end) {
    const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return html.slice(a, b);
  }
  function setup() {
    let now = 1000000, id = 0;
    const timers = new Map(), calls = {fetch: 0, save: 0, broadcast: 0, render: 0};
    const c = vm.createContext({console, Map, Set, Promise,
      Date: {now: () => now},
      setTimeout(fn, delay) {timers.set(++id, {fn, at: now + delay}); return id;},
      clearTimeout(id) {timers.delete(id);},
      activeProductId: 'A', _adsProductId: 'A', _uiProductGeneration: 1,
      _saveScheduled: null, _saveInFlight: false, _productSwitchPending: false,
      _autoSyncPollInFlight: false, _myClientId: 'self',
      document: {hidden: false, getElementById: () => null},
      _renderAllSilent() {calls.render++;},
      CFG: {key: 'test-only'}, ADS: [], MANUAL_ACTIONS: [], ANGLES: [], PERSONAS: [],
      MATRIX_CELL_META: {}, CELL_CREATIVE_ASSIGNMENTS: {}, ANGLE_PERSONAS: {},
      localStorage: {getItem: () => null, setItem() {}},
      getActiveProduct: () => ({id: c.activeProductId, clickupListId: 'list', name: 'Product'}),
      _guardClickUpListForProduct: () => true,
      fetchAllTasks: async () => {calls.fetch++; return [];},
      _onSyncSuccess() {}, saveState() {calls.save++;},
      _rtChannel: {send() {calls.broadcast++;}},
      toast() {}, showLoading() {}, hideLoading() {}, startAutoSync() {},
      flushPendingSave: async () => {},
    });
    c.window = c;
    vm.runInContext(code('var _backgroundRefreshTasks =', 'function _isBadRealtimeStatus('), c);
    vm.runInContext(code('function pollFullSync(options)', 'function _onSyncSuccess('), c);
    async function advance(ms) {
      now += ms;
      for (const [key, t] of [...timers]) if (t.at <= now) {timers.delete(key); await t.fn();}
    }
    return {c, calls, timers, advance};
  }

  test(file + ': continuous events coalesce without postponing the minute deadline', async () => {
    const {c, advance, timers} = setup();
    let count = 0;
    for (let i = 0; i < 60; i++) {
      c._queueBackgroundRefresh('snapshot', () => count++, 'A');
      await advance(1000);
    }
    assert.equal(count, 1);
    assert.equal(timers.size, 0);
    c._queueBackgroundRefresh('snapshot', () => count++, 'A');
    await advance(59999); assert.equal(count, 1);
    await advance(1); assert.equal(count, 2);
  });

  test(file + ': pending local saves and hidden tabs defer, not discard, updates', async () => {
    const {c, advance} = setup(); let count = 0;
    c._queueBackgroundRefresh('snapshot', () => count++, 'A');
    c._saveInFlight = true; await advance(60000); assert.equal(count, 0);
    c._saveInFlight = false; c.document.hidden = true;
    await advance(60000); assert.equal(count, 0);
    c.document.hidden = false; await advance(60000); assert.equal(count, 1);
  });

  test(file + ': product switches, including A-B-A, discard obsolete callbacks', async () => {
    const {c, advance} = setup(); let count = 0;
    c._queueBackgroundRefresh('snapshot', () => count++, 'A');
    c._uiProductGeneration += 2;
    await advance(60000); assert.equal(count, 0);
  });

  test(file + ': broadcasts preserve distinct records/fields and ignore self/cross-product traffic', async () => {
    const {c, advance, calls} = setup(); let listener;
    const events = [];
    c._listenProductBroadcast({on(type, filter, cb) {listener = cb;}}, 'field-update', 'A', msg => events.push(msg.payload));
    for (const [adId, field, value] of [['1','notes','old'],['1','notes','new'],['2','status','Winner'],['1','status','Testing']]) {
      listener({payload: {adId, field, value, productId: 'A', clientId: 'peer'}});
    }
    listener({payload: {adId: '3', field: 'notes', clientId: 'self'}});
    listener({payload: {adId: '4', field: 'notes', productId: 'B'}});
    assert.equal(events.length, 0);
    await advance(60000);
    assert.equal(events.length, 3);
    assert.equal(events[0].value, 'new');
    assert.equal(calls.render, 1);
    assert.equal(calls.broadcast, 0);
  });

  test(file + ': automatic ClickUp polls obey a single minute budget', async () => {
    const {c, calls, advance} = setup();
    await c.pollFullSync();
    for (let i = 0; i < 20; i++) await c.pollFullSync();
    assert.equal(calls.fetch, 1);
    await advance(59999); await c.pollFullSync(); assert.equal(calls.fetch, 1);
    await advance(1); await c.pollFullSync(); assert.equal(calls.fetch, 2);
    assert.equal(calls.save, 0); assert.equal(calls.broadcast, 0);
  });

  test(file + ': manual refresh bypasses the local timer without refreshing another client', async () => {
    const {c, calls} = setup(); const peer = setup();
    await c.pollFullSync(); await c.pollFullSync({manual: true});
    assert.equal(calls.fetch, 2); assert.equal(peer.calls.fetch, 0);
    assert.equal(calls.save, 0); assert.equal(calls.broadcast, 0);
  });

  test(file + ': overlapping refreshes share one request; rejected requests do not retry immediately', async () => {
    const {c, calls} = setup(); let resolve;
    c.fetchAllTasks = () => {calls.fetch++; return new Promise(r => {resolve = r;});};
    const first = c.pollFullSync(), second = c.pollFullSync({manual: true});
    assert.equal(first, second); assert.equal(calls.fetch, 1);
    resolve([]); await first;
    c._lastClickUpRefreshAt = 0;
    c.fetchAllTasks = async () => {calls.fetch++; throw new Error('429');};
    await c.pollFullSync(); await c.pollFullSync();
    assert.equal(calls.fetch, 2);
  });

  test(file + ': manual refresh waits for existing edits and rejects a second click', async () => {
    const {c, calls} = setup(); let resolve;
    vm.runInContext(code('async function syncClickUp()', 'function fetchAllTasks('), c);
    c.flushPendingSave = () => new Promise(r => {resolve = r;});
    const pending = c.syncClickUp();
    await c.syncClickUp(); assert.equal(calls.fetch, 0);
    resolve(); await pending; assert.equal(calls.fetch, 1);
    assert.equal(calls.save, 0); assert.equal(c._manualRefreshBusy, false);
  });

  test(file + ': product change while ClickUp is fetching cannot import into another product', async () => {
    const {c} = setup(); let resolve;
    c.fetchAllTasks = () => new Promise(r => {resolve = r;});
    c.parseClickUpTask = () => {throw new Error('Must not parse stale product');};
    const pending = c.pollFullSync();
    c.activeProductId = 'B'; c._uiProductGeneration++;
    resolve([{id: 'old-product'}]); await pending;
    assert.equal(c.ADS.length, 0);
  });

  test(file + ': imported changes do not broadcast; manual path has no snapshot save or metadata write', () => {
    const poll = code('function pollFullSync(options)', 'function _onSyncSuccess(');
    assert.ok(!poll.includes('_rtChannel.send'));
    assert.ok(poll.includes('if (!manual) saveState()'));
    assert.ok(poll.includes('broadcast: false'));
    assert.ok(!poll.includes('ADS = ADS.filter'));
    const success = code('function _onSyncSuccess(', '// ═');
    assert.ok(!success.includes('DB.upsertProduct'));
    assert.ok(!success.includes('saveState()'));
    assert.ok(success.includes('_fetchCuStatuses(false)'));
  });

  test(file + ': manual changed-data refresh preserves absent creatives and performs zero writes', async () => {
    const {c, calls} = setup();
    c.ADS = [{id:'ad-1', _clickupId:'cu-1', status:'Testing', formatName:'Creative', angle:'Angle', persona:'Persona'},
      {id:'ad-missing', _clickupId:'cu-missing', status:'Winner', formatName:'Keep me'}];
    Object.assign(c, {
      _stampClickUpTasksWithProductBoundary() {}, _stampAdProductBoundary: x => x,
      parseClickUpTask: x => x, _readTaxonomyTombstone: () => ({}), _SYNC_DIFF_FIELDS: ['status'],
      _stampAdStatusChange: (ad, status) => {ad.status = status;},
      _diffCustomFieldsRaw: () => [],
      _isDeletedAdTombstonedNow: () => false,
      autoDiscoverTaxonomy: () => ({addedAngles: [], addedPersonas: []}),
      _apRepairMASourceAdIds: () => 0, _applyProductBoundaryQuarantine: async () => {},
      _reconcileSyncedAdsToCanonicalCells: () => 0,
      process: () => ({}), buildCreativeUsageIndex() {}, deriveWinners() {}, genActions() {},
      populateFilterOptions() {}, initAnglePersonas() {},
      _writeManualActionRowDirect() {calls.save++;}
    });
    c.fetchAllTasks = async () => [{id:'ad-1', _clickupId:'cu-1', status:'Winner', formatName:'Creative', angle:'Angle', persona:'Persona'}];
    const result = await c.pollFullSync({manual: true});
    assert.equal(result?.ok, true);
    assert.equal(c.ADS[0].status, 'Winner');
    assert.equal(c.ADS.length, 2);
    assert.equal(c.ADS[1].id, 'ad-missing');
    assert.equal(calls.save, 0); assert.equal(calls.broadcast, 0);
  });

  test(file + ': failed saves never send a success notification', async () => {
    const {c, calls} = setup();
    Object.assign(c, {_freshLoadInProgress: false, _cloudLoadFailed: false,
      DB: {ready: true, saveProductData: async () => ({ok: false})},
      _broadcastSyncNeeded: () => calls.broadcast++});
    vm.runInContext(code('async function _flushStateToSupabase(', '// Async load from Supabase.'), c);
    await assert.rejects(c._flushStateToSupabase('A'), /did not complete/);
    assert.equal(calls.broadcast, 0);
    c.DB.saveProductData = async () => ({ok: true});
    await c._flushStateToSupabase('A'); assert.equal(calls.broadcast, 1);
  });

  test(file + ': Supabase bursts share one load and manual snapshot refresh is local/read-only', async () => {
    const {c, advance, calls} = setup(); let notify, loads = 0;
    Object.assign(c, {
      _activeRTChannel: null, _startRealtimeHealthWatchdog() {},
      _recentlyDeletedAdIds: new Set(), _recentlyDeletedMaIds: new Set(),
      _readTaxonomyTombstone: () => ({}), _scrubAnglePersonas: x => x,
      _META_FIELDS: [], _notesCache: {}, process: () => ({}),
      DB: {ready: true, subscribeToProduct(pid, callback) {assert.equal(pid, 'A'); notify = callback; return {};},
        loadProductData: async () => {loads++; return {ADS:[{id:'new-ad', variationNotes:'Shared note'}], ANGLES:[], PERSONAS:[], MANUAL_ACTIONS:[]};}}
    });
    vm.runInContext(code('function _resubscribeRealtime()', 'window._resubscribeRealtime'), c);
    c._resubscribeRealtime();
    for (let i = 0; i < 100; i++) notify({table:'ads', new:{id:'new-ad'}});
    assert.equal(loads, 0);
    await advance(60000); assert.equal(loads, 1);
    assert.equal(c.ADS[0].variationNotes, 'Shared note');
    await c._requestSharedRefresh(true, 'A'); assert.equal(loads, 2);
    assert.equal(calls.save, 0); assert.equal(calls.broadcast, 0);
  });

  test(file + ': identical snapshots do not repaint; changed notes do, without a transition', () => {
    const {c, calls} = setup();
    Object.assign(c, {_userIsActivelyEditing: () => false,
      _renderAllInternal: () => calls.render++, scrollTo() {}, scrollY: 42});
    vm.runInContext(code("var _lastSilentRenderFingerprint = '';", '// ── 4a.'), c);
    c.ADS = [{id:'ad', notes:'Keep this', _clientId:'one'}];
    c._renderAllSilent(); c._renderAllSilent(); assert.equal(calls.render, 1);
    c.ADS[0]._clientId = 'two'; c._renderAllSilent(); assert.equal(calls.render, 1);
    c.ADS[0].notes = 'Edited'; c._renderAllSilent(); assert.equal(calls.render, 2);
  });

  test(file + ': delayed peer notifications cannot overwrite edits made during the wait', async () => {
    const {c, advance} = setup(); let listener;
    c.ADS = [{id:'ad', notes:'Original'}];
    c._listenProductBroadcast({on(type, filter, cb) {listener = cb;}}, 'field-update', 'A', msg => {c.ADS[0].notes = msg.payload.value;});
    listener({payload:{adId:'ad', field:'notes', value:'Older peer edit', clientId:'peer'}});
    c.ADS[0].notes = 'My newer edit';
    await advance(60000);
    assert.equal(c.ADS[0].notes, 'My newer edit');
  });

  test(file + ': refresh-only legacy link repair updates local links without writes', () => {
    const {c, calls} = setup();
    c.ADS = [{id:'parent'}, {id:'new-ad', _clickupId:'cu'}];
    c.MANUAL_ACTIONS = [{id:'action', _dbId:'uuid', sourceAdId:'parent-V1', _clickupId:'cu'}];
    c._writeAdRowDirect = c._writeManualActionRowDirect = () => calls.save++;
    vm.runInContext(code('function _apRepairMASourceAdIds(options)', '// ─── Auto-adopt heal'), c);
    assert.equal(c._apRepairMASourceAdIds({persist:false}), 1);
    assert.equal(c.MANUAL_ACTIONS[0].sourceAdId, 'new-ad');
    assert.equal(c.ADS[1].parentAdId, 'parent');
    assert.equal(calls.save, 0);
  });
}
