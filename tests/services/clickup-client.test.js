import test from 'node:test';
import assert from 'node:assert/strict';
import { createClickUpClient } from '../../lib/services/clickup-client.js';
import { QA_CLICKUP_LIST_ID as listId } from '../../lib/domain/clickup-sync.js';

const task = (id) => ({ id, list: { id: listId } });
const client = (handler) => createClickUpClient('synthetic-key', { fetchImpl: handler });

test('identity only reads the authenticated user and returns safe display fields',async()=>{
  const api=client(async(url,options)=>{assert.equal(url,'https://api.clickup.com/api/v2/user');assert.equal(options.method,'GET');return Response.json({user:{id:42,username:'Teammate',email:'user@example.test',token:'must-not-return'}});});
  assert.deepEqual(await api.identity(),{id:'42',name:'Teammate',email:'user@example.test'});
  await assert.rejects(client(async()=>Response.json({user:{}})).identity(),/identity/);
});

test('cleanup pagination requires explicit end markers and rejects duplicate IDs even on the final page', async () => {
  await assert.rejects(client(async () => Response.json({ tasks: [task('one')] })).tasks(listId, { requireExplicitEnd: true }), /explicitly/);
  let count = 0;
  await assert.rejects(client(async () => Response.json({ tasks: [task('one')], last_page: ++count > 1 })).tasks(listId, { requireExplicitEnd: true }), /repeated/);
  const archived = [];
  const tasks = await client(async (url) => { const value = new URL(url).searchParams.get('archived'); archived.push(value); return Response.json({ tasks: [task(value)], last_page: true }); }).tasks(listId, { requireExplicitEnd: true, includeArchived: true });
  assert.deepEqual(archived, ['false','true']); assert.equal(tasks.length, 2);
});

test('task pagination includes closed/subtasks and continues beyond 500 tasks', async () => {
  let calls = 0;
  const api = client(async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get('include_closed'), 'true');
    assert.equal(params.get('subtasks'), 'true');
    const page = Number(params.get('page'));
    calls++;
    return Response.json({ tasks: Array.from({ length: page === 6 ? 1 : 100 }, (_, i) => task(`${page}-${i}`)) });
  });
  assert.equal((await api.tasks(listId)).length, 601);
  assert.equal(calls, 7);
});
test('partial failures, missing arrays, repeated pages and foreign tasks abort imports', async () => {
  for (const response of [{ tasks: [task('1')], last_page: false }, {}, { tasks: [{ id: '1', list: { id: 'prod' } }] }]) {
    await assert.rejects(client(async () => Response.json(response)).tasks(listId));
  }
  await assert.rejects(client(async () => new Response('', { status: 429 })).tasks(listId), /rate limit/);
});
test('no request is sent for an unapproved list', async () => {
  const api = client(() => { throw new Error('must not fetch'); });
  await assert.rejects(api.inspect('prod'), /restricted/);
  await assert.rejects(api.tasks('prod'), /restricted/);
  await assert.rejects(api.updateTask('prod', 'abc', { status: 'testing' }), /restricted/);
  await assert.rejects(api.createTask('prod', {}), /restricted/);
  await assert.rejects(api.inspect('901616718146'), /restricted/);
  await assert.rejects(api.createTask('901616718146', {}), /restricted/);
});
test('retired-list tasks cannot be edited through the replacement test list', async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push(options.method);
    return Response.json({ id: 'old-task', list: { id: '901616718146' } });
  });
  await assert.rejects(api.updateTask(listId, 'old-task', { status: 'testing' }), /does not belong/);
  await assert.rejects(api.setField(listId, 'old-task', { id: 'angle', type: 'text' }, 'New'), /does not belong/);
  assert.deepEqual(calls, ['GET', 'GET']);
});
test('task writes verify remote list ownership before sending PUT', async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push(options.method);
    return Response.json({ id: 'abc', list: { id: 'prod' } });
  });
  await assert.rejects(api.updateTask(listId, 'abc', { status: 'testing' }), /does not belong/);
  assert.deepEqual(calls, ['GET']);
});
test('task write forwards only supported native updates; failures are not retried', async () => {
  const calls = [];
  const api = client(async (url, options) => {
    calls.push(options.method);
    if (options.method === 'GET') return Response.json(task('abc'));
    assert.deepEqual(JSON.parse(options.body), { due_date: null });
    return new Response('private body must not leak', { status: 500 });
  });
  await assert.rejects(api.updateTask(listId, 'abc', { due_date: null }), /500/);
  assert.deepEqual(calls, ['GET', 'PUT']);
  await assert.rejects(api.updateTask(listId, 'abc', { url: 'bad' }), /Unsupported/);
});

