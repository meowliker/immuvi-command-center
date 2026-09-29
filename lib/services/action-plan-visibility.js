import { QA_SUPABASE_URL } from '../qa-supabase-env.js';
import { planHiddenIds, setPlanHidden } from '../domain/action-plan-visibility.js';

async function viewer(db) {
  if (db.supabaseUrl?.replace(/\/$/, '') !== QA_SUPABASE_URL) throw new Error('Hidden-task preferences are restricted to QA.');
  const session = await db.auth.getSession();
  if (session.error || !session.data?.session?.user?.id) throw new Error('Sign in to load hidden tasks.');
  return session.data.session.user.id;
}

async function readProfile(db, userId, signal) {
  let query = db.from('profiles').select('id,is_active,must_change_password,ap_dismissed_ad_ids').eq('id', userId);
  if (signal) query = query.abortSignal(signal);
  const result = await query.single();
  if (result.error) throw new Error('Could not load hidden-task preferences.');
  if (result.data?.id !== userId || !result.data.is_active || result.data.must_change_password) throw new Error('Active user access is required.');
  planHiddenIds(result.data.ap_dismissed_ad_ids);
  return result.data;
}

export async function readPlanVisibility(db, signal) {
  const userId = await viewer(db);
  const profile = await readProfile(db, userId, signal);
  return planHiddenIds(profile.ap_dismissed_ad_ids);
}

export async function savePlanVisibility(db, productId, adId, hidden) {
  setPlanHidden([], adId, hidden);
  if (typeof productId !== 'string' || !productId) throw new Error('Select a product first.');
  const userId = await viewer(db);
  const ad = await db.from('ads').select('id,product_id,deleted_at,meta').eq('product_id', productId).eq('id', adId).maybeSingle();
  if (ad.error || ad.data?.id !== adId || ad.data?.product_id !== productId || ad.data.deleted_at || ad.data.meta?.deletedAt || ad.data.meta?._productBoundaryQuarantined) {
    throw new Error('This creative is no longer available in the selected product. Refresh and try again.');
  }
  // Merge only this user's desired visibility. Retry CAS conflicts, never a
  // failed/uncertain network write, and never replace other profile columns.
  for (let attempt = 0; attempt < 3; attempt++) {
    const profile = await readProfile(db, userId);
    const previous = profile.ap_dismissed_ad_ids ?? null;
    const next = setPlanHidden(previous, adId, hidden);
    if (JSON.stringify(next) === JSON.stringify(previous)) return next;
    let update = db.from('profiles').update({ ap_dismissed_ad_ids: next }).eq('id', userId).eq('is_active', true).eq('must_change_password', false);
    update = previous === null ? update.is('ap_dismissed_ad_ids', null) : update.eq('ap_dismissed_ad_ids', JSON.stringify(previous));
    const result = await update.select('id,ap_dismissed_ad_ids').maybeSingle();
    if (result.error) throw new Error('Could not save hidden-task preferences. Refresh before retrying.');
    if (result.data) {
      if (result.data.id !== userId || JSON.stringify(result.data.ap_dismissed_ad_ids) !== JSON.stringify(next)) throw new Error('Hidden-task save could not be verified. Refresh before retrying.');
      return planHiddenIds(result.data.ap_dismissed_ad_ids);
    }
  }
  throw new Error('Hidden tasks changed in another tab. Refresh and try again.');
}
