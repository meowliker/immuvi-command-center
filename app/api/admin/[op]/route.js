import { runLegacyHandler } from '../../../../lib/legacy-route-adapter.js';
import { applyQaServiceEnv } from '../../../../lib/qa-supabase-env.js';

export const GET = (request, context) => runAdminHandler(request, context);
export const POST = (request, context) => runAdminHandler(request, context);
export const OPTIONS = (request, context) => runAdminHandler(request, context);

async function runAdminHandler(request, context) {
  const blocked = applyQaServiceEnv();
  if (blocked) return blocked;

  const { default: legacyHandler } = await import('../../../../api/admin/[op].js');
  const params = await context.params;
  const url = new URL(request.url);
  url.searchParams.set('op', params.op);

  const patched = new Request(url, request);
  return runLegacyHandler(legacyHandler, patched);
}
