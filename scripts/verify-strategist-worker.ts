import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import postgres from 'postgres'
// @ts-ignore local Node utility
import { targetEnv } from './strategist-env.mjs'

Object.assign(process.env, targetEnv())
const sql = postgres(process.env.STRATEGIST_DATABASE_URL!, { max: 1, prepare: false, ssl: 'require' })
const { default: handler } = await import('../strategist/src/server/handler')
const ids: string[] = []
const report: Record<string, unknown> = { basis: 'Live database and actual worker child; authentication lookup replaced only within this test process' }
const realFetch = globalThis.fetch
let actor = ''
globalThis.fetch = (async (input: any, init: any) => {
  if (String(input).endsWith('/auth/v1/user') && init?.headers?.Authorization === 'Bearer local-worker-verification') {
    return new Response(JSON.stringify({ id: actor }), { status: 200 })
  }
  return realFetch(input, init)
}) as typeof fetch
async function call(op: string, body: unknown) {
  let status = 200, data: any
  const response = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { data = value; return this } }
  await handler({ url: `/api/strategist?op=${op}`, method: 'POST', headers: { authorization: 'Bearer local-worker-verification' }, body }, response)
  return { status, data }
}
async function runOnce() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/strategist-worker.mjs', '--once'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Worker exited ${code}: ${output}`)))
  })
}
try {
  const active = await sql`select id from strategist_jobs where status in ('queued','running')`
  assert.equal(active.length, 0, 'Live work exists; leave it untouched and rerun this check when idle')
  const [admin] = await sql`select id from profiles where role='admin' and is_active order by created_at limit 1`
  assert.ok(admin)
  actor = admin.id
  const requestId = randomUUID()
  const queued = await call('jobs', { kind: 'snapshot', product: 'ad', requestId })
  assert.equal(queued.status, 200, JSON.stringify(queued.data))
  ids.push(queued.data.id)
  const sameRequest = await call('jobs', { kind: 'snapshot', product: 'ad', requestId })
  const duplicateClick = await call('jobs', { kind: 'snapshot', product: 'ad', requestId: randomUUID() })
  assert.equal(sameRequest.data.id, queued.data.id)
  assert.equal(duplicateClick.status, 409)
  await runOnce()
  const [finished] = await sql`select * from strategist_jobs where id=${queued.data.id}`
  assert.equal(finished.status, 'succeeded', finished.error || JSON.stringify(finished.log))
  assert.equal(finished.attempts, 1)
  assert.ok(finished.finished_at)
  const snapshot = JSON.parse(await readFile('strategist/data/snapshot-ad.json', 'utf8'))
  assert.ok(snapshot.creatives.length > 0)
  assert.ok(snapshot.creatives.every((creative: any) => creative.product === 'ad'))
  report.snapshot = { status: finished.status, attempts: finished.attempts, totals: snapshot.totals, log: finished.log }
  report.idempotency = 'Same request returns the original job; a duplicate action is rejected with 409'
  const cancellable = await call('jobs', { kind: 'snapshot', product: 'ad', requestId: randomUUID() })
  ids.push(cancellable.data.id)
  assert.equal((await call('cancel', { id: cancellable.data.id })).status, 200)
  await runOnce()
  const [cancelled] = await sql`select status,attempts from strategist_jobs where id=${cancellable.data.id}`
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.attempts, 0)
  report.cancellation = 'Queued cancellation performs no work'
  assert.equal((await call('jobs', { kind: 'not-a-command', product: 'ad', requestId: randomUUID() })).status, 400)
  report.validation = 'Unknown commands rejected'
  await mkdir('backups/strategist-verification', { recursive: true, mode: 0o700 })
  await writeFile('backups/strategist-verification/worker-report.json', JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log(JSON.stringify(report, null, 2))
} finally {
  // Remove only this test's jobs; retain the verification report and local snapshot.
  for (const id of ids) await sql`delete from strategist_jobs where id=${id} and requested_by=${actor}`
  globalThis.fetch = realFetch
  await sql.end()
  await (globalThis as any).__strategistSql?.end()
}
