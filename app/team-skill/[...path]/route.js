import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES = new Map([
  ['.md', 'text/markdown; charset=utf-8'],
  ['.py', 'text/x-python; charset=utf-8'],
  ['.sh', 'text/x-shellscript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

export async function GET(_request, context) {
  const params = await context.params;
  const parts = Array.isArray(params.path) ? params.path : [];
  const root = path.join(process.cwd(), 'team-skill');
  const file = path.normalize(path.join(root, ...parts));

  if (!file.startsWith(root + path.sep)) {
    return Response.json({ error: 'invalid path' }, { status: 400 });
  }

  try {
    const body = await readFile(file);
    const ext = path.extname(file).toLowerCase();

    return new Response(body, {
      headers: {
        'Content-Type': CONTENT_TYPES.get(ext) || 'application/octet-stream',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}
