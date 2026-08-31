import type { Metadata } from 'next';

import { qaPublicSupabaseConfig } from '../../lib/qa-supabase-env.js';
import QaNextClient from './qa-next-client';

export const metadata: Metadata = {
  title: 'QA Next | Immuvi Command Center',
};

export default function QaNextPage() {
  const config = qaPublicSupabaseConfig();

  return (
    <QaNextClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
