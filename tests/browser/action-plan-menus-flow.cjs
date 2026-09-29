const assert = require('node:assert/strict');

module.exports = async function testPlanMenus({ page, data, emit, tab, artifactDir, results }) {
  const base = data.ads[0];
  for (let i = 0; i < 35; i++) data.ads.push({ ...structuredClone(base), id: `menu-${i}`, format_name: `Menu creative ${i}`,
    status: `Review ${String(i).padStart(2, '0')}${i === 34 ? ' verylongstatuswithoutspaces'.repeat(4) : ''}` });
  await tab(page, 'Action Plan');
  const trigger = page.getByRole('button', { name: 'Filter status', exact: true });
  const menu = page.getByRole('group', { name: 'Status options', exact: true });
  const menus = page.locator('[data-placement][role="group"]');
  async function placed(key) {
    await page.waitForFunction((key) => {
      const trigger = document.querySelector(`[aria-label="Filter ${key}"]`);
      const panel = document.getElementById(trigger?.getAttribute('aria-controls'));
      if (!panel) return false;
      const a = trigger.getBoundingClientRect(), b = panel.getBoundingClientRect();
      const gap = panel.dataset.placement === 'above' ? a.top - b.bottom : b.top - a.bottom;
      return b.left >= 11 && b.right <= innerWidth - 11 && b.top >= 11 && b.bottom <= innerHeight - 11 && Math.abs(gap - 4) < 2;
    }, key);
  }
  async function moveTrigger(y) {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.evaluate((el, y) => window.scrollBy(0, el.getBoundingClientRect().top - y), y);
  }
  await trigger.focus(); await page.keyboard.press('Enter');
  await placed('status');
  await menu.getByRole('checkbox').first().waitFor();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('[data-placement] input') === document.activeElement);
  await page.keyboard.press('Space');
  assert.equal(await menu.getByRole('checkbox').first().isChecked(), true);
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
  await page.getByRole('button', { name: 'Reset Action Plan filters', exact: true }).click();

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 480 });
    await moveTrigger(425);
    await trigger.click(); await placed('status');
    assert.equal(await menu.getAttribute('data-placement'), 'above');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/action-plan-menu-above-${width}.png` });
    await page.keyboard.press('Escape');
    await moveTrigger(85);
    await trigger.click(); await placed('status');
    assert.equal(await menu.getAttribute('data-placement'), 'below');
    const scroller = menu.locator('div').last();
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const top = await scroller.evaluate((el) => el.scrollTop);
    assert.ok(top > 0);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await placed('status');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await scroller.evaluate((el) => el.scrollTop), top, 'Positioning reset option-list scroll');
    assert.equal(await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth), true, 'Long status text overflows');
    await page.screenshot({ path: `${artifactDir}/action-plan-menu-below-${width}.png` });
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 390, height: 240 });
  await moveTrigger(130); await trigger.click(); await placed('status');
  assert.ok((await menu.boundingBox()).height < 150, 'Menu did not shrink to the available height');
  assert.equal(await menu.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.left + 20, rect.top + 20));
  }), true, 'Sticky navigation covers the menu');
  await menu.getByRole('checkbox').last().focus();
  await placed('status');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });

  // Resize while open, then follow the anchor as the page moves.
  await page.setViewportSize({ width: 768, height: 480 });
  await moveTrigger(85); await trigger.click(); await placed('status');
  await page.setViewportSize({ width: 390, height: 600 });
  if (await menu.count()) await placed('status');
  else { await moveTrigger(85); await trigger.click(); await placed('status'); }
  await page.evaluate(() => window.scrollBy(0, -30)); await placed('status');
  const selected = menu.getByRole('checkbox', { name: 'Review 01', exact: true });
  await selected.check();
  const changed = data.ads.find((ad) => ad.id === 'menu-1'); changed.status = 'New review stage'; emit('ads', 'UPDATE', changed);
  await menu.getByRole('checkbox', { name: 'New review stage', exact: true }).waitFor();
  assert.equal(await selected.isChecked(), true, 'Realtime changes discarded a selected missing option');
  await placed('status');
  await menu.getByRole('button', { name: 'Clear Status filter', exact: true }).click();
  await page.keyboard.press('Escape');

  for (const [key, name] of [['angle', 'Angle'], ['persona', 'Persona'], ['funnelStage', 'Funnel'], ['adType', 'Type'], ['source', 'Source']]) {
    const button = page.getByRole('button', { name: `Filter ${key}`, exact: true });
    await button.scrollIntoViewIfNeeded(); await button.click(); await placed(key);
    assert.equal(await menus.count(), 1);
    const group = page.getByRole('group', { name: `${name} options`, exact: true });
    await group.getByRole('checkbox').first().focus();
    await page.getByLabel('Search Action Plan', { exact: true }).focus();
    await group.waitFor({ state: 'detached' });
  }
  await moveTrigger(85); await trigger.click(); await placed('status');
  await page.getByRole('button', { name: 'Filter angle', exact: true }).click();
  await menu.waitFor({ state: 'detached' });
  assert.equal(await menus.count(), 1);
  await page.getByLabel('Search Action Plan', { exact: true }).click();
  assert.equal(await menus.count(), 0);
  await moveTrigger(85); await trigger.click(); await placed('status');
  await trigger.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom + 30));
  await menu.waitFor({ state: 'detached' });
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.getByText('No Action Plan tasks match these filters.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Filter angle', exact: true }).click(); await placed('angle');
  await page.getByText('No values', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Anchored facet menus: above/below placement, 320/390/768/1440px bounds, long-list scroll preservation, long labels, keyboard entry/Escape/focus exit, single menu/outside dismissal, resize/scroll following, offscreen dismissal, realtime missing-option retention and empty state; no writes');
};
