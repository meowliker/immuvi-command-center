const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');

async function reference(context, baseUrl, artifactDir) {
  const html = fs.readFileSync('immuvi-command-center.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).find((value) => value.includes('function renderHQ()'));
  const source = ts.createSourceFile('legacy.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = ['process', 'deriveWinners', 'renderHQ', 'mono', 'esc'].map((name) => source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(source)).join('\n');
  const constants = source.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]);
  const arrays = ['CREATIVE_STRUCTURES', 'HOOK_TYPES', 'PRODUCTION_STYLES'].map((name) => `const ${name} = ${constants.find((node) => node.name.getText(source) === name).initializer.getText(source)};`).join('\n');
  const nodes = Object.fromEntries(['kpiStrip', 'covGrid', 'gapBox'].map((id) => [id, {}]));
  const sandbox = { document: { getElementById: (id) => nodes[id] }, ADS: [{ id: 'AD-1', status: 'Untested', angle: 'Energy', persona: 'Busy people', funnelStage: 'TOF' }],
    ANGLES: [{ name: 'Energy', status: 'Untested' }], PERSONAS: [{ name: 'Busy people' }], FUNNEL_STAGES: ['TOF', 'MOF', 'BOF'], WINNERS: [],
    _isBoundaryQuarantinedAd: () => false, renderProductProfile: () => {} };
  // Execute only audited pure/render functions against inert nodes, never legacy startup.
  vm.runInNewContext(`${arrays}\n${functions}\nfunction getFieldNames(key) { return ({creativeStructure: CREATIVE_STRUCTURES, hookType: HOOK_TYPES, productionStyle: PRODUCTION_STYLES})[key]; }\nP = process(ADS); deriveWinners(); renderHQ();`, sandbox, { timeout: 1000 });
  const css = postcss.parse([...html.split('</head>')[0].matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n'));
  css.walkAtRules('import', (rule) => rule.remove());
  const fonts = [...fs.readFileSync('app/globals.css', 'utf8').matchAll(/@font-face\s*\{[^}]+\}/g)].map((match) => match[0]).join('\n');
  const ref = await context.newPage();
  await ref.setContent(`<base href="${baseUrl}/"><style>${css}\n${fonts}</style><section class="panel on">${nodes.kpiStrip.innerHTML}<div class="sh" style="margin-top:20px">Coverage Intelligence</div><div class="cov-grid">${nodes.covGrid.innerHTML}</div><div class="sh" style="margin-top:20px">Gap Analysis</div>${nodes.gapBox.innerHTML}</section>`);
  await ref.evaluate(() => document.fonts.ready);
  const result = await ref.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    return { values: [...document.querySelectorAll('.kpi-val')].map((el) => el.textContent), labels: [...document.querySelectorAll('.kpi-lbl')].map((el) => el.textContent),
      coverage: [...document.querySelectorAll('.cov-card')].map((el) => ({ title: el.querySelector('.cov-card-title').textContent, percentage: el.querySelector('.cov-pct').textContent, items: [...el.querySelectorAll('.cov-item')].map((node) => node.textContent.replace(/\s+/g, ' ').trim()) })),
      gaps: [...document.querySelectorAll('.gap-list li')].map((el) => el.textContent),
      metrics: { kpiPadding: style('.kpi-item').padding, totalSize: style('.kpi-val').fontSize, labelSize: style('.kpi-lbl').fontSize,
        gap: style('.cov-grid').gap, cardPadding: style('.cov-card').padding, cardRadius: style('.cov-card').borderRadius,
        cardTitle: style('.cov-card-title').fontSize, itemSize: style('.cov-item').fontSize, percentageSize: style('.cov-pct').fontSize,
        headingSize: style('.sh').fontSize, gapPadding: style('.gap-box').padding } };
  });
  await ref.screenshot({ path: `${artifactDir}/hq-legacy-reference.png`, fullPage: true });
  await ref.close(); return result;
}

