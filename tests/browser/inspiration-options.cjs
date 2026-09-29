module.exports = async function inspirationOption(page, name) {
  const option = page.getByRole('button', { name, exact: true });
  if (!await option.isVisible()) await page.getByRole('button', { name: 'Inspiration table options', exact: true }).click();
  await option.click();
  await page.getByRole('button', { name: 'Inspiration table options', exact: true }).click();
};
