import {deleteOrphanAction} from '../tools/orphan-action-deletion.mjs';

// Forward the caller's JWT, never elevate deletion to the service role.
export function createDeleteCreativeHandler({fetchImpl = fetch, env = process.env} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({error: 'Use POST', code: 'METHOD_NOT_ALLOWED'});
    }
    const authorization = req.headers.authorization || '';
    if (!/^Bearer [^\s]+$/i.test(authorization)) {
      return res.status(401).json({error: 'Please sign in before deleting.', code: 'AUTH_REQUIRED'});
    }
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({error: 'Invalid deletion request.', code: 'INVALID_REQUEST'}); }
    const {adId, productId, expectedClickUpId, actionId, confirmOrphanAction} = body || {};
    if (![adId, productId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 200) ||
        !(expectedClickUpId === null || (typeof expectedClickUpId === 'string' && expectedClickUpId.length <= 200)) ||
        !(actionId == null || (typeof actionId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionId))) ||
        !(confirmOrphanAction==null||typeof confirmOrphanAction==='boolean') ||
        (confirmOrphanAction===true&&!actionId)) {
      return res.status(400).json({error: 'Invalid deletion request.', code: 'INVALID_REQUEST'});
    }
    const url = env.SUPABASE_URL, key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({error: 'Deletion service is not configured.', code: 'NOT_CONFIGURED'});
    const headers = {apikey: key, Authorization: authorization, 'Content-Type': 'application/json'};
    const deadline = AbortSignal.timeout(24000);
    const requestSignal = () => AbortSignal.any([deadline, AbortSignal.timeout(12000)]);
    try {
      const commit = id => fetchImpl(url + '/rest/v1/rpc/delete_creative', {
        method: 'POST', headers, signal: requestSignal(),
        body: JSON.stringify({p_ad_id: id, p_product_id: productId, p_expected_clickup_id: expectedClickUpId})
      });
      let canonicalId = adId;
      if(confirmOrphanAction===true) {
        const orphan=await deleteOrphanAction({fetchImpl,url,headers,requestSignal,adId,productId,
          expectedClickUpId,actionId,confirmOrphanAction:true});
        return res.status(orphan.status).json(orphan.body);
      }
      let response = await commit(canonicalId);
      let result = await response.json();
      // Read-only ClickUp refreshes can display task IDs rather than the saved
      // creative's serial ID. Resolve only an exact, unique same-product task.
      if (!response.ok && result.code === 'P0002' && expectedClickUpId) {
        const query = new URLSearchParams({product_id:'eq.'+productId,
          clickup_task_id:'eq.'+expectedClickUpId,select:'id,product_id,clickup_task_id',limit:'2'});
        const lookup = await fetchImpl(url + '/rest/v1/ads?' + query, {headers,signal:requestSignal()});
        const matches = await lookup.json();
        if (!lookup.ok && [401,403].includes(lookup.status)) {
          return res.status(lookup.status).json({error:lookup.status===401 ? 'Your session expired. Please sign in again.' :
            'You do not have access to delete in this product.',code:lookup.status===401?'AUTH_REQUIRED':'42501'});
        }
        if (!lookup.ok || !Array.isArray(matches)) {
          return res.status(503).json({error:'Task identity could not be checked. No further deletion was attempted.',code:'IDENTITY_UNAVAILABLE'});
        }
        if (matches.length > 1) {
          return res.status(409).json({error:'More than one creative refers to this task. Refresh and review before deleting.',code:'PT409'});
        }
        if (matches.length === 1) {
          const match = matches[0];
          if (typeof match.id !== 'string' || !match.id || match.id.length > 200 ||
              match.product_id !== productId || match.clickup_task_id !== expectedClickUpId || match.id === adId) {
            return res.status(409).json({error:'This creative has a conflicting task identity. Refresh before deleting.',code:'PT409'});
          }
          canonicalId = match.id;
          response = await commit(canonicalId);
          result = await response.json();
        }
      }
      if (!response.ok) {
        if(result.code==='P0002') {
          const orphan=await deleteOrphanAction({fetchImpl,url,headers,requestSignal,adId,productId,
            expectedClickUpId,actionId});
          return res.status(orphan.status).json(orphan.body);
        }
        const code = String(result.code || 'DATABASE_ERROR');
        const status = response.status === 401 ? 401 : code === '42501' ? 403 :
          code === 'P0002' ? 404 : ['PT409', '40001'].includes(code) ? 409 : 502;
        const error = status === 401 ? 'Your session expired. Please sign in again.' :
          status === 403 ? 'You do not have access to delete in this product.' :
          status === 404 ? 'This creative is not saved in this product. Refresh before deleting.' :
          status === 409 ? 'This creative has a conflicting task identity. Refresh and review before deleting.' :
          'The database could not confirm the deletion. Refresh to check before retrying.';
        console.warn('[delete-creative] rejected', {code, status});
        return res.status(status).json({error, code});
      }
      const expectedIds = expectedClickUpId ? [expectedClickUpId] : [];
      if (result.id !== canonicalId || result.productId !== productId || !result.deletedAt ||
          JSON.stringify(result.clickupTaskIds) !== JSON.stringify(expectedIds)) {
        return res.status(502).json({error: 'Deletion could not be verified. Refresh to check before retrying.', code: 'VERIFY_FAILED'});
      }
      const query = new URLSearchParams({id: 'eq.' + canonicalId, product_id: 'eq.' + productId, select: 'id,deleted_at'});
      const check = await fetchImpl(url + '/rest/v1/ads?' + query, {headers, signal: requestSignal()});
      const rows = await check.json();
      if (!check.ok || !Array.isArray(rows) || rows.length !== 1 || rows[0].id !== canonicalId ||
          !rows[0].deleted_at || Date.parse(rows[0].deleted_at) !== Date.parse(result.deletedAt)) {
        return res.status(502).json({error: 'Deletion could not be verified. Refresh to check before retrying.', code: 'VERIFY_FAILED'});
      }
      return res.status(200).json({...result, id: adId, canonicalId, verified: true});
    } catch (error) {
      console.warn('[delete-creative] transport failed', {name: error.name});
      return res.status(503).json({error: 'Deletion could not be confirmed. Refresh to check before retrying.', code: 'UPSTREAM_UNAVAILABLE'});
    }
  };
}
export default createDeleteCreativeHandler();
