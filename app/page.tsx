import type { Metadata } from 'next';

import CommandCenterClient from './command-center-client';
import { qaPublicSupabaseConfig } from '../lib/qa-supabase-env.js';

export const metadata: Metadata = {
  title: 'Immuvi Command Center',
};

export default function HomePage() {
  const config = qaPublicSupabaseConfig();

  return (
    <CommandCenterClient
      supabaseUrl={config.url}
      supabaseAnonKey={config.anonKey}
    />
  );
}
