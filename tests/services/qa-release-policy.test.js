import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ROUTES, QA_REF, assertArtifactPath, assertBuildSpace, assertRoutes, assertSourcePath, fileHash, releaseEnvironment, verifyArtifact } from '../../scripts/qa-release-policy.mjs';

test('release environment does not inherit production credentials or executable overrides', () => {
  const env = releaseEnvironment({ PATH:'/bin', SUPABASE_SERVICE_ROLE_KEY:'secret', QA_SUPABASE_SERVICE_ROLE_KEY:'also-secret',
    NEXT_PUBLIC_SUPABASE_URL:'production', VERCEL_PROJECT_ID:'production-project', GOOGLE_DRIVE_API_KEY:'secret', NODE_OPTIONS:'--import malicious.mjs' });
  assert.deepEqual(Object.keys(env).sort(), ['NEXT_TELEMETRY_DISABLED','NODE_ENV','PATH','QA_SUPABASE_URL']);
  assert.equal(env.QA_SUPABASE_URL, 'https://entgcnlfsnysnwyadzzp.supabase.co');
});

test('low disk space stops packaging before copying dependencies or starting a build', () => {
  for (const bytes of [NaN, Infinity, 0, 568 * 1024 ** 2]) assert.throws(() => assertBuildSpace(bytes), /2 GiB free/);
  assert.doesNotThrow(() => assertBuildSpace(2 * 1024 ** 3));
});
test('source packaging allows only native app dependencies and font assets', () => {
  for (const path of ['app/page.tsx','app/install-skill.sh/route.js','lib/qa-disabled-route.js','public/fonts/satoshi-bold.woff2','api/drive/list.js','package-lock.json']) assert.doesNotThrow(() => assertSourcePath(path));
  for (const path of ['.env.local','app/.env','app/../api/install-skill.js','api/clickup.js','vercel.json','public/strategist.html','supabase/migrations/test.sql','team-skill/run.py','app/key.pem']) assert.throws(() => assertSourcePath(path));
});
test('release route inventory rejects added or missing entry points', () => {
  const routes = Object.fromEntries(APP_ROUTES.map((route) => [route, 'compiled.js']));
  assert.doesNotThrow(() => assertRoutes(routes));
  assert.throws(() => assertRoutes({ ...routes, '/api/strategist/route':'legacy.js' }));
  delete routes['/page']; assert.throws(() => assertRoutes(routes));
});
test('artifact inspection excludes deployment links, secrets, executable legacy assets and root APIs', () => {
  for (const path of ['server.js','.next/server/app/page.js','.next/server/app/team-skill/[...path]/route.js','public/fonts/satoshi-bold.woff2']) assert.doesNotThrow(() => assertArtifactPath(path));
  for (const path of ['.env.local','.vercel/project.json','public/strategist.html','public/strategist-assets/app.js','api/clickup.js','vercel.json','team-skill/run.py','supabase/config.toml']) assert.throws(() => assertArtifactPath(path));
});

test('release verification detects tampering and additional files before starting a server', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-release-policy-'));
  try {
    mkdirSync(join(root, '.next/server'), { recursive:true });
    const routeFile = '.next/server/app-paths-manifest.json';
    writeFileSync(join(root, routeFile), JSON.stringify(Object.fromEntries(APP_ROUTES.map((route) => [route,'compiled.js']))));
    writeFileSync(join(root, 'server.js'), 'original');
    const manifest = { version:1, branch:'qa', qaProjectRef:QA_REF, deploymentApproved:false,
      artifactHashes:{ [routeFile]:fileHash(join(root, routeFile)), 'server.js':fileHash(join(root, 'server.js')) } };
    assert.doesNotThrow(() => verifyArtifact(root, manifest));
    writeFileSync(join(root, 'server.js'), 'changed'); assert.throws(() => verifyArtifact(root, manifest), /hash changed/);
    writeFileSync(join(root, 'server.js'), 'original'); writeFileSync(join(root, 'extra.js'), 'extra');
    assert.throws(() => verifyArtifact(root, manifest), /inventory changed/);
    assert.throws(() => verifyArtifact(root, { ...manifest, qaProjectRef:'production' }), /Not an unapproved QA/);
  } finally { rmSync(root, { recursive:true, force:true }); }
});
