'use client';
import { useEffect, useId, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useNavigationCounts } from '../hooks/use-navigation-counts';
import { commandTabs } from '../navigation';
import type { ActiveTab, Profile } from '../types';
import styles from '../../command-center.module.css';

const countDescriptions = {
  angles: 'angles', personas: 'personas', competitors: 'approved / total competitors',
  'creative-tracker': 'creatives', 'creative-matrix': 'occupied / possible matrix cells',
  'action-plan': 'saved Action Plan records', production: 'saved production actions', inspiration: 'inspirations',
};

export function CommandNavigation({ profile, activeTab, onChange, supabase, productId }: { profile: Profile; activeTab: ActiveTab; onChange: (tab: ActiveTab) => void; supabase: SupabaseClient; productId: string }) {
  const ref = useRef<HTMLElement>(null);
  const { counts, error, refresh } = useNavigationCounts(supabase, productId);
  const countId = useId();
  const countState = error ? 'error' : counts === null ? 'loading' : 'ready';
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    function revealActive() {
      const active = nav!.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      const parent = nav!.getBoundingClientRect(), child = active.getBoundingClientRect();
      if (child.left < parent.left || child.right > parent.right) {
        nav!.scrollLeft += child.left - parent.left - (parent.width - child.width) / 2;
      }
    }
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab, counts, error]);
  return <nav ref={ref} className={styles.commandTabs} aria-label="Command Center sections">
    {commandTabs(profile).map((tab) => {
      const countKey = tab.id in countDescriptions ? tab.id as keyof typeof countDescriptions : null;
      const showCount = Boolean(countKey && productId);
      const description = countKey ? countDescriptions[countKey] : '';
      const value = countKey ? counts?.[countKey] : undefined;
      const title = error ? `${tab.label} count unavailable` : counts === null ? `Loading ${tab.label} count` : `${value} ${description}`;
      return <button key={tab.id} type="button" aria-label={tab.label} aria-selected={activeTab === tab.id}
      aria-describedby={showCount ? `${countId}-${tab.id}` : undefined}
      className={activeTab === tab.id ? styles.commandTabActive : ''} onClick={() => {
        if (showCount && error) void refresh();
        onChange(tab.id);
      }}><span>{tab.label}</span>{showCount ? <span id={`${countId}-${tab.id}`} className={styles.commandTabCount}
        data-tab-count={tab.id} data-plan-tab-count={tab.id === 'action-plan' ? '' : undefined} data-state={countState} aria-busy={countState === 'loading'} title={title}>
        <span>{error ? '?' : value ?? '...'}</span><span className={styles.srOnly}>{error || counts === null ? ` ${title}` : ` ${description}`}</span>
      </span> : null}</button>;
    })}
  </nav>;
}
