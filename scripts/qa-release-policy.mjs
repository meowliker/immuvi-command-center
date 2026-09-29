import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const QA_REF = 'entgcnlfsnysnwyadzzp';
export const SOURCE_PATHS = ['app', 'lib', 'public/fonts', 'api/drive/list.js', 'package.json', 'package-lock.json', 'tsconfig.json'];
export const APP_ROUTES = [
  '/_global-error/page', '/_not-found/page', '/page', '/action-plan-live.html/route',
  '/api/app-version/route', '/api/workers/inspiration/route',
  '/api/workers/images/route', '/api/workers/analysis/route',
  '/api/admin/[op]/route', '/api/clickup/qa-cleanup/route', '/api/clickup/qa/route',
  '/api/clickup/route', '/api/drive/list/route', '/api/install-skill/route',
  '/api/onescale-launch-callback/route', '/immuvi-command-center-v2.html/route',
  '/immuvi-command-center.html/route', '/install-skill.sh/route', '/team-skill/[...path]/route',
].sort();

export function releaseEnvironment(env = {}) {
  // Build/rehearsal cannot inherit server credentials, tokens, .env overrides,
  // NODE_OPTIONS or an unrelated Vercel project association.
  return {
    ...(env.PATH ? { PATH: env.PATH } : {}),
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    QA_SUPABASE_URL: `https://${QA_REF}.supabase.co`,
  };
}

export function assertSourcePath(path) {
  if (path.split('/').some((part) => !part || part === '..' || part.startsWith('.'))
    || !SOURCE_PATHS.some((root) => path === root || ['app','lib','public/fonts'].includes(root) && path.startsWith(`${root}/`))) {
    throw new Error(`Non-allowlisted QA source path: ${path}`);
  }
  if (/\.(pem|key|log|sql|py|sh)$/i.test(path)) throw new Error(`Unexpected QA source file: ${path}`);
}

export function filesBelow(root, prefix = '') {
  const result = [];
  for (const entry of readdirSync(join(root, prefix)).sort()) {
    const path = prefix ? `${prefix}/${entry}` : entry;
    const stat = lstatSync(join(root, path));
    if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed in QA release files: ${path}`);
    if (stat.isDirectory()) result.push(...filesBelow(root, path));
    else if (stat.isFile()) result.push(path);
    else throw new Error(`Unexpected QA file type: ${path}`);
  }
  return result;
}

export const fileHash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function assertBuildSpace(availableBytes) {
  if (!Number.isFinite(availableBytes) || availableBytes < 2 * 1024 ** 3) {
    throw new Error('QA release build requires at least 2 GiB free disk space. No snapshot was created.');
  }
}

export function assertRoutes(routes) {
  if (JSON.stringify(Object.keys(routes).sort()) !== JSON.stringify(APP_ROUTES)) {
    throw new Error('Built route inventory differs from the reviewed QA allowlist.');
  }
}

export function assertArtifactPath(path) {
  if (path.split('/').some((part) => part === '.git' || part === '.vercel' || part === '.env' || part.startsWith('.env.'))
    || /(^|\/)(team-skill|supabase|backups)(\/|$)/.test(path.replace('app/team-skill/', 'app/disabled-team-route/'))
    || path.startsWith('public/') && !path.startsWith('public/fonts/')
    || path === 'vercel.json' || path.startsWith('api/')) {
    throw new Error(`Unsafe artifact entry: ${path}`);
  }
}

export function verifyArtifact(root, manifest) {
  if (manifest.version !== 1 || manifest.branch !== 'qa' || manifest.qaProjectRef !== QA_REF || manifest.deploymentApproved !== false) {
    throw new Error('Not an unapproved QA release manifest.');
  }
  const files = filesBelow(root), expected = Object.keys(manifest.artifactHashes || {}).sort();
  if (!expected.length || JSON.stringify(files.sort()) !== JSON.stringify(expected)) throw new Error('QA artifact file inventory changed.');
  for (const file of files) {
    assertArtifactPath(file);
    if (fileHash(join(root, file)) !== manifest.artifactHashes[file]) throw new Error(`QA artifact hash changed: ${file}`);
  }
  assertRoutes(JSON.parse(readFileSync(join(root, '.next/server/app-paths-manifest.json'), 'utf8')));
}
