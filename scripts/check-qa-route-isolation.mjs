import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

if (execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'qa') throw new Error('Run only on qa.');
const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3001');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password) throw new Error('Only a loopback QA server may be probed.');
const results = [];
async function probe(path, method = 'GET') {
  return fetch(new URL(path, base), { method, redirect: 'manual', signal: AbortSignal.timeout(30000) });
}
for (const path of ['/immuvi-command-center.html', '/immuvi-command-center-v2.html', '/action-plan-live.html']) {
  const response = await probe(path); assert.equal(response.status, 307, path);
  assert.equal(new URL(response.headers.get('location'), base).href, new URL('/', base).href);
  assert.equal(await response.text(), ''); assert.equal(response.headers.get('cache-control'), 'no-store');
  results.push(`${path}: root-only redirect`);
}
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  const response = await probe('/api/clickup?path=/task/not-a-real-task', method);
  assert.equal(response.status, 503); assert.equal((await response.json()).dispatchEnabled, false);
  results.push(`Legacy ClickUp ${method}: disabled`);
}
for (const [path, method] of [['/api/onescale-launch-callback', 'POST'], ['/api/install-skill', 'GET'], ['/install-skill.sh', 'GET'], ['/team-skill/classify_inspiration.py', 'GET']]) {
  const response = await probe(path, method); assert.equal(response.status, 503, path);
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal((await response.json()).code, 'QA_INTEGRATION_DISABLED');
  results.push(`${path}: disabled`);
}
for (const path of ['/api/clickup/qa', '/api/clickup/qa-cleanup']) {
  const unconfiguredCleanup = process.env.QA_RELEASE_REHEARSAL === '1' && path === '/api/clickup/qa-cleanup';
  const response = await probe(path, 'POST'); assert.equal(response.status, unconfiguredCleanup ? 503 : 401, path);
  if (unconfiguredCleanup) {
    assert.equal((await response.json()).error, 'QA cleanup service is not configured.');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  results.push(`${path}: ${unconfiguredCleanup ? 'unconfigured service disabled' : 'unauthenticated request rejected'}`);
}
const root = await probe('/'); assert.equal(root.status, 200);
const html = await root.text(); assert.ok(html.includes('Immuvi Command Center'));
assert.ok(!html.includes('hdniumnkprkadlrrataz.supabase.co'));
results.push('Root: native dashboard served without production Supabase URL');
const strategist = await probe('/api/strategist?op=config'); assert.equal(strategist.status, 404);
results.push('Legacy static Strategist: no configuration API exposed by Next');
console.log(JSON.stringify({ results, passed: results.length, databaseMutations: 0 }, null, 2));
