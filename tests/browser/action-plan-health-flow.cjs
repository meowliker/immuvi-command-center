const assert = require('node:assert/strict');
module.exports = async function testPlanHealth({ page, data, control, emit, tab, artifactDir, results }) {
  const now = new Date(2026, 8, 16, 12).getTime(), day = 86_400_000;
  await page.clock.setFixedTime(now);
  const ad = data.ads[0], action = data.manual_actions[0];
  ad.status = 'Testing'; ad.created_at = new Date(now - 40 * day).toISOString(); ad.last_status_change_at = now - 8 * day;
  const specs = [
    ['Snoozed', 'Testing', 16, { testing_deferred_at: now - 6 * day, testing_defer_count: 1 }],
    ['Final', 'Testing', 15, {}], ['Winner', 'Winner', 30, {}],
    ['Late production', 'In Production', 0.5, { meta: { _dueDateMs: now - 1 } }],
    ['Ready', 'Ready to Launch', 2, {}], ['Closed review', 'Review', 10, {}], ['Fresh', 'Untested', 0.5, {}],
  ];
  for (const [name, status, age, extra] of specs) {
    data.ads.push({ ...structuredClone(ad), id: name, format_name: name, status, last_status_change_at: now - age * day, ...extra });
    data.manual_actions.push({ ...structuredClone(action), id: `action-${name}`, payload: { adId: name, title: name } });
  }
  control.pipelineStatuses = [{ status: 'Testing', type: 'custom', orderindex: 1 }, { status: 'Review', type: 'closed', orderindex: 2 }];
  await tab(page, 'Action Plan');
  await page.getByRole('button', { name: 'Retry status rules', exact: true }).waitFor();
  await page.evaluate(() => sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111', 'synthetic-clickup-key'));
  await page.getByRole('button', { name: 'Retry status rules', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-attention-total]')?.textContent === '3');
  const row = (id) => page.locator(`[data-plan-row="${id}"]`);
  assert.equal(await row('ACTION-1').locator('[data-checkpoint]').getAttribute('data-checkpoint'), 'first');
  assert.equal(await row('action-Snoozed').locator('[data-checkpoint]').getAttribute('data-checkpoint'), 'snoozed');
  assert.equal(await row('action-Final').locator('[data-checkpoint]').getAttribute('data-checkpoint'), 'final');
  assert.equal(await row('action-Winner').locator('[data-plan-age]').getAttribute('data-plan-age'), 'none');
  assert.equal(await row('action-Closed review').locator('[data-plan-age]').getAttribute('data-plan-age'), 'none');
  assert.equal(await row('action-Ready').locator('[data-plan-age]').getAttribute('data-plan-age'), 'yellow');
  assert.equal(await row('action-Late production').locator('[data-plan-age]').getAttribute('data-plan-age'), 'red');
  await page.getByLabel('Select Winner', { exact: true }).check();
  await page.getByLabel('Needs attention only', { exact: true }).check();
  assert.equal(await page.locator('[data-plan-row]').count(), 3);
  await page.getByText('1 hidden selections excluded', { exact: true }).waitFor();
  await page.getByLabel('Search Action Plan').fill('Final');
  assert.equal(await page.locator('[data-plan-row]').count(), 1);
  assert.equal(await page.locator('[data-attention-total]').innerText(), '3');
  await page.getByRole('button', { name: 'Trends view', exact: true }).click();
  assert.equal(await page.locator('[data-trend-stuck]').innerText(), '3');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  assert.equal(await page.getByLabel('Needs attention only', { exact: true }).isChecked(), true);
  await page.getByRole('button', { name: 'Reset Action Plan filters', exact: true }).click();
  assert.equal(await page.getByLabel('Select Winner', { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel('Needs attention only', { exact: true }).isChecked(), false);

  const overrides = async (value) => page.evaluate((next) => {
    localStorage.setItem('ap.ageThresholds.overrides', next);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ap.ageThresholds.overrides' }));
  }, value);
  await overrides(JSON.stringify({ 'qa-fixture': { 'ready to launch': { yellow: 0, red: 1 } }, 'qa-second': { testing: null } }));
  await page.waitForFunction(() => document.querySelector('[data-attention-total]')?.textContent === '4');
  await overrides('{bad json');
  await page.waitForFunction(() => document.querySelector('[data-attention-total]')?.textContent === '3');

  await page.getByRole('button', { name: 'QA creative', exact: true }).click();
  await page.getByRole('complementary').locator('[data-checkpoint="first"]').waitFor();
  await page.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await page.screenshot({ path: `${artifactDir}/action-plan-health-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Pipeline view', exact: true }).click();
  assert.equal(await page.locator('[data-pipeline-task="ACTION-1"] [data-checkpoint]').getAttribute('data-checkpoint'), 'first');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-health-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  assert.equal(await page.locator('[data-checkpoint="snoozed"]').count(), 1);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  ad.status = 'Winner'; ad.last_status_change_at = now;
  emit('ads', 'UPDATE', ad);
  await page.waitForFunction(() => document.querySelector('[data-attention-total]')?.textContent === '2');
  assert.equal(await row('ACTION-1').locator('[data-plan-age]').getAttribute('data-plan-age'), 'none');
  await page.clock.setFixedTime(now + day);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await row('action-Snoozed').locator('[data-checkpoint="final"]').waitFor();
  assert.equal(await page.locator('[data-attention-total]').innerText(), '4');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.waitForFunction(() => document.querySelector('[data-attention-total]')?.textContent === '0');
  assert.equal(await page.locator('[data-plan-row]').count(), 0);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Action Plan age/checkpoint badges, custom closed statuses, attention filters and hidden selections, all-product stuck count, threshold overrides, realtime decisions, snooze expiry, product isolation and responsive views');
};
