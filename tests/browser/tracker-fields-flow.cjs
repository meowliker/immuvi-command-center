const assert = require('node:assert/strict');

module.exports = async function testTrackerFields({ page, data, control, tab, artifactDir, results }) {
  const base = data.ads[0];
  base.meta = { creativeStructure: 'Imported custom structure', notes: 'Keep existing metadata', _clickupUrl: 'https://app.clickup.com/9016762494/v/li/1301130000002447', _qaNavigationPreview: true };
  base.drive_link = 'https://drive.google.com/drive/u/0/my-drive';
  data.ads.push({ ...structuredClone(base), id: 'AD-2', format_name: 'Production row', meta: { taskType: 'production' } });
  await tab(page, 'Creative Tracker');
  const row = page.locator('[data-creative-id="AD-1"]');
  await row.waitFor();
  assert.equal(await row.getByRole('link', { name: 'Open QA creative in ClickUp', exact: true }).getAttribute('href'), base.meta._clickupUrl);
  assert.equal(await row.getByRole('button', { name: 'Push changes for QA creative', exact: true }).count(), 0);
  const structure = row.getByLabel('Structure for QA creative', { exact: true });
  assert.equal(await structure.inputValue(), 'Imported custom structure');
  assert.equal(await structure.getByRole('option', { name: 'Imported custom structure', exact: true }).count(), 1);
  for (const [label, key, value] of [['Structure', 'creativeStructure', 'Demo'], ['Hook', 'hookType', 'Curiosity'], ['Production style', 'productionStyle', 'AI Generated']]) {
    const select = row.getByLabel(`${label} for QA creative`, { exact: true });
    await select.selectOption(value);
    await page.waitForFunction(({ label }) => !document.querySelector(`select[aria-label="${label} for QA creative"]`).disabled, { label });
    assert.equal(data.ads[0].meta[key], value);
    assert.equal(await select.inputValue(), value);
    assert.equal(data.ads[0].meta.notes, 'Keep existing metadata');
  }
  assert.equal(data.ads[0].clickup_task_id ?? null, null);
  assert.equal(control.clickupCalls.length, 0);
  await tab(page, 'Angles'); await tab(page, 'Creative Tracker');
  await row.waitFor();
  assert.equal(await row.getByLabel('Structure for QA creative', { exact: true }).inputValue(), 'Demo');
  assert.equal(await row.getByLabel('Hook for QA creative', { exact: true }).inputValue(), 'Curiosity');
  assert.equal(await row.getByLabel('Production style for QA creative', { exact: true }).inputValue(), 'AI Generated');
  const widths = await row.locator('td').evaluateAll((cells) => cells.slice(0, 7).map((cell) => Math.round(cell.getBoundingClientRect().width)));
  assert.deepEqual(widths, [256, 172, 172, 172, 172, 172, 200]);
  assert.equal(await row.locator('td').nth(3).evaluate((node) => getComputedStyle(node).borderRightColor), 'rgb(255, 255, 255)');
  const color = (locator) => locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.notEqual(await color(row), await color(page.locator('[data-creative-id="AD-2"]')));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const inventory = page.getByRole('region', { name: 'Creative inventory table', exact: true });
    await inventory.evaluate((node) => { node.scrollLeft = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${artifactDir}/tracker-fields-${width}.png`, fullPage: true });
  }
  results.push('Tracker: all three catalog dropdowns persist edits across tab reload without losing metadata, imported custom options retained, display-only ClickUp test link cannot trigger task push, legacy-sized columns and colored rows with white dividers, 320/390/1440px layout; mocked writes only');
};
