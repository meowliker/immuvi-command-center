const assert = require('node:assert/strict');
module.exports = async function testPlanFields({ page, data, control, emit, tab, artifactDir, results }) {
  const ad = data.ads[0], action = data.manual_actions[0];
  ad.clickup_task_id = 'qa-assignment-task'; action.payload._clickupId = ad.clickup_task_id;
  ad.meta.assignees = [{ id: 77 }]; ad.meta._customFieldsRaw = { reviewer: [88], score: 1, checked: true };
  control.schema = { fields: [
    { id: '__task_assignees', name: 'Task assignees', type: 'users' }, { id: 'review', name: 'Reviewer', type: 'users' },
    { id: 'score', name: 'Score', type: 'number' }, { id: 'checked', name: 'Checked', type: 'checkbox' },
    { id: 'angle', name: 'Angle Tag', type: 'text' },
  ], members: [{ id: 11, username: 'QA Editor' }, { id: 22, username: 'QA Reviewer' }], mappings: { angle: 'angle' } };
  await tab(page, 'Action Plan');
  await page.evaluate(() => sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111', 'synthetic-clickup-key'));
  await page.getByRole('button', { name: 'Retry fields', exact: true }).click();
  const row = page.locator('[data-plan-row="ACTION-1"]');
  await row.getByRole('button', { name: 'Edit Editor for QA creative', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Editor', exact: true });
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await editor.getByRole('checkbox', { name: 'User 77', exact: true }).uncheck();
  await editor.getByRole('checkbox', { name: 'QA Editor', exact: true }).check();
  emit('ads', 'UPDATE', ad);
  await page.waitForTimeout(350);
  assert.equal(await editor.getByRole('checkbox', { name: 'QA Editor', exact: true }).isChecked(), true);
  control.clickupFailure = true;
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  assert.deepEqual(ad.meta.assignees, [{ id: 11 }]);
  assert.deepEqual(ad.meta._trackerPending['custom:__task_assignees'], [11]);
  control.clickupFailure = false;
  await row.getByRole('button', { name: 'Edit Reviewer for QA creative', exact: true }).click();
  const reviewer = page.getByRole('dialog', { name: 'Edit Reviewer', exact: true });
  await reviewer.getByRole('checkbox', { name: 'User 88', exact: true }).uncheck();
  await reviewer.getByRole('checkbox', { name: 'QA Reviewer', exact: true }).check();
  await reviewer.getByRole('button', { name: 'Apply', exact: true }).click();
  await reviewer.waitFor({ state: 'hidden' });
  assert.deepEqual(ad.meta._customFieldsRaw.reviewer, [22]);
  await row.getByRole('button', { name: 'QA creative', exact: true }).click();
  const drawer = page.locator('dialog[open]');
  for (const [name, value] of [['Score', '0'], ['Checked', false]]) {
    await drawer.getByRole('button', { name: `Edit ${name} for QA creative`, exact: true }).click();
    const field = page.getByRole('dialog', { name: `Edit ${name}`, exact: true });
    if (value === false) await field.getByLabel(`${name} custom field`, { exact: true }).uncheck();
    else await field.getByLabel(`${name} custom field`, { exact: true }).fill(value);
    await field.getByRole('button', { name: 'Apply', exact: true }).click();
    await field.waitFor({ state: 'hidden' });
  }
  assert.equal(ad.meta._customFieldsRaw.score, 0); assert.equal(ad.meta._customFieldsRaw.checked, false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-fields-mobile.png`, fullPage: true });
  await drawer.getByRole('button', { name: 'Close task detail', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: 'networkidle' });
  await row.getByRole('button', { name: 'Edit Reviewer for QA creative', exact: true }).click();
  await reviewer.getByRole('checkbox', { name: 'QA Reviewer', exact: true }).uncheck();
  await reviewer.getByRole('button', { name: 'Apply', exact: true }).click();
  await reviewer.waitFor({ state: 'hidden' });
  assert.deepEqual(ad.meta._customFieldsRaw.reviewer, []);
  assert.ok(control.clickupCalls.some(call => call.operation === 'push-creative' && call.actionId === action.id));
  results.push('Action Plan inline people pickers, unknown members, snapshot drafts, pending remote writes, drawer edits, zero/false, clear/reload');
};
