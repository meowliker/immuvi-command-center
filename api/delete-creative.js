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
    const {adId, productId, expectedClickUpId} = body || {};
    if (![adId, productId].every(v => typeof v === 'string' && v.length > 0 && v.length <= 200) ||
        !(expectedClickUpId === null || (typeof expectedClickUpId === 'string' && expectedClickUpId.length <= 200))) {
      return res.status(400).json({error: 'Invalid deletion request.', code: 'INVALID_REQUEST'});
    }
    const url = env.SUPABASE_URL, key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({error: 'Deletion service is not configured.', code: 'NOT_CONFIGURED'});
    const headers = {apikey: key, Authorization: authorization, 'Content-Type': 'application/json'};
    try {
      const response = await fetchImpl(url + '/rest/v1/rpc/delete_creative', {
        method: 'POST', headers, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({p_ad_id: adId, p_product_id: productId, p_expected_clickup_id: expectedClickUpId})
      });
      const result = await response.json();
      if (!response.ok) {
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
      if (result.id !== adId || result.productId !== productId || !result.deletedAt ||
          JSON.stringify(result.clickupTaskIds) !== JSON.stringify(expectedIds)) {
        return res.status(502).json({error: 'Deletion could not be verified. Refresh to check before retrying.', code: 'VERIFY_FAILED'});
      }
      const query = new URLSearchParams({id: 'eq.' + adId, product_id: 'eq.' + productId, select: 'id,deleted_at'});
      const check = await fetchImpl(url + '/rest/v1/ads?' + query, {headers, signal: AbortSignal.timeout(12000)});
      const rows = await check.json();
      if (!check.ok || !Array.isArray(rows) || rows.length !== 1 || rows[0].id !== adId ||
          !rows[0].deleted_at || Date.parse(rows[0].deleted_at) !== Date.parse(result.deletedAt)) {
        return res.status(502).json({error: 'Deletion could not be verified. Refresh to check before retrying.', code: 'VERIFY_FAILED'});
      }
      return res.status(200).json({...result, verified: true});
    } catch (error) {
      console.warn('[delete-creative] transport failed', {name: error.name});
      return res.status(503).json({error: 'Deletion could not be confirmed. Refresh to check before retrying.', code: 'UPSTREAM_UNAVAILABLE'});
    }
  };
}
export default createDeleteCreativeHandler();
