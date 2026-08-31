import { timestampMs } from './action-plan.js';

const WINNER_STATUSES = new Set(['winner', 'mild winner', 'scale']);
const TESTING_STATUSES = new Set(['testing']);
const READY_STATUSES = new Set(['approved', 'assigned', 'in production', 'ready to launch']);

export function normalizeCreativeRow(row) {
  const meta = objectOrEmpty(row && row.meta);
  const clickupTaskId = text(row && row.clickup_task_id) || text(meta.clickupTaskId) || text(meta._clickupId);
  const createdAt = timestampMs(row && row.created_at) || timestampMs(meta.createdAt) || timestampMs(meta.dateCreated);
  const updatedAt = timestampMs(row && row.updated_at) || timestampMs(meta.updatedAt);

  return {
    ...meta,
    id: text(row && row.id),
    productId: text(row && row.product_id),
    formatName: text(row && row.format_name) || text(meta.formatName),
    adLink: text(row && row.ad_link) || text(meta.adLink),
    driveLink: text(row && row.drive_link) || text(meta.driveLink),
    adType: text(row && row.ad_type) || text(meta.adType),
    funnelStage: text(row && row.funnel_stage) || text(meta.funnelStage),
    status: text(row && row.status) || text(meta.status) || 'Untested',
    angle: text(row && row.angle) || text(meta.angle),
    persona: text(row && row.persona) || text(meta.persona),
    parentAdId: text(row && row.parent_ad_id) || text(meta.parentAdId),
    variationNumber: numberOrNull(row && row.variation_number),
    adOrigin: text(row && row.ad_origin) || text(meta.adOrigin),
    clickupTaskId,
    _clickupId: clickupTaskId,
    _clickupUrl: clickupTaskId ? `https://app.clickup.com/t/${clickupTaskId}` : text(meta._clickupUrl),
    creativeStructure: text(meta.creativeStructure),
    hookType: text(meta.hookType),
    productionStyle: text(meta.productionStyle),
    creativeHypothesis: text(meta.creativeHypothesis),
    creativeUSP: text(meta.creativeUSP),
    taskType: text(meta.taskType),
    trackerRefId: text(meta.trackerRefId),
    sourceFormatId: text(meta.sourceFormatId),
    sourceFormatName: text(meta._sourceFormatName),
    fromInspoId: text(meta._fromInspoId) || text(meta._sourceInsId),
    dueDate: text(meta.dueDate),
    dateCreated: timestampMs(meta.dateCreated) || createdAt,
    createdAt,
    updatedAt,
    lastStatusChangeAt: timestampMs(row && row.last_status_change_at) || timestampMs(meta.lastStatusChangeAt),
    deletedAt: text(row && row.deleted_at) || text(meta.deletedAt),
    productBoundaryQuarantined: Boolean(meta._productBoundaryQuarantined),
  };
}

export function isCreativeTrackerVisible(creative) {
  if (!creative || !creative.id || creative.deletedAt || creative.productBoundaryQuarantined) return false;
  if (creative.trackerRefId) return false;
  if (creative.parentAdId && creative.adOrigin !== 'Winner Variation') return false;
  return true;
}

export function filterCreativeTrackerRows(creatives, filters = {}, nowMs = Date.now()) {
  return (creatives || []).filter((creative) => {
    if (!isCreativeTrackerVisible(creative)) return false;
    if (filters.angle && creative.angle !== filters.angle) return false;
    if (filters.persona && creative.persona !== filters.persona) return false;
    if (filters.format && creative.formatName !== filters.format) return false;
    if (filters.adType && creative.adType !== filters.adType) return false;
    if (filters.funnelStage && creative.funnelStage !== filters.funnelStage) return false;
    if (filters.status && creative.status !== filters.status) return false;
    if (filters.structure && creative.creativeStructure !== filters.structure) return false;
    if (filters.hookType && creative.hookType !== filters.hookType) return false;
    if (filters.productionStyle && creative.productionStyle !== filters.productionStyle) return false;
    if (filters.taskType === 'format' && creative.taskType === 'production') return false;
    if (filters.taskType === 'production' && creative.taskType !== 'production') return false;
    if (filters.dateRange && !creativeMatchesDateRange(creative, filters.dateRange, nowMs)) return false;
    return true;
  });
}

