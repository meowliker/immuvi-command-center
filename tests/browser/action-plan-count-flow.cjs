const assert = require('node:assert/strict');

module.exports = async function testPlanCount({ page, context, data, emit, tab, artifactDir, results }) {
  await page.clock.setFixedTime(new Date(2026, 8, 16, 23, 59));
  const badge = page.locator('[data-plan-tab-count]');
  const waitCount = (value) => page.waitForFunction((value) => {
    const badge = document.querySelector('[data-plan-tab-count]');
    return badge?.dataset.state === 'ready' && badge.firstElementChild.textContent === String(value);
  }, value);
  await waitCount(1);
  let fail = false, hold = false, release, held;
  await context.route(/\/rest\/v1\/manual_actions\?/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('select') !== 'id,product_id,payload') return route.fallback();
    if (fail) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (hold) {
      hold = false;
      const rows = structuredClone(data.manual_actions.filter((row) => `eq.${row.product_id}` === url.searchParams.get('product_id')));
      await new Promise((resolve) => { release = resolve; held(); });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    return route.fallback();
  });
  const base = data.ads[0], original = data.manual_actions[0];
  base.status = 'Testing'; original.payload.dueDate = '2026-09-16';
  data.ads.push({ ...structuredClone(base), id: 'count-production', format_name: 'Production task', status: 'In Production' });
  data.ads.push({ ...structuredClone(base), id: 'count-adopted', format_name: 'Adopted task', status: 'Untested' });
  data.ads.push({ ...structuredClone(base), id: 'count-deleted', deleted_at: '2026-09-21' });
  data.manual_actions.push({ ...structuredClone(original), id: 'count-saved', payload: { title: 'Production task', adId: 'count-production' } });
  data.manual_actions.push({ ...structuredClone(original), id: 'count-blocked', payload: { adId: 'count-deleted' } });
  data.manual_actions.push({ ...structuredClone(original), id: 'count-quarantined', payload: { _productBoundaryQuarantined: true } });
  emit('manual_actions', 'UPDATE', original);
  await waitCount(2);
  await tab(page, 'Action Plan');
  await page.waitForFunction(() => document.querySelector('[data-plan-result-count]')?.textContent === '3 / 3');
  const summary = page.getByRole('group', { name: 'Action Plan summary', exact: true });
  const totals = () => summary.locator('[data-plan-summary]').allTextContents();
  assert.deepEqual(await totals(), ['1', '1', '0']);
  await page.getByLabel('Search Action Plan', { exact: true }).fill('no rows');
  await waitCount(2); assert.deepEqual(await totals(), ['1', '1', '0']);
  await page.getByRole('button', { name: 'Reset Action Plan filters', exact: true }).click();
  await page.getByRole('button', { name: 'Include all work', exact: true }).click();
  await waitCount(2); assert.deepEqual(await totals(), ['1', '1', '0']);
  data.profiles[0].ap_dismissed_ad_ids = [base.id]; emit('profiles', 'UPDATE', data.profiles[0]);
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '1');
  await waitCount(2);
  await page.clock.setFixedTime(new Date(2026, 8, 17, 0, 1));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => document.querySelector('[data-plan-summary="overdue"]')?.textContent === '1');
  await page.getByRole('button', { name: 'Variations view', exact: true }).click();
  await waitCount(2); assert.deepEqual(await totals(), ['1', '1', '1']);
  await tab(page, 'Command HQ');
  const added = { ...structuredClone(original), id: 'count-standalone', payload: { title: 'Standalone record' } };
  data.manual_actions.push(added); emit('manual_actions', 'INSERT', added); await waitCount(3);
  data.manual_actions = data.manual_actions.filter((row) => row.id !== added.id);
  emit('manual_actions', 'DELETE', { id: added.id }); await waitCount(2);
  data.deleted_ads.push({ id: 'count-production', product_id: base.product_id });
  emit('deleted_ads', 'INSERT', data.deleted_ads[0]); await waitCount(1);
  data.deleted_ads = []; emit('deleted_ads', 'DELETE', { id: 'count-production' }); await waitCount(2);

  fail = true; emit('manual_actions', 'UPDATE', original);
  await page.waitForFunction(() => document.querySelector('[data-plan-tab-count]')?.dataset.state === 'error');
  assert.equal(await badge.locator('span').first().innerText(), '?');
  fail = false;
  await tab(page, 'Action Plan'); await waitCount(2);
  await summary.locator('[data-plan-summary="overdue"]').waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const nav = document.querySelector('nav'), button = nav.querySelector('[aria-selected="true"]');
      const a = nav.getBoundingClientRect(), b = button.getBoundingClientRect();
      return b.left >= a.left - 1 && b.right <= a.right + 1;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await badge.evaluate((el) => el.getBoundingClientRect().right <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/action-plan-count-${width}.png` });
  }

  await tab(page, 'Command HQ');
  for (let i = 0; i < 501; i++) data.manual_actions.push({ ...structuredClone(original), id: `count-page-${i}`, payload: { title: `Saved ${i}` } });
  emit('manual_actions', 'UPDATE', original); await waitCount(503);
  const started = new Promise((resolve) => { held = resolve; });
  hold = true; emit('manual_actions', 'UPDATE', original); await started;
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await waitCount(0);
  release(); await page.waitForLoadState('networkidle'); await waitCount(0);
  fail = true;
  await page.locator('main > section').first().locator('select').selectOption(base.product_id);
  await page.waitForFunction(() => document.querySelector('[data-plan-tab-count]')?.dataset.state === 'error');
  assert.equal(await badge.locator('span').first().innerText(), '?');
  fail = false; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await waitCount(503);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await badge.count(), 0);
  results.push('Saved Action Plan badge: product scope, 500-row pagination, lifecycle/tombstones, inactive-tab realtime/primary-key deletes, error/retry, late-response isolation, filters/hiding/adoption independence, responsive active-tab visibility, sign-out cleanup; header midnight refresh; no writes');
};
