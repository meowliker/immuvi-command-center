import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClickUpClient } from '../../../../lib/services/clickup-client.js';
import { runClickUpIntegration } from '../../../../lib/services/clickup-integration.js';
import { saveClickUpPresenceIdentity } from '../../../../lib/services/clickup-presence.js';

export const maxDuration = 120;

export async function POST(request) {
  const requestId = crypto.randomUUID();
  const headers = { 'Cache-Control': 'no-store', 'X-Request-Id': requestId };
  let operation = 'unknown';
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'Sign in to QA first.' }, { status: 401, headers });
    const db = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } },
    });
    const auth = await db.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) return Response.json({ error: 'QA session expired.' }, { status: 401, headers });
    const input = await request.json();
    operation = typeof input.operation === 'string' ? input.operation.replace(/[^a-z-]/g, '').slice(0, 60) : 'unknown';
    console.info('[qa-clickup]', { requestId, operation, phase: 'received' });
    if (typeof input.productId !== 'string' || !input.productId) throw new Error('Select a product.');
    const profileResult = await db.from('profiles').select('*').eq('id', auth.data.user.id).single();
    const profile = profileResult.data;
    if (profileResult.error || !profile?.is_active || profile.must_change_password) {
      return Response.json({ error: 'Active QA access is required.' }, { status: 403, headers });
    }
    if (profile.role !== 'admin') {
      const access = await db.from('user_products').select('product_id').eq('user_id', auth.data.user.id).eq('product_id', input.productId).maybeSingle();
      if (access.error || !access.data) return Response.json({ error: 'No access to this product.' }, { status: 403, headers });
    }
    const product = await db.from('products').select('*').eq('id', input.productId).single();
    if (product.error || !product.data) throw new Error('Product is unavailable.');
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]);
    const clickup = createClickUpClient(request.headers.get('x-clickup-token'), { signal });
    const result = await runClickUpIntegration({ db, clickup, product: product.data, profile, input, signal });
    if (operation === 'identity') {
      const serviceKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey || (process.env.QA_SUPABASE_URL && process.env.QA_SUPABASE_URL.replace(/\/$/, '') !== QA_SUPABASE_URL)) {
        throw new Error('QA ClickUp presence service is not configured.');
      }
      const serviceDb = createClient(QA_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await saveClickUpPresenceIdentity(serviceDb, auth.data.user.id, result.user);
    }
    console.info('[qa-clickup]', { requestId, operation, phase: 'completed', pushed: result?.pushed,
      failedCount: Array.isArray(result?.failed) ? result.failed.length : 0 });
    return Response.json(result, { headers });
  } catch (error) {
    // Keep credentials, task contents, and third-party error bodies out of logs.
    console.warn('[qa-clickup]', { requestId, operation, phase: 'failed', status: error?.status || null, errorType: error?.name || 'Error' });
    return Response.json({ error: error instanceof Error ? error.message : 'ClickUp request failed.' }, { status: 400, headers });
  }
}
