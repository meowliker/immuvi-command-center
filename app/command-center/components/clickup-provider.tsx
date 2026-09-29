'use client';

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from 'react';
import { QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useClickUpConnection } from '../hooks/use-clickup-connection';
import type { Product, Profile } from '../types';
import { useClickUpPresenceIdentity } from './workspace-session';

type Connection = ReturnType<typeof useClickUpConnection> & {
  detailsRef: RefObject<HTMLDetailsElement | null>;
  openSettings: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
};
const ClickUpContext = createContext<Connection | null>(null);

export function ClickUpProvider({ supabase, product, profile, children }: { supabase: SupabaseClient; product: Product; profile: Profile; children: ReactNode }) {
  const state = useClickUpConnection(supabase, product, profile.id, profile.role === 'admin');
  useClickUpPresenceIdentity(state.identity?.id || null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  function openSettings() {
    setSettingsOpen(true);
    if (profile.role === 'admin' && state.token.trim()) void state.run('inspect', QA_CLICKUP_LIST_ID);
  }
  return <ClickUpContext.Provider value={{ ...state, detailsRef, openSettings, settingsOpen, closeSettings: () => setSettingsOpen(false) }}>{children}</ClickUpContext.Provider>;
}

export function useClickUpControls() { return useContext(ClickUpContext); }
