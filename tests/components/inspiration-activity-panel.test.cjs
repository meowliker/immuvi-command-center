const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function fixture() {
  const activity = await import('../../lib/domain/inspiration-activity.js');
  let filter = 'all';
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('app/command-center/components/inspiration-activity-panel.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id === 'react') return { ...React, useId: () => 'activity-title', useState: () => [filter, value => { filter = value; }] };
    if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    if (id.endsWith('use-modal-dialog')) return { useModalDialog: () => ({ current: null }) };
    if (id.endsWith('private-worker-controls')) return { PrivateWorkerControls: () => null };
    if (id.endsWith('inspiration-priority')) return { InspirationPriority: () => React.createElement('button',null,'Run next') };
    if (id.endsWith('inspiration-activity.js')) return activity;
    if (id.endsWith('/format')) return { formatAge: String, formatDateTime: String };
    if(id==='./inspiration-cancel')return {InspirationCancel:props=>React.createElement('button',{'data-cancel-job':props.jobId},'Cancel task')};
    return require(id);
  } });
  const jobs = ['pending', 'running', 'blocked', 'done', 'failed', 'ready', 'unknown'].map(status => ({
    id: status, title: `Job-${status}`, target: status, kind: 'Inspiration', status, stage: status,
    queuedAt: 1000, startedAt: 0, finishedAt: 0, worker: '', assignment: 'auto',
  }));
  const props = { db: {}, mode: 'activity', jobs, errors: [], loaded: true, busy: false, now: 2000,
    workers: [], imageOnline: false, imageKnown: true, inspectableIds: [], classifierWorkers: [] };
  return { jobs, render: () => module.exports.InspirationActivityPanel(props), filter: value => { filter = value; } };
}

test('queue panel shows only queued, running and blocked work, never historical or undispatched rows', async () => {
  const f = await fixture();
  const html = renderToStaticMarkup(f.render());
  for (const status of ['pending', 'running', 'blocked']) assert.ok(html.includes(`Job-${status}`));
  for (const status of ['done', 'failed', 'ready', 'unknown']) assert.ok(!html.includes(`Job-${status}`));
  assert.ok(!html.includes('All rows'));
  assert.ok(!html.includes('<option value="failed">'));
  assert.ok(!html.includes('<option value="classified">'));
  f.filter('running');
  const running = renderToStaticMarkup(f.render());
  assert.ok(running.includes('Job-running')); assert.ok(!running.includes('Job-pending'));
  assert.equal(f.jobs.length, 7, 'History stays available for timing estimates, without being rendered');
});

test('finishing a job removes it from the panel without deleting its history', async () => {
  const f = await fixture();
  for (const job of f.jobs) job.status = 'done';
  const html = renderToStaticMarkup(f.render());
  assert.ok(html.includes('No ongoing or queued tasks.'));
  assert.ok(!html.includes('data-activity-id'));
  assert.equal(f.jobs.length, 7);
});
test('priority controls are available only for queued private jobs',async()=>{
  const f=await fixture();
  for(const job of f.jobs)job.privateJobId=job.id;
  const html=renderToStaticMarkup(f.render());
  assert.equal((html.match(/Run next/g)||[]).length,1);
  f.filter('running');assert.ok(!renderToStaticMarkup(f.render()).includes('Run next'));
});
test('cancel appears only when the server grants control for that active job',async()=>{
  const f=await fixture();
  for(const job of f.jobs)job.privateJobId=job.id;
  f.jobs.find(job=>job.status==='running').canCancel=true;
  const html=renderToStaticMarkup(f.render());
  assert.equal((html.match(/data-cancel-job=/g)||[]).length,1);
  assert.match(html,/data-cancel-job="running"/);
});
