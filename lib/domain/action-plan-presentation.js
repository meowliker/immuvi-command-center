const text = (value) => typeof value === 'string' ? value.trim() : '';

export function planLink(value) {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function planSourceLabel(action) {
  const kind = action.display.source.kind;
  return { kind, label: ({ inspo: 'From Inspiration', tracker: 'From Tracker', variation: 'Winner Variation',
    blank: 'Blank Brief', manual: 'Manual entry', adopted: 'Adopted from ClickUp' })[kind] || 'Unknown source' };
}

// Inputs have already passed the plan's product/lifecycle projection. Never look up
// provenance across products or use a name match to find a reference creative.
export function planPresentation(action, ads = [], inspirations = []) {
  const d = action.display, meta = action.linkedAdMeta || {}, payload = action.payload || {};
  const sameProduct = ads.filter((ad) => ad.productId === d.productId && !ad.deletedAt);
  const source = sameProduct.find((ad) => ad.id === meta.sourceFormatId);
  const reference = sameProduct.find((ad) => ad.id === meta._fromTrackerAdId);
  const inspiration = inspirations.find((row) => row.product_id === d.productId && row.id === (meta._fromInspoId || meta._sourceInsId));
  const custom = meta._customFields || {};
  const value = (key, label) => Object.hasOwn(meta, key) ? text(meta[key]) : Object.hasOwn(custom, label) ? text(custom[label]) : text(payload[key]);
  return {
    source: planSourceLabel(action),
    originLabel: text(inspiration?.title) || text(inspiration?.data?.formatName) || text(inspiration?.data?.title) || d.source.label || planSourceLabel(action).label,
    hookType: Object.hasOwn(meta, 'hookType') ? text(meta.hookType) : d.hookType || value('hookType', 'hook type'),
    creativeStructure: Object.hasOwn(meta, 'creativeStructure') ? text(meta.creativeStructure) : d.creativeStructure || value('creativeStructure', 'creative structure'),
    productionStyle: value('productionStyle', 'production style'),
    hypothesis: value('creativeHypothesis', 'creative hypothesis'),
    usp: value('creativeUSP', 'creative usp'),
    notes: value('notes', 'notes'),
    approvedDate: value('approvedDate', 'approved date') || text(payload.approvedAt),
    briefUrl: [inspiration?.data?._clickupDocPageUrl, meta._sourceInspirationBriefUrl, meta.briefUrl, source?.briefUrl, payload.briefUrl].map(planLink).find(Boolean) || '',
    refUrl: reference?.clickupTaskId ? `https://app.clickup.com/t/${encodeURIComponent(reference.clickupTaskId)}` : '',
    sourceUrl: [inspiration?.data?._clickupDocPageUrl, inspiration?.url, inspiration?.data?.sourceUrl, d.source.refUrl].map(planLink).find(Boolean) || '',
    adSourceUrl: [inspiration?.url, inspiration?.data?.sourceUrl, d.adLink].map(planLink).find(Boolean) || '',
    clickupDriveUrl: planLink(Object.hasOwn(custom, 'drive link') ? custom['drive link'] : d.clickupTaskId ? d.driveLink : ''),
    adUrl: planLink(d.adLink), driveUrl: planLink(d.driveLink), clickupUrl: planLink(d.clickupUrl),
    winner: ['winner', 'mild winner', 'scale'].includes(d.status.trim().toLowerCase()),
  };
}

export function resolvePlanMatrixCell(target, angles, personas) {
  const matches = (rows, name) => rows.filter((row) => name && row.name === name && !row.archivedAt);
  const a = matches(angles, target.angle), p = matches(personas, target.persona);
  return a.length === 1 && p.length === 1 ? { angleId: a[0].id, personaId: p[0].id } : null;
}
