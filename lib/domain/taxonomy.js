const LEADING_MARKER_RE =
  /^\s*(?:(?:[-*]+|[\u2022\u2023\u25E6])\s+|(?:\(?\d+\)?[.)]|[A-Za-z][.)])\s+|\[[ xX]\]\s+)/;
const STATUS_PRIORITY = ['Winner', 'Scale', 'Mild Winner', 'Testing', 'Ready to Launch', 'In Production', 'Approved', 'Complete', 'Loser', 'Untested'];
const WINNER_STATUSES = new Set(['winner', 'scale', 'mild winner']);

export function normalizeTaxonomyName(value) {
  let text = String(value || '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  while (LEADING_MARKER_RE.test(text)) {
    text = text.replace(LEADING_MARKER_RE, '').trim();
  }

  return text.replace(/\s*-\s*/g, ' - ').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
}

export function taxonomyKey(value) {
  return normalizeTaxonomyName(value).toLocaleLowerCase();
}

export function sameTaxonomyName(left, right) {
  const leftKey = taxonomyKey(left);
  const rightKey = taxonomyKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function normalizeTaxonomyRow(row) {
  return {
    id: text(row && row.id),
    productId: text(row && row.product_id),
    name: normalizeTaxonomyName(row && row.name),
    status: text(row && row.status) || 'Untested',
    sourceLink: text(row && row.source_link),
    notes: text(row && row.notes),
    createdAt: text(row && row.created_at),
    updatedAt: text(row && row.updated_at),
    archivedAt: text(row && row.archived_at),
  };
}

export function newTaxonomyId(kind, rows = [], nowMs = Date.now(), randomFn = Math.random) {
  const prefix = kind === 'persona' ? 'per' : 'ang';
  const seen = new Set((rows || []).map((row) => row && row.id).filter(Boolean));
  for (let index = 0; index < 5; index += 1) {
    const id = `${prefix}-manual-${nowMs.toString(36)}-${randomFn().toString(36).slice(2, 8)}`;
    if (!seen.has(id)) return id;
  }
  return `${prefix}-manual-${nowMs.toString(36)}-${randomFn().toString(36).slice(2)}`;
}

export function deriveTaxonomyStatus(kind, name, creatives = []) {
  const related = relatedCreatives(kind, name, creatives);
  if (!related.length) return 'Untested';
  const statuses = new Set(related.map((creative) => text(creative && creative.status) || 'Untested'));
  return STATUS_PRIORITY.find((status) => statuses.has(status)) || 'Untested';
}

export function taxonomyStats(kind, name, creatives = []) {
  const related = relatedCreatives(kind, name, creatives);
  const oppositeNames = new Set();
  let winners = 0;

  for (const creative of related) {
    const opposite = kind === 'angle' ? creative && creative.persona : creative && creative.angle;
    if (opposite) oppositeNames.add(opposite);
    if (WINNER_STATUSES.has(text(creative && creative.status).toLowerCase())) winners += 1;
  }

  return {
    creatives: related.length,
    relatedCount: oppositeNames.size,
    winners,
    winRate: related.length ? Math.round((winners / related.length) * 100) : 0,
  };
}

export function summarizeTaxonomyRows(kind, rows = [], creatives = []) {
  const summary = {
    total: rows.length,
    active: 0,
    archived: 0,
    winners: 0,
    testing: 0,
    untested: 0,
    totalCreatives: 0,
  };

  for (const row of rows || []) {
    if (row && row.archivedAt) summary.archived += 1;
    else summary.active += 1;

    const status = deriveTaxonomyStatus(kind, row && row.name, creatives);
    const stats = taxonomyStats(kind, row && row.name, creatives);
    const key = status.toLowerCase();
    if (WINNER_STATUSES.has(key)) summary.winners += 1;
    else if (key === 'testing') summary.testing += 1;
    else if (key === 'untested') summary.untested += 1;
    summary.totalCreatives += stats.creatives;
  }

  return summary;
}

export function filterTaxonomyRows(rows = [], view = 'active') {
  if (view === 'archived') return (rows || []).filter((row) => row && row.archivedAt);
  if (view === 'all') return rows || [];
  return (rows || []).filter((row) => row && !row.archivedAt);
}

function relatedCreatives(kind, name, creatives) {
  const cleanName = normalizeTaxonomyName(name);
  if (!cleanName) return [];
  return (creatives || []).filter((creative) => {
    if (!creative || creative.deletedAt || creative.productBoundaryQuarantined || creative.parentAdId) return false;
    return kind === 'angle' ? creative.angle === cleanName : creative.persona === cleanName;
  });
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
