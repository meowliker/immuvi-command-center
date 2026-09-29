export const QA_SUPABASE_URL = 'https://entgcnlfsnysnwyadzzp.supabase.co';
export const QA_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudGdjbmxmc255c253eWFkenpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjQ3NDcsImV4cCI6MjEwMzc0MDc0N30.ptpwyclOwbhiAQTyZ-8WlWmHCAEBbL50PIqJgDwDTnE';

const QA_REF = 'entgcnlfsnysnwyadzzp';

function validatePublicKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) throw new Error();
    const claims = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')));
    if (claims.ref !== QA_REF || claims.role !== 'anon') throw new Error();
  } catch {
    throw new Error('Only a public anonymous key for the approved QA project may be sent to the browser.');
  }
}

export function qaPublicSupabaseConfig() {
  const urls = [process.env.QA_SUPABASE_URL, process.env.NEXT_PUBLIC_QA_SUPABASE_URL].filter(Boolean);
  if (urls.some((url) => url.trim().replace(/\/$/, '') !== QA_SUPABASE_URL)) {
    throw new Error('The command center is restricted to the approved QA Supabase project.');
  }
  const keys = [process.env.QA_SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_QA_SUPABASE_ANON_KEY]
    .filter(Boolean).map((key) => key.trim());
  keys.forEach(validatePublicKey);
  // Generic Supabase settings may belong to production. Never serialize them.
  return { url: QA_SUPABASE_URL, anonKey: keys[0] || QA_SUPABASE_ANON_KEY };
}
