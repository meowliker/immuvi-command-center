import type { Metadata } from 'next';

import { qaPublicSupabaseConfig } from '../../../lib/qa-supabase-env.js';
import QaNextActionPlanClient from './qa-next-action-plan-client';

export const metadata: Metadata = {
  title: 'Action Plan | QA Next | Immuvi Command Center',
};

export default function QaNextActionPlanPage() {
  const config = qaPublicSupabaseConfig();

  return (
    <QaNextActionPlanClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
