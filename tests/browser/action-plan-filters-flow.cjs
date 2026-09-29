const assert = require('node:assert/strict');
module.exports = async function testPlanFilters({ page, data, emit, tab, artifactDir, results }) {
  const now = new Date(2026, 8, 19, 12).getTime(), day = 86400000;
  await page.clock.setFixedTime(now);
  const ad = data.ads[0], action = data.manual_actions[0];
  Object.assign(ad, { status: 'Testing', last_status_change_at: now - 8 * day, created_at: new Date(now - 20 * day).toISOString() });
  action.payload._origin = 'adopted';
  for (const [id, status, type, payload] of [
    ['win', 'Winner', 'Image', { _clickupTaskDeleted: true }],
    ['prod', 'In Production', 'Video', { _clickupId: 'task-prod', _history: [{ type: 'tag_removed', ts: now - day }] }],
    ['link', 'Testing', 'Image', { _history: [{ type: 'relinked', ts: now - 1000 }] }],
    ['plain', 'Testing', 'Video', { _adoptedAt: now }],
  ]) {
    data.ads.push({ ...structuredClone(ad), id, format_name: id, status, ad_type: type, funnel_stage: 'MOF', meta: { taskType: 'format' } });
    data.manual_actions.push({ ...structuredClone(action), id: `action-${id}`, payload: { adId: id, title: id, ...payload } });
  }
  await tab(page, 'Action Plan');
  await page.waitForFunction(() => document.querySelector('[data-anomaly-total]')?.textContent === '3');
  const ids = async () => (await page.locator('[data-plan-row]').evaluateAll((els) => els.map((el) => el.dataset.planRow))).sort();
  const facet = async (key, label, values) => {
    await page.getByRole('button', { name: `Filter ${key}`, exact: true }).click();
    const menu = page.getByRole('group', { name: `${label} options`, exact: true });
    for (const value of values) await menu.getByRole('checkbox', { name: value, exact: true }).check();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: `Filter ${key}`, exact: true }).evaluate((el) => el === document.activeElement), true);
  };
  assert.equal(await page.locator('[data-anomaly-total]').innerText(), '3');
  for (const type of ['cu_deleted', 'tag_removed', 'relinked']) assert.equal(await page.locator(`[data-plan-row] [data-anomaly="${type}"]`).count(), 1);
  assert.equal(await page.locator('[data-plan-row] [data-anomaly="adopted"]').count(),0);
  const statusTrigger = page.getByRole('button', { name: 'Filter status', exact: true });
  await statusTrigger.focus(); await page.keyboard.press('Enter');
  const statusMenu = page.getByRole('group', { name: 'Status options' });
  await statusMenu.getByText('Testing', { exact: true }).click();
  assert.equal(await statusMenu.getByRole('checkbox', { name: 'Testing', exact: true }).isChecked(), true);
  await statusMenu.getByRole('checkbox', { name: 'Winner', exact: true }).focus(); await page.keyboard.press('Space');
  assert.equal(await statusMenu.getByRole('checkbox', { name: 'Winner', exact: true }).isChecked(), true);
  await statusMenu.getByRole('button', { name: 'Clear Status filter', exact: true }).click();
  assert.equal(await statusMenu.getByRole('checkbox', { name: 'Testing', exact: true }).isChecked(), false);
  await page.keyboard.press('Escape');
  await page.getByLabel('Select plain', { exact: true }).check();
  await facet('status', 'Status', ['Testing', 'Winner']);
  assert.deepEqual(await ids(), ['ACTION-1', 'action-link', 'action-plain', 'action-win']);
  await facet('adType', 'Type', ['Video', 'Image']);
  await page.getByRole('button', { name: 'Remove Type: Video filter', exact: true }).click();
  assert.deepEqual(await ids(), ['action-link', 'action-win']);
  await page.getByText('1 hidden selections excluded', { exact: true }).waitFor();
  await page.getByLabel('Search Action Plan').fill('win'); assert.deepEqual(await ids(), ['action-win']);
  await page.getByRole('button', { name: 'Remove Search: win filter', exact: true }).click();
  await facet('funnelStage', 'Funnel', ['MOF']);
  await facet('angle', 'Angle', ['Energy']);
  await facet('persona', 'Persona', ['Busy people']);
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await page.getByLabel('Anomalies only', { exact: true }).check();
  assert.deepEqual(await ids(), ['action-link', 'action-prod', 'action-win']);
  await page.screenshot({ path: `${artifactDir}/action-plan-anomalies-desktop.png`, fullPage: true });
  await page.getByLabel('Needs attention only', { exact: true }).check();
  assert.deepEqual(await ids(), ['action-link', 'action-prod']);
  await page.getByRole('button', { name: 'Remove Needs attention filter', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Anomalies only filter', exact: true }).click();
  await page.locator('[data-pulse-key="week:launched"]').click();
  await facet('status', 'Status', ['Winner']);
  assert.equal(await page.locator('[data-pulse-key="week:launched"]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-pulse-key="week:winners"]').click();
  assert.equal(await page.getByRole('button', { name: 'Remove Status: Winner filter', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();

  await facet('status', 'Status', ['Winner']);
  const win = data.ads.find((a) => a.id === 'win'); win.status = 'Paused'; emit('ads', 'UPDATE', win);
  await page.getByText('No Action Plan tasks match these filters.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Filter status', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: 'Status options' }).getByRole('checkbox', { name: 'Winner', exact: true }).isChecked(), true);
  await page.getByLabel('Search Action Plan').click();
  assert.equal(await page.getByRole('group', { name: 'Status options' }).count(), 0);
  await page.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await page.getByLabel('Anomalies only', { exact: true }).check();
  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  assert.equal(await page.locator('[data-anomaly="adopted"]').count(), 1);
  await page.getByRole('button', { name: 'Pipeline view', exact: true }).click();
  assert.equal(await page.locator('[data-pipeline-task]').count(), 4);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await page.clock.setFixedTime(now + day); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => document.querySelector('[data-anomaly-total]')?.textContent === '3');
  assert.deepEqual(await ids(), ['ACTION-1', 'action-prod', 'action-win']);
  delete action.payload._origin; emit('manual_actions', 'UPDATE', action);
  await page.waitForFunction(() => document.querySelector('[data-anomaly-total]')?.textContent === '2');
  assert.deepEqual(await ids(), ['action-prod', 'action-win']);
  await page.getByRole('button', { name: 'Filter source', exact: true }).click();
  const sources = page.getByRole('group', { name: 'Source options' }).getByRole('checkbox');
  assert.ok(await sources.count() > 0); await sources.first().check(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Filter status', exact: true }).click();
  await page.screenshot({ path: `${artifactDir}/action-plan-filters-desktop.png`, fullPage: true });
  await page.keyboard.press('Escape');
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const key of ['status', 'angle', 'persona', 'funnelStage', 'adType', 'source']) {
      await page.getByRole('button', { name: `Filter ${key}`, exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width} ${key} overflow`);
      const box = await page.locator('[id][role="group"]').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${width} ${key} menu outside viewport`);
      if (width === 390 && key === 'status') await page.screenshot({ path: `${artifactDir}/action-plan-filters-mobile.png`, fullPage: true });
      await page.keyboard.press('Escape');
    }
  }
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.getByText('No Action Plan tasks match these filters.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Anomalies only', { exact: true }).isChecked(), false);
  assert.equal(await page.locator('[data-anomaly-total]').innerText(), '0');
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Multi-select facets, per-value chips, status/pulse exclusivity, anomaly badges/filter/expiry, attention/search composition, missing-selection retention, realtime/product isolation, hidden selections, keyboard/outside dismissal and responsive menus');
};
