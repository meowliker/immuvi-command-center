const assert = require('node:assert/strict');

async function beginDrag(page, dialog, source, target, edge = 'before') {
  const grip = dialog.getByRole('button', { name: `Drag ${source} to reorder`, exact: true });
  await grip.scrollIntoViewIfNeeded();
  const from = await grip.boundingBox();
  const row = dialog.getByRole('button', { name: `Drag ${target} to reorder`, exact: true }).locator('..');
  const to = await row.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height * (edge === 'before' ? 0.25 : 0.75), { steps: 6 });
  assert.equal(await row.getAttribute('data-drop'), edge);
  assert.equal(await row.evaluate(element => getComputedStyle(element, '::after').backgroundColor), 'rgb(40, 123, 100)');
  assert.equal(await grip.locator('..').getAttribute('data-dragging'), 'true');
}

module.exports = { beginDrag };
