import { taxonomyKey } from './taxonomy.js';
import { timestampMs } from './action-plan.js';
/** @typedef {ReturnType<typeof import('./creative-tracker.js').normalizeCreativeRow>} Creative */
/** @typedef {ReturnType<typeof import('./taxonomy.js').normalizeTaxonomyRow>} Taxonomy */

export const MATRIX_SORTS = { manual: 'Manual order', mostCreatives: 'Most worked on', leastCreatives: 'Least worked on', recentActivity: 'Most recent activity', oldestActivity: 'Oldest activity', newestAngle: 'Newest angle', oldestAngle: 'Oldest angle', statusPriority: 'Status priority', nameAsc: 'Name A-Z', nameDesc: 'Name Z-A' };
export const MATRIX_DEFAULTS = { source: '', funnel: '', adType: '', statuses: [], dateRange: 'all', dateFrom: '', dateTo: '', dateBasis: 'created', filterMode: 'scope', density: 'comfortable', sort: 'manual', manualOrder: [], staleOnly: false, showAll: true, search: '', personaId: '', overlay: '' };
export const matrixKey = (angleId, personaId) => JSON.stringify([angleId, personaId]);
export function matrixSearchMatches(query, angle, persona, ads) {
  const needle = String(query || '').trim().toLowerCase();
  return !needle || [angle, persona, ...ads.flatMap((ad) => [ad.formatName, ad.id, ad.clickupTaskId])]
    .some((value) => String(value || '').toLowerCase().includes(needle));
}
export function matrixBucket(status) {
  if (['Winner','Mild Winner','Scale','Complete'].includes(status)) return 'winner';
  if (status === 'Testing') return 'testing';
  if (['Loser','Killed'].includes(status)) return 'loser';
  if (['In Production','Approved','Assigned','Ready to Launch'].includes(status)) return 'prelaunch';
  return 'untested';
}
export function matrixSource(ad) {
  if (ad.fromInspoId) return 'inspo';
  if (ad.sourceFormatId || ad.adOrigin && ad.adOrigin !== 'ClickUp') return 'app';
  return ad.clickupTaskId ? 'clickup' : 'app';
}
export function matrixDateRange(filters, now = Date.now()) {
  const start = new Date(now); start.setHours(0,0,0,0);
  if (filters.dateRange === 'all') return { from: 0, to: Infinity, valid: true };
  if (filters.dateRange === 'custom') {
    const parse = (value, end) => {
      if (!value) return end ? Infinity : 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
      const date = new Date(`${value}T00:00:00`);
      if (!Number.isFinite(date.getTime()) || `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` !== value) return NaN;
      if (end) date.setHours(23,59,59,999);
      return date.getTime();
    };
    const from = parse(filters.dateFrom, false), to = parse(filters.dateTo, true);
    return { from, to, valid: !Number.isNaN(from) && !Number.isNaN(to) && from <= to };
  }
  const days = { today: 0, week: 6, '14d': 13, '30d': 29 }[filters.dateRange] ?? 0;
  start.setDate(start.getDate() - days);
  return { from: start.getTime(), to: now, valid: true };
}
export function matrixDateMatches(ad, filters, now = Date.now()) {
  if (filters.dateRange === 'all') return true;
  const range = matrixDateRange(filters, now);
  const ts = filters.dateBasis === 'status' ? ad.lastStatusChangeAt || ad.updatedAt || ad.createdAt
    : filters.dateBasis === 'updated' ? ad.updatedAt || ad.createdAt : ad.createdAt;
  return range.valid && Boolean(ts) && ts >= range.from && ts <= range.to;
}

