import {
  normalizeProductIds,
  resolveAccessibleProducts,
  resolveActiveProductId,
} from '../../../lib/domain/auth-access.js';
import { productRowToView } from '../../../lib/domain/product-config.js';
import { ACTIVE_PRODUCT_KEY, ACTIVE_TAB_KEY, validTabForProfile } from '../navigation';
import type { ActiveTab, AppState, Product, Profile } from '../types';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export async function fetchAuthedState(supabase: SupabaseClient, session: Session, signal: AbortSignal): Promise<AppState> {
  const [profileResult, userProductsResult, productsResult] = await Promise.all([
    supabase.from('profiles').select('*').abortSignal(signal).eq('id', session.user.id).maybeSingle(),
    supabase.from('user_products').select('product_id').abortSignal(signal).eq('user_id', session.user.id),
    supabase.from('products').select('*').abortSignal(signal).order('name', { ascending: true }),
  ]);

  if (profileResult.error || userProductsResult.error || productsResult.error) {
    throw new Error('Account access could not be refreshed. Please try again.');
  }
  if (!profileResult.data) return { view: 'login', error: 'Profile not found. Contact your admin.' };
  const profile = profileResult.data as Profile;
  if (!profile.is_active) return { view: 'login', error: 'Your account has been deactivated.' };
  if (profile.must_change_password) return { view: 'password', session, user: session.user, profile };

  const allProducts = Array.isArray(productsResult.data) ? productsResult.data.map((row) => productRowToView(row) as Product).filter(Boolean) : [];
  const assignedProductIds = profile.role === 'admin' ? null : normalizeProductIds(userProductsResult.data || []);
  const products = resolveAccessibleProducts(profile, assignedProductIds || [], allProducts) as Product[];
  const savedProductId = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_PRODUCT_KEY) || '' : '';
  const activeProductId = resolveActiveProductId(savedProductId, products);
  const savedTab = typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_TAB_KEY) as ActiveTab | null : null;
  const activeTab = validTabForProfile(savedTab, profile) ? savedTab : 'overview';

  return {
    view: 'dashboard',
    session,
    user: session.user,
    profile,
    products,
    activeProductId,
    activeTab,
  };
}
