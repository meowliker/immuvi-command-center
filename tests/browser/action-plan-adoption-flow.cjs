const assert = require('node:assert/strict');
const { stage } = require('./creation-fixture.cjs');
module.exports = async function testPlanAdoption({ page, data, emit, control, tab, artifactDir, results }) {
  const base = data.ads[0], now = Date.now();
  for (const name of ['Adopt status', 'Adopt due', 'Adopt rename', 'Adopt fields', 'Adopt review', 'Adopt bulk', 'Adopt external', 'Adopt race', 'Adopt stale', 'Adopt details', 'Adopt push', 'Adopt terminal']) {
    data.ads.push({ ...structuredClone(base), id: name, format_name: name,
      status: name === 'Adopt review' ? 'Testing' : name === 'Adopt terminal' ? 'Winner' : 'Untested',
      last_status_change_at: now - 8 * 86400000 + data.ads.length * 1000, created_at: new Date(now - 30 * 86400000).toISOString(), meta: name === 'Adopt terminal' ? { _tags: ['app-created'] } : {} });
  }
  control.schema = { fields: [{ id: 'score', name: 'Score', type: 'number' }], members: [], mappings: {} };
  const saved = (name) => data.manual_actions.filter((a) => (a.payload.sourceAdId || a.payload.adId) === name);
  const row = (name) => page.locator(`[data-plan-row="${saved(name)[0]?.id || `va:${name}`}"]`);
  const stageCount = () => (control.stageCalls || []).length;
  const dialog = page.getByRole('dialog');
  await tab(page, 'Action Plan');
  await page.locator('[data-plan-row="va:Adopt terminal"]').waitFor();
  assert.equal(await page.locator('[data-plan-row]').count(), 13);
  await page.getByLabel('Select Adopt status', { exact: true }).check();
  assert.equal(await page.getByRole('button', { name: 'Remove selected from plan', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Include all work', exact: true }).textContent(), 'All work 13');
  await page.getByRole('button', { name: 'Include all work', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Include all work', exact: true }).textContent(), 'App-only 1');
  assert.equal(await page.locator('[data-plan-row]').count(), 1);
  await page.getByText('1 hidden selections excluded', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Remove App-only filter', exact: true }).click();
  assert.equal(await page.getByLabel('Select Adopt status', { exact: true }).isChecked(), true);
  await row('Adopt status').getByRole('button', { name: 'Adopt status', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Remove from Action Plan', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await row('Adopt rename').getByRole('button', { name: 'Rename Adopt rename', exact: true }).click();
  await row('Adopt rename').getByLabel('Task name', { exact: true }).fill('Discard this');
  await row('Adopt rename').getByRole('button', { name: 'Cancel rename', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Adopt terminal from my plan', exact: true }).click();
  await page.getByLabel('Show hidden tasks', { exact: true }).check();
  await page.getByRole('button', { name: 'Restore Adopt terminal in my plan', exact: true }).click();
  await page.getByLabel('Show hidden tasks', { exact: true }).uncheck();
  assert.equal(stageCount(), 0); assert.equal(data.manual_actions.length, 1);

  await page.getByLabel('Show Selected', { exact: true }).check();
  await row('Adopt status').getByLabel('Status for Adopt status', { exact: true }).selectOption('Testing');
  await page.locator('[data-plan-row="plan-Adopt status"]').waitFor();
  assert.equal(saved('Adopt status').length, 1);
  assert.equal(await page.getByLabel('Select Adopt status', { exact: true }).isChecked(), true);
  assert.equal(await page.locator('[data-plan-row]').count(), 1);
  await page.getByLabel('Show Selected', { exact: true }).uncheck();
  await row('Adopt due').getByLabel('Due date for Adopt due', { exact: true }).fill('2026-10-03');
  await page.locator('[data-plan-row="plan-Adopt due"]').waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Due date for Adopt due"]')?.value === '2026-10-03');
  assert.equal(saved('Adopt due')[0].payload.dueDate, '2026-10-03');

  // An acknowledged promotion followed by a failed edit must retain the draft.
  control.failNextCreative = true; control.expectedAdoptionRejections = 2;
  await row('Adopt rename').getByRole('button', { name: 'Rename Adopt rename', exact: true }).click();
  await row('Adopt rename').getByLabel('Task name', { exact: true }).fill('Retained rename');
  await row('Adopt rename').getByRole('button', { name: 'Save task name', exact: true }).click();
  await page.getByText('Synthetic edit conflict; draft preserved.', { exact: true }).waitFor();
  assert.equal(await row('Adopt rename').getByLabel('Task name', { exact: true }).inputValue(), 'Retained rename');
  await row('Adopt rename').getByRole('button', { name: 'Save task name', exact: true }).click();
  await row('Adopt rename').getByRole('button', { name: 'Rename Retained rename', exact: true }).waitFor();
  assert.equal(saved('Adopt rename').length, 1);

  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await page.getByLabel('Select Adopt external', { exact: true }).check();
  await page.getByLabel('Show Selected', { exact: true }).check();
  await row('Adopt external').getByRole('button', { name: 'Adopt external', exact: true }).click();
  const external = stage(data, { p_ad_id: 'Adopt external', p_product_id: base.product_id });
  emit('manual_actions', 'INSERT', external);
  await page.locator('[data-plan-row="plan-Adopt external"]').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Close task detail', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Close task detail', exact: true }).click();
  assert.equal(await page.getByLabel('Select Adopt external', { exact: true }).isChecked(), true);
  assert.equal(await page.locator('[data-plan-row]').count(), 1);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();

  // The server may already have saved the action before this tab learns of it.
  stage(data, { p_ad_id: 'Adopt race', p_product_id: base.product_id });
  await page.locator('[data-plan-row="va:Adopt race"]').getByLabel('Status for Adopt race', { exact: true }).selectOption('Testing');
  await page.locator('[data-plan-row="plan-Adopt race"]').waitFor();
  assert.equal(saved('Adopt race').length, 1);

  await row('Adopt stale').getByRole('button', { name: 'Rename Adopt stale', exact: true }).click();
  await row('Adopt stale').getByLabel('Task name', { exact: true }).fill('Stale draft');
  data.ads.find((a) => a.id === 'Adopt stale').updated_at = new Date(now + 99999).toISOString();
  await row('Adopt stale').getByRole('button', { name: 'Save task name', exact: true }).click();
  await page.getByText('Creative changed. Refresh before adding to Action Plan.', { exact: true }).waitFor();
  assert.equal(saved('Adopt stale').length, 0);
  assert.equal(await row('Adopt stale').getByLabel('Task name', { exact: true }).inputValue(), 'Stale draft');
  await row('Adopt stale').getByRole('button', { name: 'Cancel rename', exact: true }).click();

  await page.evaluate(() => sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111', 'synthetic-clickup-key'));
  await row('Adopt fields').getByRole('button', { name: 'Adopt fields', exact: true }).click();
  const drawer = page.locator('dialog[open]');
  await drawer.getByRole('button', { name: 'Refresh ClickUp fields', exact: true }).click();
  await drawer.getByRole('button', { name: 'Edit Score for Adopt fields', exact: true }).click();
  const score = page.getByRole('dialog', { name: 'Edit Score', exact: true });
  await score.getByLabel('Score custom field', { exact: true }).fill('0');
  await score.getByRole('button', { name: 'Apply', exact: true }).click();
  await score.waitFor({ state: 'hidden' });
  await drawer.getByRole('button', { name: 'Close task detail', exact: true }).click();
  assert.equal(data.ads.find((a) => a.id === 'Adopt fields').meta._customFieldsRaw.score, 0);
  await row('Adopt details').getByRole('button', { name: 'Adopt details', exact: true }).click();
  await dialog.locator('summary').filter({ hasText: /^Creative details$/ }).click();
  await dialog.getByRole('textbox', { name: 'Notes', exact: true }).fill('Adopted brief');
  await dialog.getByRole('button', { name: 'Save creative', exact: true }).click();
  await page.getByText('Task successfully updated.', { exact: true }).waitFor();
  await drawer.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(saved('Adopt details').length, 1);
  await page.getByRole('button', { name: 'Review testing for Adopt review', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Needs more testing (+7 days)', exact: true }).check();
  await dialog.getByRole('button', { name: 'Save testing review', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(saved('Adopt review').length, 1);
  assert.equal(data.ads.find((a) => a.id === 'Adopt review').testing_defer_count, 1);

  await page.getByLabel('Select Adopt bulk', { exact: true }).check();
  await page.getByLabel('Select Adopt status', { exact: true }).check();
  await page.getByLabel('Bulk status', { exact: true }).selectOption('Winner');
  await page.getByRole('button', { name: 'Apply status', exact: true }).click();
  await row('Adopt bulk').getByLabel('Status for Adopt bulk', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label="Status for Adopt bulk"]')?.value === 'Winner');
  assert.equal(saved('Adopt bulk')[0].live_status, 'Winner');
  assert.equal(saved('Adopt status')[0].live_status, 'Winner');

  await row('Adopt push').getByRole('button', { name: 'Push to ClickUp: Adopt push', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-plan-row="plan-Adopt push"] a')?.textContent?.includes('ClickUp'));
  assert.equal(control.creationPosts, 1); assert.equal(saved('Adopt push').length, 1);

  await row('Adopt due').getByRole('button', { name: 'Adopt due', exact: true }).click();
  await page.getByRole('button', { name: 'Remove from Action Plan', exact: true }).click();
  await page.locator('[data-plan-row="plan-Adopt due"]').waitFor({ state: 'detached' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('Select Adopt due', { exact: true }).count(), 0);
  assert.ok(data.ads.some((a) => a.id === 'Adopt due'));
  assert.equal(control.expectedAdoptionRejections, 0);
  await page.screenshot({ path: `${artifactDir}/action-plan-adoption-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-adoption-mobile.png`, fullPage: true });
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Read-only auto-adoption, opt-out, hide/restore, guarded status/date/title/fields/creative/checkpoint/bulk/push promotion, retained drafts and selection, concurrent reuse, stale rejection, removal without resurrection, responsive single-page UI');
};
