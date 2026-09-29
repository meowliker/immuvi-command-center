const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { dateTrigger, dateMenu, openDateMenu, choosePlanDate } = require('./plan-date-helpers.cjs');

module.exports = async function testPlanDateMenu({ page, data, emit, tab, artifactDir, results }) {
  await page.clock.setFixedTime(new Date(2026, 8, 16, 12));
  const base = data.ads[0];
  for (let i = 0; i < 20; i++) data.ads.push({ ...structuredClone(base), id: `date-${i}`, format_name: `Date creative ${i}` });
  await tab(page, 'Action Plan');
  await page.locator('[data-plan-row]').first().waitFor();
  const trigger = dateTrigger(page), menu = dateMenu(page);
  async function positioned() {
    await page.waitForFunction(() => {
      const trigger = document.querySelector('[aria-label="Action Plan date range"]');
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return false;
      const a = trigger.getBoundingClientRect(), b = panel.getBoundingClientRect();
      const gap = panel.dataset.placement === 'above' ? a.top - b.bottom : b.top - a.bottom;
      return b.left >= 11 && b.right <= innerWidth - 11 && b.top >= 11 && b.bottom <= innerHeight - 11 && Math.abs(gap - 4) < 2;
    });
  }
  // Compare preset ordering with the audited pure legacy renderer, never its startup code.
  const html = fs.readFileSync('immuvi-command-center.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).find((s) => s.includes('function renderApDateDropdown('));
  const source = ts.createSourceFile('legacy.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const render = source.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'renderApDateDropdown').getText(source);
  const sandbox = { _apState: { filters: { datePreset: 'all', dateMode: 'window' } }, result: '' };
  vm.runInNewContext(`${render}\nresult = renderApDateDropdown();`, sandbox, { timeout: 1000 });
  const legacy = await page.evaluate((html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.ap-date-preset')].map((el) => el.textContent.replace('\u2026', '')), sandbox.result);
  await openDateMenu(page);
  assert.deepEqual(await menu.locator('[data-date-preset]').allTextContents(), legacy);
  const presets = await menu.locator('[data-date-preset]').evaluateAll((els) => els.map((el) => el.dataset.datePreset));
  await menu.locator('[data-date-preset="all"]').hover();
  assert.deepEqual(await menu.locator('[data-date-preset="all"]').evaluate((el) => {
    const style = getComputedStyle(el); return [style.backgroundColor, style.color];
  }), ['rgb(14, 14, 16)', 'rgb(214, 255, 75)']);
  await page.keyboard.press('Escape');
  for (const preset of presets.filter((value) => value !== 'custom')) {
    await choosePlanDate(page, preset);
    assert.equal(await trigger.getAttribute('data-preset'), preset);
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
    await openDateMenu(page);
    assert.equal(await menu.locator(`[data-date-preset="${preset}"]`).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
  }
  await trigger.focus(); await page.keyboard.press('Enter'); await menu.waitFor();
  await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  assert.equal(await trigger.getAttribute('data-preset'), 'today');
  await choosePlanDate(page, 'all');
  await page.getByLabel('Select QA creative', { exact: true }).check();
  await choosePlanDate(page, 'custom');
  await menu.getByRole('button', { name: 'Apply date range', exact: true }).click();
  await menu.getByRole('alert').waitFor();
  assert.equal(await trigger.getAttribute('data-preset'), 'all');
  await menu.getByLabel('Start date', { exact: true }).fill('2026-09-17');
  await menu.getByLabel('End date', { exact: true }).fill('2026-09-16');
  await menu.getByRole('button', { name: 'Apply date range', exact: true }).click();
  await menu.getByText('End date must be on or after start date.', { exact: true }).waitFor();
  await menu.getByLabel('Start date', { exact: true }).fill('2026-09-15');
  base.status = 'Winner'; emit('ads', 'UPDATE', base);
  await page.waitForFunction(() => document.querySelector('[data-plan-row="ACTION-1"] select')?.value === 'Winner');
  assert.equal(await menu.getByLabel('Start date', { exact: true }).inputValue(), '2026-09-15');
  await menu.getByRole('button', { name: 'Created', exact: true }).click();
  assert.equal(await menu.getByRole('button', { name: 'Created', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await trigger.getAttribute('data-preset'), 'all', 'Basis change committed unfinished dates');
  await menu.getByRole('button', { name: 'Apply date range', exact: true }).click();
  assert.equal(await trigger.getAttribute('data-preset'), 'custom');
  assert.equal(await trigger.getAttribute('title'), '2026-09-15 to 2026-09-16');
  await page.getByRole('button', { name: 'Reset Action Plan filters', exact: true }).click();
  assert.equal(await page.getByLabel('Select QA creative', { exact: true }).isChecked(), true);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 700 });
    await choosePlanDate(page, 'custom');
    await positioned();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    const boxes = await menu.locator('button, input').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    for (const box of boxes) assert.ok(box.left >= 12 && box.right <= width - 12, `Date control overflow at ${width}px`);
    await menu.getByLabel('Start date', { exact: true }).fill('2026-01-01');
    await page.screenshot({ path: `${artifactDir}/action-plan-date-menu-${width}.png` });
    await menu.getByRole('button', { name: 'Created', exact: true }).focus();
    await positioned();
    await page.screenshot({ path: `${artifactDir}/action-plan-date-menu-bottom-${width}.png` });
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
    assert.equal(await trigger.getAttribute('data-preset'), 'all');
    await choosePlanDate(page, 'custom');
    assert.equal(await menu.getByLabel('Start date', { exact: true }).inputValue(), '');
    await menu.getByRole('button', { name: 'Cancel date range', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 260 });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 145));
  await choosePlanDate(page, 'custom'); await positioned();
  assert.ok((await menu.boundingBox()).height < 150);
  await menu.getByRole('button', { name: 'Created', exact: true }).click(); await positioned();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await choosePlanDate(page, 'custom');
  await page.getByRole('button', { name: 'Filter status', exact: true }).click();
  await menu.waitFor({ state: 'detached' });
  await openDateMenu(page);
  assert.equal(await page.getByRole('group', { name: 'Status options', exact: true }).count(), 0);
  await page.getByLabel('Search Action Plan', { exact: true }).focus();
  await menu.waitFor({ state: 'detached' });
  await choosePlanDate(page, 'custom');
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await menu.waitFor({ state: 'detached' });
  assert.equal(await trigger.getAttribute('data-preset'), 'all');
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Legacy date preset order, segmented basis, explicit validated custom apply/cancel, draft retention across realtime, keyboard/focus restoration, selection preservation, 320/390/768/1440px bounds, short viewport scrolling, facet/outside dismissal and product reset; no writes');
};
