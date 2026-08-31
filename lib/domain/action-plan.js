const BACKLOG_STATUSES = new Set(['untested', 'approved', 'assigned', 'to do']);
const PRODUCTION_STATUSES = new Set(['in production', 'ready to launch']);
const TESTING_STATUSES = new Set(['testing']);
const WINNER_STATUSES = new Set(['winner', 'mild winner', 'scale', 'complete']);
const LOSER_STATUSES = new Set(['loser', 'killed']);
const FINAL_STATUSES = new Set(['winner', 'mild winner', 'scale', 'complete', 'loser', 'killed']);

export function normalizeManualActionRow(row) {
  const payload = objectOrEmpty(row && row.payload);
  const liveStatus = text(row && row.live_status) || text(payload.liveStatus) || 'Untested';

  return {
    ...payload,
    id: text(payload.id) || text(row && row.id),
    _dbId: text(row && row.id) || text(payload._dbId),
    productId: text(row && row.product_id) || text(payload.productId),
    liveStatus,
    createdAt: text(row && row.created_at) || text(payload.createdAt),
    updatedAt: text(row && row.updated_at) || text(payload.updatedAt),
    approvedAt: text(row && row.approved_at) || text(payload.approvedAt),
    deliveredAt: text(row && row.delivered_at) || text(payload.deliveredAt),
    launchedAt: text(row && row.launched_at) || text(payload.launchedAt),
    killedAt: text(row && row.killed_at) || text(payload.killedAt),
    scaledAt: text(row && row.scaled_at) || text(payload.scaledAt),
    clickupTaskDeleted: Boolean(payload._clickupTaskDeleted),
  };
}

export function normalizeActionAd(row) {
  const meta = objectOrEmpty(row && row.meta);
  const clickupTaskId = text(row && row.clickup_task_id) || text(meta.clickupTaskId) || text(meta._clickupId);
  const parentAdId = text(row && row.parent_ad_id) || text(meta.parentAdId);

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
    parentAdId,
    variationNumber: numberOrNull(row && row.variation_number),
    adOrigin: text(row && row.ad_origin) || text(meta.adOrigin),
    clickupTaskId,
    _clickupId: clickupTaskId,
    _clickupUrl: clickupTaskId ? `https://app.clickup.com/t/${clickupTaskId}` : text(meta._clickupUrl),
    createdAt: timestampMs(row && row.created_at) || timestampMs(meta.createdAt),
    updatedAt: timestampMs(row && row.updated_at) || timestampMs(meta.updatedAt),
    lastStatusChangeAt: timestampMs(row && row.last_status_change_at) || timestampMs(meta.lastStatusChangeAt),
    testingDeferredAt: timestampMs(row && row.testing_deferred_at) || timestampMs(meta.testingDeferredAt),
    testingDeferCount: numberOrNull(row && row.testing_defer_count) || 0,
    deletedAt: text(row && row.deleted_at) || text(meta.deletedAt),
    _customFields: objectOrEmpty(meta._customFields),
    _customFieldsRaw: objectOrEmpty(meta._customFieldsRaw),
  };
}

export function actionClickUpId(action) {
  return text(action && action.clickupTaskId) || text(action && action._clickupId);
}

export function actionSourceAdId(action) {
  return text(action && action.sourceAdId) || text(action && action.adId);
}

export function findLinkedAd(action, ads) {
  if (!action || !Array.isArray(ads)) return null;
  const sourceAdId = actionSourceAdId(action);
  if (sourceAdId) {
    const bySourceId = ads.find((ad) => ad && ad.id === sourceAdId && !ad.deletedAt);
    if (bySourceId) return bySourceId;
  }

  const clickupId = actionClickUpId(action);
  if (clickupId) {
    const byClickup = ads.find((ad) => ad && !ad.deletedAt && (ad.clickupTaskId === clickupId || ad._clickupId === clickupId));
    if (byClickup) return byClickup;
  }

  const title = text(action.title || action.taskName).trim().toLowerCase();
  if (!title) return null;
  return ads.find((ad) => {
    if (!ad || ad.deletedAt) return false;
    const formatName = text(ad.formatName).trim().toLowerCase();
    return formatName && (formatName === title || formatName.startsWith(title) || title.startsWith(formatName));
  }) || null;
}

