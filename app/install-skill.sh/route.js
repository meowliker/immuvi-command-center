import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  const file = path.join(process.cwd(), 'team-skill', 'install-skill.sh');
  const script = await readFile(file, 'utf8');

  return new Response(script, {
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
