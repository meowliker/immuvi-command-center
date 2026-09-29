const assert = require('node:assert/strict');

module.exports = async function testHqOperations({ page, context, data, control, emit, tab, artifactDir, results }) {
  await tab(page, 'Command HQ');
  const health = page.getByRole('region', { name: 'Product sync health', exact: true });
  const history = page.getByRole('region', { name: 'Product history', exact: true });
  const panel = page.locator('details').filter({ has: page.getByText('ClickUp', { exact: false }) }).first();
  const sync = health.getByRole('button', { name: 'Sync Now', exact: true });
  await page.locator('[data-hq-sync-state="Session key required"]').waitFor();
  assert.equal(await sync.isDisabled(), true);
  await page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await page.locator('[data-hq-sync-state="Not synced"]').waitFor();
  const invalidConnection = async (route) => route.request().postDataJSON().operation === 'inspect'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : route.fallback();
  await context.route('**/api/clickup/qa', invalidConnection);
  await health.getByRole('button', { name: 'Change', exact: true }).click();
  const listDialog = page.getByRole('dialog', { name: 'Link ClickUp List', exact: true });
  await listDialog.getByRole('alert').filter({ hasText: 'connection response could not be verified' }).waitFor();
  assert.equal(await page.getByLabel('Angle ClickUp field', { exact: true }).count(), 0);
  await context.unroute('**/api/clickup/qa', invalidConnection);
  await listDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await health.getByRole('button', { name: 'Change', exact: true }).click();
  await listDialog.getByRole('button', { name: 'Select', exact: true }).click();
  await listDialog.waitFor({ state: 'detached' });
  assert.equal(await health.locator('dt').count(), 0);

  const stamp = new Date().toISOString();
  data.activity_events = Array.from({ length: 45 }, (_, index) => ({ id: `hq-${String(index).padStart(3, '0')}`, product_id: 'qa-fixture', event_type: 'status_changed', field_name: 'status', old_value: 'Untested', new_value: 'Testing', actor: 'QA teammate', source: 'qa', created_at: stamp }));
  data.activity_events.push({ ...data.activity_events[0], id: 'foreign-event', product_id: 'qa-second' });
  emit('activity_events', 'INSERT', data.activity_events[0]);
  await page.waitForFunction(() => document.querySelectorAll('[data-history-id]').length === 40);
  let failHistory = true;
  const historyFailure = async (route) => failHistory && new URL(route.request().url()).searchParams.has('or') ? route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }) : route.fallback();
  await context.route(/\/rest\/v1\/activity_events\?/, historyFailure);
  await history.getByRole('button', { name: 'Load older events', exact: true }).click();
  await history.getByRole('alert').waitFor(); assert.equal(await history.locator('[data-history-id]').count(), 40);
  failHistory = false; await history.getByRole('button', { name: 'Retry history', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-history-id]').length === 45);
  assert.equal(await page.locator('[data-history-id="event:foreign-event"]').count(), 0);
  await context.unroute(/\/rest\/v1\/activity_events\?/, historyFailure);

  let mode = 'success', release, started;
  const startedSync = () => new Promise((resolve) => { started = resolve; });
  const handler = async (route) => {
    const input = route.request().postDataJSON();
    if (input.operation !== 'sync') return route.fallback();
    control.clickupCalls.push(input);
    assert.equal(input.productId, 'qa-fixture'); assert.equal(input.listId, '1301130000002447');
    if (mode === 'hold') { started(); await new Promise((resolve) => { release = resolve; }); }
    if (mode === 'bad') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (mode === 'fail') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic HQ outage' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ productId:input.productId,listId:input.listId,productUpdatedAt:data.products[0].updated_at,plan:{ads:[],actions:[],fetched:0} }) });
  };
  await context.route('**/api/clickup/qa', handler);
  await sync.click(); await page.getByRole('status').filter({ hasText: '0 tasks checked' }).waitFor();
  await page.locator('[data-hq-sync-state="Connected"]').waitFor();
  assert.ok(await health.locator('time').getAttribute('datetime'));
  mode = 'bad'; await sync.click(); await page.getByRole('alert').filter({ hasText: 'could not be verified' }).waitFor();
  await page.locator('[data-hq-sync-state="Needs attention"]').waitFor();
  assert.equal(await health.locator('[data-hq-sync-notice]').count(), 0);
  mode = 'fail'; await sync.click(); const outage = page.getByRole('alert').filter({ hasText: 'Synthetic HQ outage' }); await outage.waitFor();
  assert.equal(await outage.count(), 1);
  await outage.getByRole('button', { name: 'Dismiss ClickUp notification' }).click();
  await outage.waitFor({ state: 'detached' });
  mode = 'success'; await sync.click(); await page.locator('[data-hq-sync-state="Connected"]').waitFor();
  await page.getByLabel('Live sync', { exact: true }).check();
  assert.equal(await page.getByLabel('Live sync', { exact: true }).isChecked(), true);
  await tab(page, 'Angles'); await tab(page, 'Command HQ');
  assert.equal(await page.getByLabel('Live sync', { exact: true }).isChecked(), true);
  await page.getByLabel('Live sync', { exact: true }).uncheck();
  await panel.evaluate(el => { el.open = true; });
  await page.getByRole('button', { name: 'Forget key', exact: true }).click();
  await page.locator('[data-hq-sync-state="Session key required"]').waitFor(); assert.equal(await sync.isDisabled(), true);
  await page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await panel.locator('summary').click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const button of await health.getByRole('button').all()) assert.equal(await button.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: `${artifactDir}/hq-operations-${width}.png`, fullPage: true });
  }
  mode = 'hold'; const held = startedSync(); await sync.click(); await held;
  assert.equal(await sync.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Sync ClickUp', exact: true, includeHidden: true }).isDisabled(), true);
  await page.getByRole('region', { name: 'Product profiles' }).getByRole('button', { name: /Second QA/ }).click();
  await page.locator('[data-hq-sync-state="Not linked"]').waitFor(); release();
  await page.waitForTimeout(300); assert.equal(await health.locator('[data-hq-sync-notice]').count(), 0);
  await history.locator('[data-history-id="event:foreign-event"]').waitFor();
  assert.equal(await history.locator('[data-history-id]').count(), 1);
  await context.unroute('**/api/clickup/qa', handler);
  data.products[1].config.clickup_list_id = 'production-list'; emit('products', 'UPDATE', data.products[1]);
  await page.locator('[data-hq-sync-state="Blocked list"]').waitFor(); assert.equal(await sync.isDisabled(), true);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('HQ operations: shared QA connection/mapping/sync, valid/invalid/failed receipts, persisted sync metadata including zero tasks, session key removal, auto-sync across tabs, busy lock and late-product isolation; paginated realtime activity with retained failed pages/retry, foreign-event isolation, responsive controls and blocked non-test destinations');
};

module.exports.member = async function testHqMember({ page, tab, results }) {
  await tab(page, 'Command HQ');
  const health = page.getByRole('region', { name: 'Product sync health', exact: true });
  assert.equal(await health.getByRole('button', { name: /Configure fields|^Change$|Link ClickUp List/ }).count(), 0);
  assert.equal(await page.getByLabel('ClickUp list URL or ID').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Check connection', exact: true }).count(), 0);
  await page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  await health.getByRole('button', { name: 'Sync Now', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 tasks checked' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Product profiles' }).getByRole('button', { name: /Second QA/ }).count(), 0);
  results.push('HQ member access: only assigned products, sync allowed, list and field configuration unavailable');
};
