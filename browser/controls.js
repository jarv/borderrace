export async function selectDifficulty(page, difficulty) {
  await page.locator('#difficulty-select').selectOption(difficulty);
}
