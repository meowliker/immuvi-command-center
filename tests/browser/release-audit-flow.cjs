const assert = require('node:assert/strict');
const fs = require('node:fs');

module.exports = async function releaseAudit({ page, data, emit, tab, artifactDir, results }) {
  const screens = [], names = ['Command HQ','Angles','Personas','Competitors','Creative Tracker','Creative Matrix','Action Plan','Production','Strategist','Inspiration','Admin'];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of names) {
      const start = Date.now();
      await tab(page, new RegExp(`^${name}`, 'i'));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.getByRole('button', { name: 'Refreshing...', exact: true }).waitFor({ state: 'hidden' });
      const screen = await page.evaluate(() => {
        const visible = (element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
        const nameOf = (element) => element.getAttribute('aria-label')
          || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim()
          || [...(element.labels || [])].map((label) => label.textContent).join(' ').trim()
          || element.getAttribute('title') || (element.matches('button,a') ? element.textContent?.trim() : '');
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          overflowElements: [...document.querySelectorAll('main *')].filter(visible)
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
            .filter((element) => !element.closest('[role=region],nav')).slice(0, 12)
            .map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent.slice(0, 80) })),
          unnamedControls: [...document.querySelectorAll('button,input:not([type=hidden]),select,textarea')]
            .filter(visible).filter((element) => !nameOf(element)).map((element) => element.outerHTML.slice(0, 250)),
        };
      });
      screens.push({ width, name, warmSwitchMs: Date.now() - start, ...screen });
      if (screen.overflow > 1) await page.screenshot({ path: `${artifactDir}/overflow-${width}-${name.replaceAll(' ', '-')}.png`, fullPage: true });
    }
    await page.screenshot({ path: `${artifactDir}/release-admin-${width}.png`, fullPage: true });
  }
  fs.writeFileSync(`${artifactDir}/release-audit.json`, JSON.stringify({ screens }, null, 2));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tab(page, 'Creative Tracker');
  data.ads = Array.from({ length: 1000 }, (_, index) => ({ ...data.ads[0], id: `LOAD-${index}`, format_name: `Load fixture ${index}`, meta: {} }));
  const started = Date.now();
  emit('ads');
  await page.locator('[data-creative-id="LOAD-0"]').waitFor();
  const thousandRowRefreshMs = Date.now() - started;
  await page.screenshot({ path: `${artifactDir}/release-tracker-1000.png` });
  fs.writeFileSync(`${artifactDir}/release-audit.json`, JSON.stringify({
    scope: 'Warm loopback server, intercepted data, visible-control label heuristic; not a full WCAG or production performance certification.',
    screens, thousandRowRefreshMs,
  }, null, 2));
  assert.ok(screens.every((screen) => screen.overflow <= 1), 'Page overflow; see release-audit.json');
  assert.ok(screens.every((screen) => !screen.unnamedControls.length), 'Unnamed visible controls; see release-audit.json');
  assert.ok(thousandRowRefreshMs < 10000, '1000-row fixture did not settle within the local smoke budget');
  results.push('44 tab/viewport overflow and visible-label checks; 1000-row Tracker refresh smoke');
};
