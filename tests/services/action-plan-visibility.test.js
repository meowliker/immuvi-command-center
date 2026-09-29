import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlanVisibility, savePlanVisibility } from '../../lib/services/action-plan-visibility.js';

function fixture(options = {}) {
  const profile = { id: 'user', is_active: true, must_change_password: false, ap_dismissed_ad_ids: ['foreign'], ap_col_state: { keep: true }, ...options.profile };
  const writes = [], reads = [];
  let attempts = 0;
  const db = {
    supabaseUrl: options.url || 'https://entgcnlfsnysnwyadzzp.supabase.co',
    auth: { getSession: async () => ({ data: { session: options.noSession ? null : { user: { id: 'user' } } } }) },
    from(table) {
      const filters = []; let patch;
      const query = {
        select() { return this; },
        eq(k, v) { filters.push([k, k === 'ap_dismissed_ad_ids' ? JSON.parse(v) : v]); return this; },
        is(k, v) { filters.push([k, v]); return this; },
        abortSignal() { return this; },
        update(value) { patch = value; return this; },
        single() { return this.maybeSingle(); },
        async maybeSingle() {
          if (table === 'ads') return { data: options.missingAd ? null : { id: 'ad', product_id: 'p', ...options.ad } };
          assert.equal(table, 'profiles');
          if (!patch) { reads.push(filters); return options.readError ? { error: { message: 'Unavailable' } } : { data: structuredClone(profile) }; }
          attempts++;
          if (options.conflict?.(attempts)) profile.ap_dismissed_ad_ids.push(`concurrent-${attempts}`);
          if (options.writeError) return { error: { message: 'Offline' } };
          if (!filters.every(([k, v]) => JSON.stringify(profile[k] ?? null) === JSON.stringify(v))) return { data: null };
          writes.push({ patch, filters }); Object.assign(profile, patch);
          return { data: options.invalidResponse ? { ...profile, id: 'other-user' } : structuredClone(profile) };
        },
      }; return query;
    },
  };
  return { db, profile, writes, reads, attempts: () => attempts };
}

test('visibility uses the signed-in profile, preserves foreign IDs/columns, and is idempotent', async () => {
  const f = fixture(); assert.deepEqual(await readPlanVisibility(f.db), ['foreign']);
  assert.deepEqual(await savePlanVisibility(f.db, 'p', 'ad', true), ['foreign', 'ad']);
  await savePlanVisibility(f.db, 'p', 'ad', true); assert.equal(f.writes.length, 1);
  assert.deepEqual(await savePlanVisibility(f.db, 'p', 'ad', false), ['foreign']);
  assert.deepEqual(f.profile.ap_col_state, { keep: true });
  assert.ok(f.reads.every((filters) => filters.some(([k, v]) => k === 'id' && v === 'user')));
  assert.ok(f.writes.every(({ patch, filters }) => Object.keys(patch).join() === 'ap_dismissed_ad_ids' && filters.some(([k]) => k === 'ap_dismissed_ad_ids')));
});

test('CAS conflicts merge concurrent changes and bounded conflicts fail without replacing preferences', async () => {
  const f = fixture({ conflict: (attempt) => attempt === 1 });
  assert.deepEqual(await savePlanVisibility(f.db, 'p', 'ad', true), ['foreign', 'concurrent-1', 'ad']);
  assert.equal(f.attempts(), 2);
  const blocked = fixture({ conflict: () => true });
  await assert.rejects(savePlanVisibility(blocked.db, 'p', 'ad', true), /another tab/);
  assert.equal(blocked.attempts(), 3); assert.equal(blocked.writes.length, 0);
});

test('null legacy preference uses a null precondition; unknown IDs and malformed preferences fail closed', async () => {
  const f = fixture({ profile: { ap_dismissed_ad_ids: null } });
  assert.deepEqual(await savePlanVisibility(f.db, 'p', 'ad', true), ['ad']);
  for (const options of [{ missingAd: true }, { ad: { product_id: 'foreign' } }, { ad: { deleted_at: 'stamp' } }, { ad: { meta: { _productBoundaryQuarantined: true } } }, { profile: { ap_dismissed_ad_ids: {} } }]) {
    const blocked = fixture(options);
    await assert.rejects(savePlanVisibility(blocked.db, 'p', 'ad', true)); assert.equal(blocked.writes.length, 0);
  }
});

test('production clients, unauthenticated/inactive users and reset-required accounts cannot read or change preferences', async () => {
  for (const options of [{ url: 'https://hdniumnkprkadlrrataz.supabase.co' }, { noSession: true }, { profile: { is_active: false } }, { profile: { must_change_password: true } }]) {
    const f = fixture(options);
    await assert.rejects(readPlanVisibility(f.db)); await assert.rejects(savePlanVisibility(f.db, 'p', 'ad', true));
    assert.equal(f.writes.length, 0);
  }
});

test('read errors, uncertain writes and invalid acknowledgments never trigger blind retries', async () => {
  for (const options of [{ readError: true }, { writeError: true }, { invalidResponse: true }]) {
    const f = fixture(options); await assert.rejects(savePlanVisibility(f.db, 'p', 'ad', true)); assert.ok(f.attempts() <= 1);
  }
});
