import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { SOURCE_REF, TARGET_REF, PRODUCTS, CONTENT_TABLES, WRITE_TABLES, sanitize, pick, newId, assertPlan } from './qa-sample-policy.mjs';

const apply = process.argv.includes('--apply');
const run = randomUUID(), output = mkdtempSync(join(tmpdir(), 'immuvi-qa-samples-'));
const trace = [], report = { run, sourceAccess:'GET only', clickupRequests:0, target:TARGET_REF, applied:false, products:[], exclusions:[] };
function guard() {
  assert.equal(execFileSync('git', ['branch','--show-current'], { encoding:'utf8' }).trim(), 'qa');
  assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(), TARGET_REF);
}
guard();
function query(sql) {
  guard();
  const file = join(output, 'qa-query.sql');
  writeFileSync(file, sql, { mode:0o600 });
  try { return JSON.parse(execFileSync('supabase', ['db','query','--linked','--file',file,'-o','json'], { encoding:'utf8', stdio:['ignore','pipe','pipe'], maxBuffer:12000000 })).rows; }
  catch (error) { throw new Error(`QA SQL failed: ${String(error.stderr || '').slice(0,3000)}`); }
}
const columns = query("begin read only; select table_name,column_name,udt_name,column_default from information_schema.columns where table_schema='public'; commit;");
const schema = new Map();
for (const c of columns) { if (!schema.has(c.table_name)) schema.set(c.table_name, new Map()); schema.get(c.table_name).set(c.column_name,c); }
const existing = query("begin read only; select id from products where id in ('qa-sample-astrorekha','qa-sample-canva'); commit;");
assert.equal(existing.length, 0, 'Sample products already exist; refusing to overwrite or duplicate them.');
const actor = query("begin read only; select id from profiles where lower(email)='likermeow@gmail.com' and is_active=true; commit;");
assert.equal(actor.length, 1, 'Expected the existing active QA review account.');
// Review every enabled INSERT trigger before any fixture can enter the target.
const triggers = query("begin read only; select p.proname,pg_get_functiondef(p.oid) as body from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal and t.tgenabled<>'D' and (t.tgtype & 4)=4; commit;");
for (const trigger of triggers) {
  assert.ok(['strip_manual_action_runtime_payload','qa_guard_creation_assignments','qa_guard_creation_username','qa_guard_account_assignments','qa_guard_worker_control'].includes(trigger.proname), 'Unreviewed INSERT trigger.');
  assert.ok(!/http|net\.|dblink|execute\s/i.test(trigger.body), 'Potential outbound/dynamic trigger.');
}
const sourceKeys = JSON.parse(execFileSync('supabase', ['projects','api-keys','--project-ref',SOURCE_REF,'-o','json'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }));
const key = sourceKeys.find((row) => row.name === 'service_role')?.api_key;
assert.ok(key, 'Source read credential unavailable.');
async function get(table, filters, limit = 6) {
  assert.ok(CONTENT_TABLES.includes(table));
  const url = new URL(`/rest/v1/${table}`, `https://${SOURCE_REF}.supabase.co`);
  url.search = new URLSearchParams({ select:'*', ...filters, limit:String(limit) });
  const response = await fetch(url, { method:'GET', redirect:'error', headers:{ apikey:key, Authorization:`Bearer ${key}` }, signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source GET ${table} failed (${response.status}).`);
  const rows = await response.json();
  trace.push({ method:'GET', table, rows:rows.length });
  return rows;
}
const rows = Object.fromEntries(WRITE_TABLES.map((table) => [table, []]));
const now = new Date().toISOString();
const adMetaKeys = ['notes','hookType','taskType','uniqueName','variationNotes','variationChanges','_customFields','productionStyle','creativeStructure','creativeHypothesis','hypothesis','description','brief','briefMarkdown','dueDate'];
const actionKeys = ['title','taskName','angle','persona','format','reason','dueDate','priority','description','funnelStage','sourceAngle','sourcePersona','tag','hypothesis','brief','notes','variationChanges','variationNotes'];
for (const product of PRODUCTS) {
  const source = {}, counts = {}, synthetic = {};
  for (const table of CONTENT_TABLES.filter((name) => schema.get(name)?.has('product_id') || name === 'products')) {
    source[table] = await get(table, { [table === 'products' ? 'id':'product_id']:`eq.${product.source}`,
      ...(table === 'ads' ? { deleted_at:'is.null', order:'updated_at.desc' } : {}) },
    ['angles','personas'].includes(table) ? 30 : table === 'ads' ? 14 : table === 'matrix_cells' ? 8 : 5);
    counts[table] = source[table].length;
  }
  for (const status of ['Winner','Testing','In Production','Untested']) {
    const extra = await get('ads',{product_id:`eq.${product.source}`,status:`eq.${status}`,deleted_at:'is.null',order:'updated_at.desc'},2);
    for (const row of extra) if (!source.ads.some((item)=>item.id===row.id)) source.ads.push(row);
  }
  // Include referenced creatives/parents so the small sample is a connected graph.
  const needed = new Set(source.manual_actions.flatMap((row) => [row.payload?.sourceAdId,row.payload?.adId]).filter(Boolean));
  for (const row of source.ads) if (row.parent_ad_id) needed.add(row.parent_ad_id);
  for (const id of [...needed].slice(0,25)) if (!source.ads.some((row) => row.id === id)) source.ads.push(...await get('ads', { product_id:`eq.${product.source}`, id:`eq.${id}` }, 1));
  counts.ads = source.ads.length;
  if (source.inspirations.length) {
    const filter = `in.(${source.inspirations.map((row)=>`"${row.id}"`).join(',')})`;
    source.inspiration_queue = await get('inspiration_queue',{product_id:`eq.${product.source}`,ins_id:filter},10);
    source.inspiration_results = await get('inspiration_results',{product_id:`eq.${product.source}`,ins_id:filter},10);
    counts.inspiration_queue = source.inspiration_queue.length;
    counts.inspiration_results = source.inspiration_results.length;
  }
  const ids = new Map([[product.source, product.target]]);
  for (const [table, records] of Object.entries(source)) for (const record of records) if (record.id && !ids.has(record.id)) ids.set(record.id, newId(schema.get(table).get('id').udt_name));
  const adIds = source.ads.map((ad) => ad.id);
  for (const table of ['task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue']) {
    source[table] = adIds.length ? await get(table, { [table === 'variation_brief_queue' ? 'parent_ad_id' : 'ad_id']:`in.(${adIds.map((id) => `"${id}"`).join(',')})` }, 4) : [];
    counts[table] = source[table].length;
    for (const row of source[table]) if (row.id) ids.set(row.id, randomUUID());
  }
  const add = (table, row, fixture = false) => { rows[table].push(row); if (fixture) synthetic[table] = (synthetic[table] || 0)+1; };
  const base = (table, row) => {
    const value = sanitize(row, ids);
    if ('id' in row) {
      if (schema.get(table).get('id').udt_name === 'int8') delete value.id;
      else value.id = ids.get(row.id);
    }
    if ('product_id' in row) value.product_id = product.target;
    for (const field of ['approved_by','reviewed_by','actor_id','created_by','target_user']) if (field in value) value[field] = null;
    for (const field of ['added_by','deleted_by','marked_by','generated_by','actor']) if (field in value) value[field] = 'QA sample import';
    return value;
  };
  add('products', { id:product.target, name:product.name, config:{ color:source.products[0]?.config?.color || '#3468c0', ins_prefix:product.target.endsWith('canva')?'QAC':'QAA', qa_sample:{ run, externalIntegrations:false, copiedAt:now } } });
  for (const table of ['angles','personas']) for (const row of source[table]) add(table, base(table,row));
  for (const row of source.ads) {
    const value = base('ads',row);
    value.clickup_task_id = null; value.ad_link = null; value.drive_link = null;
    value.parent_ad_id = ids.get(row.parent_ad_id) || null;
    value.meta = { ...sanitize(pick(row.meta,adMetaKeys),ids), qaSample:true };
    value.ad_origin = row.ad_origin === 'Winner Variation' ? 'Winner Variation' : 'QA Sample'; value.deleted_at = null;
    add('ads',value);
  }
  const ownAds = rows.ads.filter((row) => row.product_id === product.target);
  assert.ok(ownAds.length > 1, 'Need at least two source creatives.');
  const ownAngles = rows.angles.filter((row) => row.product_id === product.target);
  const ownPersonas = rows.personas.filter((row) => row.product_id === product.target);
  for (const row of source.manual_actions) {
    const ad = ownAds.find((item) => item.id === ids.get(row.payload?.sourceAdId || row.payload?.adId));
    const value = base('manual_actions',row);
    value.payload = { ...sanitize(pick(row.payload,actionKeys),ids), id:value.id, productId:product.target, ...(ad ? {sourceAdId:ad.id,adId:ad.id,title:ad.format_name,liveStatus:ad.status} : {}), qaSample:true };
    if (ad) value.live_status = ad.status;
    add('manual_actions',value);
  }
  for (const row of source.matrix_cells) if (ids.has(row.angle_id) && ids.has(row.persona_id)) {
    const value = base('matrix_cells',row);
    value.meta = { qaSample:true };
    const a = ownAngles.find((item) => item.id === value.angle_id), p = ownPersonas.find((item) => item.id === value.persona_id);
    value.creative_assignments = ownAds.filter((ad) => ad.angle === a?.name && ad.persona === p?.name).map((ad) => ad.id);
    add('matrix_cells',value);
  }
  for (const ad of ownAds) {
    const angle = ownAngles.find((row)=>row.name.toLowerCase()===String(ad.angle||'').toLowerCase());
    const persona = ownPersonas.find((row)=>row.name.toLowerCase()===String(ad.persona||'').toLowerCase());
    if (!angle || !persona) continue;
    let cell = rows.matrix_cells.find((row)=>row.product_id===product.target && row.angle_id===angle.id && row.persona_id===persona.id);
    if (!cell) {
      cell = {id:randomUUID(),product_id:product.target,angle_id:angle.id,persona_id:persona.id,meta:{qaSample:true,rebuiltFromCopiedTaxonomy:true},creative_assignments:[]};
      add('matrix_cells',cell,true);
    }
    if (!cell.creative_assignments.includes(ad.id)) cell.creative_assignments.push(ad.id);
  }
  for (const row of source.angle_personas) if (ids.has(row.angle_id) && ids.has(row.persona_id)) add('angle_personas',base('angle_personas',row));
  if (!source.angle_personas.length) for (let i=0;i<Math.min(3,ownAngles.length,ownPersonas.length);i++) add('angle_personas',{id:randomUUID(),product_id:product.target,angle_id:ownAngles[i].id,persona_id:ownPersonas[i].id,linked:true},true);
  for (const row of source.inspirations) {
    const value = base('inspirations',row);
    value.url = `https://example.invalid/qa/${value.id}`;
    value.data = { ...sanitize(row.data,ids), id:value.id,product_id:product.target,url:value.url,sourceUrl:value.url,qaSample:true };
    add('inspirations',value);
    const queue = source.inspiration_queue.find((item) => item.ins_id === row.id);
    add('inspiration_queue',{...(queue?base('inspiration_queue',queue):{}),id:randomUUID(),ins_id:value.id,product_id:product.target,url:value.url,platform:value.platform,status:'cancelled',processed_at:now,claimed_at:null,error_message:'QA sample: execution disabled',attempts:0},!queue);
    const result = source.inspiration_results.find((item) => item.ins_id === row.id);
    add('inspiration_results',{...(result ? base('inspiration_results',result):{}),id:randomUUID(),ins_id:value.id,product_id:product.target,source_url:value.url,platform:value.platform,
      metadata:{qaSample:true},classification:sanitize(result?.classification || pick(row.data,['angle','persona','adType','funnelStage','hookType','productionStyle']),ids),
      brief:sanitize(result?.brief || pick(row.data,['headline','bodyCopy','voiceOver','ctaText','nextAdScripts','creativeHypothesis']),ids)},!result);
  }
  for (const row of source.competitor_brands) add('competitor_brands',base('competitor_brands',row));
  if (!source.competitor_brands.length) add('competitor_brands',{id:newId('text'),product_id:product.target,name:`${product.name} demo competitor`,approved:false,notes:'Synthetic QA fixture; no source competitor available.'},true);
  const brand = rows.competitor_brands.find((row) => row.product_id === product.target);
  for (const row of source.competitor_creatives) add('competitor_creatives',{...base('competitor_creatives',row),brand_id:ids.get(row.brand_id)||brand.id});
  if (!source.competitor_creatives.length) add('competitor_creatives',{id:newId('text'),product_id:product.target,brand_id:brand.id,hook:ownAds[0].format_name,angle:ownAngles[0]?.name,persona:ownPersonas[0]?.name,body_copy:'Synthetic competitor fixture based on the sampled product. No external research performed.',source_data:{qaSample:true}},true);
  for (const row of source.competitor_research_queue) add('competitor_research_queue',{...base('competitor_research_queue',row),brand_id:brand.id,status:'failed',payload:{qaSample:true},error_message:'QA sample: execution disabled',claimed_at:null,finished_at:now});
  if (!source.competitor_research_queue.length) add('competitor_research_queue',{id:newId('text'),product_id:product.target,brand_id:brand.id,job_type:'research',status:'failed',error_message:'Synthetic QA fixture; execution disabled',payload:{qaSample:true}},true);
  for (const row of source.strategist_memory) add('strategist_memory',{...base('strategist_memory',row),json:sanitize(row.json,ids),markdown:sanitize(row.markdown,ids)});
  for (const row of source.strategist_runs) add('strategist_runs',{...base('strategist_runs',row),status:['done','failed'].includes(row.status)?row.status:'failed',worker_id:null,finished_at:row.finished_at||now});
  for (const row of source.strategist_processed) add('strategist_processed',{...base('strategist_processed',row),clickup_task_id:newId('text')});
  for (const row of source.producer_runs) add('producer_runs',{...base('producer_runs',row),task_id:newId('text'),status:'failed',worker_id:null,outputs:[],error:'QA history sample: execution and external output links disabled',finished_at:now});
  const creative = rows.competitor_creatives.find((row) => row.product_id === product.target);
  for (const row of source.strategist_recommendations) add('strategist_recommendations',{...base('strategist_recommendations',row),source_creative_id:creative.id,manual_action_id:null,ad_id:null,inspiration_id:null,task_id:null,status:'pending'});
  if (!source.strategist_recommendations.length) add('strategist_recommendations',{id:newId('text'),product_id:product.target,source_creative_id:creative.id,recommendation_type:'test',recommended_hook:ownAds[0].format_name,recommended_angle:ownAngles[0]?.name,recommended_persona:ownPersonas[0]?.name,reasoning:'Synthetic QA recommendation derived from copied product taxonomy; not generated by a worker.',status:'pending',metadata:{qaSample:true}},true);
  for (const row of source.deleted_ads) add('deleted_ads',{...base('deleted_ads',row),id:newId('text'),clickup_task_id:null});
  for (const row of source.activity_events) add('activity_events',{...base('activity_events',row),action_id:null,clickup_task_id:null});
  if (!source.activity_events.length) add('activity_events',{id:randomUUID(),product_id:product.target,event_type:'qa_sample_import',source:'app',actor:'QA sample import',metadata:{run,synthetic:true}},true);
  // Media artifacts are display-only fixtures; original Drive IDs/URLs never survive.
  for (const table of ['task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue']) {
    const records = source[table].length ? source[table] : [{}];
    for (const row of records) {
      const ad = ownAds.find((item) => item.id === ids.get(row.ad_id || row.parent_ad_id)) || ownAds[0];
      const value = { ...base(table,row),id:randomUUID(),drive_file_id:newId('text') };
      if (table === 'variation_brief_queue') Object.assign(value,{parent_ad_id:ad.id,target_ad_id:ownAds.find((item) => item.id !== ad.id).id,status:'failed',attempts:0,claimed_at:null,processed_at:now,error_message:'QA fixture: no media processing'});
      else value.ad_id = ad.id;
      if (['task_video_winners','task_drive_cache'].includes(table)) Object.assign(value,{file_name:row.file_name||'QA sample video (no external file)',thumbnail_url:null,web_view_url:null});
      if (table === 'variation_briefs') Object.assign(value,{brief_markdown:sanitize(row.brief_markdown||ownAds[0].meta.notes||'Synthetic QA variation brief; change the opening hook while retaining the product angle.',ids),clickup_doc_page_url:null,generated_by:'QA sample import'});
      add(table,value,!source[table].length);
    }
  }
  add('user_products',{user_id:actor[0].id,product_id:product.target,assigned_by:actor[0].id});
  add('admin_audit_log',{actor_id:actor[0].id,action:'qa_sample_import',target_product:product.target,meta:{run,sourceReadOnly:true,externalIntegrations:false}});
  report.products.push({id:product.target,name:product.name,sourceRowsRead:counts,syntheticRows:synthetic});
}
rows.worker_registry.push({worker_id:`qa-sample-offline-${run}`,hostname:'qa-fixture',status:'offline',enabled:false,last_heartbeat:null,current_job_id:null,capabilities:{qaSample:true},jobs_completed_total:0,jobs_failed_total:0});
report.exclusions = ['auth users and production profiles: not copied; existing QA account retained','qa_* recovery/operation receipts: deliberately not fabricated or imported','production worker identities: replaced by one synthetic disabled/offline row'];
assertPlan(rows);
for (const product of PRODUCTS) for (const table of CONTENT_TABLES.filter((name)=>schema.get(name)?.has('product_id') && name!=='products')) {
  assert.ok(rows[table].some((row)=>row.product_id===product.target), `Missing ${product.target}/${table} coverage.`);
}
for (const ad of rows.ads) if (ad.parent_ad_id) assert.ok(rows.ads.some((parent)=>parent.id===ad.parent_ad_id && parent.product_id===ad.product_id));
for (const action of rows.manual_actions) if (action.payload.sourceAdId) assert.ok(rows.ads.some((ad)=>ad.id===action.payload.sourceAdId && ad.product_id===action.product_id));
for (const cell of rows.matrix_cells) {
  assert.ok(rows.angles.some((row)=>row.id===cell.angle_id && row.product_id===cell.product_id));
  assert.ok(rows.personas.some((row)=>row.id===cell.persona_id && row.product_id===cell.product_id));
  for (const id of cell.creative_assignments) assert.ok(rows.ads.some((ad)=>ad.id===id && ad.product_id===cell.product_id));
}
// Strip columns absent from the current QA schema, but fail on unexpected tables.
for (const [table, records] of Object.entries(rows)) for (const row of records) for (const key of Object.keys(row)) if (!schema.get(table)?.has(key)) delete row[key];
const literal = (value) => `'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const order = ['products','angles','personas','angle_personas','ads','matrix_cells','manual_actions','inspirations','inspiration_queue','inspiration_results','competitor_brands','competitor_creatives','competitor_research_queue','strategist_memory','strategist_runs','strategist_processed','producer_runs','strategist_recommendations','activity_events','deleted_ads','task_video_winners','task_drive_cache','variation_briefs','variation_brief_queue','worker_registry','user_products','admin_audit_log'];
const statements = [];
for (const table of order) for (const row of rows[table]) {
  const fields = Object.keys(row).map((name) => `"${name}"`).join(',');
  statements.push(`insert into public.${table} (${fields}) select ${fields} from jsonb_populate_record(null::public.${table},${literal(row)});`);
}
const precondition = `do $$ begin if exists(select 1 from products where id in ('qa-sample-astrorekha','qa-sample-canva')) then raise exception 'Sample products already exist'; end if; end $$;`;
const sql = `begin; set local statement_timeout='60s'; set local lock_timeout='5s'; ${precondition}\n${statements.join('\n')}\nselect 'sample checks passed' as result; ${apply?'commit':'rollback'};`;
writeFileSync(join(output,'sanitized-plan.json'),JSON.stringify(rows,null,2),{mode:0o600});
report.counts = Object.fromEntries(Object.entries(rows).map(([table,records])=>[table,records.length]));
report.planHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
report.sourceRequests = trace;
if (apply) query(sql.replace(/commit;$/, 'rollback;'));
query(sql);
report.applied = apply;
writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({output,applied:apply,products:report.products,counts:report.counts,exclusions:report.exclusions,sourceRequests:trace.length,clickupRequests:0},null,2));
