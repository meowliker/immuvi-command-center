const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');

async function legacyReference(context, baseUrl, artifactDir) {
  const html = fs.readFileSync('immuvi-command-center.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).find((s) => s.includes('function renderApPulseStrip('));
  const source = ts.createSourceFile('legacy.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['renderApPulseStrip', '_apTileColor'];
  const functions = names.map((name) => source.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name).getText(source)).join('\n');
  const sandbox = { _apState: {}, _apIsTileActive: () => false, esc: (v) => String(v), result: '' };
  const zero = { created: 0, briefed: 0, production: 0, ready: 0, launched: 0, decisions: 0, tested: 0, winners: 0, killed: 0 };
  sandbox.pulse = { today: zero, week: zero, weekDelta: zero };
  vm.runInNewContext(`${functions}\nresult = renderApPulseStrip(pulse);`, sandbox, { timeout: 1000 });
  const css = postcss.parse([...html.split('</head>')[0].matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n'));
  css.walkAtRules('import', (rule) => rule.remove());
  const fonts = [...fs.readFileSync('app/globals.css', 'utf8').matchAll(/@font-face\s*\{[^}]+\}/g)].map((m) => m[0]).join('\n');
  const ref = await context.newPage();
  // Only audited pure render functions and CSS are used, never legacy startup/network code.
  await ref.setContent(`<base href="${baseUrl}/"><style>${css}\n${fonts}</style><header class="hdr"><div class="hdr-inner"><div class="hdr-logo-name">Immuvi Command Center</div></div></header><section class="panel on">${sandbox.result}</section>`);
  await ref.evaluate(() => document.fonts.ready);
  const metrics = await ref.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('.hdr-logo-name')).fontSize,
    tileHeight: document.querySelector('.ap-tile').getBoundingClientRect().height,
    countFont: getComputedStyle(document.querySelector('.ap-tile-val')).fontFamily }));
  await ref.screenshot({ path: `${artifactDir}/legacy-pulse-reference.png`, fullPage: true });
  await ref.close(); return metrics;
}

