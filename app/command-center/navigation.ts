import type { ActiveTab, Profile } from './types';

export const ACTIVE_PRODUCT_KEY = 'immuvi_active_product';

export const ACTIVE_TAB_KEY = 'immuvi_qa_next_active_tab';

export function commandTabs(profile: Profile) {
  const tabs: Array<{ id: ActiveTab; label: string; caption: string }> = [
    { id: 'overview', label: 'Command HQ', caption: 'Coverage' },
    { id: 'angles', label: 'Angles', caption: 'Tracker' },
    { id: 'personas', label: 'Personas', caption: 'Tracker' },
    { id: 'competitors', label: 'Competitors', caption: 'Brands' },
    { id: 'creative-tracker', label: 'Creative Tracker', caption: 'Inventory' },
    { id: 'creative-matrix', label: 'Creative Matrix', caption: 'Cells' },
    { id: 'action-plan', label: 'Action Plan', caption: 'Actions' },
    { id: 'production', label: 'Production', caption: 'Board' },
    { id: 'strategist', label: 'Strategist', caption: 'Memory' },
    { id: 'inspiration', label: 'Inspiration', caption: 'Queue' },
  ];
  if (profile.role === 'admin') tabs.push({ id: 'admin', label: 'Admin', caption: 'Users' });
  return tabs;
}

export function validTabForProfile(tab: ActiveTab | null, profile: Profile): tab is ActiveTab {
  if (!tab) return false;
  if (tab === 'admin' && profile.role !== 'admin') return false;
  return [
    'overview',
    'angles',
    'personas',
    'competitors',
    'creative-tracker',
    'creative-matrix',
    'action-plan',
    'production',
    'strategist',
    'inspiration',
    'admin',
  ].includes(tab);
}