test('status writes require a matching read-back even when ClickUp responds 200', async () => {
  for (const accepted of [true, false]) {
    let status = 'untested';
    const methods = [];
    const api = client(async (url, options) => {
      methods.push(options.method);
      if (options.method === 'PUT' && accepted) status = JSON.parse(options.body).status;
      return Response.json({ ...task('abc'), status: { status } });
    });
    if (accepted) await api.updateTask(listId, 'abc', { status: 'testing' });
    else await assert.rejects(api.updateTask(listId, 'abc', { status: 'testing' }), /did not confirm.*remains pending/);
    assert.deepEqual(methods, ['GET', 'PUT', 'GET']);
  }
});
test('custom fields preserve zero/false, clear with DELETE, and diff user membership', async () => {
  const writes = [];
  const api = client(async (url, options) => {
    if (options.method === 'GET') return Response.json({ ...task('abc'), custom_fields: [{ id: 'users', value: [{ id: 1 }, { id: 2 }] }] });
    writes.push({ method: options.method, body: options.body ? JSON.parse(options.body) : null });
    return new Response(null, { status: 204 });
  });
  await api.setField(listId, 'abc', { id: 'number', type: 'number' }, 0);
  await api.setField(listId, 'abc', { id: 'check', type: 'checkbox' }, false);
  await api.setField(listId, 'abc', { id: 'text', type: 'text' }, null);
  await api.setField(listId, 'abc', { id: 'users', type: 'users' }, [2, 3]);
  assert.deepEqual(writes, [{ method: 'POST', body: { value: 0 } }, { method: 'POST', body: { value: false } },
    { method: 'DELETE', body: null }, { method: 'POST', body: { value: { add: [3], rem: [1] } } }]);
});
test('delete and comments refuse foreign tasks; already deleted task is idempotent', async () => {
  const api = client(async () => Response.json({ ...task('abc'), list: { id: 'prod' } }));
  await assert.rejects(api.deleteTask(listId, 'abc'), /does not belong/);
  await assert.rejects(api.comment(listId, 'abc', 'winner'), /does not belong/);
  assert.deepEqual(await client(async () => new Response('', { status: 404 })).deleteTask(listId, 'abc'), {});
});
test('native assignees add/remove diffs do not remove retained members', async () => {
  const api = client(async (url, options) => {
    if (options.method === 'GET') return Response.json({ ...task('abc'), assignees: [{ id: 1 }, { id: 2 }] });
    assert.deepEqual(JSON.parse(options.body), { assignees: { add: [3], rem: [1] } });
    return Response.json({});
  });
  await api.setAssignees(listId, 'abc', [2, 3]);
});
test('recovery scans both active and archived tasks and deduplicates overlaps',async () => {
  const requests=[];
  const api=client(async (url) => {
    const archived=new URL(url).searchParams.get('archived');requests.push(archived);
    return Response.json({tasks:[task('shared'),task(archived==='true' ? 'archived' : 'active')],last_page:true});
  });
  assert.equal((await api.tasks(listId,{includeArchived:true})).length,3);
  assert.deepEqual(requests,['false','true']);
});
test('creation tags verify list ownership and explicit validation errors retain status without body leaks',async () => {
  const writes=[];
  const api=client(async (url,options) => {
    if(options.method==='GET') return Response.json(task('abc'));
    writes.push(url);return new Response(null,{status:204});
  });
  await api.addTag(listId,'abc','production');assert.ok(writes[0].endsWith('/task/abc/tag/production'));
  await assert.rejects(api.addTag(listId,'abc','foreign-tag'),/Unsupported/);
  const denied=client(async () => new Response('private',{status:401}));
  await assert.rejects(denied.createTask(listId,{name:'test'}),(error) => error.status===401 && !error.message.includes('private'));
});
test('schema inspection requests task-type applicability instead of silently dropping scoped fields',async () => {
  const api=client(async (url) => {
    if(new URL(url).pathname.endsWith('/field')) {
      assert.equal(new URL(url).searchParams.get('include_applied_objects'),'true');return Response.json({fields:[]});
    }
    return Response.json({id:listId,name:'QA list',statuses:[]});
  });
  assert.deepEqual((await api.inspect(listId)).fields,[]);
});
