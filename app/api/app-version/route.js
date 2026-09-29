import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export async function GET() {
  let version=process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || null;
  if (!version && process.env.NODE_ENV==='production') {
    try { version=(await readFile(path.join(process.cwd(),process.env.QA_NEXT_DIST_DIR || '.next','BUILD_ID'),'utf8')).trim(); } catch { /* No published build identity available. */ }
  }
  return Response.json({version},{headers:{'Cache-Control':'no-store'}});
}
