import { test, expect } from '@playwright/test';
import { newEasyGame, newGame, canAdd } from '../src/game.js';
import { coast } from '../src/data.js';
import { emptySave, STORAGE_KEY } from '../src/storage.js';

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function seed(page, overrides = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ key, data }) => {
      if (!sessionStorage.getItem('theme-seeded')) {
        localStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem('theme-seeded', '1');
      }
    },
    {
      key: STORAGE_KEY,
      data: {
        ...emptySave(),
        game: { ...newEasyGame(), hand: ['CA', 'WA', 'MA', 'SC'] },
        ...overrides,
      },
    },
  );
  await page.goto('/');
}

test('light/dark toggle persists without restarting play or losing penalties and survives score clearing', async ({
  page,
}) => {
  await seed(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'California, 1 points, west coast' }).click();
  const current = (await saved(page)).game;
  const invalid = current.hand.find((code) => !canAdd(current.deal, current.route, code));
  await page.locator(`[data-card="${invalid}"]`).click();
  await page.locator('#hint-button').click();
  const before = (await saved(page)).game;
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const after = (await saved(page)).game;
  for (const key of ['id', 'route', 'hand', 'zeroCards', 'hintPending', 'mistakePoints'])
    expect(after[key]).toEqual(before[key]);
  expect(after.sweep.multiplier).toBe(before.sweep.multiplier);
  expect(after.sweep.progress).toBeGreaterThanOrEqual(before.sweep.progress);
  expect((await saved(page)).theme).toBe('light');
  await page.locator('#records-button').click();
  await page.locator('#clear-scores').click();
  await page.keyboard.press('Escape');
  expect((await saved(page)).theme).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f4ef');
  await expect(page.locator('#hint-cost')).toBeVisible();
  await page.locator('#theme-button').focus();
  await page.locator('#theme-button').press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111d32');
  await page.locator('#new-game').click();
  expect((await saved(page)).theme).toBe('dark');
});

function luminance(hex) {
  const rgb = hex
    .match(/[a-f\d]{2}/gi)
    .map((part) => parseInt(part, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('both palettes keep full names readable, the phone controls compact, and dialogs themed', async ({
  page,
  isMobile,
}, testInfo) => {
  await seed(page);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-button').click();
    const palette = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        ['ink', 'muted', 'surface', 'card-top', 'card-bottom', 'green'].map((name) => [
          name,
          css.getPropertyValue(`--${name}`).trim(),
        ]),
      );
    });
    expect(contrast(palette.ink, palette['card-top'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.ink, palette['card-bottom'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.muted, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.green, palette.surface)).toBeGreaterThanOrEqual(4.5);
    for (const [width, height] of isMobile
      ? [
          [320, 568],
          [360, 780],
          [650, 850],
          [780, 360],
        ]
      : [
          [768, 844],
          [1440, 1000],
        ]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const toggle = await page.locator('#theme-button').boundingBox();
      expect(toggle.width).toBeGreaterThanOrEqual(44);
      expect(toggle.height).toBeGreaterThanOrEqual(44);
      expect(toggle.x + toggle.width).toBeLessThanOrEqual(width);
      await expect(page.locator('.state-card')).toHaveCount(4);
      if (width === 360 || width === 1440)
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), scale: 'css' });
    }
    await page.locator('#help-button').click();
    await expect(page.locator('#help-dialog')).toBeVisible();
    const surface = await page
      .locator('#help-dialog')
      .evaluate((dialog) => getComputedStyle(dialog).backgroundColor);
    expect(surface).toBe(theme === 'light' ? 'rgb(255, 254, 250)' : 'rgb(26, 41, 66)');
    await page.keyboard.press('Escape');
  }
});

test('light mode retains recognizable coastal/gold cards and translucent played cards in Challenging', async ({
  page,
}) => {
  const game = newGame();
  const gold = game.deal.find(coast);
  game.scoring = 'hard-v1';
  game.cardPoints = Object.fromEntries(game.deal.map((code) => [code, code === gold ? 3 : 1]));
  await seed(page, { game, difficulty: 'challenging', theme: 'light' });
  await expect(page.locator(`[data-card="${gold}"]`)).toHaveCSS(
    'border-top-color',
    'rgb(148, 100, 17)',
  );
  await page.locator(`[data-card="${gold}"]`).click();
  await expect(page.locator(`[data-chain="${gold}"]`)).toHaveCSS('opacity', '1');
  await expect(page.locator(`[data-chain="${gold}"] .bonus-star`)).toHaveCSS(
    'color',
    'rgb(148, 100, 17)',
  );
  await expect(page.locator('#score')).toHaveText('3 pts');
  await page.locator('#theme-button').click();
  await expect(page.locator(`[data-chain="${gold}"] .bonus-star`)).toHaveCSS(
    'color',
    'rgb(255, 210, 121)',
  );
  await expect(page.locator('.coastline')).toHaveCSS('stroke', 'rgb(157, 243, 117)');
});

test('theme controls work in memory when storage is blocked', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Blocked');
      },
    }),
  );
  await page.goto('/');
  await page.locator('#theme-button').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#new-game').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.state-card')).toHaveCount(4);
});
