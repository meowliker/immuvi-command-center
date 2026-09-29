const assert = require('node:assert/strict');

module.exports = async function testPlanTableParity({ page, data, control, tab, artifactDir, results }) {
  const ad = data.ads[0], action = data.manual_actions[0];
  ad.status = 'Testing'; ad.clickup_task_id = 'qa-existing';
  ad.ad_link = 'https://example.test/inspiration'; ad.drive_link = 'https://drive.google.com/file/d/qa-test/view';
  ad.meta = { _fromInspoId: 'INS-TEST', _sourceInspoUrl: 'https://example.test/source', hookType: 'Question' };
  action.payload._clickupId = 'qa-existing';
  for (const [index, status] of ['In Production', 'Winner', 'Ready to Launch', 'Loser'].entries()) {
    data.ads.push({ ...structuredClone(ad), id: `PARITY-${index}`, format_name: `${status} creative`, status, clickup_task_id: null,
      meta: { hookType: 'Curiosity' }, ad_link: 'javascript:alert(1)', drive_link: '' });
    data.manual_actions.push({ ...structuredClone(action), id: `PARITY-ACTION-${index}`, payload: { title: `${status} creative`, adId: `PARITY-${index}`, angle: 'Energy', persona: 'Busy people' } });
  }
  await tab(page, 'Action Plan');
  const row = page.locator('[data-plan-row="ACTION-1"]'); await row.waitFor();
  assert.deepEqual(await page.locator('[data-plan-column]').evaluateAll(elements => elements.map(el => el.dataset.planColumn)),
    ['cb','source','title','angle','persona','origin','brief','adSource','driveLink','funnel','type','hook','status','age','editor','reviewer','created','due','clickup','producer','del']);
  assert.deepEqual(await page.locator('[data-plan-column]').evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().width))),
    [44,48,240,180,180,180,90,110,110,70,70,110,130,80,140,140,80,120,100,90,96]);
  for (const [name, href] of [['ClickUp','https://app.clickup.com/t/qa-existing'],['INS-TEST','https://example.test/source'],['Ad source for QA creative','https://example.test/inspiration'],['Drive Link for QA creative','https://drive.google.com/file/d/qa-test/view']]) {
    const link = row.getByRole('link', { name, exact: true });
    assert.equal(await link.getAttribute('href'), href); assert.equal(await link.getAttribute('target'), '_blank');
  }
  assert.equal(await page.locator('[data-plan-row] a[href^="javascript:"]').count(), 0);
  assert.equal(await row.getByLabel('Generate images for QA creative').isEnabled(), true);
  const testing = row.locator('[data-plan-cell=status] select');
  assert.equal(await testing.evaluate(el => getComputedStyle(el).color), 'rgb(139, 92, 246)');
  assert.equal(await row.locator('[data-plan-cell=origin] [data-source]').getAttribute('data-source'), 'inspo');
  await page.getByLabel('Select all table tasks', { exact: true }).check();
  assert.equal(await page.locator('[data-plan-row][data-selected=true]').count(), 5);
  await page.getByLabel('Select all table tasks', { exact: true }).uncheck();
  await page.getByRole('columnheader').getByRole('button', { name: 'Task name', exact: true }).click();
  assert.equal(await page.locator('[data-plan-column=title]').getAttribute('aria-sort'), 'ascending');
  await page.getByRole('columnheader').getByRole('button', { name: 'Task name', exact: true }).click();
  assert.equal(await page.locator('[data-plan-column=title]').getAttribute('aria-sort'), 'descending');
  const region = page.getByRole('region', { name: 'Action Plan tasks', exact: true });
  for (const width of [1440, 1920, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await region.scrollIntoViewIfNeeded();
    await region.evaluate(el => { el.scrollLeft = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Document overflow at ${width}`);
    assert.equal(await region.evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'No vertical table cap');
    await page.screenshot({ path: `${artifactDir}/action-plan-table-parity-${width}.png` });
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.screenshot({ path: `${artifactDir}/action-plan-table-links-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await row.getByRole('button', { name: 'QA creative', exact: true }).click();
  await page.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await row.getByRole('button', { name: 'Delete creative QA creative', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(control.clickupCalls.length, 0);
  assert.equal(data.ads.length, 5);
  results.push('Legacy Action Plan 16 columns/exact widths, source and status colors, safe origin/ClickUp/Drive/Ad links, selection/sort, drawer/delete-cancel, QA Producer control, 320-1920px bounds and horizontal-only table scroll; no writes');
};
