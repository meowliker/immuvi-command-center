const assert = require('node:assert/strict');

module.exports = async function testModalDismiss({ page, context, data, control, tab, results }) {
  data.inspirations.push({ id: 'DISMISS-INS', product_id: 'qa-fixture', title: 'Dismissal reference', status: 'Classified', data: { formatName: 'Dismissal reference' }, created_at: new Date().toISOString() });
  const dialogs = page.locator('dialog[open]');
  async function clickOutside() { await page.mouse.click(2, 2); }
  await tab(page, 'Action Plan');
  const opener = page.getByRole('button', { name: 'Columns and views', exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Action Plan columns and views', exact: true });
    await dialog.waitFor();
    // Padding belongs to the window, not its backdrop.
    const bounds = await dialog.boundingBox();
    await page.mouse.click(bounds.x + 3, bounds.y + 3);
    assert.equal(await dialog.count(), 1);
    const heading = await dialog.getByRole('heading').boundingBox();
    await page.mouse.move(heading.x + 10, heading.y + 10); await page.mouse.down();
    await page.mouse.move(2, 2); await page.mouse.up();
    assert.equal(await dialog.count(), 1, 'A drag starting inside must not dismiss');
    await page.mouse.move(2, 2); await page.mouse.down();
    await page.mouse.move(heading.x + 10, heading.y + 10); await page.mouse.up();
    assert.equal(await dialog.count(), 1, 'A drag ending inside must not dismiss');
    if (width === 390) {
      const touch = await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 2, y: 2 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else await clickOutside();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await opener.click();
  const preferences = page.getByRole('dialog');
  await preferences.getByLabel('Show Reviewer', { exact: true }).uncheck();
  control.holdPreferences = true;
  const held = new Promise(resolve => { control.preferencesHeld = resolve; });
  await preferences.getByRole('button', { name: 'Save layout', exact: true }).click();
  await held;
  await preferences.getByRole('button', { name: 'Close column preferences', exact: true }).evaluate(async element => {
    if (!element.disabled) await new Promise(resolve => {
      const observer = new MutationObserver(() => { if (element.disabled) { observer.disconnect(); resolve(); } });
      observer.observe(element, { attributes: true });
    });
  });
  await clickOutside();
  assert.equal(await preferences.count(), 1, 'Do not interrupt an in-flight save');
  assert.equal(typeof control.releasePreferences, 'function');
  control.releasePreferences();
  await preferences.waitFor({ state: 'detached' });

  // Dismiss only the top window, retaining the parent drawer and its scroll lock.
  await page.getByRole('button', { name: 'QA creative', exact: true }).click();
  const drawer = page.locator('dialog').filter({ has: page.getByRole('button', { name: 'Close task detail', exact: true }) });
  await drawer.getByRole('button', { name: 'Edit creative details', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Creative details: QA creative', exact: true });
  await editor.waitFor();
  await clickOutside();
  await editor.waitFor({ state: 'detached' });
  assert.equal(await drawer.count(), 1);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await clickOutside(); await drawer.waitFor({ state: 'detached' });

  for (const [section, button] of [
    ['Creative Tracker', 'Add creative'],
    ['Angles', 'View personas for Energy'],
    ['Personas', 'View creatives for Busy people'],
    ['Creative Matrix', 'Energy x Busy people: 1 creatives'],
  ]) {
    await tab(page, section);
    await page.getByRole('button', { name: button, exact: true }).click();
    await dialogs.waitFor();
    await dialogs.getByRole('heading').first().click();
    assert.equal(await dialogs.count(), 1);
    await clickOutside(); await dialogs.waitFor({ state: 'detached' });
  }
  await tab(page, 'Action Plan');
  await page.getByRole('button', { name: 'Generate images for QA creative', exact: true }).click();
  await dialogs.waitFor(); await clickOutside(); await dialogs.waitFor({ state: 'detached' });
  await tab(page, 'Inspiration');
  await page.getByRole('button', { name: `Open inspiration ${data.inspirations[0].id}`, exact: true }).click();
  await dialogs.locator('aside').waitFor();
  await dialogs.getByRole('heading').first().click();
  assert.equal(await dialogs.count(), 1);
  await clickOutside(); await dialogs.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  results.push('Backdrop dismissal across shared dialogs, columns, tracker, taxonomy, matrix, image producer and drawers; inside/padding/drag protection, touch, nested top-window-only dismissal, focus/scroll restoration, busy save guard');
};
