import type { Metadata } from 'next';

import { qaPublicSupabaseConfig } from '../../../lib/qa-supabase-env.js';
import QaNextCreativeTrackerClient from './qa-next-creative-tracker-client';

export const metadata: Metadata = {
  title: 'Creative Tracker | QA Next | Immuvi Command Center',
};

export default function QaNextCreativeTrackerPage() {
  const config = qaPublicSupabaseConfig();

  return (
    <QaNextCreativeTrackerClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
