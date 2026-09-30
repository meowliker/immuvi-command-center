import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = html.indexOf('function _variationNotesText(');
  const end = html.indexOf('function saveAdNotes(', start);
  assert.ok(start > 0 && end > start);
  const code = html.slice(start, end);
  function setup() {
    const log = [], broadcasts = [];
    const state = {meta: {notes: 'Original', variationNotes: 'Original', brief: 'Keep brief', other: 7},
      readError: null, saveError: null, missing: false, conflict: false, afterRead: null,
      storedMeta: null, refreshes: 0, refreshOK: true, verifyMismatch: false};
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const c = vm.createContext({console, activeProductId:'A', _adsProductId:'A', _uiProductGeneration:1,
      _productSwitchPending:false, _cloudLoadFailed:false, _notesCache:{}, _myClientId:'me',
      ADS:[{id:'v1', parentAdId:'p1', notes:'Original', status:'Testing', formatName:'V1'},
        {id:'unrelated', notes:'Untouched', status:'Winner'}],
      esc:escape, escAttr:escape, _withCloudTimeout:async value => value,
      _isSupabaseAuthError:error => error.code === 'PGRST301' || error.status === 401,
      _refreshSupabaseWriteSession:async () => {
        state.refreshes++;
        if (state.refreshOK) state.saveError = null;
        return state.refreshOK;
      },
      _rtChannel:{send:async message => broadcasts.push(message)},
      SB:{from(table) {
        assert.equal(table, 'ads');
        let update = null;
        const filters = [];
        const q = {
          select(columns) { log.push(['select', columns]); return q; },
          eq(key, value) { filters.push([key,value]); return q; },
          is(key, value) { filters.push([key,value]); return q; },
          update(patch) { update = patch; return q; },
          async maybeSingle() {
            log.push(['read', filters]);
            const meta = state.verifyMismatch ? state.meta : (state.storedMeta || state.meta);
            const result = {error:state.readError, data:state.missing ? null : {id:'v1', meta, updated_at:'2026-09-30T06:00:00Z'}};
            if (state.afterRead) state.afterRead();
            return result;
          },
          then(resolve, reject) {
            log.push(['write', update, filters]);
            if (!state.saveError && !state.conflict) state.storedMeta = update.meta;
            return Promise.resolve({error:state.saveError, data:state.conflict ? [] : [{id:'v1'}]}).then(resolve, reject);
          }
        };
        return q;
      }}
    });
    vm.runInContext(code, c);
    return {c, log, state, broadcasts};
  }
  test(file + ': notes column keeps existing variation columns and row behavior', () => {
    assert.ok(html.includes('<th>Due</th><th>Notes</th><th>ClickUp</th>'));
    assert.ok(html.includes('html += _variationNotesCell(v);'));
    const {c} = setup();
    const result = c._variationNotesCell({id:'v1', notes:'Short note'});
    assert.ok(result.includes('Short note</button>'));
    assert.ok(result.includes('event.stopPropagation()'));
    assert.ok(result.includes('openVariationNotes(this.dataset.adId)'));
  });
  test(file + ': preview is truncated and safely escaped; full notes stay unchanged', () => {
    const {c} = setup();
    const ad = {id:'" onclick="bad()', notes:'<script>' + 'x'.repeat(200)};
    const before = JSON.stringify(ad);
    const result = c._variationNotesCell(ad);
    assert.ok(result.includes('...</button>'));
    assert.ok(result.includes('&lt;script&gt;'));
    assert.ok(!result.includes('<script>'));
    assert.equal(JSON.stringify(ad), before);
    assert.equal(c._variationNotesText({notes:'', variationNotes:'Old'}), '');
    assert.equal(c._variationNotesText({variationNotes:'Legacy'}), 'Legacy');
    assert.ok(c._variationNotesCell({id:'empty', notes:''}).includes('Add notes...'));
  });
  test(file + ': saves only notes in current product and preserves every other field', async () => {
    const {c, log, state, broadcasts} = setup();
    const before = JSON.stringify(state.meta);
    assert.equal(await c._saveVariationNotes('v1','A',1,'Original',' Shared note '), 'Shared note');
    const write = log.find(x => x[0] === 'write');
    assert.deepEqual(Object.keys(write[1]), ['meta']);
    assert.equal(write[1].meta.brief, 'Keep brief');
    assert.equal(write[1].meta.other, 7);
    assert.equal(write[1].meta.notes, 'Shared note');
    assert.equal(write[1].meta.variationNotes, 'Shared note');
    assert.deepEqual(write[2], [['id','v1'], ['product_id','A'], ['deleted_at',null], ['updated_at','2026-09-30T06:00:00Z']]);
    assert.equal(log.filter(x => x[0] === 'read').length, 2);
    assert.equal(c.ADS[0].notes, 'Shared note');
    assert.equal(c.ADS[0].status, 'Testing');
    assert.equal(c.ADS[1].notes, 'Untouched');
    assert.equal(broadcasts[0].payload.productId, 'A');
    assert.equal(JSON.stringify(state.meta), before);
    assert.ok(!code.includes('apiUpdateTask('));
    assert.ok(!code.includes('_flushStateToSupabase('));
    assert.ok(!code.includes('.upsert('));
    assert.ok(!code.includes('.delete('));
  });
  test(file + ': clearing a note is persisted without reviving the legacy note', async () => {
    const {c, log} = setup();
    await c._saveVariationNotes('v1','A',1,'Original','  ');
    const meta = log.find(x => x[0] === 'write')[1].meta;
    assert.equal(meta.notes, '');
    assert.equal(meta.variationNotes, '');
    assert.equal(c._variationNotesText(c.ADS[0]), '');
  });
  test(file + ': product switch or incomplete load blocks reads and writes', async () => {
    for (const changes of [{activeProductId:'B'}, {_adsProductId:'B'}, {_uiProductGeneration:2},
      {_cloudLoadFailed:true}, {_productSwitchPending:true}]) {
      const {c, log} = setup();
      Object.assign(c, changes);
      await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /Product changed/);
      assert.equal(log.length, 0);
    }
  });
  test(file + ': switching product during read prevents the write', async () => {
    const {c, log, state} = setup();
    state.afterRead = () => {c.activeProductId = 'B';};
    await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /Product changed/);
    assert.ok(!log.some(x => x[0] === 'write'));
  });
  test(file + ': missing rows never get recreated', async () => {
    const {c, log, state} = setup();
    state.missing = true;
    await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /not found/);
    assert.ok(!log.some(x => x[0] === 'write'));
    assert.equal(c.ADS[0].notes, 'Original');
  });
  test(file + ': concurrent notes edits are not overwritten', async () => {
    const {c, log, state} = setup();
    state.meta.notes = 'Written by teammate';
    await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /changed since/);
    assert.ok(!log.some(x => x[0] === 'write'));
    assert.equal(c.ADS[0].notes, 'Original');
  });
  test(file + ': metadata conflict and network errors leave local data unchanged', async () => {
    for (const failure of ['conflict','readError','saveError']) {
      const {c, state, broadcasts} = setup();
      state[failure] = true;
      await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'));
      assert.equal(c.ADS[0].notes, 'Original');
      assert.equal(broadcasts.length, 0);
    }
  });
  test(file + ': expired session refreshes once and retries the same guarded write', async () => {
    const {c, state, log} = setup();
    state.saveError = {code:'PGRST301', message:'JWT expired'};
    await c._saveVariationNotes('v1','A',1,'Original','New');
    assert.equal(state.refreshes, 1);
    const writes = log.filter(x => x[0] === 'write');
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0][2], writes[1][2]);
    assert.equal(c.ADS[0].notes, 'New');
  });
  test(file + ': failed session renewal keeps edits and shows a useful error code', async () => {
    const {c, state} = setup();
    state.saveError = {code:'PGRST301', message:'JWT expired'};
    state.refreshOK = false;
    await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /PGRST301.*Sign in again/);
    assert.equal(c.ADS[0].notes, 'Original');
    assert.equal(state.refreshes, 1);
  });
  test(file + ': read-back must match before claiming success', async () => {
    const {c, state, broadcasts} = setup();
    state.verifyMismatch = true;
    await assert.rejects(c._saveVariationNotes('v1','A',1,'Original','New'), /did not confirm/);
    assert.equal(c.ADS[0].notes, 'Original');
    assert.equal(broadcasts.length, 0);
  });
  test(file + ': retry after lost acknowledgment confirms an already saved note without rewriting it', async () => {
    const {c, state, log} = setup();
    state.meta.notes = 'New';
    state.meta.variationNotes = 'New';
    await c._saveVariationNotes('v1','A',1,'Original','New');
    assert.equal(log.filter(x => x[0] === 'write').length, 0);
    assert.equal(log.filter(x => x[0] === 'read').length, 2);
    assert.equal(c.ADS[0].notes, 'New');
  });
  test(file + ': dialog uses native focus management, scroll containment, and retains failed edits', () => {
    assert.ok(code.includes('dialog.showModal()'));
    assert.ok(code.includes("dialog.addEventListener('cancel'"));
    assert.ok(code.includes('input.value = original'));
    assert.ok(code.includes('error.textContent = e.message'));
    assert.ok(html.includes('body.varlab-notes-open { overflow: hidden; }'));
    assert.ok(html.includes('overscroll-behavior: contain'));
    assert.ok(code.includes('trigger.focus()'));
  });
  test(file + ': every inline script parses', () => {
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/type="module"|src=/.test(attrs)) new vm.Script(body);
    }
  });
}
