const assert = require('node:assert/strict');

module.exports = async function testTrackerLinks({ page, data, emit, tab, artifactDir, results }) {
  const base = data.ads[0];
  Object.assign(base, { ad_link: 'https://example.com/inspiration', drive_link: 'https://drive.google.com/file/d/fixture/view', clickup_task_id: 'qa-task-1' });
  data.angles.push({ ...data.angles[0], id: 'ANG-2', name: 'Archived angle with a complete readable name', archived_at: '2026-09-01T00:00:00Z' });
  data.matrix_cells.push({ ...data.matrix_cells[0], id: 'CELL-2', angle_id: 'ANG-2' });
  data.ads.push({ ...structuredClone(base), id: 'AD-2', format_name: 'Production creative', clickup_task_id: null, ad_link: '', drive_link: '', meta: { taskType: 'production' } },
    { ...structuredClone(base), id: 'AD-3', format_name: 'Source format', clickup_task_id: null, ad_link: 'javascript:alert(1)', drive_link: 'data:text/html,unsafe', meta: {} },
    { ...structuredClone(base), id: 'AD-4', format_name: 'Spawned production', clickup_task_id: null, meta: { taskType: 'production', sourceFormatId: 'AD-3' } },
    { ...structuredClone(base), id: 'AD-5', format_name: 'Unused format', clickup_task_id: null, meta: {} });
  await tab(page, 'Creative Tracker');
  const inventory = page.getByRole('region', { name: 'Creative inventory table', exact: true });
  const row = (id) => inventory.locator(`[data-creative-id="${id}"]`);
  await row('AD-5').waitFor();
  assert.equal(await inventory.getByRole('columnheader', { name: 'Matrix Usage', exact: true }).count(), 1);
  assert.equal(await inventory.getByRole('columnheader', { name: 'Usage', exact: true }).count(), 0);
  assert.equal(await inventory.getByRole('button', { name: 'Sort by name', exact: true }).textContent(), 'Format Name');
  for (const [label, text, href] of [
    ['Open QA creative in ClickUp', 'ClickUp', 'https://app.clickup.com/t/qa-task-1'],
    ['Open inspiration for QA creative', 'Inspiration', base.ad_link],
    ['Open Drive for QA creative', 'Drive Link', base.drive_link],
  ]) {
    const link = row('AD-1').getByRole('link', { name: label, exact: true });
    assert.equal(await link.textContent(), text); assert.equal(await link.getAttribute('href'), href);
    assert.equal(await link.getAttribute('target'), '_blank'); assert.match(await link.getAttribute('rel'), /noopener/);
  }
  assert.equal(await row('AD-1').locator('td').first().getByRole('link', { name: /ClickUp/ }).count(), 1);
  assert.equal(await row('AD-1').getByRole('link', { name: 'Open inspiration for QA creative', exact: true }).locator('svg').count(), 0);
  assert.equal(Math.round((await row('AD-1').locator('td').nth(7).boundingBox()).width), 110);
  assert.equal(await row('AD-2').getByRole('link').count(), 0);
  assert.equal(await row('AD-3').getByRole('link').count(), 0);
  const usage = (id) => row(id).locator('td').nth(14);
  assert.equal(await usage('AD-1').locator('details').count(), 0);
  assert.match(await usage('AD-1').textContent(), /2 cells/);
  assert.equal(await usage('AD-1').getByText('Energy \u00d7 Busy people', { exact: true }).isVisible(), true);
  assert.equal(await usage('AD-1').getByText('Archived angle with a complete readable name \u00d7 Busy people', { exact: true }).isVisible(), true);
  assert.equal(await usage('AD-2').textContent(), 'Energy \u00d7 Busy people');
  assert.match(await usage('AD-3').textContent(), /1 production task/);
  assert.match(await usage('AD-3').textContent(), /Spawned production/);
  assert.equal(await usage('AD-5').textContent(), 'Not in matrix');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await inventory.evaluate((node) => { node.scrollLeft = 0; });
    await page.screenshot({ path: `${artifactDir}/tracker-links-${width}.png`, fullPage: true });
    await inventory.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    const pair = usage('AD-1').getByText('Archived angle with a complete readable name \u00d7 Busy people', { exact: true });
    assert.equal(await pair.evaluate((node) => { const range = document.createRange(); range.selectNodeContents(node); const box = range.getBoundingClientRect(); const parent = node.closest('td').getBoundingClientRect(); return box.left >= parent.left && box.right <= parent.right && box.bottom <= parent.bottom; }), true);
    await page.screenshot({ path: `${artifactDir}/tracker-matrix-usage-${width}.png`, fullPage: true });
  }
  data.angles[0].name = 'Renamed energy'; emit('angles', 'UPDATE', data.angles[0]);
  await usage('AD-1').getByText('Renamed energy \u00d7 Busy people', { exact: true }).waitFor();
  results.push('Tracker links: labeled Inspiration/Drive/ClickUp links with correct destinations, safe new tabs, missing/unsafe links omitted; Matrix Usage shows full production pairs and resolved direct-cell names including archived taxonomy, source production tasks, empty state, realtime rename and responsive horizontal scrolling; no external requests or writes');
};
