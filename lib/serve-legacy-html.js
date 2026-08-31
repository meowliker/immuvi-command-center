import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { qaPublicSupabaseConfig } from './qa-supabase-env.js';

const LEGACY_SUPABASE_URL = 'https://hdniumnkprkadlrrataz.supabase.co';
const LEGACY_SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkbml1bW5rcHJrYWRscnJhdGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTQ4NzUsImV4cCI6MjA5MjA5MDg3NX0.xnkNthP1SnnvaColrhukZqV1e5WrZz_VncCpyznlcWE';

const LEGACY_HTML_FILES = {
  actionPlan: path.join(process.cwd(), 'action-plan-live.html'),
  main: path.join(process.cwd(), 'immuvi-command-center.html'),
  v2: path.join(process.cwd(), 'immuvi-command-center-v2.html'),
};

export async function serveLegacyHtml(name) {
  const file = LEGACY_HTML_FILES[name];
  if (!file) {
    return Response.json({ error: 'unknown legacy html route' }, { status: 404 });
  }

  const raw = await readFile(/* turbopackIgnore: true */ file, 'utf8');
  const html = injectQaSupabase(raw);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function injectQaSupabase(html) {
  const { url: supabaseUrl, anonKey: supabaseAnon } = qaPublicSupabaseConfig();

  if (!supabaseUrl || !supabaseAnon) return html;

  return html
    .replaceAll(LEGACY_SUPABASE_URL, supabaseUrl)
    .replaceAll(LEGACY_SUPABASE_ANON, supabaseAnon);
}
