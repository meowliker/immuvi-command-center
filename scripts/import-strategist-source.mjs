import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('Pass the standalone Strategist project path');
const destination = path.resolve('strategist');
const paths = ['src/db', 'src/lib/analysis', 'src/lib/clickup', 'src/lib/drive', 'src/lib/media', 'src/lib/parse', 'src/lib/products.ts', 'src/lib/data', 'src/scripts', 'tests', 'src/components/CreativeModal.tsx', 'src/components/CreativesTable.tsx', 'src/components/ResearchList.tsx', 'src/components/HooksView.tsx', 'src/app/globals.css'];
const manifest = [];
async function copy(relative) {
  const absolute = path.join(source, relative);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => null);
  if (entries) { for (const entry of entries) await copy(path.join(relative, entry.name)); return; }
  const content = await readFile(absolute);
  const output = path.join(destination, relative);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, content, { flag: 'wx' });
  manifest.push({ path: relative, sha256: createHash('sha256').update(content).digest('hex') });
}
for (const relative of paths) await copy(relative);
await writeFile(path.join(destination, 'source-manifest.json'), JSON.stringify({ source: 'Strategist', importedAt: new Date().toISOString(), files: manifest }, null, 2) + '\n');
console.log(`Imported ${manifest.length} source files; original hashes recorded.`);
