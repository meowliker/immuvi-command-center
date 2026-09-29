import { constants, cpSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { APP_ROUTES, QA_REF, SOURCE_PATHS, assertArtifactPath, assertBuildSpace, assertRoutes, assertSourcePath, fileHash, filesBelow, releaseEnvironment } from './qa-release-policy.mjs';

const root = process.cwd();
if (execFileSync('git', ['branch','--show-current'], { encoding: 'utf8' }).trim() !== 'qa'
  || readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== QA_REF) throw new Error('Only branch qa and the approved QA project may be packaged.');
const disk = statfsSync(tmpdir());
assertBuildSpace(disk.bavail * disk.bsize);
const output = mkdtempSync(join(tmpdir(), 'immuvi-qa-release-'));
let completed = false;
// On a failed local build remove only this invocation's generated directory.
process.once('exit', () => { if (!completed) rmSync(output, { recursive:true, force:true }); });
const source = join(output, 'source'), artifact = join(output, 'artifact');
mkdirSync(source, { mode: 0o700 });
const hashes = {};
for (const entry of SOURCE_PATHS) {
  const stat = lstatSync(entry);
  if (stat.isSymbolicLink()) throw new Error('Source symlinks are not allowed.');
  const files = stat.isDirectory() ? filesBelow(entry).map((file) => `${entry}/${file}`) : [entry];
  for (const file of files) {
    if (file.split('/').at(-1) === '.DS_Store') continue;
    assertSourcePath(file);
    const target = join(source, file);
    mkdirSync(resolve(target, '..'), { recursive: true });
    copyFileSync(file, target); hashes[file] = fileHash(target);
  }
}
copyFileSync('next.config.mjs', join(source, 'next.base.config.mjs'));
copyFileSync('deploy/qa/next.config.mjs', join(source, 'next.config.mjs'));
hashes['next.base.config.mjs'] = fileHash(join(source, 'next.base.config.mjs'));
hashes['next.config.mjs'] = fileHash(join(source, 'next.config.mjs'));
// Clone the installed local dependencies for an offline rehearsal. Release CI
// must rebuild with npm ci on the target OS; this is not a cross-platform image.
console.log('Copying installed dependencies into the isolated QA build directory.');
cpSync('node_modules', join(source, 'node_modules'), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  cwd: source, env: releaseEnvironment(process.env), encoding: 'utf8', timeout: 180000, maxBuffer: 2000000,
});
process.stdout.write(build.stdout || '');
if (build.status !== 0) { process.stderr.write(build.stderr || ''); throw new Error('Isolated QA build failed; its temporary snapshot will be removed.'); }
const routes = JSON.parse(readFileSync(join(source, '.next/server/app-paths-manifest.json'), 'utf8'));
assertRoutes(routes);
cpSync(join(source, '.next/standalone'), artifact, { recursive: true });
cpSync(join(source, '.next/static'), join(artifact, '.next/static'), { recursive: true });
cpSync(join(source, 'public'), join(artifact, 'public'), { recursive: true });
const artifactHashes = {};
for (const file of filesBelow(artifact)) { assertArtifactPath(file); artifactHashes[file] = fileHash(join(artifact, file)); }
const manifest = {
  version: 1, qaProjectRef: QA_REF, branch: 'qa', commit: execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8' }).trim(),
  includesUncommittedWork: true, createdAt: new Date().toISOString(), platform: process.platform, arch: process.arch,
  node: process.version, sourceHashes: hashes, artifactHashes, routes: APP_ROUTES,
  runtime: 'Next.js standalone Node server; not Vercel build output',
  liveClickUp: 'not exercised by packaging', workerAcceptance: 'requires Mac mini live verification',
  oneScale: 'not enabled by this release', deploymentApproved: false,
};
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
completed = true;
console.log(`QA release prepared: ${output}\nNo environment files copied or server credentials supplied; no deployment or changes to ${root}/vercel.json.`);
