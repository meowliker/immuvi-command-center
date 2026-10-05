import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';

export const CODEX_APP_PATHS = Object.freeze(['ChatGPT', 'Codex'].flatMap(app => [
  `/Applications/${app}.app/Contents/Resources/codex-cli/bin/codex`,
  `/Applications/${app}.app/Contents/Resources/codex`,
]));

const absolutePath = value => typeof value === 'string' && isAbsolute(value)
  && normalize(value) === value && !/[\x00-\x1f\x7f]/.test(value);

async function executableExists(path) {
  try {
    if (!(await stat(path)).isFile()) throw new Error('Codex path is not a file.');
    await access(path, constants.X_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    // A permission failure or invalid file must not silently select another binary.
    throw new Error('Codex executable is not usable; no work will be claimed.');
  }
}

export async function resolveConfiguredCodexExecutable(configuredPath, { probe = executableExists } = {}) {
  if (!absolutePath(configuredPath)) throw new Error('Codex requires an absolute executable path.');
  if (await probe(configuredPath)) return configuredPath;
  if (CODEX_APP_PATHS.includes(configuredPath)) {
    const bundle = configuredPath.split('/Contents/')[0];
    // App updates may move the CLI inside its existing bundle. Never switch an
    // enrolled worker to PATH or a different app merely because its binary moved.
    for (const candidate of CODEX_APP_PATHS.filter(path => path.startsWith(`${bundle}/Contents/`) && path !== configuredPath)) {
      if (await probe(candidate)) return candidate;
    }
  }
  throw new Error('Configured Codex executable is missing; no work will be claimed.');
}

export async function discoverCodexExecutable({ env = process.env, probe = executableExists } = {}) {
  const override = env.IMMUVI_CODEX_BIN || env.CODEX_BIN;
  if (override) return resolveConfiguredCodexExecutable(override, { probe });
  const candidates = [...new Set([
    ...(env.PATH || '').split(':').filter(absolutePath).map(path => join(path, 'codex')),
    ...CODEX_APP_PATHS,
  ])];
  for (const candidate of candidates) if (await probe(candidate)) return candidate;
  throw new Error('Codex CLI not found; install or select an executable before enrolling this worker.');
}