export function resolveActionDisplay(action, ads) {
  if (!action) return null;
  const ad = findLinkedAd(action, ads);
  const customFields = objectOrEmpty(ad && ad._customFields);
  const clickupTaskId = actionClickUpId(action) || text(ad && (ad.clickupTaskId || ad._clickupId));
  const source = resolveActionSource(action, ad, ads);

  return {
    id: text(action.id) || text(action._dbId),
    dbId: text(action._dbId),
    productId: text(action.productId),
    title: text(ad && ad.formatName) || text(action.title) || text(action.taskName) || text(action.id) || text(action._dbId),
    status: text(ad && ad.status) || text(action.liveStatus) || 'Untested',
    angle: text(action.sourceAngle) || text(action.angle) || text(ad && ad.angle),
    persona: text(action.sourcePersona) || text(action.persona) || text(ad && ad.persona),
    funnelStage: text(ad && ad.funnelStage) || text(action.funnelStage),
    adType: text(ad && ad.adType) || text(action.format) || text(action.adType),
    hookType: text(ad && ad.hookType) || text(customFields['hook type']),
    creativeStructure: text(ad && ad.creativeStructure) || text(customFields['creative structure']),
    description: text(action.description) || text(ad && (ad.notes || ad.description)),
    dueDate: text(action.dueDate) || text(ad && ad.dueDate),
    dueAtMs: timestampMs(action._dueDateMs) || dueDateToMs(action.dueDate || (ad && ad.dueDate)),
    createdAt: timestampMs(ad && ad.createdAt) || timestampMs(action._pushedAt) || timestampMs(action.createdAt),
    updatedAt: timestampMs(ad && ad.updatedAt) || timestampMs(action.updatedAt),
    lastStatusChangeAt: timestampMs(ad && ad.lastStatusChangeAt) || timestampMs(action._statusChangedAt) || timestampMs(action._pushedAt),
    clickupTaskId,
    clickupUrl: clickupTaskId ? `https://app.clickup.com/t/${clickupTaskId}` : text(ad && ad._clickupUrl),
    adLink: text(ad && ad.adLink) || text(action.adLink),
    driveLink: text(ad && ad.driveLink) || text(customFields['drive link']),
    linkedAdId: text(ad && ad.id),
    source,
    isVirtual: Boolean(action._virtual),
    clickupTaskDeleted: Boolean(action.clickupTaskDeleted || action._clickupTaskDeleted),
  };
}

export function resolveActionSource(action, ad, ads) {
  if (!ad) {
    return { kind: 'manual', label: 'Manual', refId: '', refUrl: '' };
  }
  if (ad._fromInspoId || ad._sourceInsId) {
    return {
      kind: 'inspo',
      label: text(ad._fromInspoId) || text(ad._sourceInsId),
      refId: text(ad._fromInspoId) || text(ad._sourceInsId),
      refUrl: text(ad._sourceInspirationBriefUrl) || text(ad._sourceInspoUrl) || text(ad._sourceInspoAdUrl),
    };
  }
  if (ad.parentAdId) {
    const parent = Array.isArray(ads) ? ads.find((candidate) => candidate && candidate.id === ad.parentAdId) : null;
    return {
      kind: 'variation',
      label: text(parent && parent.formatName) || text(ad.parentTaskName) || text(ad.parentAdId),
      refId: text(ad.parentAdId),
      refUrl: parent && parent._clickupId ? `https://app.clickup.com/t/${parent._clickupId}` : '',
    };
  }
  if (ad.sourceFormatId) {
    const sourceAd = Array.isArray(ads) ? ads.find((candidate) => candidate && candidate.id === ad.sourceFormatId) : null;
    return {
      kind: 'tracker',
      label: text(sourceAd && sourceAd.formatName) || text(ad._sourceFormatName) || text(ad.sourceFormatId),
      refId: text(ad.sourceFormatId),
      refUrl: sourceAd && sourceAd._clickupId ? `https://app.clickup.com/t/${sourceAd._clickupId}` : text(ad._sourceClickupId) ? `https://app.clickup.com/t/${ad._sourceClickupId}` : '',
    };
  }
  if (action && (action.sourceAngle || action.sourcePersona || action.angle || action.persona)) {
    const angle = text(action.sourceAngle) || text(action.angle);
    const persona = text(action.sourcePersona) || text(action.persona);
    return { kind: 'blank', label: [angle, persona].filter(Boolean).join(' x ') || 'Blank brief', refId: '', refUrl: '' };
  }
  return { kind: 'manual', label: 'Manual', refId: '', refUrl: '' };
}

export function summarizeActionPlan(displays, nowMs = Date.now()) {
  const summary = {
    total: 0,
    backlog: 0,
    production: 0,
    testing: 0,
    winners: 0,
    losers: 0,
    overdue: 0,
  };

  for (const display of displays || []) {
    const key = statusKey(display && display.status);
    summary.total += 1;
    if (BACKLOG_STATUSES.has(key)) summary.backlog += 1;
    if (PRODUCTION_STATUSES.has(key)) summary.production += 1;
    if (TESTING_STATUSES.has(key)) summary.testing += 1;
    if (WINNER_STATUSES.has(key)) summary.winners += 1;
    if (LOSER_STATUSES.has(key)) summary.losers += 1;
    if (isActionOverdue(display, nowMs)) summary.overdue += 1;
  }

  return summary;
}

export function actionPlanBucket(status) {
  const key = statusKey(status);
  if (BACKLOG_STATUSES.has(key)) return 'backlog';
  if (PRODUCTION_STATUSES.has(key)) return 'production';
  if (TESTING_STATUSES.has(key)) return 'testing';
  if (WINNER_STATUSES.has(key)) return 'winners';
  if (LOSER_STATUSES.has(key)) return 'losers';
  return 'backlog';
}

export function isFinalActionStatus(status) {
  return FINAL_STATUSES.has(statusKey(status));
}

export function isActionOverdue(display, nowMs = Date.now()) {
  if (!display || !display.dueDate || isFinalActionStatus(display.status)) return false;
  const dueAtMs = display.dueAtMs || dueDateToMs(display.dueDate);
  if (!dueAtMs) return false;
  return dueAtMs < startOfDayMs(nowMs);
}

export function timestampMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dueDateToMs(value) {
  const date = text(value);
  if (!date) return null;
  const parsed = Date.parse(`${date}T23:59:59`);
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDayMs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Date.now();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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
