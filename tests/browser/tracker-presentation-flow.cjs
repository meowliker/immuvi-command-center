const assert = require('node:assert/strict');

module.exports = async function testTrackerPresentation({ page, data, emit, tab, artifactDir, results }) {
  const base = data.ads[0];
  const hypothesis = ('A specific audience and a clear reason to try this creative.\n').repeat(100) + '<b>Literal text, not HTML</b> END OF HYPOTHESIS';
  Object.assign(base, { format_name: 'Bravo creative', status: 'Winner', created_at: '2026-09-02T00:00:00Z', meta: { creativeHypothesis: hypothesis } });
  data.ads.push({ ...structuredClone(base), id: 'AD-2', format_name: 'Alpha creative', status: 'Testing', created_at: '2026-09-03T00:00:00Z', meta: {} },
    { ...structuredClone(base), id: 'AD-3', format_name: 'Charlie creative', status: 'Loser', created_at: '2026-09-01T00:00:00Z', meta: {} });
  await tab(page, 'Creative Tracker');
  const inventory = page.getByRole('region', { name: 'Creative inventory table', exact: true });
  await inventory.locator('[data-creative-id="AD-3"]').waitFor();
  const ids = () => inventory.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.dataset.creativeId));
  assert.equal(await page.getByLabel('Sort creatives', { exact: true }).count(), 0);
  for (const [label, ascending] of [['name', ['AD-2', 'AD-1', 'AD-3']], ['status', ['AD-3', 'AD-2', 'AD-1']], ['created', ['AD-3', 'AD-1', 'AD-2']]]) {
    const button = inventory.getByRole('button', { name: `Sort by ${label}`, exact: true });
    await button.click();
    assert.deepEqual(await ids(), ascending);
    assert.equal(await button.locator('..').getAttribute('aria-sort'), 'ascending');
    assert.equal(await button.locator('svg.lucide-arrow-up').count(), 1);
    await button.click();
    assert.deepEqual(await ids(), [...ascending].reverse());
    assert.equal(await button.locator('..').getAttribute('aria-sort'), 'descending');
    assert.equal(await button.locator('svg.lucide-arrow-down').count(), 1);
    assert.equal(await inventory.locator('th[aria-sort="descending"]').count(), 1);
  }
  const preview = page.getByRole('button', { name: 'View hypothesis for Bravo creative', exact: true });
  assert.equal(await inventory.getByRole('button', { name: /View hypothesis/ }).count(), 1);
  assert.ok((await preview.boundingBox()).height <= 66);
  assert.ok((await inventory.locator('[data-creative-id="AD-1"]').boundingBox()).height < 130);
  const frame = await inventory.evaluate((node) => ({ border: getComputedStyle(node).borderLeftWidth, background: getComputedStyle(node).backgroundColor }));
  assert.equal(frame.border, '1px'); assert.equal(frame.background, 'rgb(255, 255, 255)');
  await inventory.evaluate((node) => { node.scrollLeft = 0; });
  await page.screenshot({ path: `${artifactDir}/tracker-table-1440.png`, fullPage: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await preview.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Creative hypothesis', exact: true });
    await dialog.waitFor();
    const body = dialog.getByRole('region', { name: 'Creative details and full hypothesis', exact: true });
    assert.equal(await body.locator('p').textContent(), hypothesis);
    assert.equal(await body.locator('b').count(), 0);
    assert.equal(await body.getByText('Energy', { exact: true }).count(), 1);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.width <= Math.min(640, width - 24) && bounds.height <= 620);
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.equal(await body.evaluate((node) => node.scrollHeight > node.clientHeight), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/tracker-hypothesis-${width}.png` });
    await body.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.equal(await preview.evaluate((node) => document.activeElement === node), true);
  }
  await preview.click();
  base.meta.creativeHypothesis = 'Updated hypothesis from live data';
  emit('ads', 'UPDATE', base);
  await page.getByRole('dialog').getByText(base.meta.creativeHypothesis, { exact: true }).waitFor();
  data.ads = data.ads.filter((ad) => ad.id !== base.id);
  emit('ads', 'DELETE', base);
  await page.getByRole('dialog').getByText('This creative is no longer available.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close hypothesis', exact: true }).click();
  data.ads[0].meta.creativeHypothesis = 'Second creative hypothesis'; emit('ads', 'UPDATE', data.ads[0]);
  await page.getByRole('button', { name: 'View hypothesis for Alpha creative', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('dialog').count(), 0);
  results.push('Tracker presentation: header sorting and direction arrows, framed table, three-line hypothesis previews, bounded full-text dialog at 320/390/768/1440px, literal text, keyboard open/Escape/focus restoration, live updates/removal and product isolation; read-only mocks');
};
