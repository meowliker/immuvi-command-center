import { runLegacyHandler } from '../../../lib/legacy-route-adapter.js';
import { applyQaInstallerEnv } from '../../../lib/qa-supabase-env.js';

export async function GET(request) {
  const blocked = applyQaInstallerEnv();
  if (blocked) return blocked;

  const { default: legacyHandler } = await import('../../../api/install-skill.js');
  return runLegacyHandler(legacyHandler, request);
}
