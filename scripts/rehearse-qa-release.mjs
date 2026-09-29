import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileHash, releaseEnvironment, verifyArtifact } from './qa-release-policy.mjs';

if (execFileSync('git', ['branch','--show-current'], { encoding:'utf8' }).trim() !== 'qa') throw new Error('Run only on qa.');
if (!process.argv[2]) throw new Error('Pass the local output directory from build-qa-release.mjs.');
const release = realpathSync(process.argv[2]), artifact = join(release, 'artifact');
const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'));
const productionConfigHash = fileHash('vercel.json');
verifyArtifact(artifact, manifest);
const results = [];
let child, stopped;
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  await Promise.race([stopped, sleep(5000)]);
  if (child.exitCode === null && !child.signalCode) { child.kill('SIGKILL'); await stopped; }
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function probe(base, path, status) {
  const response = await fetch(new URL(path, base), { redirect:'manual', signal:AbortSignal.timeout(10000) });
  assert.equal(response.status, status, path);
  return response;
}
try {
  for (const cycle of ['candidate', 'same-artifact-restart']) {
    const port = await freePort(), base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['server.js'], { cwd:artifact, env:{ ...releaseEnvironment(process.env), HOSTNAME:'127.0.0.1', PORT:String(port) }, stdio:['ignore','pipe','pipe'] });
    let logs = '';
    child.stdout.on('data', (data) => { logs = (logs + data).slice(-8000); });
    child.stderr.on('data', (data) => { logs = (logs + data).slice(-8000); });
    stopped = new Promise((resolve) => { child.once('exit', resolve); child.once('error', resolve); });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error(`QA server exited: ${logs}`);
      try { await probe(base, '/', 200); ready = true; break; } catch { await sleep(100); }
    }
    if (!ready) throw new Error(`QA server failed readiness: ${logs}`);
    const isolation = spawnSync(process.execPath, ['scripts/check-qa-route-isolation.mjs'], {
      env:{ ...releaseEnvironment(process.env), TEST_BASE_URL:base, QA_RELEASE_REHEARSAL:'1' }, encoding:'utf8', timeout:120000,
    });
    if (isolation.status !== 0) throw new Error(isolation.stderr || 'Route isolation failed.');
    const checks = JSON.parse(isolation.stdout);
    for (const path of ['/strategist.html','/strategist-assets/app.js','/api/strategist','/api/admin.js','/.env.local','/vercel.json']) await probe(base, path, 404);
    await probe(base, '/api/admin/health', 503);
    await probe(base, '/api/drive/list?folder=qa-not-a-folder', 503);
    await probe(base, '/fonts/satoshi-regular.woff2', 200);
    const html = await (await probe(base, '/', 200)).text();
    const chunks = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map((match) => match[1]))];
    assert.ok(chunks.length > 0, 'No built JS/CSS found.');
    for (const path of chunks) await probe(base, path.replaceAll('&amp;', '&'), 200);
    if (cycle === 'candidate' && process.argv.includes('--browser')) {
      if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright entry point.');
      const browser = spawnSync(process.execPath, ['tests/browser/command-center-live.cjs'], {
        env:{ ...releaseEnvironment(process.env), PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE, TEST_BASE_URL:base,
          BROWSER_ARTIFACTS:join(release, 'browser'), RELEASE_AUDIT_ONLY:'1' },
        encoding:'utf8', timeout:180000, maxBuffer:2000000,
      });
      if (browser.status !== 0) throw new Error(browser.stderr || 'Built browser acceptance failed.');
      results.push({ cycle, browser:JSON.parse(browser.stdout) });
    }
    results.push({ cycle, routeProbes:checks.passed + 9, staticChunks:chunks.length, outcome:'passed' });
    await stop(); child = null;
    verifyArtifact(artifact, manifest);
  }
  assert.equal(fileHash('vercel.json'), productionConfigHash);
  const receipt = { results, productionConfigUnchanged:true, liveIntegrations:'not exercised', externalDeployment:false,
    rollback:'Same-artifact stop/restart verified; prior deployed release restoration not exercised.' };
  writeFileSync(join(release, 'rehearsal.json'), JSON.stringify(receipt, null, 2), { mode:0o600 });
  console.log(JSON.stringify(receipt, null, 2));
} finally { await stop(); }
