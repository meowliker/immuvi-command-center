import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  async function setup() {
    const html = await readFile(file, 'utf8');
    const start = html.indexOf('function _apResolveCellIdentity(');
    const context = vm.createContext({});
    vm.runInContext(html.slice(start, html.indexOf('\n}', start) + 2), context);
    const ad = {id:'creative', _clickupId:'task', angle:'Current angle', persona:'Current persona',
      _customFields:{'angle tag':'Current angle','persona tag':'Current persona'}};
    const action = {sourceAdId:ad.id, _clickupId:'task', angle:'Old angle', sourceAngle:'Old angle',
      persona:'Old persona', sourcePersona:'Old persona'};
    return {resolve:context._apResolveCellIdentity, ad, action};
  }

  test(`${file}: exact same-task action displays current creative taxonomy without writing`, async () => {
    const {resolve, ad, action} = await setup();
    const before = JSON.stringify({ad, action});
    const result = resolve(action, ad);
    assert.equal(result.angle, ad.angle);
    assert.equal(result.persona, ad.persona);
    assert.equal(JSON.stringify({ad, action}), before);
  });

  test(`${file}: parent, missing, and unverified links retain action taxonomy`, async () => {
    for (const change of [a=>{a._clickupId='child';}, a=>{delete a._clickupId;}, a=>{a.sourceAdId='other';}]) {
      const {resolve, ad, action} = await setup();
      change(action);
      const result = resolve(action, ad);
      assert.equal(result.angle, 'Old angle');
      assert.equal(result.persona, 'Old persona');
    }
    const {resolve, action} = await setup();
    assert.equal(resolve(action, null).angle, 'Old angle');
  });

  test(`${file}: absent current labels retain the saved action labels`, async () => {
    const {resolve, ad, action} = await setup();
    ad.angle='';ad.persona='';
    const result=resolve(action, ad);
    assert.equal(result.angle,'Old angle');
    assert.equal(result.persona,'Old persona');
  });
}
