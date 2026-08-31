import type { Metadata } from 'next';

import { qaPublicSupabaseConfig } from '../../../lib/qa-supabase-env.js';
import QaNextInspirationClient from './qa-next-inspiration-client';

export const metadata: Metadata = {
  title: 'Inspiration Queue | QA Next | Immuvi Command Center',
};

export default function QaNextInspirationPage() {
  const config = qaPublicSupabaseConfig();

  return (
    <QaNextInspirationClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
