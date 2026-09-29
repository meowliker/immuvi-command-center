const text = (value) => typeof value === 'string' ? value.trim() : '';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const ms = (value) => { const parsed = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; };
export const inspirationText = (value) => text(value).replace(/<br\s*\/?>/gi, '\n');
export function inspirationVoice(value) {
  const voice=inspirationText(value);
  return /(?:transcript (?:unavailable|not (?:verified|available))|exact (?:transcript|words) (?:unavailable|not verified)|audio (?:track )?present[;,. -]+(?:exact|transcript)|unable to (?:verify|transcribe))/i.test(voice)?'':voice;
}
export const INSPIRATION_FILTERS = { query: '', platform: '', status: '', hookType: '', adType: '', performance: '', formatName: '', source: '' };

export function inspirationLink(value) {
  try { const url = new URL(text(value)); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}

export function inspirationQueueStatus(status, queue) {
  const current = text(status) || 'Saved', q = text(queue?.status).toLowerCase();
  if (q === 'ready') return 'Ready';
  if (q === 'cancelled') return 'Cancelled';
  if (q === 'blocked' || (['failed', 'error'].includes(q) && (/^blocked:/i.test(queue.worker_assignment || '')
    || /no healthy enabled classifier worker|agent infrastructure failure|operation not permitted|os error 1/i.test(queue.error_message || '')))) return 'Blocked';
  if (['failed', 'error'].includes(q)) return 'Failed';
  if (['claimed', 'classifying'].includes(q)) return 'Classifying';
  if (['pending', 'processing'].includes(q)) return 'Queued';
  if (['classified', 'done'].includes(q) && /^(queued|classifying|pending|processing)$/i.test(current)) return 'Classified';
  return current.charAt(0).toUpperCase() + current.slice(1);
}

export function inspirationMediaType(data, status) {
  if (['Queued', 'Classifying', 'Blocked', 'Failed', 'Cancelled'].includes(status)) return '';
  const raw = text(data.adType || data.ad_type || data.photo_video);
  const kind = text(data.mediaKind || data.media_kind || data.media_type || data.mediaType || data.fetched_media_kind || data.downloaded_media_kind).toLowerCase();
  const image = ['image', 'photo', 'static'].includes(kind) || data.is_video === false;
  const video = kind === 'video' || data.is_video === true;
  if (image && (!raw || /^(video|vsl)$/i.test(raw))) return 'Photo';
  if (kind === 'carousel' && (!raw || /^(video|vsl)$/i.test(raw))) return 'Carousel';
  if (video && (!raw || /^(photo|image|carousel)$/i.test(raw))) return 'Video';
  return /^(video|photo|carousel|ugc|vsl)$/i.test(raw) ? ({ ugc: 'UGC', vsl: 'VSL' }[raw.toLowerCase()] || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) : raw;
}

export function projectInspirationLibrary(productId, rows, queues, ads, tombstones = [], cells = []) {
  const queueById = new Map(), byId = new Map(), usage = new Map();
  for (const q of queues) {
    if (q.product_id !== productId || !q.ins_id) continue;
    const old = queueById.get(q.ins_id);
    if (!old || ms(q.queued_at) >= ms(old.queued_at)) queueById.set(q.ins_id, q);
  }
  for (const row of rows) if (row.product_id === productId && row.id && !row.deleted_at) byId.set(row.id, row);
  // Queue-only records must remain inspectable instead of disappearing behind an empty library.
  for (const [id, q] of queueById) if (!byId.has(id) && !rows.some((row) => row.product_id === productId && row.id === id && row.deleted_at))
    byId.set(id, { id, product_id: productId, url: q.url, platform: q.platform, status: 'Queued', created_at: q.queued_at, data: {}, queueOnly: true });
  const deleted = new Set(tombstones.filter((row) => row.product_id === productId).flatMap((row) => [row.id, row.clickup_task_id]).filter(Boolean));
  for (const ad of ads) {
    const meta = object(ad.meta), task = ad.clickup_task_id || meta.clickupTaskId || meta._clickupId;
    if (ad.product_id !== productId || ad.deleted_at || meta._productBoundaryQuarantined || deleted.has(ad.id) || (task && deleted.has(task))) continue;
    const source = meta._fromInspoId || meta._sourceInsId;
    if (!source || !byId.has(source)) continue;
    const group = usage.get(source) || [];
    if (!group.some((item) => item.id === ad.id)) group.push({ id: ad.id, version: text(ad.updated_at), title: text(ad.format_name) || ad.id,
      angle: text(ad.angle), persona: text(ad.persona), status: text(ad.status) || text(meta.status) || 'Untested',
      createdAt: ms(ad.created_at || meta.createdAt || meta.dateCreated),
      cells: cells.filter((cell) => cell.product_id === productId && Array.isArray(cell.creative_assignments) && cell.creative_assignments.includes(ad.id)).map((cell) => cell.id) });
    usage.set(source, group);
  }
  return [...byId.values()].map((row) => {
    const data = object(row.data), q = queueById.get(row.id), used = usage.get(row.id) || [];
    const winners = used.filter((ad) => /^(winner|mild winner|scale|complete)$/i.test(ad.status)).length;
    const losers = used.filter((ad) => /^(loser|killed)$/i.test(ad.status)).length;
    const testing = used.filter((ad) => /^(testing|in production|ready to launch)$/i.test(ad.status)).length;
    const status = inspirationQueueStatus(text(row.status) || text(data.status), q);
    const voice = inspirationText(data.voiceOver || data.voice_over);
    return { id: String(row.id), productId, version: text(row.updated_at), queueOnly: Boolean(row.queueOnly), queueSnapshot: q || null,
      editFields: { ...data, formatName: text(data.formatName) || text(row.title), platform: text(row.platform) || text(data.platform), addedBy: text(row.added_by) || text(data.addedBy) },
      formatName: text(data.formatName) || text(row.title) || text(data.title) || String(row.id),
      brand: text(data.brand), platform: text(row.platform) || text(data.platform), status,
      angle: text(data.angle), persona: text(data.persona), hookType: text(data.hookType),
      creativeStructure: text(data.creativeStructure), productionStyle: text(data.productionStyle), funnelStage: text(data.funnelStage),
      adType: inspirationMediaType(data, status), sourceUrl: inspirationLink(row.url || data.sourceUrl), briefUrl: inspirationLink(data._clickupDocPageUrl || data.briefUrl),
      source: data._sourceProductId ? 'imported' : 'original', sourceProductId: text(data._sourceProductId), sourceProductName:text(data._sourceProductName), sourceRecordId:text(data._sourceInsId || data._sourceAdId),
      addedBy: text(row.added_by) || text(data.addedBy), createdAt: ms(data.classifiedAt || row.created_at || data.queuedAt),
      hypothesis: inspirationText(data.creativeHypothesis), notes: inspirationText(data.notes), bodyCopy: inspirationText(data.bodyCopy),
      voiceOver: inspirationVoice(voice),
      duplicate: text(data._dupeDetail) || text(data._dupeType), duplicateReviewed: Boolean(data._dupeBannerDismissed),
      duration: Number.isFinite(Number(data.duration_seconds)) && Number(data.duration_seconds)>0 ? `${Number(data.duration_seconds)}s` : text(data.duration),
      tags:Array.isArray(data.importTags)?data.importTags.filter((tag)=>typeof tag==='string'):[],
      formatDetail:text(data.creativeUSP).split(' \u2014 ').slice(1).join(' \u2014 '),
      queueError: text(q?.error_message), queueAttempts: Number(q?.attempts) || 0, queueWorker: text(q?.claimed_by),
      recovery: data._qaRecoveredQueue ? {status:text(object(data._qaRecoveredQueue).status),error:text(object(data._qaRecoveredQueue).error_message),attempts:Number(object(data._qaRecoveredQueue).attempts)||0,worker:text(object(data._qaRecoveredQueue).claimed_by)} : null,
      usage: used, cellCount: new Set(used.flatMap((ad) => ad.cells)).size,
      performance: !used.length ? 'unused' : winners && losers ? 'mixed' : winners ? 'winner' : losers ? 'loser' : testing ? 'testing' : 'placed' };
  });
}

export function filterInspirations(rows, filters = INSPIRATION_FILTERS, sort = { key: 'createdAt', direction: -1 }) {
  const query = filters.query.toLowerCase().trim();
  return rows.filter((row) => Object.entries(filters).every(([key, value]) => key === 'query' || !value || row[key] === value)
    && (!query || [row.id, row.formatName, row.formatDetail, row.brand, row.angle, row.persona, row.notes, row.sourceUrl, row.addedBy].join(' ').toLowerCase().includes(query)))
    .sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (!av !== !bv) return av ? -1 : 1;
      const diff = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
      return diff * (sort.direction === 1 ? 1 : -1) || a.id.localeCompare(b.id);
    });
}