// Canonical taxonomy is authoritative. Explicit assignments also support legacy
// records with missing axes; ambiguous ClickUp aliases are never guessed.
/** @param {{productId:string,angles:Taxonomy[],personas:Taxonomy[],creatives:Creative[],cells:any[]}} input */
export function indexMatrix({ productId, angles, personas, creatives, cells }) {
  /** @param {Taxonomy[]} rows */
  const active = (rows) => rows.filter((row) => row.productId === productId && !row.archivedAt);
  const activeAngles = active(angles), activePersonas = active(personas);
  const byName = (rows) => {
    const map = new Map();
    for (const row of rows) { const key = taxonomyKey(row.name); map.set(key, map.has(key) ? null : row.id); }
    return map;
  };
  const angleNames = byName(activeAngles), personaNames = byName(activePersonas);
  const angleIds = new Set(activeAngles.map((row) => row.id)), personaIds = new Set(activePersonas.map((row) => row.id));
  const ads = creatives.filter((ad) => ad.productId === productId && !ad.deletedAt && !ad.productBoundaryQuarantined && !ad.trackerRefId);
  const byId = new Map(ads.map((ad) => [ad.id, ad])), aliases = new Map();
  for (const ad of ads) if (ad.clickupTaskId) aliases.set(ad.clickupTaskId, aliases.has(ad.clickupTaskId) ? null : ad);
  const canonical = (ad) => {
    const angle = angleNames.get(taxonomyKey(ad.angle)), persona = personaNames.get(taxonomyKey(ad.persona));
    return angle && persona ? matrixKey(angle,persona) : '';
  };
  /** @type {Map<string,Map<string,Creative>>} */
  const byCell = new Map();
  const records = new Map(), unresolved = new Map();
  for (const cell of cells) {
    if (cell.product_id !== productId || !angleIds.has(cell.angle_id) || !personaIds.has(cell.persona_id)) continue;
    const key = matrixKey(cell.angle_id,cell.persona_id);
    records.set(key,cell); const found = new Map(); let missing = 0;
    for (const id of cell.creative_assignments || []) {
      const ad = byId.get(id) || aliases.get(id);
      if (!ad) { missing++; continue; }
      if (canonical(ad) && canonical(ad) !== key) continue;
      if (!(cell.meta?._excludedCreativeIds || []).includes(ad.id)) found.set(ad.id,ad);
    }
    byCell.set(key,found); unresolved.set(key,missing);
  }
  for (const ad of ads) {
    const key = canonical(ad);
    if (!key || (records.get(key)?.meta?._excludedCreativeIds || []).includes(ad.id)) continue;
    if (!byCell.has(key)) byCell.set(key,new Map());
    byCell.get(key).set(ad.id,ad);
  }
  return { angles: activeAngles, personas: activePersonas, records, unresolved,
    byCell: new Map([...byCell].map(([key, rows]) => [key, [...rows.values()].sort((a,b) => a.id.localeCompare(b.id))])) };
}
/** @param {Creative[]} lifetime */
export function classifyMatrixCell(lifetime, filters, now = Date.now()) {
  const ads = lifetime.filter((ad) => (!filters.statuses.length || filters.statuses.includes(matrixBucket(ad.status)))
    && (filters.filterMode !== 'scope' || matrixDateMatches(ad, filters, now)));
  const counts = { winner: 0, testing: 0, loser: 0, prelaunch: 0, untested: 0 };
  for (const ad of ads) counts[matrixBucket(ad.status)]++;
  const latest = ads.reduce((last, ad) => Math.max(last,ad.createdAt || 0),0);
  const stale = latest > 0 && now-latest > 14*86400000;
  const matches = !ads.length || ((!filters.source || ads.some((ad) => matrixSource(ad) === filters.source))
    && (!filters.funnel || ads.some((ad) => ad.funnelStage === filters.funnel))
    && (!filters.adType || ads.some((ad) => ad.adType === filters.adType)) && (!filters.staleOnly || stale)
    && (filters.filterMode !== 'highlight' || ads.some((ad) => matrixDateMatches(ad,filters,now))));
  return { ads, lifetime, counts, total: ads.length, lifetimeTotal: lifetime.length, stale, matches,
    dominant: !ads.length ? 'empty' : counts.winner ? counts.loser ? 'mixed' : 'winner' : counts.testing ? 'testing' : counts.loser ? 'loser' : counts.prelaunch ? 'prelaunch' : 'untested' };
}
export function matrixDecisions(states) {
  const winningAngles = new Set(), winningPersonas = new Set();
  for (const [key, state] of states) if (state.counts.winner) { const [a,p] = JSON.parse(key); winningAngles.add(a); winningPersonas.add(p); }
  /** @type {{winners:string[],replicate:string[],gaps:string[],kill:string[]}} */
  const groups = { winners: [], replicate: [], gaps: [], kill: [] };
  for (const [key, state] of states) {
    const [a,p] = JSON.parse(key);
    if (state.counts.winner) groups.winners.push(key);
    if (state.counts.winner && state.total < 3) groups.replicate.push(key);
    if (!state.total && (winningAngles.has(a) || winningPersonas.has(p))) groups.gaps.push(key);
    if (state.counts.loser >= 2 && !state.counts.winner) groups.kill.push(key);
  }
  return groups;
}
/** @param {Taxonomy[]} angles */
export function sortMatrixAngles(angles, states, filters) {
  const stats = new Map(angles.map((a) => [a.id, { count: 0, latest: 0, first: Infinity }]));
  for (const [key, state] of states) {
    const s = stats.get(JSON.parse(key)[0]); if (!s) continue;
    s.count += state.total;
    for (const ad of state.ads) if (ad.createdAt) { s.latest=Math.max(s.latest,ad.createdAt); s.first=Math.min(s.first,ad.createdAt); }
  }
  const order = [...new Set([...filters.manualOrder,...angles.map((a) => a.id)])];
  return [...angles].sort((a,b) => {
    const x=stats.get(a.id), y=stats.get(b.id);
    const weight = (status) => ({ Winner: 0, Testing: 1, Pivot: 2, Killed: 3 })[status] ?? 4;
    const diff = ({ manual: () => order.indexOf(a.id)-order.indexOf(b.id), mostCreatives: () => y.count-x.count,
      leastCreatives: () => x.count-y.count, recentActivity: () => y.latest-x.latest, oldestActivity: () => x.first-y.first,
      newestAngle: () => (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0), oldestAngle: () => (Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0),
      statusPriority: () => weight(a.status)-weight(b.status), nameAsc: () => a.name.localeCompare(b.name), nameDesc: () => b.name.localeCompare(a.name),
    }[filters.sort] || (() => 0))();
    return (Number.isNaN(diff) ? 0 : diff) || a.name.localeCompare(b.name);
  });
}
export function moveMatrixAngle(order, source, target) {
  if (!order.includes(source) || !order.includes(target)) return order;
  const next = order.filter((id) => id !== source); next.splice(order.indexOf(target),0,source); return next;
}
export function normalizeMatrixInspiration(row) {
  const data = row.data || {};
  const status = row.status || data.status || '';
  const pending = !['saved','classified','approved','testing'].includes(status.toLowerCase());
  return { id: row.id, name: row.title || data.formatName || data.brand || row.id, status, pending,
    url: data.sourceUrl || row.url || '', adType: pending ? '' : data.adType || '', funnelStage: pending ? '' : data.funnelStage || '',
    angle: pending ? '' : String(data.angle || ''), notes: String(data.notes || ''), driveLink: String(data.driveLink || ''),
    createdAt: timestampMs(row.created_at) || timestampMs(data.addedAt || data.createdAt) || 0 };
}
