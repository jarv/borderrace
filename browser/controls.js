export async function selectDifficulty(page, difficulty) {
  if (await page.locator('#difficulty-select').isVisible()) {
    await page.locator('#difficulty-select').selectOption(difficulty);
  } else {
    await page.locator(`#difficulty-${difficulty}`).check();
  }
}
