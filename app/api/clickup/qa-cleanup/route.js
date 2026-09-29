import { createClient } from '@supabase/supabase-js';
import { QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClickUpClient } from '../../../../lib/services/clickup-client.js';
import { runStaleAdCleanup } from '../../../../lib/services/stale-ad-cleanup.js';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!process.env.QA_SUPABASE_SERVICE_ROLE_KEY || (process.env.QA_SUPABASE_URL && process.env.QA_SUPABASE_URL.replace(/\/$/, '') !== QA_SUPABASE_URL)) return Response.json({ error: 'QA cleanup service is not configured.' }, { status: 503, headers });
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'Sign in to QA first.' }, { status: 401, headers });
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const userDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, { ...options, global: { headers: { Authorization: authorization } } });
    const auth = await userDb.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) return Response.json({ error: 'QA session expired.' }, { status: 401, headers });
    const profile = await userDb.from('profiles').select('role,is_active,must_change_password').eq('id', auth.data.user.id).single();
    if (profile.error || profile.data?.role !== 'admin' || !profile.data.is_active || profile.data.must_change_password) return Response.json({ error: 'Active QA administrator access is required.' }, { status: 403, headers });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(110000)]);
    const db = createClient(QA_SUPABASE_URL, process.env.QA_SUPABASE_SERVICE_ROLE_KEY, options);
    const result = await runStaleAdCleanup({ db, actorId: auth.data.user.id, input: await request.json(), signal,
      makeClickUp: () => createClickUpClient(request.headers.get('x-clickup-token'), { signal }) });
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error?.message || 'Cleanup failed.', definite: error?.definite === true }, { status: error?.definite ? 400 : 409, headers });
  }
}
