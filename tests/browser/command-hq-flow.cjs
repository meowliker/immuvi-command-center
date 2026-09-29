const assert = require('node:assert/strict');

module.exports = async function testCommandHq({ page, context, data, control, emit, requests, tab, artifactDir, results }) {
  await tab(page, 'Command HQ');
  const metric = (name) => page.locator(`[data-hq-metric="${name}"] strong`);
  const waitMetric = (name, value) => page.waitForFunction(({ name, value }) => document.querySelector(`[data-hq-metric="${name}"] strong`)?.textContent === String(value), { name, value });
  const refresh = () => emit('products', 'UPDATE', data.products[0]);
  await waitMetric('total', 1);
  assert.equal(await page.locator('[data-hq-coverage]').count(), 5);
  assert.equal(await page.getByRole('progressbar', { name: 'Angles coverage', exact: true }).getAttribute('value'), '100');
  await page.getByText('1 angle not started.', { exact: true }).waitFor();
  data.ads[0].status = 'Winner';
  data.ads[0].meta = { creativeStructure: 'QA custom', hookType: 'Fear', productionStyle: 'Organic / Raw UGC' };
  emit('ads', 'UPDATE', data.ads[0]);
  await waitMetric('winners', 1);
  assert.equal(await metric('winRate').textContent(), '100.0%');
  await page.getByText('AD-1 needs 5 more variations.', { exact: true }).waitFor();
  await page.getByText('1 winner combo missing 2 funnel stages.', { exact: true }).waitFor();
  const ad = data.ads[0];
  data.ads.push(...Array.from({ length: 505 }, (_, index) => ({ ...ad, id: `PAGE-${index}`, status: 'Testing', meta: {} })),
    { ...ad, id: 'DELETED', deleted_at: 'now' }, { ...ad, id: 'QUARANTINED', meta: { _productBoundaryQuarantined: true } },
    { ...ad, id: 'TOMBSTONE' }, { ...ad, id: 'OTHER', product_id: 'qa-second', meta: { creativeStructure: 'Other-only custom' } });
  data.deleted_ads.push({ id: 'TOMBSTONE', product_id: ad.product_id });
  data.angles.push({ ...data.angles[0], id: 'ARCHIVED', name: 'Archived', archived_at: 'now' });
  refresh(); await waitMetric('total', 506);
  assert.equal(await metric('testing').textContent(), '505');
  assert.equal(await metric('angles').textContent(), '1');
  assert.equal(await page.getByText('Other-only custom', { exact: true }).count(), 0);
  assert.ok(requests.filter((request) => request.table === 'ads' && request.product === 'eq.qa-fixture').length >= 3);

  let fail = true;
  const failure = async (route) => fail ? route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }) : route.fallback();
  await context.route(/\/rest\/v1\/personas\?/, failure);
  refresh();
  await page.getByRole('alert').filter({ hasText: 'Showing the last successful snapshot.' }).waitFor();
  assert.equal(await metric('total').textContent(), '506');
  fail = false; refresh(); await page.getByRole('alert').filter({ hasText: 'Incomplete personas response.' }).waitFor({ state: 'hidden' });

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page overflow at ${width}`);
    for (const card of await page.locator('[data-hq-coverage]').all()) assert.equal(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: `${artifactDir}/command-hq-${width}.png`, fullPage: true });
  }
  await page.bringToFront();
  await page.waitForLoadState('networkidle');

  control.holdNextAds = true; refresh();
  for (let attempt = 0; !control.release && attempt < 100; attempt++) await page.waitForTimeout(10);
  assert.equal(typeof control.release, 'function');
  const productButtons = page.getByRole('region', { name: 'Product profiles', exact: true });
  await productButtons.getByRole('button', { name: /Second QA/ }).click();
  await waitMetric('total', 1); control.release(); control.release = null;
  await page.waitForTimeout(300);
  assert.equal(await metric('total').textContent(), '1');
  await page.getByText('Other-only custom', { exact: true }).waitFor();
  assert.equal(await page.getByText('QA custom', { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).pathname, '/');

  fail = true;
  await productButtons.getByRole('button', { name: /QA Fixture/ }).click();
  await page.getByRole('status').filter({ hasText: 'Command HQ data unavailable.' }).waitFor();
  assert.equal(await metric('total').textContent(), '-');
  assert.equal(await page.locator('[data-hq-coverage]').count(), 0);
  fail = false; data.ads = []; data.angles = []; data.personas = [];
  refresh(); await waitMetric('total', 0);
  assert.equal(await metric('winRate').textContent(), '0.0%');
  assert.equal(await page.getByRole('progressbar', { name: 'Angles coverage', exact: true }).getAttribute('value'), '0');
  await context.unroute(/\/rest\/v1\/personas\?/, failure);
  assert.equal(requests.some((request) => ['ads', 'angles', 'personas', 'deleted_ads'].includes(request.table) && request.method !== 'GET'), false);
  assert.equal(control.clickupCalls.length, 0);
  results.push('Command HQ: eight KPIs, five coverage groups and gaps; paginated/deletion-aware product reads; realtime refresh, failure retention/retry, initial failure and empty states; responsive 320-1440px, late response isolation; read-only and root-only');
};
