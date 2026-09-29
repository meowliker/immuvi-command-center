const assert = require('node:assert/strict');

module.exports = async function testNavigationCounts({ page, context, data, emit, tab, artifactDir, results, requests }) {
  const waitCounts = (expected) => page.waitForFunction((expected) => Object.entries(expected).every(([key, value]) => {
    const badge = document.querySelector(`[data-tab-count="${key}"]`);
    return badge?.dataset.state === 'ready' && badge.firstElementChild.textContent === String(value);
  }), expected);
  const initial = { angles: 1, personas: 1, competitors: '1/1', 'creative-tracker': 1,
    'creative-matrix': '1/1', 'action-plan': 1, production: 1, inspiration: 0 };
  await waitCounts(initial);
  assert.equal(await page.locator('[data-tab-count]').count(), 8);
  const product = data.ads[0].product_id;
  const base = structuredClone(data.ads[0]);
  data.angles.push({ ...data.angles[0], id: 'COUNT-ANGLE', name: 'Second angle', archived_at: '2026-09-20' });
  data.personas.push({ ...data.personas[0], id: 'COUNT-PERSONA', name: 'Second persona' });
  data.ads.push({ ...base, id: 'COUNT-TOP', angle: 'Second angle' }, { ...base, id: 'COUNT-CHILD', parent_ad_id: base.id },
    { ...base, id: 'COUNT-DELETED', deleted_at: 'now' }, { ...base, id: 'COUNT-QUARANTINED', meta: { _productBoundaryQuarantined: true } },
    { ...base, id: 'COUNT-FOREIGN', product_id: 'qa-second' });
  data.competitor_brands.push({ ...data.competitor_brands[0], id: 'COUNT-BRAND', approved: false });
  data.manual_actions.push({ ...data.manual_actions[0], id: 'COUNT-ACTION', payload: { title: 'Standalone saved action' } });
  data.inspirations.push({ id: 'COUNT-INSPIRATION', product_id: product, url: 'https://example.test/inspiration' });
  for (const table of ['angles', 'personas', 'ads', 'competitor_brands', 'manual_actions', 'inspirations']) emit(table, 'INSERT', data[table].at(-1));
  const changed = { angles: 2, personas: 2, competitors: '1/2', 'creative-tracker': 3,
    'creative-matrix': '2/4', 'action-plan': 2, production: 2, inspiration: 1 };
  await waitCounts(changed);
  data.competitor_brands.at(-1).approved = true;
  emit('competitor_brands', 'UPDATE', data.competitor_brands.at(-1));
  await waitCounts({ competitors: '2/2' });
  data.deleted_ads.push({ id: 'COUNT-TOP', product_id: product }); emit('deleted_ads', 'INSERT', data.deleted_ads.at(-1));
  await waitCounts({ 'creative-tracker': 2, 'creative-matrix': '1/4' });
  data.inspirations = []; emit('inspirations', 'DELETE', { id: 'COUNT-INSPIRATION' });
  await waitCounts({ inspiration: 0 });
  await tab(page, 'Angles');
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await waitCounts({ angles: 2 });
  // Counts describe the product, not the active tab or its local filters.
  for (const name of ['Angles', 'Creative Tracker', 'Inspiration']) {
    await tab(page, name);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const nav = document.querySelector('nav'), active = nav.querySelector('[aria-selected="true"]');
        const a = nav.getBoundingClientRect(), b = active.getBoundingClientRect();
        return b.left >= a.left - 1 && b.right <= a.right + 1;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${artifactDir}/tab-counts-${name.replaceAll(' ', '-')}-${width}.png` });
    }
  }
  await tab(page, 'Command HQ');
  data.inspirations.push(...Array.from({ length: 501 }, (_, i) => ({ id: `PAGE-${i}`, product_id: product })));
  emit('inspirations', 'INSERT', data.inspirations[0]); await waitCounts({ inspiration: 501 });
  let release, started;
  const held = new Promise((resolve) => { started = resolve; });
  const hold = async (route) => {
    if (new URL(route.request().url()).searchParams.get('product_id') !== `eq.${product}`) return route.fallback();
    await new Promise((resolve) => { release = resolve; started(); });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  };
  await context.route(/\/rest\/v1\/inspirations\?/, hold);
  emit('inspirations', 'UPDATE', data.inspirations[0]); await held;
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await waitCounts({ angles: 0, personas: 0, competitors: '0/0', 'creative-tracker': 1, 'creative-matrix': '1/0', 'action-plan': 0, production: 0, inspiration: 0 });
  release(); await context.unroute(/\/rest\/v1\/inspirations\?/, hold);
  await page.waitForLoadState('networkidle'); await waitCounts({ inspiration: 0 });
  const failure = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  await context.route(/\/rest\/v1\/competitor_brands\?/, failure);
  await page.locator('main > section').first().locator('select').selectOption(product);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tab-count]')].every((el) => el.dataset.state === 'error' && el.firstElementChild.textContent === '?'));
  await context.unroute(/\/rest\/v1\/competitor_brands\?/, failure);
  await tab(page, 'Angles'); await waitCounts({ inspiration: 501, competitors: '2/2', angles: 2 });
  assert.equal(requests.some((r) => r.method !== 'GET'), false);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal(await page.locator('[data-tab-count]').count(), 0);
  results.push('All eight legacy tab counts: totals/ratios, live inserts/updates/deletes, lifecycle isolation, filter independence, pagination, errors/retry, stale product responses, sign-out cleanup, desktop/mobile active-tab visibility; no writes');
};
