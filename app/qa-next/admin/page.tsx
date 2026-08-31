import type { Metadata } from 'next';

import { qaPublicSupabaseConfig } from '../../../lib/qa-supabase-env.js';
import QaNextAdminClient from './qa-next-admin-client';

export const metadata: Metadata = {
  title: 'Admin | QA Next | Immuvi Command Center',
};

export default function QaNextAdminPage() {
  const config = qaPublicSupabaseConfig();

  return (
    <QaNextAdminClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