module.exports = async function testPlanVisual({ page, context, data, tab, artifactDir, results }) {
  const baseUrl = new URL(page.url()).origin;
  const legacy = await legacyReference(context, baseUrl, artifactDir);
  const base = data.ads[0];
  for (let i = 0; i < 12; i++) data.ads.push({ ...structuredClone(base), id: `visual-${i}`, format_name: `Creative ${i + 1}`, status: 'Testing' });
  await tab(page, 'Action Plan');
  await page.locator('[data-pulse-count]').first().waitFor();
  await page.locator('[data-plan-row]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const desktop = await page.evaluate(() => {
    const pulse = document.querySelector('[data-pulse-key]');
    return { font: getComputedStyle(document.body).fontFamily, margin: getComputedStyle(document.body).margin,
      heading: getComputedStyle(document.querySelector('h1')).fontSize, countFont: getComputedStyle(document.querySelector('[data-pulse-count]')).fontFamily,
      tileHeight: pulse.getBoundingClientRect().height, tableTop: document.querySelector('[data-plan-row]').getBoundingClientRect().top,
      faces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family), overflow: document.documentElement.scrollWidth > innerWidth,
      tileTops: ['today', 'week'].map((scope) => document.querySelector(`[data-pulse-key="${scope}:created"]`).getBoundingClientRect().top) };
  });
  assert.equal(desktop.font, legacy.font); assert.equal(desktop.heading, legacy.heading);
  assert.equal(desktop.tileHeight, legacy.tileHeight); assert.equal(desktop.countFont, legacy.countFont);
  assert.equal(desktop.margin, '0px'); assert.equal(desktop.overflow, false);
  assert.ok(desktop.faces.some((font) => font.includes('Satoshi'))); assert.ok(desktop.faces.some((font) => font.includes('JetBrains Mono')));
  assert.equal(desktop.tileTops[0], desktop.tileTops[1]); assert.ok(desktop.tableTop < 900, `Table starts too low: ${desktop.tableTop}`);
  const filters = page.locator('[aria-label="Action Plan filters"]');
  const bulk = page.locator('[aria-label="Action Plan bulk actions"]');
  const layouts = page.getByRole('group', { name: 'Action Plan layout', exact: true });
  const pulseBottom = await page.getByRole('region', { name: 'Action Plan pulse' }).evaluate((el) => el.getBoundingClientRect().bottom);
  assert.ok((await layouts.boundingBox()).y >= pulseBottom);
  assert.ok((await filters.boundingBox()).y > (await layouts.boundingBox()).y);
  assert.ok((await bulk.boundingBox()).y > (await filters.boundingBox()).y);
  assert.equal(await bulk.getByRole('searchbox', { name: 'Search Action Plan' }).count(), 1);
  assert.equal(await filters.getByRole('combobox', { name: 'Action Plan saved view' }).count(), 1);
  assert.equal(await filters.getByRole('button', { name: 'Columns and views' }).count(), 1);
  assert.equal(await page.getByLabel('Bulk status', { exact: true }).count(), 0, 'Idle bulk bar must stay compact');
  assert.equal(await page.locator('[data-plan-result-count]').innerText(), '13 / 13');
  await page.screenshot({ path: `${artifactDir}/action-plan-parity-desktop.png` });
  await page.getByLabel('Select Creative 1', { exact: true }).check();
  await bulk.getByRole('searchbox').fill('QA creative');
  assert.equal(await page.locator('[data-plan-result-count]').innerText(), '1 / 13');
  await page.getByText('1 hidden selections excluded', { exact: true }).waitFor();
  await page.getByLabel('Bulk status', { exact: true }).selectOption('Winner');
  assert.equal(await page.getByRole('button', { name: 'Apply status', exact: true }).isDisabled(), true);
  await page.getByRole('combobox', { name: 'Action Plan task group', exact: true }).selectOption('testing');
  assert.equal(await page.locator('[data-plan-result-count]').innerText(), '0 / 13');
  await page.getByRole('button', { name: 'Reset Action Plan filters', exact: true }).click();
  assert.equal(await page.getByLabel('Select Creative 1', { exact: true }).isChecked(), true);
  assert.equal(await page.locator('[data-plan-result-count]').innerText(), '13 / 13');
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  assert.equal(await page.getByLabel('Bulk status', { exact: true }).count(), 0);
  await page.evaluate(() => window.scrollTo(0, 650));
  const nav = page.getByRole('navigation', { name: 'Command Center sections' });
  assert.ok(Math.abs((await nav.boundingBox()).y) < 1, 'Tabs must remain visible while scrolling');
  await page.getByRole('button', { name: 'Cards view', exact: true }).click();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1080 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const nav = document.querySelector('nav'), active = nav.querySelector('[aria-selected="true"]');
      const outer = nav.getBoundingClientRect(), inner = active.getBoundingClientRect();
      return inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Document overflow at ${width}px`);
    assert.equal(await page.locator('[data-pulse-key]').evaluateAll((tiles) => tiles.every((tile) => tile.scrollHeight <= tile.clientHeight && tile.scrollWidth <= tile.clientWidth)), true, `Tile overflow at ${width}px`);
    await page.screenshot({ path: `${artifactDir}/action-plan-parity-${width}.png` });
    await layouts.scrollIntoViewIfNeeded();
    const boxes = await filters.locator('button, select, input').evaluateAll((controls) => controls.filter((el) => el.getClientRects().length).map((el) => ({ name: el.getAttribute('aria-label') || el.textContent, rect: el.getBoundingClientRect().toJSON() })));
    for (const { name, rect } of boxes) assert.ok(rect.left >= 0 && rect.right <= width, `${name} extends outside ${width}px`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].rect, b = boxes[j].rect;
      assert.ok(Math.min(a.right, b.right) - Math.max(a.left, b.left) < 1 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 1,
        `Overlapping filter controls: ${boxes[i].name} / ${boxes[j].name} at ${width}px`);
    }
    await page.screenshot({ path: `${artifactDir}/action-plan-controls-${width}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Columns and views', exact: true }).click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
  await page.screenshot({ path: `${artifactDir}/action-plan-parity-dialog.png` });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Legacy CSS comparison and control hierarchy: fonts/heading/76px pulse, views above unified filters, saved views/counts, search in compact bulk bar, hidden-selection exclusion, reset preservation, 320/390/768/1920px bounds/non-overlap, sticky tabs and dialog dismissal; no writes');
};
