import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CODEX_APP_PATHS, discoverCodexExecutable, resolveConfiguredCodexExecutable } from '../../lib/services/codex-executable.js';

const old = '/Applications/ChatGPT.app/Contents/Resources/codex';
const current = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex';

test('Bug 37: a moved app CLI resolves within the same bundle without changing credentials', async () => {
  const seen = [];
  assert.equal(await resolveConfiguredCodexExecutable(old, { probe: async path => { seen.push(path); return path === current; } }), current);
  assert.deepEqual(seen, [old, current]);
  assert.equal(await resolveConfiguredCodexExecutable(current, { probe: async path => path === old }), old);
});

test('enrolled custom paths and permission failures never fall back to a different binary', async () => {
  const seen = [];
  await assert.rejects(resolveConfiguredCodexExecutable('/custom/codex', { probe: async path => { seen.push(path); return false; } }), /missing/);
  assert.deepEqual(seen, ['/custom/codex']);
  await assert.rejects(resolveConfiguredCodexExecutable(old, { probe: async () => { throw new Error('permission failure'); } }), /permission failure/);
  await assert.rejects(resolveConfiguredCodexExecutable(old, { probe: async path => path.includes('Codex.app') }), /missing/);
});

test('installation discovers modern bundles without PATH and respects explicit absolute overrides', async () => {
  assert.equal(await discoverCodexExecutable({ env: { PATH: '' }, probe: async path => path === current }), current);
  assert.equal(await discoverCodexExecutable({ env: { CODEX_BIN: '/custom/codex' }, probe: async () => true }), '/custom/codex');
  await assert.rejects(discoverCodexExecutable({ env: { CODEX_BIN: 'codex' }, probe: async () => true }), /absolute/);
  await assert.rejects(discoverCodexExecutable({ env: { CODEX_BIN: '/missing/codex', PATH: '/working' }, probe: async path => path === '/working/codex' }), /missing/);
  const seen = [];
  await assert.rejects(discoverCodexExecutable({ env: { PATH: ':relative:.' }, probe: async path => { seen.push(path); return false; } }), /not found/);
  assert.deepEqual(seen, CODEX_APP_PATHS);
});

test('filesystem resolution rejects missing, non-executable and directory paths', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'immuvi-codex-path-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const binary = join(directory, 'codex');
  await writeFile(binary, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  assert.equal(await resolveConfiguredCodexExecutable(binary), binary);
  const blocked = join(directory, 'not-executable');
  await writeFile(blocked, 'not executable', { mode: 0o600 });
  await assert.rejects(resolveConfiguredCodexExecutable(blocked), /not usable/);
  const folder = join(directory, 'folder'); await mkdir(folder);
  await assert.rejects(resolveConfiguredCodexExecutable(folder), /not usable/);
  await assert.rejects(resolveConfiguredCodexExecutable(join(directory, 'absent')), /missing/);
  for (const path of ['codex', '/foo/../codex', '/codex\n']) await assert.rejects(resolveConfiguredCodexExecutable(path), /absolute/);
});

test('QA installer and runtime use the resolver before client construction or claims', async () => {
  const shared = await readFile(new URL('../../scripts/install-shared-qa-worker.mjs', import.meta.url), 'utf8');
  const personal = await readFile(new URL('../../scripts/install-private-worker.mjs', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../../scripts/private-worker.mjs', import.meta.url), 'utf8');
  assert.match(shared, /codexBin=await discoverCodexExecutable\(\)/);
  assert.match(personal, /codexBin = await discoverCodexExecutable\(\)/);
  assert(worker.indexOf('await resolveConfiguredCodexExecutable(configured.codexBin)') < worker.indexOf('const db = client()'));
  assert.match(worker, /process\.env\.IMMUVI_CODEX_BIN = config\.codexBin/);
  const guard = worker.indexOf('if (currentExecutable !== config.codexBin)');
  assert(guard > 0 && guard < worker.indexOf("await rpc(shared?'qa_shared_inspiration_claim'"));
  assert.match(worker.slice(guard, worker.indexOf('const job = classifier', guard)), /if \(pool\.size \|\| current\).*continue.*process\.exitCode=75;stopped=true;break/s);
});
