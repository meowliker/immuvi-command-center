const assert = require('node:assert/strict');

module.exports = async function testTrackerBulk({ page, data, emit, control, tab, artifactDir, results }) {
  const base = data.ads[0]; base.clickup_task_id = 'task-1';
  base.meta = { creativeStructure: 'UGC', hookType: 'Fear', productionStyle: 'Organic' };
  data.ads.push({ ...structuredClone(base), id: 'AD-2', clickup_task_id: 'task-2', status: 'Testing', format_name: 'Filtered creative' },
    { ...structuredClone(base), id: 'AD-3', clickup_task_id: 'task-3', parent_ad_id: base.id, format_name: 'Child creative' },
    { ...structuredClone(base), id: 'UNLINKED', clickup_task_id: null },
    { ...structuredClone(base), id: 'DELETED', deleted_at: 'now' },
    { ...structuredClone(base), id: 'QUARANTINED', meta: { _productBoundaryQuarantined: true } },
    { ...structuredClone(base), id: 'FOREIGN', product_id: 'qa-second', clickup_task_id: 'foreign' });
  await tab(page, 'Creative Tracker');
  const push = page.getByRole('button', { name: 'Push All to ClickUp', exact: true });
  assert.equal(await push.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Refresh', exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Creative inventory', exact: true }).count(), 0);
  assert.equal(await page.getByText('Missing links', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Summary', { exact: true }).count(), 0);
  await page.locator('details summary').first().click();
  await page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await page.getByText('ClickUp: QA ClickUp User', { exact: true }).waitFor();
  await page.locator('details summary').first().click();
  await page.getByLabel('All statuses', { exact: true }).selectOption('Testing');
  assert.equal(await page.locator('[data-creative-id]').count(), 1);
  const pushed = () => control.clickupCalls.filter((call) => call.operation === 'push-all-creative-fields');
  page.removeAllListeners('dialog'); page.once('dialog', (dialog) => dialog.dismiss());
  await push.click(); assert.equal(pushed().length, 0);
  page.on('dialog', (dialog) => { assert.match(dialog.message(), /all 3 linked creatives/); return dialog.accept(); });
  control.bulkFailedId = 'AD-2';
  await push.click();
  await page.getByRole('status').filter({ hasText: '17 ClickUp fields updated; 1 creative needs attention; 1 skipped.' }).waitFor();
  assert.deepEqual(pushed().map((call) => call.adId), ['AD-1', 'AD-2', 'AD-3']);
  assert.ok(pushed().every((call) => call.productId === base.product_id && call.expectedUpdatedAt === base.updated_at));
  await page.getByText('Push results (3)', { exact: true }).click();
  await page.getByText(/Hook Type: Missing dropdown option/).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/tracker-push-all-${width}.png`, fullPage: true });
  }
  const beforeStop = pushed().length;
  control.holdBulkPush = true;
  await push.click();
  await page.getByRole('button', { name: 'Stop push', exact: true }).waitFor();
  for (let i = 0; !control.releaseBulkPush && i < 100; i++) await page.waitForTimeout(10);
  assert.equal(typeof control.releaseBulkPush, 'function');
  assert.equal(await page.getByRole('button', { name: 'Add creative', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Stop push', exact: true }).click();
  control.releaseBulkPush(); control.releaseBulkPush = null;
  await page.getByRole('status').filter({ hasText: 'Stopped.' }).waitFor();
  assert.equal(pushed().length, beforeStop + 1);
  const beforeSwitch = pushed().length;
  control.holdBulkPush = true;
  await push.click();
  for (let i = 0; !control.releaseBulkPush && i < 100; i++) await page.waitForTimeout(10);
  assert.equal(typeof control.releaseBulkPush, 'function');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  control.releaseBulkPush(); control.releaseBulkPush = null;
  await page.waitForLoadState('networkidle');
  assert.equal(pushed().length, beforeSwitch + 1);
  assert.equal(await push.isDisabled(), true);
  assert.match(await push.getAttribute('title'), /QA ClickUp test list/);
  assert.equal(await page.getByText('Push results (3)', { exact: true }).count(), 0);
  results.push('Tracker: no summary panels, full-width inventory, Add creative retained, Push All confirms all product creatives despite filters, skips unlinked/blocked rows, reports partial results, stops/cancels on product switch, QA-only connection guards and 320-1440px layout; mocked ClickUp only');
};
