const LEADING_MARKER_RE =
  /^\s*(?:(?:[-*]+|[\u2022\u2023\u25E6])\s+|(?:\(?\d+\)?[.)]|[A-Za-z][.)])\s+|\[[ xX]\]\s+)/;
const STATUS_PRIORITY = ['Winner', 'Scale', 'Mild Winner', 'Testing', 'Ready to Launch', 'In Production', 'Approved', 'Complete', 'Loser', 'Untested'];
const WINNER_STATUSES = new Set(['winner', 'scale', 'mild winner']);
const TAXONOMY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'for', 'to', 'is', 'are', 'was', 'were', 'be', 'been', 'by', 'with', 'from', 'that', 'this',
  'it', 'as', 'at', 'on', 'into', 'about', 'around', 'who', 'when', 'while', 'using', 'use', 'uses', 'used', 'seeking', 'seek', 'looking',
  'look', 'need', 'needs', 'want', 'wants', 'people', 'person', 'audience', 'customer', 'customers', 'buyer', 'buyers', 'user', 'users',
  'adult', 'adults', 'woman', 'women', 'man', 'men', 'male', 'female', 'age', 'aged', 'year', 'years', 'yr', 'yrs', 'old', 'free',
]);
const TAXONOMY_SYNONYMS = new Map([
  ['sellers', 'seller'], ['selling', 'seller'], ['sell', 'seller'],
  ['hustlers', 'hustler'], ['hustles', 'hustle'],
  ['tools', 'tool'], ['toolkit', 'tool'], ['toolkits', 'tool'], ['resources', 'tool'], ['resource', 'tool'],
  ['worksheets', 'worksheet'], ['printables', 'printable'], ['pages', 'page'],
  ['help', 'tool'], ['helps', 'tool'], ['support', 'tool'], ['solutions', 'tool'], ['solution', 'tool'],
  ['adhders', 'adhd'], ['adhder', 'adhd'],
]);

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

export function taxonomySemanticTokens(value) {
  let clean = normalizeTaxonomyName(value)
    .toLowerCase()
    .replace(/[\u2605\u2B50*]/g, ' ')
    .replace(/\b(?:mild\s+winner|winner|scale|testing|tested|untested|loser|killed|complete|approved)\b/g, ' ')
    .replace(/\bmedication\s*[- ]\s*free\b/g, ' ')
    .replace(/\b(?:age|aged)\s*[-:]?\s*/g, ' ')
    .replace(/\b\d{2}\s*(?:to|-)\s*\d{2}\b/g, ' ')
    .replace(/\b\d{2}\+?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\boverwelmed\b/g, 'overwhelmed')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];
  const tokens = [];
  for (const raw of clean.split(' ')) {
    let token = TAXONOMY_SYNONYMS.get(raw) || raw;
    if (token.length > 4 && token.endsWith('ies')) token = `${token.slice(0, -3)}y`;
    else if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) token = token.slice(0, -1);
    token = TAXONOMY_SYNONYMS.get(token) || token;
    if (token.length <= 2 || TAXONOMY_STOPWORDS.has(token)) continue;
    tokens.push(token);
  }
  return Array.from(new Set(tokens));
}

export function taxonomySimilarityScore(left, right) {
  const leftName = normalizeTaxonomyName(left);
  const rightName = normalizeTaxonomyName(right);
  if (!leftName || !rightName) return 0;
  const leftKey = taxonomyKey(leftName);
  const rightKey = taxonomyKey(rightName);
  if (leftKey === rightKey) return 1;

  const leftTokens = taxonomySemanticTokens(leftName);
  const rightTokens = taxonomySemanticTokens(rightName);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token));
  const union = new Set(leftTokens.concat(rightTokens));
  const jaccard = shared.length / union.size;
  const coverage = shared.length / Math.min(leftSet.size, rightSet.size);
  let score = Math.max(jaccard, coverage * 0.82);

  const leftLoose = leftTokens.join(' ');
  const rightLoose = rightTokens.join(' ');
  if (leftLoose && rightLoose && (leftLoose.includes(rightLoose) || rightLoose.includes(leftLoose))) {
    score = Math.max(score, 0.88);
  }
  if (coverage === 1 && Math.min(leftSet.size, rightSet.size) >= 2) score = Math.max(score, 0.9);
  return Math.min(1, Number(score.toFixed(3)));
}

export function findTaxonomyMergeSuggestions(kind, rows = [], creatives = [], limit = 8) {
  const candidates = (rows || []).filter((row) => row && row.name && !row.archivedAt);
  const suggestions = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];
      const score = taxonomySimilarityScore(left.name, right.name);
      if (score < 0.72) continue;
      const leftStats = taxonomyStats(kind, left.name, creatives);
      const rightStats = taxonomyStats(kind, right.name, creatives);
      const keep = preferredMergeTarget(kind, left, right, leftStats, rightStats, creatives);
      const merge = keep === left ? right : left;
      const keepStats = keep === left ? leftStats : rightStats;
      const mergeStats = keep === left ? rightStats : leftStats;
      const shared = taxonomySemanticTokens(left.name).filter((token) => taxonomySemanticTokens(right.name).includes(token));
      suggestions.push({
        id: `${kind}:${left.id || left.name}:${right.id || right.name}`,
        kind,
        keep,
        merge,
        score,
        reason: shared.length
          ? `Shared meaning: ${shared.slice(0, 4).join(', ')}`
          : 'Names differ mainly by modifier/status wording',
        keepStats,
        mergeStats,
      });
    }
  }
  return suggestions
    .sort((a, b) => b.score - a.score || b.mergeStats.creatives - a.mergeStats.creatives)
    .slice(0, Math.max(0, limit));
}

function relatedCreatives(kind, name, creatives) {
  const cleanName = normalizeTaxonomyName(name);
  if (!cleanName) return [];
  return (creatives || []).filter((creative) => {
    if (!creative || creative.deletedAt || creative.productBoundaryQuarantined || creative.parentAdId) return false;
    return kind === 'angle' ? creative.angle === cleanName : creative.persona === cleanName;
  });
}

function preferredMergeTarget(kind, left, right, leftStats, rightStats, creatives) {
  const leftStatus = STATUS_PRIORITY.indexOf(deriveTaxonomyStatus(kind, left && left.name, creatives));
  const rightStatus = STATUS_PRIORITY.indexOf(deriveTaxonomyStatus(kind, right && right.name, creatives));
  if (leftStatus !== rightStatus) return leftStatus < rightStatus ? left : right;
  if (leftStats.creatives !== rightStats.creatives) return leftStats.creatives > rightStats.creatives ? left : right;
  const leftName = normalizeTaxonomyName(left && left.name);
  const rightName = normalizeTaxonomyName(right && right.name);
  if (leftName.length !== rightName.length) return leftName.length < rightName.length ? left : right;
  const leftCreated = Date.parse(left && left.createdAt) || 0;
  const rightCreated = Date.parse(right && right.createdAt) || 0;
  if (leftCreated && rightCreated && leftCreated !== rightCreated) return leftCreated < rightCreated ? left : right;
  return left;
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
