// Vercel Serverless Function — receives OneScale launch results.
//
// POST /api/onescale-launch-callback

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESCALE_UPDATES_CLICKUP_STATUS = true;
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || process.env.CLICKUP_TOKEN || '';

async function sbRest(method, path, body) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path} failed: HTTP ${response.status} ${text}`);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function actionClickupId(action) {
  if (!action || typeof action !== 'object') return '';
  return action.clickupTaskId || action._clickupId || '';
}

function compactStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function postgrestIn(values) {
  return values
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
}

function launchMetadata(payload, status) {
  const launchedAt = payload.launchedAt || new Date().toISOString();
  const meta = {
    launchId: payload.launchId,
    status,
    storeId: payload.storeId || '',
    productProfileId: payload.productProfileId || '',
    launchedAt,
  };

  if (payload.metaCampaignId) meta.metaCampaignId = payload.metaCampaignId;
  if (Array.isArray(payload.metaAdSetIds)) meta.metaAdSetIds = payload.metaAdSetIds;
  if (Array.isArray(payload.metaAdIds)) meta.metaAdIds = payload.metaAdIds;
  if (payload.error) meta.error = payload.error;

  return meta;
}

function patchActionPayload(action, payload, status) {
  const next = Object.assign({}, action);
  next.oneScaleLaunch = launchMetadata(payload, status);

  if (status === 'success') {
    next.liveStatus = 'Testing';
    next._oneScaleLaunchedAt = next.oneScaleLaunch.launchedAt;
    next._statusChangedAt = Date.now();
    if (Array.isArray(next._history)) {
      next._history = next._history.slice(-49);
    } else {
      next._history = [];
    }
    next._history.push({
      ts: Date.now(),
      type: 'onescale_launched',
      detail: 'Launched in OneScale',
      by: 'onescale',
    });
  } else {
    next.oneScaleLaunchError = payload.error || 'OneScale launch failed';
    if (Array.isArray(next._history)) {
      next._history = next._history.slice(-49);
    } else {
      next._history = [];
    }
    next._history.push({
      ts: Date.now(),
      type: 'onescale_launch_failed',
      detail: next.oneScaleLaunchError,
      by: 'onescale',
    });
  }

  return next;
}

function matchManualActionRows(rows, clickupTaskIdSet) {
  return rows.filter((row) => {
    const payload = row && row.payload;
    const clickupId = actionClickupId(payload);
    return clickupId && clickupTaskIdSet.has(clickupId);
  });
}

async function updateLinkedAds(rows, clickupTaskIds) {
  const ids = new Set();
  const taskIds = new Set(clickupTaskIds || []);
  const nowMs = Date.now();

  rows.forEach((row) => {
    const action = row.payload || {};
    if (action.sourceAdId) ids.add(action.sourceAdId);
    if (action.adId) ids.add(action.adId);
  });

  for (const id of ids) {
    await sbRest('PATCH', `/ads?id=eq.${encodeURIComponent(id)}`, {
      status: 'Testing',
      last_status_change_at: nowMs,
    });
  }

  for (const taskId of taskIds) {
    await sbRest('PATCH', `/ads?clickup_task_id=eq.${encodeURIComponent(taskId)}`, {
      status: 'Testing',
      last_status_change_at: nowMs,
    });
  }
}

async function findAdsByClickUpTaskIds(clickupTaskIds) {
  const ids = compactStringArray(clickupTaskIds);
  if (!ids.length) return [];
  const query = `/ads?select=id,product_id,format_name,clickup_task_id&clickup_task_id=in.(${encodeURIComponent(postgrestIn(ids))})`;
  const rows = await sbRest('GET', query);
  return Array.isArray(rows) ? rows : [];
}

async function insertOneScaleActivityEvents(payload, clickupTaskIds, updatedRows) {
  if (normalizeStatus(payload.status) !== 'success') return 0;

  const launchedAt = payload.launchedAt || new Date().toISOString();
  const ads = await findAdsByClickUpTaskIds(clickupTaskIds);
  const adByClickUpId = new Map();
  ads.forEach((ad) => {
    if (ad && ad.clickup_task_id) adByClickUpId.set(ad.clickup_task_id, ad);
  });

  const actionByClickUpId = new Map();
  (updatedRows || []).forEach((row) => {
    const action = (row && row.payload) || {};
    const clickupId = actionClickupId(action);
    if (clickupId) actionByClickUpId.set(clickupId, row);
  });

  const events = [];
  compactStringArray(clickupTaskIds).forEach((clickupTaskId) => {
    const ad = adByClickUpId.get(clickupTaskId);
    const actionRow = actionByClickUpId.get(clickupTaskId);
    const action = (actionRow && actionRow.payload) || {};
    const productId = (ad && ad.product_id) || (actionRow && actionRow.product_id);
    if (!productId) return;

    const taskName = (ad && ad.format_name) || action.taskName || action.title || clickupTaskId;
    events.push({
      product_id: productId,
      action_id: actionRow && actionRow.id ? actionRow.id : null,
      clickup_task_id: clickupTaskId,
      event_type: 'launched',
      field_name: 'status',
      old_value: 'Ready to Launch',
      new_value: 'Testing',
      actor: 'OneScale',
      source: 'onescale',
      metadata: {
        ad_id: ad && ad.id ? ad.id : (action.sourceAdId || action.adId || null),
        task_name: taskName,
        launch_id: payload.launchId,
        store_id: payload.storeId || '',
        product_profile_id: payload.productProfileId || '',
        clickup_task_ids: compactStringArray(clickupTaskIds),
        meta_campaign_id: payload.metaCampaignId || null,
        meta_ad_set_ids: Array.isArray(payload.metaAdSetIds) ? payload.metaAdSetIds : [],
        meta_ad_ids: Array.isArray(payload.metaAdIds) ? payload.metaAdIds : [],
      },
      created_at: launchedAt,
    });
  });

  if (!events.length) return 0;
  await sbRest('POST', '/activity_events', events);
  return events.length;
}

async function updateClickUpTasksToTesting(clickupTaskIds) {
  if (ONESCALE_UPDATES_CLICKUP_STATUS) return { skipped: true, updated: 0 };
  if (!CLICKUP_API_KEY) {
    throw new Error('CLICKUP_API_KEY or CLICKUP_TOKEN is required when Immuvi updates ClickUp status');
  }

  let updated = 0;
  for (const taskId of clickupTaskIds || []) {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers: {
        Authorization: CLICKUP_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status: 'testing' }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`ClickUp status update failed for ${taskId}: HTTP ${response.status} ${text}`);
    }
    updated++;
  }

  return { skipped: false, updated };
}

async function updateManualActionRows(rows, payload, status) {
  const updatedRows = [];
  const launchedAt = payload.launchedAt || new Date().toISOString();
  const normalizedPayload = Object.assign({}, payload, { launchedAt });

  for (const row of rows) {
    const nextPayload = patchActionPayload(row.payload || {}, normalizedPayload, status);
    const patch = {
      payload: nextPayload,
    };

    if (status === 'success') {
      patch.live_status = 'Testing';
      patch.launched_at = launchedAt;
    }

    await sbRest('PATCH', `/manual_actions?id=eq.${encodeURIComponent(row.id)}`, patch);
    updatedRows.push(Object.assign({}, row, { payload: nextPayload }));
  }

  return updatedRows;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  let payload = req.body || {};
  if (typeof payload === 'string') {
    try {
      payload = payload ? JSON.parse(payload) : {};
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'invalid JSON body' });
    }
  }

  if (!payload.launchId) {
    return res.status(400).json({ ok: false, error: 'missing launchId' });
  }

  if (!Array.isArray(payload.clickupTaskIds)) {
    return res.status(400).json({ ok: false, error: 'clickupTaskIds must be an array' });
  }

  const status = normalizeStatus(payload.status);
  if (status !== 'success' && status !== 'failed') {
    return res.status(400).json({ ok: false, error: 'status must be success or failed' });
  }

  const clickupTaskIds = compactStringArray(payload.clickupTaskIds);
  const clickupTaskIdSet = new Set(clickupTaskIds);
  console.log('[OneScale Launch Callback]', payload);

  try {
    const rows = await sbRest('GET', '/manual_actions?select=id,product_id,payload,live_status,launched_at');
    const matches = matchManualActionRows(Array.isArray(rows) ? rows : [], clickupTaskIdSet);

    if (status === 'failed') {
      await updateManualActionRows(matches, payload, 'failed');
      return res.status(200).json({ ok: true, updated: 0 });
    }

    const updatedRows = await updateManualActionRows(matches, payload, 'success');
    await updateLinkedAds(updatedRows, clickupTaskIds);
    const activityEvents = await insertOneScaleActivityEvents(payload, clickupTaskIds, updatedRows);
    await updateClickUpTasksToTesting(clickupTaskIds);

    return res.status(200).json({ ok: true, updated: updatedRows.length, activityEvents });
  } catch (err) {
    console.error('[OneScale Launch Callback] error:', err);
    return res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
}
