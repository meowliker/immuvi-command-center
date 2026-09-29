const dateTrigger = (page) => page.getByRole('button', { name: 'Action Plan date range', exact: true });
const dateMenu = (page) => page.getByRole('group', { name: 'Action Plan date options', exact: true });
async function openDateMenu(page) {
  const trigger = dateTrigger(page);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await dateMenu(page).waitFor();
  return dateMenu(page);
}
async function choosePlanDate(page, preset) {
  const menu = await openDateMenu(page);
  await menu.locator(`[data-date-preset="${preset}"]`).click();
  if (preset !== 'custom') await menu.waitFor({ state: 'detached' });
}
async function setPlanDateBasis(page, mode) {
  const menu = await openDateMenu(page);
  await menu.getByRole('button', { name: mode, exact: true }).click();
  await page.keyboard.press('Escape');
}
module.exports = { dateTrigger, dateMenu, openDateMenu, choosePlanDate, setPlanDateBasis };