module.exports = async function testHqFinal({ page, context, data, emit, tab, artifactDir, results }) {
  const legacy = await reference(context, new URL(page.url()).origin, artifactDir);
  await tab(page, 'Command HQ');
  await page.waitForFunction(() => document.querySelector('[data-hq-metric="total"] strong')?.textContent === '1');
  const current = await page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    return { values: [...document.querySelectorAll('[data-hq-metric] strong')].map((el) => el.textContent), labels: [...document.querySelectorAll('[data-hq-metric] > span')].map((el) => el.textContent),
      coverage: [...document.querySelectorAll('[data-hq-coverage]')].map((el) => ({ title: el.querySelector('h3').textContent, percentage: el.querySelector('p').textContent, items: [...el.querySelectorAll('li')].map((node) => [...node.querySelectorAll('span')].map((span) => span.textContent).join(' ')) })),
      gaps: [...document.querySelectorAll('[aria-label="Gap Analysis"] li')].map((el) => el.textContent),
      metrics: { kpiPadding: style('[data-hq-metric]').padding, totalSize: style('[data-hq-metric] strong').fontSize, labelSize: style('[data-hq-metric] > span').fontSize,
        gap: style('[aria-label="Coverage Intelligence"]').gap, cardPadding: style('[data-hq-coverage]').padding, cardRadius: style('[data-hq-coverage]').borderRadius,
        cardTitle: style('[data-hq-coverage] h3').fontSize, itemSize: style('[data-hq-coverage] li').fontSize, percentageSize: style('[data-hq-coverage] p').fontSize,
        headingSize: style('[aria-label="Gap Analysis"] h2').fontSize, gapPadding: style('[aria-label="Gap Analysis"] > div').padding } };
  });
  assert.deepEqual(current, legacy);
  const profiles = page.getByRole('region', { name: 'Product profiles', exact: true });
  assert.ok((await profiles.getByRole('button', { name: /QA Fixture/ }).boundingBox()).height < 40);
  const health = page.getByRole('region', { name: 'Product sync health', exact: true });
  await page.getByLabel('QA session API key').fill('synthetic-clickup-key');
  const panel = page.getByRole('dialog', { name: 'Link ClickUp List', exact: true });
  const malformed = async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ list: { id: '1301130000002447', name: 'QA' }, fields: [{ id: 'bad', name: 'Broken', type: 'drop_down', type_config: { options: {} } }], mappings: {}, productUpdatedAt: new Date().toISOString() }) });
  await context.route('**/api/clickup/qa', malformed);
  await health.getByRole('button', { name: 'Change', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: 'could not be verified' }).waitFor();
  assert.equal(await page.getByLabel('Angle ClickUp field', { exact: true }).count(), 0);
  await context.unroute('**/api/clickup/qa', malformed);
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await health.getByRole('button', { name: 'Change', exact: true }).click();
  await panel.getByRole('button', { name: 'Select', exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Close ClickUp connection' }).click();
  await page.getByLabel('Live sync', { exact: true }).check();
  data.products[0].config.clickup_list_id = 'blocked-list'; emit('products', 'UPDATE', data.products[0]);
  await page.locator('[data-hq-sync-state="Blocked list"]').waitFor();
  assert.equal(await page.getByLabel('Live sync', { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel('Angle ClickUp field', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('ClickUp list URL or ID').count(), 0);
  assert.equal(await health.locator('[data-hq-sync-notice]').count(), 0);
  data.products[0].config.clickup_list_id = '1301130000002447'; emit('products', 'UPDATE', data.products[0]);
  await page.locator('[data-hq-sync-state="Not synced"]').waitFor();
  const longName = 'LongProductName'.repeat(20);
  data.products[0].name = longName;
  data.angles[0].name = '<img src=x onerror=alert(1)>' + 'LongAngle'.repeat(30);
  data.ads[0].angle = data.angles[0].name;
  emit('products', 'UPDATE', data.products[0]); emit('angles', 'UPDATE', data.angles[0]); emit('ads', 'UPDATE', data.ads[0]);
  await page.locator('[data-hq-coverage="angle"]').getByText(data.angles[0].name, { exact: true }).waitFor();
  assert.equal(await page.locator('[data-hq-coverage] script, [data-hq-coverage] img').count(), 0);
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= innerWidth, nodes: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('[aria-label="Command HQ metrics"]')).slice(0, 12).map((el) => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })) }));
    assert.equal(overflow.fits, true, `Page overflow at ${width}: ${JSON.stringify(overflow.nodes)}`);
    for (const card of await page.locator('[data-hq-coverage]').all()) assert.equal(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    const count = await page.locator('[aria-label="Coverage Intelligence"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(count, width <= 768 ? 1 : 3);
    const boxes = await profiles.getByRole('button').evaluateAll((nodes) => nodes.filter((node) => node.getClientRects().length).map((node) => node.getBoundingClientRect().toJSON()));
    for (const box of boxes) assert.ok(box.left >= 0 && box.right <= width, 'HQ control outside viewport');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(Math.min(a.right, b.right) - Math.max(a.left, b.left) < 1 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 1, 'HQ controls overlap');
    }
    await page.screenshot({ path: `${artifactDir}/hq-final-${width}.png`, fullPage: true });
  }
  // Revoking access removes the product snapshot, controls and activity, not just the selector.
  data.profiles[0].role = 'member'; data.user_products = [];
  emit('profiles', 'UPDATE', data.profiles[0]);
  await page.getByText('No products assigned', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-hq-metric]').count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Product sync health' }).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Product history' }).count(), 0);
  assert.equal(new URL(page.url()).pathname, '/');
  results.push('Final HQ acceptance: audited legacy KPI/coverage/gap output and CSS metrics; compact product chips; malformed option-schema rejection/retry; same-product relink clears stale fields/notices and preserves live-sync preference; literal long names and 320-1920px bounds/non-overlap; access revocation clears all product views');
};