export function sortCreativeTrackerRows(creatives, sort = { col: 'id', dir: 1 }) {
  const col = sort && sort.col ? sort.col : 'id';
  const dir = sort && sort.dir === -1 ? -1 : 1;
  return [...(creatives || [])].sort((a, b) => {
    const va = sortValue(a && a[col]);
    const vb = sortValue(b && b[col]);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

export function summarizeCreativeTracker(creatives) {
  const visible = (creatives || []).filter(isCreativeTrackerVisible);
  const summary = {
    total: visible.length,
    formats: 0,
    production: 0,
    winnerVariations: 0,
    winners: 0,
    testing: 0,
    ready: 0,
    missingLinks: 0,
  };

  for (const creative of visible) {
    if (creative.taskType === 'production') summary.production += 1;
    else summary.formats += 1;
    if (creative.adOrigin === 'Winner Variation' && creative.parentAdId) summary.winnerVariations += 1;
    if (WINNER_STATUSES.has(statusKey(creative.status))) summary.winners += 1;
    if (TESTING_STATUSES.has(statusKey(creative.status))) summary.testing += 1;
    if (READY_STATUSES.has(statusKey(creative.status))) summary.ready += 1;
    if (!creative.adLink && !creative.driveLink && !creative._clickupUrl) summary.missingLinks += 1;
  }

  return summary;
}

export function creativeFilterOptions(creatives) {
  const visible = (creatives || []).filter(isCreativeTrackerVisible);
  return {
    angles: uniqueSorted(visible.map((creative) => creative.angle)),
    personas: uniqueSorted(visible.map((creative) => creative.persona)),
    formats: uniqueSorted(visible.map((creative) => creative.formatName)),
    structures: uniqueSorted(visible.map((creative) => creative.creativeStructure)),
    hookTypes: uniqueSorted(visible.map((creative) => creative.hookType)),
    productionStyles: uniqueSorted(visible.map((creative) => creative.productionStyle)),
    adTypes: uniqueSorted(visible.map((creative) => creative.adType)),
    funnelStages: uniqueSorted(visible.map((creative) => creative.funnelStage)),
    statuses: uniqueSorted(visible.map((creative) => creative.status)),
  };
}

export function variationCountForCreative(creative, allCreatives) {
  if (!creative || !creative.id) return 0;
  return (allCreatives || []).filter((candidate) => candidate && candidate.parentAdId === creative.id).length;
}

export function usageCountForCreative(creative, allCreatives, matrixCells) {
  if (!creative || !creative.id) return 0;
  const cellUses = (matrixCells || []).filter((cell) => {
    const assignments = Array.isArray(cell && cell.creative_assignments) ? cell.creative_assignments : [];
    return assignments.includes(creative.id);
  }).length;
  const productionUses = (allCreatives || []).filter((candidate) => candidate && candidate.sourceFormatId === creative.id).length;
  return cellUses + productionUses;
}

export function creativeStatusBucket(status) {
  const key = statusKey(status);
  if (WINNER_STATUSES.has(key)) return 'winner';
  if (TESTING_STATUSES.has(key)) return 'testing';
  if (READY_STATUSES.has(key)) return 'ready';
  if (key === 'loser' || key === 'killed') return 'loser';
  return 'untested';
}

export function creativeMatchesDateRange(creative, range, nowMs = Date.now()) {
  const createdAt = timestampMs(creative && (creative.dateCreated || creative.createdAt));
  if (!createdAt) return true;
  const dayStart = startOfDayMs(nowMs);
  const weekStart = weekStartMs(nowMs);
  const monthStart = monthStartMs(nowMs);
  if (range === 'today') return createdAt >= dayStart;
  if (range === 'week') return createdAt >= weekStart;
  if (range === 'month') return createdAt >= monthStart;
  return true;
}

function uniqueSorted(values) {
  return [...new Set((values || []).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sortValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).toLowerCase();
}

function startOfDayMs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Date.now();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function weekStartMs(value) {
  const date = new Date(startOfDayMs(value));
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.getTime();
}

function monthStartMs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Date.now();
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusKey(status) {
  return text(status).trim().toLowerCase();
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
