import { runLegacyHandler } from '../../../lib/legacy-route-adapter.js';
import { applyQaServiceEnv } from '../../../lib/qa-supabase-env.js';

export async function POST(request) {
  const blocked = applyQaServiceEnv();
  if (blocked) return blocked;

  const { default: legacyHandler } = await import('../../../api/onescale-launch-callback.js');
  return runLegacyHandler(legacyHandler, request);
}
