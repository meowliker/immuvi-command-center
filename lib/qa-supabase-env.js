export const QA_SUPABASE_URL = 'https://entgcnlfsnysnwyadzzp.supabase.co';
export const QA_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudGdjbmxmc255c253eWFkenpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjQ3NDcsImV4cCI6MjEwMzc0MDc0N30.ptpwyclOwbhiAQTyZ-8WlWmHCAEBbL50PIqJgDwDTnE';

const PRODUCTION_REF = 'hdniumnkprkadlrrataz';

export function qaPublicSupabaseConfig() {
  const explicitUrl =
    process.env.QA_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_QA_SUPABASE_URL ||
    '';
  const genericUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';

  const url = explicitUrl || (genericUrl && !genericUrl.includes(PRODUCTION_REF) ? genericUrl : QA_SUPABASE_URL);

  const explicitAnon =
    process.env.QA_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_QA_SUPABASE_ANON_KEY ||
    '';
  const genericAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  const anonKey = explicitAnon || (url !== QA_SUPABASE_URL ? genericAnon : QA_SUPABASE_ANON_KEY);

  return { url, anonKey };
}

export function applyQaServiceEnv() {
  const serviceKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey) {
    return Response.json(
      {
        error: 'QA Supabase service role is not configured. Set QA_SUPABASE_SERVICE_ROLE_KEY before using this server-side QA route.',
      },
      { status: 503 },
    );
  }

  process.env.SUPABASE_URL = process.env.QA_SUPABASE_URL || QA_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

  if (process.env.QA_SUPABASE_DB_PASSWORD) {
    process.env.SUPABASE_DB_PASSWORD = process.env.QA_SUPABASE_DB_PASSWORD;
  }

  if (process.env.QA_INSTALL_SKILL_SECRET) {
    process.env.INSTALL_SKILL_SECRET = process.env.QA_INSTALL_SKILL_SECRET;
  }

  return null;
}

export function applyQaInstallerEnv() {
  const blocked = applyQaServiceEnv();
  if (blocked) return blocked;

  if (!process.env.QA_SUPABASE_DB_PASSWORD || !process.env.QA_INSTALL_SKILL_SECRET) {
    return Response.json(
      {
        error: 'QA installer is not configured. Set QA_SUPABASE_DB_PASSWORD and QA_INSTALL_SKILL_SECRET before using this route.',
      },
      { status: 503 },
    );
  }

  return null;
}
