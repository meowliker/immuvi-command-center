import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {REVIEW_VERSION, REVIEW_PROMPT, REVIEW_SCHEMA, reviewInput, hasEvidence, needsReview, validateAssessment} from './taxonomy-review-core.mjs';

const safeId = /^[a-zA-Z0-9_-]{1,160}$/;
export function reviewCommand(codex, schema, output) {
  return [codex, 'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--output-schema', schema, '--output-last-message', output,
    '-c', 'web_search="disabled"', '-c', 'approval_policy="never"',
    ...['shell_tool','apps','plugins','hooks','multi_agent','browser_use','computer_use','image_generation','view_image','skill_search','code_mode','code_mode_host'].flatMap(f => ['--disable', f]), '-'];
}

export async function runAgent(input, proposals, {env = process.env, spawnImpl = spawn} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'immuvi-taxonomy-'));
  try {
    const schema = join(directory, 'schema.json'), output = join(directory, 'result.json');
    await writeFile(schema, JSON.stringify(REVIEW_SCHEMA), {mode:0o600});
    // Keep database/API credentials out of the tool-less model subprocess.
    const childEnv = Object.fromEntries(['HOME','PATH','CODEX_HOME','TMPDIR','LANG'].filter(k => env[k]).map(k => [k, env[k]]));
    const [command, ...args] = reviewCommand(env.CODEX_BIN || 'codex', schema, output);
    await new Promise((resolve, reject) => {
      const child = spawnImpl(command, args, {cwd:directory, env:childEnv, stdio:['pipe','ignore','ignore']});
      const timeout = setTimeout(() => child.kill('SIGKILL'), 180000);
      child.once('error', () => {clearTimeout(timeout); reject(new Error('Review agent could not start. Update/restart Codex on the Mac mini.'));});
      child.once('close', code => {clearTimeout(timeout); code === 0 ? resolve() : reject(new Error('Review agent failed or timed out. Update/restart Codex on the Mac mini, then retry.'));});
      child.stdin.on('error', () => {});
      child.stdin.end(REVIEW_PROMPT + '\n\nDATA:\n' + JSON.stringify({...input, proposedCandidates:proposals}));
    });
    return JSON.parse(await readFile(output, 'utf8'));
  } finally {
    await rm(directory, {recursive:true, force:true});
  }
}

export async function runReview(jobId, workerId, {env = process.env, fetchImpl = fetch, agent = runAgent} = {}) {
  if (!safeId.test(jobId) || workerId !== 'gp-mac-mini') throw new Error('Invalid review worker or job.');
  const headers = {apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json'};
  const base = env.SUPABASE_URL;
  if (!base || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Worker database configuration is missing.');
  async function read(table, query) {
    const response = await fetchImpl(`${base}/rest/v1/${table}?${query}`, {headers, signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Review evidence could not be read. Retry when the database is available.');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid review evidence response.');
    return rows;
  }
  let claim;
  async function finish(patch) {
    // The ONLY writable table in this runner is its own review queue.
    const response = await fetchImpl(`${base}/rest/v1/taxonomy_review_jobs?id=eq.${jobId}&status=eq.running&claimed_by=eq.${workerId}&claimed_at=eq.${encodeURIComponent(claim)}`, {
      method:'PATCH', headers, signal:AbortSignal.timeout(20000), body:JSON.stringify({...patch, finished_at:new Date().toISOString()})
    });
    if (!response.ok) throw new Error('Could not save review result.');
  }
  const [job] = await read('taxonomy_review_jobs', `id=eq.${jobId}&status=eq.running&claimed_by=eq.${workerId}&select=*`);
  if (!job) return;
  claim = job.claimed_at;
  try {
    const {product_id:pid, ins_id:insId} = job;
    if (!safeId.test(pid) || !safeId.test(insId)) throw new Error('Invalid review identity.');
    if (!safeId.test(job.requested_by)) throw new Error('Invalid requester.');
    const [profile] = await read('profiles', `id=eq.${job.requested_by}&select=id,role,is_active`);
    if (!profile?.is_active) throw new Error('Requester no longer has access.');
    if (profile.role !== 'admin') {
      const access = await read('user_products', `user_id=eq.${job.requested_by}&product_id=eq.${pid}&select=product_id`);
      if (!access.some(r => r.product_id === pid)) throw new Error('Requester no longer has product access.');
    }
    const [product] = await read('products', `id=eq.${pid}&select=id,name,offer:config->production->>offer,description:config->>description`);
    const [ins] = await read('inspirations', `id=eq.${insId}&product_id=eq.${pid}&select=id,product_id,data`);
    if (!product || product.id !== pid || !ins || ins.product_id !== pid) throw new Error('Inspiration is no longer in this product.');
    const angles = await read('angles', `product_id=eq.${pid}&archived_at=is.null&select=id,product_id,name,notes`);
    const personas = await read('personas', `product_id=eq.${pid}&archived_at=is.null&select=id,product_id,name,notes`);
    const input = reviewInput(product, angles, personas, ins);
    const previous = await read('taxonomy_review_jobs', `product_id=eq.${pid}&status=eq.complete&order=finished_at.desc&limit=40&select=result`);
    const proposals = [];
    for (const row of previous) for (const kind of ['angle','persona']) {
      if (row.result?.productId !== pid) continue;
      const p = row.result?.[kind];
      if (p?.decision === 'new' && p.verified === REVIEW_VERSION && !proposals.some(x => x.kind === kind && x.name === p.name)) proposals.push({kind, name:p.name});
    }
    const raw = hasEvidence(input.inspiration.evidence) ? await agent(input, proposals, {env}) : {angle:needsReview(), persona:needsReview()};
    if (!raw || !raw.angle || !raw.persona) throw new Error('Agent returned an incomplete review. Please retry.');
    const result = {version:REVIEW_VERSION, productId:pid, productName:product.name, insId, evidence:input.inspiration.evidence,
      angle:validateAssessment(raw.angle, 'angle', input), persona:validateAssessment(raw.persona, 'persona', input)};
    await finish({status:'complete', result, error_message:null});
    return result;
  } catch (error) {
    await finish({status:'failed', error_message: 'Review could not finish. Check the Mac mini worker and retry.', result:null});
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReview(process.argv[2], process.argv[3]).then(() => console.log('Taxonomy review complete.')).catch(() => {console.error('Taxonomy review failed; retry from Immuvi.'); process.exitCode = 1;});
}
