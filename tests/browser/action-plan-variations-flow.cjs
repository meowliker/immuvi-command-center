const assert = require('node:assert/strict');

module.exports = async function testPlanVariations({ page, context, data, emit, tab, artifactDir, results }) {
  let failRead = true;
  await context.route(/\/rest\/v1\/ads\?/, (route) => failRead
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ incomplete: true }) })
    : route.fallback());
  await tab(page, 'Action Plan');
  const view = page.getByRole('button', { name: 'Variations view', exact: true });
  await view.click();
  await page.getByText('Variations unavailable.', { exact: true }).waitFor();
  assert.equal(await page.getByText('No variations yet.', { exact: true }).count(), 0);
  failRead = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('No variations yet.', { exact: true }).waitFor();
  const base = data.ads[0]; base.status = 'Winner';
  for (const [id, status, number, axes] of [['VAR-1', 'Winner', 1, ['Hook']], ['VAR-2', 'Testing', 2, ['Hook', 'Music']], ['VAR-3', 'Loser', 3, []], ['VAR-4', 'Scale', 4, ['CTA']]]) {
    data.ads.push({ ...structuredClone(base), id, parent_ad_id: base.id, variation_number: number, status, format_name: `Variation ${number}`,
      clickup_task_id: id === 'VAR-1' ? 'qa-variation' : null,
      meta: { variationChanges: axes, assignees: [{ id: 12, username: 'QA Editor' }], dueDate: '2026-10-10' } });
  }
  data.ads.push({ ...structuredClone(base), id: 'GRANDCHILD', parent_ad_id: 'VAR-1', format_name: 'Nested variation' });
  data.ads.push({ ...structuredClone(base), id: 'ORPHAN', parent_ad_id: 'missing', format_name: 'Orphan variation' });
  data.ads.push({ ...structuredClone(base), id: 'DELETED', parent_ad_id: base.id, format_name: 'Deleted variation', deleted_at: new Date().toISOString() });
  data.ads.push({ ...structuredClone(base), id: 'QUARANTINED', parent_ad_id: base.id, format_name: 'Quarantined variation', meta: { _productBoundaryQuarantined: true } });
  data.ads.push({ ...structuredClone(base), id: 'FOREIGN', parent_ad_id: base.id, product_id: 'qa-second', format_name: 'Foreign variation' });
  const first = data.ads.find((ad) => ad.id === 'VAR-1');
  data.manual_actions.push({ ...structuredClone(data.manual_actions[0]), id: 'VAR-ACTION', payload: { sourceAdId: first.id, title: first.format_name, _clickupId: first.clickup_task_id } });
  data.profiles[0].ap_dismissed_ad_ids = ['VAR-3'];
  emit('profiles', 'UPDATE', data.profiles[0]); emit('ads', 'UPDATE', base);
  const group = page.locator('[data-variation-group="AD-1"]');
  await group.waitFor();
  assert.equal(await page.locator('[data-variation-group]').count(), 2);
  assert.equal(await group.locator('[data-variation-row]').count(), 4);
  assert.equal(await group.locator('[data-variation-win-rate]').innerText(), '50% won');
  assert.deepEqual(await group.locator('[data-variation-row]').evaluateAll((rows) => rows.map((row) => row.dataset.variationRow)), ['VAR-1', 'VAR-2', 'VAR-3', 'VAR-4']);
  await group.getByText('Hook 1W/2T', { exact: true }).waitFor();
  assert.equal(await group.getByRole('link', { name: 'ClickUp for Variation 1', exact: true }).getAttribute('href'), 'https://app.clickup.com/t/qa-variation');
  assert.ok((await group.locator('[data-variation-row="VAR-1"]').innerText()).includes('QA Editor'));
  await group.getByText('Hidden from my plan', { exact: true }).waitFor();
  assert.equal(await group.getByRole('button', { name: 'Open variation Variation 3', exact: true }).count(), 0);
  for (const id of ['ORPHAN', 'DELETED', 'QUARANTINED', 'FOREIGN']) assert.equal(await page.locator(`[data-variation-row="${id}"]`).count(), 0);

  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await page.getByLabel('Select QA creative', { exact: true }).check();
  await page.getByLabel('Show Selected', { exact: true }).check();
  await page.getByLabel('Search Action Plan', { exact: true }).fill('no matching task');
  await view.click();
  assert.equal(await group.locator('[data-variation-row]').count(), 4);
  assert.equal(await page.getByLabel('Search Action Plan', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Show Selected', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Apply status', exact: true }).count(), 0);
  const open = group.getByRole('button', { name: 'Open variation Variation 1', exact: true });
  await open.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Close task detail', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await open.evaluate((el) => el === document.activeElement), true);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  assert.equal(await page.getByLabel('Show Selected', { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel('Search Action Plan', { exact: true }).inputValue(), 'no matching task');
  await view.click();
  const second = data.ads.find((ad) => ad.id === 'VAR-2'); second.status = 'Winner'; emit('ads', 'UPDATE', second);
  await page.waitForFunction(() => document.querySelector('[data-variation-group="AD-1"] [data-variation-win-rate]')?.textContent === '75% won');
  for (const width of [1440, 320, 390, 768]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await view.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth && !el.closest('table');
    }).map((el) => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}: ${JSON.stringify(overflow)}`);
    const table = group.getByRole('region');
    assert.equal(await table.evaluate((el) => el.getBoundingClientRect().right <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/action-plan-variations-${width}.png` });
    if (width === 320) {
      await table.focus(); await page.keyboard.press('End');
      await group.getByRole('link', { name: 'ClickUp for Variation 1', exact: true }).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  await open.click();
  first.deleted_at = new Date().toISOString(); emit('ads', 'UPDATE', first);
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelectorAll('[data-variation-group]').length === 1);
  assert.equal(await page.locator('[data-variation-row="GRANDCHILD"]').count(), 0);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await view.click(); await page.getByText('No variations yet.', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-variation-row]').count(), 0);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Variations: failed-read recovery and empty state, legacy direct-parent grouping/order/win rates/axis totals, assignments/due/ClickUp, all-product scope independent of table filters, safe drawer links/focus, personal hiding, deletion/quarantine/orphan/product boundaries, realtime updates, desktop/mobile overflow; no writes');
};
