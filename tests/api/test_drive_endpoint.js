// Smoke test for /api/drive/list. Imports the handler directly and
// calls it with a mock req/res — no Vercel server needed.
// Requires GOOGLE_DRIVE_API_KEY in the env (sourced from
// ~/.classify-inspiration.env before running).

import { strict as assert } from 'node:assert';
import handler from '../../api/drive.js';

const AT_079_FOLDER = '1rRLCkrljGA91imdRl-vFhxnM08j_ACnU';

function mockReqRes(query, method = 'GET') {
  let statusCode = 200;
  let body = null;
  const res = {
    setHeader: () => {},
    status: (s) => { statusCode = s; return res; },
    json: (b) => { body = b; return res; },
    end: () => res,
  };
  return { req: { query, method }, res, get: () => ({ statusCode, body }) };
}

async function main() {
  if (!process.env.GOOGLE_DRIVE_API_KEY) {
    console.error('FAIL: GOOGLE_DRIVE_API_KEY not set in env. Source ~/.classify-inspiration.env first.');
    process.exit(1);
  }

  // 1. Happy path against AT-079's real folder
  let { req, res, get } = mockReqRes({ folder: AT_079_FOLDER });
  await handler(req, res);
  let r = get();
  assert.equal(r.statusCode, 200, `happy path status got ${r.statusCode}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.folder_id, AT_079_FOLDER);
  assert.ok(Array.isArray(r.body.files), 'files is array');
  assert.ok(r.body.files.length >= 1, `expected ≥1 file, got ${r.body.files.length}`);
  console.log(`OK happy path: ${r.body.files.length} file(s) returned from "${r.body.folder_name}"`);

  // 2. Missing folder param
  ({ req, res, get } = mockReqRes({}));
  await handler(req, res);
  r = get();
  assert.equal(r.statusCode, 400, 'missing folder should be 400');
  console.log('OK missing folder → 400');

  // 3. Bogus folder id (Drive returns 404)
  ({ req, res, get } = mockReqRes({ folder: 'this-folder-definitely-does-not-exist-xyz123' }));
  await handler(req, res);
  r = get();
  assert.equal(r.statusCode, 404, `bogus folder should be 404 (got ${r.statusCode})`);
  console.log('OK bogus folder → 404');

  // 4. Wrong method
  ({ req, res, get } = mockReqRes({ folder: AT_079_FOLDER }, 'POST'));
  await handler(req, res);
  r = get();
  assert.equal(r.statusCode, 405, 'POST should be 405');
  console.log('OK POST → 405');

  console.log('--- ALL TESTS PASS ---');
}

main().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });
