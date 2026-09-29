const assert = require('node:assert/strict');
module.exports = async function testPlanVisibility({ page, context, data, emit, control, tab, artifactDir, results }) {
  const ad = data.ads[0], action = data.manual_actions[0], profile = data.profiles[0];
  profile.ap_dismissed_ad_ids = ['other-product-hidden'];
  profile.ap_col_state = { keep: 'legacy columns' };
  for (const id of ['hidden', 'gone', 'quarantined', 'tombstoned']) {
    data.ads.push({ ...structuredClone(ad), id, format_name: id === 'gone' ? 'QA creative' : id,
      deleted_at: id === 'gone' ? new Date().toISOString() : null,
      meta: id === 'quarantined' ? { _productBoundaryQuarantined: true } : {} });
    data.manual_actions.push({ ...structuredClone(action), id: `action-${id}`, payload: { adId: id, title: id === 'gone' ? 'QA creative' : id } });
  }
  data.deleted_ads.push({ id: 'tombstoned', product_id: 'qa-fixture' });
  data.manual_actions.push({ ...structuredClone(action), id: 'standalone', payload: { title: 'Standalone only' } });
  const before = structuredClone({ ads: data.ads, actions: data.manual_actions });
  await tab(page, 'Action Plan');
  const rows = () => page.locator('[data-plan-row]');
  await page.getByRole('button', { name: 'Hide hidden from my plan', exact: true }).waitFor();
  assert.equal(await rows().count(), 3);
  assert.equal(await page.locator('[data-hidden-total]').innerText(), '0');
  assert.equal(await page.getByRole('button', { name: 'Hide Standalone only from my plan', exact: true }).count(), 0);
  await page.getByLabel('Select hidden', { exact: true }).check();
  await page.getByRole('button', { name: 'Hide hidden from my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '1');
  assert.equal(await rows().count(), 2);
  await page.getByText('1 hidden selections excluded', { exact: true }).waitFor();
  assert.deepEqual(profile.ap_dismissed_ad_ids, ['other-product-hidden', 'hidden']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByLabel('Show hidden tasks', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-plan-row]').length === 2);
  await page.getByLabel('Show hidden tasks', { exact: true }).check();
  await page.getByRole('button', { name: 'Restore hidden in my plan', exact: true }).waitFor();
  assert.equal(await page.locator('[data-plan-row="action-hidden"]').getAttribute('data-plan-hidden'), 'true');
  await page.getByLabel('Search Action Plan').fill('Standalone'); assert.equal(await rows().count(), 1);
  await page.getByRole('button', { name: 'Remove Search: Standalone filter', exact: true }).click();
  await page.screenshot({ path: `${artifactDir}/action-plan-visibility-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Restore hidden in my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '0');
  await page.getByRole('button', { name: 'Remove Show hidden filter', exact: true }).click();
  assert.equal(await rows().count(), 3);

  control.visibilityConflicts = 3;
  await page.getByRole('button', { name: 'hidden', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hide hidden from my plan', exact: true }).click();
  await page.getByRole('dialog').getByRole('alert').getByText('Hidden tasks changed in another tab. Refresh and try again.', { exact: false }).waitFor();
  assert.equal(await rows().count(), 3, 'Unacknowledged hide changed the UI');
  assert.equal(profile.ap_dismissed_ad_ids.includes('hidden'), false);
  await page.getByRole('button', { name: 'Retry hidden tasks', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hide hidden from my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '1');
  assert.ok(profile.ap_dismissed_ad_ids.includes('concurrent-1'));

  const second = await context.newPage();
  await second.goto(page.url(), { waitUntil: 'networkidle' }); await tab(second, 'Action Plan');
  await second.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '1');
  await second.getByLabel('Show hidden tasks', { exact: true }).check();
  await second.getByRole('button', { name: 'Restore hidden in my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '0');
  await second.close();
  assert.equal(await page.getByRole('button', { name: 'Close task detail', exact: true }).count(), 0, 'Cross-tab restore must not reopen the dismissed drawer');
  profile.ap_dismissed_ad_ids.push('AD-1'); emit('profiles', 'UPDATE', profile);
  await page.waitForFunction(() => !document.querySelector('[data-plan-row="ACTION-1"]'));
  await page.getByLabel('Show hidden tasks', { exact: true }).check();
  await page.getByRole('button', { name: 'Pipeline view', exact: true }).click();
  await page.getByRole('button', { name: 'Restore QA creative in my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '0');
  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  await page.getByRole('button', { name: 'Hide hidden from my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '1');
  await page.getByRole('button', { name: 'Restore hidden in my plan', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-hidden-total]')?.textContent === '0');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();

  // New tombstones must remove both the task and any stale open inspector.
  await page.getByRole('button', { name: 'QA creative', exact: true }).click();
  const tombstone = { id: 'AD-1', product_id: 'qa-fixture' };
  data.deleted_ads.push(tombstone); emit('deleted_ads', 'INSERT', tombstone);
  await page.waitForFunction(() => !document.querySelector('[data-plan-row="ACTION-1"]'));
  assert.equal(await page.getByRole('button', { name: 'Close task detail' }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-visibility-mobile.png`, fullPage: true });
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.getByText('No Action Plan tasks match these filters.', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-hidden-total]').innerText(), '0');
  assert.equal(await page.getByLabel('Show hidden tasks', { exact: true }).isChecked(), false);
  assert.deepEqual({ ads: data.ads, actions: data.manual_actions }, before);
  assert.deepEqual(profile.ap_col_state, { keep: 'legacy columns' });
  assert.ok(profile.ap_dismissed_ad_ids.includes('other-product-hidden'));
  assert.equal(control.clickupCalls.length, 0);

  control.visibilityReadFailure = true;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Retry hidden tasks', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Show hidden tasks', { exact: true }).isDisabled(), true);
  control.visibilityReadFailure = false;
  await page.getByRole('button', { name: 'Retry hidden tasks', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Show hidden tasks"]')?.disabled === false);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Per-user hide/restore, reload, reversible chips, selection exclusion, CAS failure/retry, cross-tab/realtime updates, product counts, cards/pipeline/table, deleted/quarantined/tombstoned suppression, stale inspector cleanup and responsive rendering; preferences-only mocked writes');
};
