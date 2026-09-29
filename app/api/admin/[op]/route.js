import { QA_SUPABASE_URL } from '../../../../lib/qa-supabase-env.js';
import { QA_SUPABASE_ANON_KEY } from '../../../../lib/qa-supabase-env.js';
import { createClient } from '@supabase/supabase-js';
import { ACCOUNT_OPERATIONS, validateAccountRequest } from '../../../../lib/domain/account-operations.js';
import { runAccountOperation } from '../../../../lib/services/account-operations.js';
import { runAccountCreation } from '../../../../lib/services/account-creation.js';

export const runtime = 'nodejs';

export const GET = (request, context) => runAdminHandler(request, context);
export const POST = (request, context) => runAdminHandler(request, context);
export const OPTIONS = (request, context) => runAdminHandler(request, context);

async function runAdminHandler(request, context) {
  const params = await context.params;
  if (['set-role', 'update-products', 'assign-product', 'unassign-product'].includes(params.op)) {
    return Response.json({ error: 'Use the versioned QA user access workflow.' }, { status: 409 });
  }
  if (process.env.QA_SUPABASE_URL && process.env.QA_SUPABASE_URL.replace(/\/$/, '') !== QA_SUPABASE_URL) {
    return Response.json({ error: 'Admin operations are restricted to the approved QA project.' }, { status: 503 });
  }
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST' && !(params.op === 'health' && request.method === 'GET')) return Response.json({ error: 'POST required.' }, { status: 405, headers });
  if (!['health', 'create-user', ...ACCOUNT_OPERATIONS].includes(params.op)) return Response.json({ error: 'Unknown admin operation.' }, { status: 404, headers });
  const serviceKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: 'QA account service is not configured.' }, { status: 503, headers });
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'Sign in to QA first.' }, { status: 401, headers });
    const userDb = createClient(QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } },
    });
    const verified = await userDb.auth.getUser(authorization.slice(7));
    const actor = verified.data.user;
    if (verified.error || !actor) return Response.json({ error: 'QA session expired.' }, { status: 401, headers });
    const profile = await userDb.from('profiles').select('role,is_active,must_change_password').eq('id', actor.id).single();
    if (profile.error || profile.data?.role !== 'admin' || !profile.data.is_active || profile.data.must_change_password) return Response.json({ error: 'Active QA administrator access is required.' }, { status: 403, headers });
    if (params.op === 'health') return Response.json({ ok: true, service: 'qa-account-admin' }, { headers });
    if (params.op === 'create-user') {
      const db = createClient(QA_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const result = await runAccountCreation({ db, actorId: actor.id, request: await request.json(), secretKey: process.env.QA_ACCOUNT_ENCRYPTION_KEY || serviceKey });
      return Response.json(result, { headers });
    }
    if (ACCOUNT_OPERATIONS.includes(params.op)) {
      const input = validateAccountRequest(await request.json());
      if (input.operation !== params.op || input.userId === actor.id) return Response.json({ error: 'Invalid target account operation.', definite: true }, { status: 400, headers });
      const db = createClient(QA_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const result = await runAccountOperation({ db, actorId: actor.id, request: input, secretKey: process.env.QA_ACCOUNT_ENCRYPTION_KEY || serviceKey });
      return Response.json(result, { headers });
    }
  } catch (error) {
    return Response.json({ error: error?.message || 'Account operation failed.', definite: error?.definite === true }, { status: error?.definite ? 400 : 409, headers });
  }
}
