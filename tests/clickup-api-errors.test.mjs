import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import handler from '../api/clickup.js';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../'+file, import.meta.url), 'utf8');
  function setup(response) {
    const c = vm.createContext({CFG:{key:'private-test-key'}, Date, Number, console,
      apiUrl: path => path, fetch: async () => response});
    vm.runInContext(html.slice(html.indexOf('function apiFetch('), html.indexOf('function apiCreateTask(')), c);
    vm.runInContext(html.slice(html.indexOf('function fetchAllTasks('), html.indexOf('// Low-level: set a single ClickUp custom field')), c);
    return c;
  }
  test(file+': preserves status and rate-limit reset without exposing credentials', async () => {
    for (const status of [401,403,404,429,503]) {
      const reset = Math.ceil(Date.now()/1000)+90;
      const c = setup(new Response('{"err":"Rejected","ECODE":"OAUTH_019"}', {status, headers:{'x-ratelimit-reset':String(reset),'retry-after':'60'}}));
      await assert.rejects(c.apiFetch('/list/test/task'), err => {
        assert.equal(err.status, status); assert.equal(err.service, 'clickup');
        assert.equal(err.retryAt, reset*1000); assert.ok(!err.message.includes('private-test-key')); return true;
      });
    }
  });
  test(file+': malformed and structurally invalid responses cannot erase the task list', async () => {
    const c = setup(new Response('{broken', {status:200}));
    await assert.rejects(c.fetchAllTasks('list'), error => error.code === 'INVALID_RESPONSE');
    c.fetch = async () => new Response('{"err":"Not a task list"}', {status:200});
    await assert.rejects(c.fetchAllTasks('list'), error => error.code === 'INVALID_RESPONSE');
    c.fetch = async () => new Response('{"tasks":[]}', {status:200});
    assert.equal((await c.fetchAllTasks('list')).length, 0);
  });
  test(file+': pagination uses the captured key even when another key is entered', async () => {
    const c = setup(); const keys = [];
    c.apiFetch = async (_, options) => {
      keys.push(options.apiKey); c.CFG.key = 'replacement';
      return {tasks:keys.length===1?Array.from({length:100},(_,id)=>({id})):[]};
    };
    assert.equal((await c.fetchAllTasks('list')).length, 100);
    assert.deepEqual(keys, ['private-test-key','private-test-key']);
  });
}

function response() {
  return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    status(code){this.code=code;return this;},json(body){this.body=body;return this;},
    send(body){this.body=body;return this;},end(){return this;}};
}
test('proxy forwards rate-limit headers and status, disables caching, and logs no token/content', async t => {
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers.Authorization, 'secret-test-key');
    assert.ok(options.signal);
    return new Response('{"err":"private response body","ECODE":"OAUTH_019"}', {
      status:429,headers:{'retry-after':'42','x-ratelimit-reset':'1791279000','x-ratelimit-remaining':'0'}});
  });
  const res = response();
  await handler({method:'GET',url:'/api/clickup?path=%2Flist%2Ftest%2Ftask',headers:{authorization:'secret-test-key'}},res);
  assert.equal(res.code,429); assert.equal(res.headers['retry-after'],'42');
  assert.equal(res.headers['x-ratelimit-reset'],'1791279000');
  assert.equal(res.headers['cache-control'],'private, no-store');
  assert.equal(res.headers.vary,'Authorization');
  assert.doesNotMatch(JSON.stringify(logs), /secret-test-key|private response body/);
});
test('proxy rejects missing credentials without fetching and never retries writes', async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async (_,opts)=>{calls++;assert.equal(opts.signal,undefined);return new Response(null,{status:204});});
  const missing = response();
  await handler({method:'GET',url:'/api/clickup?path=%2Fteam',headers:{}},missing);
  assert.equal(missing.code,401); assert.equal(calls,0);
  const write = response();
  await handler({method:'POST',url:'/api/clickup?path=%2Ftask%2Ftest',headers:{authorization:'test'},body:{name:'keep'}},write);
  assert.equal(write.code,204); assert.equal(calls,1);
});
test('proxy read timeout is explicit and reveals no network details', async t => {
  t.mock.method(console,'error',()=>{});
  t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(new Error('private details'),{name:'TimeoutError'});});
  const res = response();
  await handler({method:'GET',url:'/api/clickup?path=%2Fteam',headers:{authorization:'test'}},res);
  assert.equal(res.code,504); assert.doesNotMatch(JSON.stringify(res.body),/private details/);
});
