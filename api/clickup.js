// Vercel Serverless Function — proxies browser → api.clickup.com
// Reason: ClickUp's REST API doesn't allow cross-origin browser calls with
// Authorization headers, so we relay through our own domain.
//
// Frontend calls: /api/clickup?path=/team  (optional ?v=3 for v3 API)
// This function forwards to: https://api.clickup.com/api/v2/team
// (or https://api.clickup.com/api/v3/... when v=3 is passed)
//
// Security:
//  - User's ClickUp API key is forwarded as-is (it lives in their browser localStorage).
//  - No key is stored server-side.
//  - Only api.clickup.com is contacted; no SSRF risk.

import {
  buildClickUpProxyTarget,
  clickUpForwardHeaders,
  clickUpProxyCorsHeaders,
} from '../lib/services/clickup-proxy.js';

export default async function handler(req, res) {
  // Basic CORS so the Vercel HTML can call this function
  const corsHeaders = clickUpProxyCorsHeaders();
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const target = buildClickUpProxyTarget(req.url);

    // Forward the user's ClickUp token
    let forwardHeaders;
    try {
      forwardHeaders = clickUpForwardHeaders(req.headers);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    // Read the request body for non-GET methods
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Vercel's default body parser leaves req.body populated for JSON content
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: body
    });

    const text = await upstream.text();
    res.status(upstream.status);
    // Forward content-type if present
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    return res.send(text);
  } catch (err) {
    console.error('[api/clickup] error:', err);
    return res.status(502).json({ error: 'Proxy error', detail: String(err && err.message || err) });
  }
}
