const assert = require('node:assert/strict');

module.exports = async function resizeColumn(page, label, delta) {
  const handle = page.getByRole('separator', { name: `Resize ${label} column`, exact: true });
  await handle.scrollIntoViewIfNeeded();
  await page.waitForFunction((label) => document.querySelector(`[aria-label="Resize ${label} column"]`)?.getAttribute('aria-disabled') === 'false', label);
  const before = Number(await handle.getAttribute('aria-valuenow'));
  const min = Number(await handle.getAttribute('aria-valuemin'));
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 5 });
  const expected = Math.min(600, Math.max(min, before + delta));
  assert.equal(Number(await handle.getAttribute('aria-valuenow')), expected, 'Resize preview follows the pointer');
  await page.mouse.up();
  await page.waitForFunction(({ label, expected }) => {
    const handle = document.querySelector(`[aria-label="Resize ${label} column"]`);
    return handle?.getAttribute('aria-disabled') === 'false' && Number(handle.getAttribute('aria-valuenow')) === expected;
  }, { label, expected });
  assert.ok(Math.abs((await handle.locator('..').boundingBox()).width - expected) < 2);
};
