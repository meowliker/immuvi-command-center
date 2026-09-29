const assert = require('node:assert/strict');

module.exports = async function testPlanDrawer({ page, data, emit, tab, artifactDir, results }) {
  await tab(page, 'Action Plan');
  const opener = page.getByRole('button', { name: 'QA creative', exact: true });
  await opener.waitFor();
  const row = page.locator('[data-plan-row="ACTION-1"]');
  const tableWidth = (await row.boundingBox()).width;
  const drawer = page.locator('dialog').filter({ has: page.getByRole('button', { name: 'Close task detail', exact: true }) });
  await opener.click();
  const close = drawer.getByRole('button', { name: 'Close task detail', exact: true });
  await close.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close task detail');
  assert.equal((await row.boundingBox()).width, tableWidth, 'Opening the drawer must not resize the table');
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  const panel = drawer.getByRole('complementary');
  await page.waitForFunction(() => {
    const panel = document.querySelector('dialog aside').getBoundingClientRect();
    return Math.abs(panel.right - innerWidth) < 1;
  });
  assert.equal((await panel.boundingBox()).width, 540);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await drawer.evaluate((el) => el.contains(document.activeElement)), true, 'Focus escaped the modal drawer');
  }
  assert.equal(await panel.evaluate((el) => Math.round(el.getBoundingClientRect().right)), 1440, 'Keyboard navigation must not move the drawer away from the viewport edge');
  assert.equal(await drawer.getByRole('button', { name: 'Rename QA creative', exact: true }).locator('svg').evaluate((el) => el.getBoundingClientRect().width > 0), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-drawer-desktop.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'detached' });
  assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');

  await opener.click();
  await drawer.getByRole('heading', { name: 'QA creative', exact: true }).click();
  assert.equal(await drawer.count(), 1, 'Clicking inside must not dismiss');
  await page.mouse.click(20, 100);
  await drawer.waitFor({ state: 'detached' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await opener.click();
    await close.waitFor();
    await page.waitForFunction(() => document.querySelector('dialog aside').getAnimations().every((animation) => animation.playState !== 'running'));
    const bounds = await panel.boundingBox();
    assert.equal(Math.round(bounds.x + bounds.width), width, `Drawer right edge at ${width}`);
    assert.ok(bounds.x >= 0, `Drawer clipped on left at ${width}`);
    assert.equal(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth), true, `Drawer overflow at ${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/action-plan-drawer-${width}.png`, animations: 'disabled' });
    await close.click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await opener.click();
  const edit = drawer.getByRole('button', { name: 'Edit creative details', exact: true });
  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Creative details: QA creative', exact: true });
  await editor.getByRole('textbox', { name: 'Notes', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  assert.equal(await drawer.count(), 1);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.equal(await edit.evaluate((el) => el === document.activeElement), true);

  await edit.click();
  await editor.getByRole('textbox', { name: 'Notes', exact: true }).waitFor();
  data.ads[0].deleted_at = new Date().toISOString();
  emit('ads', 'UPDATE', data.ads[0]);
  await page.locator('dialog aside').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Nested editor must retain its scroll lock after task removal');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Legacy-style 540px overlay drawer, stable table width, mobile overflow, focus trap/restore, Escape/backdrop dismissal, nested editor and out-of-order scroll lock cleanup; no writes');
};
