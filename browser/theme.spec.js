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
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#08090b');
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
        ['ink', 'muted', 'surface', 'card-top', 'card-bottom', 'blue'].map((name) => [
          name,
          css.getPropertyValue(`--${name}`).trim(),
        ]),
      );
    });
    expect(contrast(palette.ink, palette['card-top'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.ink, palette['card-bottom'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.muted, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.blue, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#1669d6')).toBeGreaterThanOrEqual(4.5);
    const border = theme === 'light' ? 'rgb(36, 117, 223)' : 'rgb(57, 140, 255)';
    const accent = theme === 'light' ? 'rgb(20, 101, 204)' : 'rgb(106, 181, 255)';
    for (const selector of ['.game-shell', '.state-card', '#hint-button']) {
      await expect(page.locator(selector).first()).toHaveCSS('border-top-color', border);
    }
    await expect(page.locator('.game-settings')).toHaveCSS('border-top-color', border);
    await expect(page.locator('.map-wrap')).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('.map-wrap')).toHaveCSS('border-right-width', '0px');
    await expect(page.locator('.map-wrap')).toHaveCSS('border-bottom-width', '0px');
    await expect(page.locator('.map-wrap')).toHaveCSS('border-left-width', '0px');
    await expect(page.locator('.map-wrap')).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('.coastline')).toHaveCSS('stroke', accent);
    await expect(page.locator('.map-state path').first()).toHaveCSS('stroke', 'rgb(75, 80, 88)');
    await expect(page.locator('#score')).toHaveCSS('color', accent);
    await expect(page.locator('.card-points').first()).toHaveCSS('color', accent);
    await expect(page.locator('#new-game')).toHaveCSS('background-color', 'rgb(22, 105, 214)');
    for (const selector of ['.state-card', '.map-wrap', '#new-game', '#hint-button']) {
      await expect(page.locator(selector).first()).toHaveCSS('border-top-left-radius', '3px');
    }
    if (theme === 'dark') {
      for (const selector of [
        'body',
        '.game-shell',
        '.game-toolbar',
        '.hand',
        '.map-panel',
        '.map-wrap',
        '.state-card',
      ]) {
        await expect(page.locator(selector).first()).toHaveCSS('background-image', 'none');
      }
      await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(8, 9, 11)');
      await expect(page.locator('.map-panel')).toHaveCSS('background-color', 'rgb(12, 14, 17)');
      await expect(page.locator('.state-card').first()).toHaveCSS(
        'background-color',
        'rgb(27, 30, 35)',
      );
    }
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
    expect(surface).toBe(theme === 'light' ? 'rgb(255, 254, 250)' : 'rgb(17, 19, 21)');
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
  await expect(page.locator(`[data-chain="${gold}"]`)).toHaveCSS(
    'border-top-color',
    'rgb(148, 100, 17)',
  );
  await expect(page.locator(`[data-chain="${gold}"] .bonus-star`)).toHaveCSS(
    'color',
    'rgb(148, 100, 17)',
  );
  await expect(page.locator('#score')).toHaveText('3 pts');
  await expect(page.locator('.map-state.on-route path')).toHaveCSS('stroke', 'rgb(75, 80, 88)');
  await page.locator('#theme-button').click();
  await expect(page.locator(`[data-chain="${gold}"]`)).toHaveCSS('background-image', 'none');
  await expect(page.locator(`[data-chain="${gold}"]`)).toHaveCSS(
    'border-top-color',
    'rgb(255, 210, 121)',
  );
  await expect(page.locator(`[data-chain="${gold}"]`)).toHaveCSS(
    'background-color',
    'rgba(20, 23, 27, 0.8)',
  );
  await expect(page.locator(`[data-chain="${gold}"] .bonus-star`)).toHaveCSS(
    'color',
    'rgb(255, 210, 121)',
  );
  await expect(page.locator('.coastline')).toHaveCSS('stroke', 'rgb(106, 181, 255)');
  await expect(page.locator('.map-state.on-route path')).toHaveCSS('stroke', 'rgb(75, 80, 88)');
});

test('map-route cards have solid blue borders in both themes, including after undo', async ({
  page,
}) => {
  await seed(page);
  await page.locator('[data-card="CA"]').click();
  const game = (await saved(page)).game;
  const next = game.hand.find((code) => canAdd(game.deal, game.route, code));
  await page.locator(`[data-card="${next}"]`).click();
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-button').click();
    for (const card of await page.locator('.map-card').all()) {
      await expect(card).toHaveCSS(
        'border-top-color',
        theme === 'light' ? 'rgb(36, 117, 223)' : 'rgb(57, 140, 255)',
      );
      await expect(card).toHaveCSS('border-top-style', 'solid');
      await expect(card).toHaveCSS('border-top-width', '2px');
      await expect(card).toHaveCSS('opacity', '1');
    }
  }
  await page.locator(`[data-chain="${next}"]`).click();
  await expect(page.locator('.map-card')).toHaveCount(1);
  await expect(page.locator('[data-chain="CA"]')).toHaveCSS(
    'border-top-color',
    'rgb(36, 117, 223)',
  );
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

test('Dark coastal choices stand out from charcoal cards without hiding gold difficulty cues', async ({
  page,
  isMobile,
}, testInfo) => {
  const game = newGame();
  const gold = game.deal.find(coast);
  game.scoring = 'hard-v1';
  game.cardPoints = Object.fromEntries(game.deal.map((code) => [code, code === gold ? 3 : 1]));
  await seed(page, { game, difficulty: 'challenging' });
  await expect(page.locator('.state-card:not(.coastal)').first()).toHaveCSS(
    'background-color',
    'rgb(27, 30, 35)',
  );
  for (const card of await page.locator('.state-card.coastal').all()) {
    await expect(card).toHaveCSS('background-color', 'rgb(21, 57, 95)');
    await expect(card).toHaveCSS('background-image', 'none');
    await expect(card).toHaveCSS('opacity', '1');
  }
  await expect(page.locator(`[data-card="${gold}"]`)).toHaveCSS(
    'border-top-color',
    'rgb(255, 210, 121)',
  );
  if (isMobile)
    await page.screenshot({ path: testInfo.outputPath('dark-coastal-choices.png'), scale: 'css' });
  await page.locator(`[data-card="${gold}"]`).click();
  await expect(page.locator(`[data-card="${gold}"]`)).toHaveCSS(
    'background-color',
    'rgb(20, 22, 25)',
  );
  await expect(page.locator('.state-card.coastal:not(.placed)').first()).toHaveCSS(
    'background-color',
    'rgb(21, 57, 95)',
  );
  await page.locator('#theme-button').click();
  await expect(page.locator('.state-card.coastal:not(.placed)').first()).toHaveCSS(
    'background-image',
    /linear-gradient/,
  );
});
