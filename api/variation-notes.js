// Same-origin transport; the user's JWT and database function enforce product access.
export function createVariationNotesHandler({fetchImpl = fetch, env = process.env} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({error: 'Use POST', code: 'METHOD_NOT_ALLOWED'});
    }
    const authorization = req.headers.authorization || '';
    if (!/^Bearer [^\s]+$/i.test(authorization)) {
      return res.status(401).json({error: 'Sign in to save notes', code: 'AUTH_REQUIRED'});
    }
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({error: 'Notes service is not configured', code: 'NOT_CONFIGURED'});
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({error: 'Invalid request', code: 'INVALID_REQUEST'}); }
    const {adId, productId, original, notes} = body || {};
    if (![adId, productId, original, notes].every(value => typeof value === 'string') ||
        !adId || !productId || adId.length > 200 || productId.length > 200 ||
        original.length > 100000 || notes.length > 20000) {
      return res.status(400).json({error: 'Invalid notes request (maximum 20,000 characters)', code: 'INVALID_REQUEST'});
    }
    const headers = {apikey: key, Authorization: authorization, 'Content-Type': 'application/json'};
    try {
      const response = await fetchImpl(url + '/rest/v1/rpc/save_variation_notes', {
        method: 'POST', headers, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({p_ad_id: adId, p_product_id: productId, p_original: original, p_notes: notes})
      });
      const result = await response.json();
      if (!response.ok) {
        const code = String(result.code || 'DATABASE_ERROR');
        const status = code === '40001' ? 409 : code === 'P0002' ? 404 :
          code === '42501' ? 403 : response.status === 401 ? 401 : 502;
        const error = status === 409 ? 'Notes changed since you opened them. Copy your edits, then reopen the notes.' :
          status === 404 ? 'This variation is no longer available in this product.' :
          status === 403 ? 'You do not have access to this product.' :
          status === 401 ? 'Please sign in again.' : 'The notes service could not save this note.';
        console.warn('[variation-notes] rejected', {code, status});
        return res.status(status).json({error, code});
      }
      if (result.id !== adId || result.productId !== productId || result.notes !== notes) {
        return res.status(502).json({error: 'The save was not confirmed', code: 'VERIFY_FAILED'});
      }
      // Read after the RPC transaction commits, using the same user identity.
      const query = new URLSearchParams({id: 'eq.' + adId, product_id: 'eq.' + productId,
        deleted_at: 'is.null', select: 'id,meta'});
      const check = await fetchImpl(url + '/rest/v1/ads?' + query, {
        headers, signal: AbortSignal.timeout(12000)
      });
      const rows = await check.json();
      if (!check.ok || !Array.isArray(rows) || rows.length !== 1 || rows[0].id !== adId ||
          (rows[0].meta?.notes ?? rows[0].meta?.variationNotes ?? '') !== notes) {
        return res.status(502).json({error: 'The save could not be verified. Retry to check again.', code: 'VERIFY_FAILED'});
      }
      return res.status(200).json({id: adId, productId, notes, verified: true});
    } catch (error) {
      console.error('[variation-notes] transport failed', {name: error.name});
      return res.status(503).json({error: 'The notes service could not reach Supabase. Your edits remain in the popup.', code: 'UPSTREAM_UNAVAILABLE'});
    }
  };
}

export default createVariationNotesHandler();
