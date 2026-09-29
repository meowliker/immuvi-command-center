const assert = require('node:assert/strict');

module.exports = async function testPlanSelection({ page, data, emit, tab, artifactDir, results }) {
  const base = data.ads[0];
  for (const name of ['Selected second', 'Unselected third']) {
    data.ads.push({ ...structuredClone(base), id: name, format_name: name, status: 'Testing' });
  }
  const only = page.getByRole('checkbox', { name: 'Show Selected', exact: true });
  const rows = page.locator('[data-plan-row]');
  const count = page.locator('[data-plan-result-count]');
  const clear = page.getByRole('button', { name: 'Clear selection', exact: true });
  const reset = page.getByRole('button', { name: 'Reset Action Plan filters', exact: true });
  await tab(page, 'Action Plan');
  await rows.nth(2).waitFor();
  const search = page.getByRole('searchbox', { name: 'Search Action Plan', exact: true });
  async function checkSearchFocus() {
    await search.click();
    const control = search.locator('..');
    const focused = await control.evaluate((element) => {
      const input = element.querySelector('input');
      const icon = element.querySelector('svg').getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return {
        outline: getComputedStyle(element).outlineStyle,
        width: getComputedStyle(element).outlineWidth,
        inputOutline: getComputedStyle(input).outlineStyle,
        containsIcon: icon.left >= bounds.left && icon.right <= bounds.right,
      };
    });
    assert.deepEqual(focused, { outline: 'solid', width: '2px', inputOutline: 'none', containsIcon: true });
    await page.keyboard.press('Tab');
    assert.equal(await control.evaluate((element) => getComputedStyle(element).outlineStyle), 'none');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await search.evaluate((element) => element === document.activeElement), true);
    assert.equal(await control.evaluate((element) => getComputedStyle(element).outlineStyle), 'solid');
  }
  await checkSearchFocus();
  const selectedCount = page.locator('[data-plan-selected-count]');
  assert.equal(await selectedCount.innerText(), '0 selected');
  await only.check();
  assert.equal(await rows.count(), 0);
  assert.equal(await count.innerText(), '0 / 3');
  await clear.click();
  assert.equal(await only.isChecked(), false);
  assert.equal(await rows.count(), 3);

  await page.getByLabel('Select QA creative', { exact: true }).check();
  assert.equal(await selectedCount.innerText(), '1 selected');
  await page.getByLabel('Select Selected second', { exact: true }).check();
  assert.equal(await selectedCount.innerText(), '2 selected');
  await only.focus(); await page.keyboard.press('Space');
  assert.equal(await only.isChecked(), true);
  assert.equal(await rows.count(), 2);
  await page.getByLabel('Search Action Plan', { exact: true }).fill('Unselected third');
  assert.equal(await rows.count(), 0);
  await page.getByText('2 hidden selections excluded', { exact: true }).waitFor();
  assert.equal(await selectedCount.innerText(), '0 selected');
  await page.getByLabel('Bulk status', { exact: true }).selectOption('Winner');
  assert.equal(await page.getByRole('button', { name: 'Apply status', exact: true }).isDisabled(), true);
  await reset.click();
  assert.equal(await only.isChecked(), false);
  assert.equal(await rows.count(), 3);
  assert.equal(await page.getByLabel('Select Selected second', { exact: true }).isChecked(), true);

  await only.check();
  await page.getByRole('combobox', { name: 'Action Plan task group', exact: true }).selectOption('testing');
  assert.equal(await count.innerText(), '1 / 3');
  await page.getByRole('button', { name: 'Include all work', exact: true }).click();
  assert.equal(await rows.count(), 0);
  await reset.click(); await only.check();
  // Personal hiding still wins over selection; the explicit reveal control is required.
  data.profiles[0].ap_dismissed_ad_ids = ['Selected second'];
  emit('profiles', 'UPDATE', data.profiles[0]);
  await page.waitForFunction(() => document.querySelector('[data-plan-result-count]')?.textContent === '1 / 3');
  await page.getByLabel('Show hidden tasks', { exact: true }).check();
  assert.equal(await rows.count(), 2);
  data.profiles[0].ap_dismissed_ad_ids = [];
  emit('profiles', 'UPDATE', data.profiles[0]);
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '0');
  await reset.click(); await only.check();

  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Details', exact: true }).count(), 2);
  await page.getByRole('button', { name: 'Pipeline view', exact: true }).click();
  assert.equal(await page.locator('[data-pipeline-task]').count(), 2);
  await page.getByRole('button', { name: 'Week view', exact: true }).click();
  assert.equal(await only.count(), 0);
  assert.equal(await count.innerText(), '3 / 3', 'Week must not inherit an invisible selection filter');
  await checkSearchFocus();
  await page.getByRole('button', { name: 'Trends view', exact: true }).click();
  assert.equal(await only.count(), 0);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  assert.equal(await only.isChecked(), true);
  assert.equal(await rows.count(), 2);

  for (const width of [1440, 320, 390]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await only.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bounds = await only.locator('..').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await checkSearchFocus();
    await page.screenshot({ path: `${artifactDir}/action-plan-selected-${width}.png` });
  }
  // The selected-only row disappears immediately, so assert the result separately.
  await page.getByLabel('Select QA creative', { exact: true }).click();
  assert.equal(await rows.count(), 1);
  await page.getByLabel('Select all visible tasks', { exact: true }).uncheck();
  assert.equal(await rows.count(), 0);
  assert.equal(await only.isChecked(), true);
  await clear.click();
  assert.equal(await rows.count(), 3);

  await page.getByLabel('Select Selected second', { exact: true }).check(); await only.check();
  data.ads = data.ads.filter((ad) => ad.id !== 'Selected second');
  emit('ads', 'DELETE', { ...base, id: 'Selected second' });
  await page.waitForFunction(() => document.querySelector('[data-plan-result-count]')?.textContent === '0 / 2');
  assert.equal(await page.getByRole('button', { name: 'Apply status', exact: true }).isDisabled(), true);
  await clear.click();
  await page.getByLabel('Select QA creative', { exact: true }).check(); await only.check();
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.waitForLoadState('networkidle');
  assert.equal(await only.isChecked(), false);
  assert.equal(await clear.count(), 0);
  await page.locator('main > section').first().locator('select').selectOption(base.product_id);
  await rows.first().waitFor();
  await page.getByLabel('Select QA creative', { exact: true }).check(); await only.check();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await only.isChecked(), false);
  assert.equal(await page.getByLabel('Select QA creative', { exact: true }).isChecked(), false);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Show Selected: keyboard toggle, empty/clear/reset, filter and personal-hiding intersection, Table/Cards/Pipeline, Week/Trends scope, deselection, realtime removal, product/reload isolation, desktop/mobile bounds; no writes');
};
