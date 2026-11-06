import { test, expect } from '@playwright/test';
import { CODES } from '../src/data.js';
import { canAdd, findContinuation, newEasyGame } from '../src/game.js';
import { easyHand } from '../src/easy.js';
import { emptySave, STORAGE_KEY } from '../src/storage.js';

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function seed(page, game, extras = {}) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!sessionStorage.getItem('easy-seeded')) {
        localStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem('easy-seeded', '1');
      }
    },
    { key: STORAGE_KEY, data: { ...emptySave(), game, ...extras } },
  );
  await page.goto('/');
}

test('Easy defaults to four neutral cards, persists selection, and switches both ways', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#difficulty-easy')).toBeChecked();
  await expect(page.locator('.state-card')).toHaveCount(4);
  await expect(page.locator('#cards')).not.toContainText('COAST');
  await expect(page.locator('.state-card.coastal, .state-card.hard')).toHaveCount(0);
  const first = (await saved(page)).game.hand;
  await page.reload();
  expect((await saved(page)).game.hand).toEqual(first);
  await selectDifficulty(page, 'challenging');
  await expect(page.locator('.state-card')).toHaveCount(24);
  await page.reload();
  await expect(page.locator('#difficulty-challenging')).toBeChecked();
  await selectDifficulty(page, 'easy');
  await expect(page.locator('.state-card')).toHaveCount(4);
  await page.locator('#new-game').click();
  expect((await saved(page)).game.difficulty).toBe('easy');
});

test('Easy handles one valid choice, mistakes, hints, reload, map undo, and deadline', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const game = {
    ...newEasyGame(),
    route: ['ME'],
    hand: easyHand(['ME']),
    sweep: { origin: 'ME', progress: 0, multiplier: 1 },
  };
  await seed(page, game);
  const invalid = game.hand.find((code) => code !== 'NH');
  await page.locator(`[data-card="${invalid}"]`).click();
  await expect(page.locator('#score')).toHaveText('0 pts');
  expect((await saved(page)).game.hand).toEqual(game.hand);
  expect((await saved(page)).game.sweep.multiplier).toBe(1.35);
  await page.locator('#hint-button').click();
  await expect(page.locator('#message')).toHaveText('Play NH');
  await page.locator('[data-card="NH"]').click();
  await expect(page.locator('#score')).toHaveText('0 pts');
  const after = (await saved(page)).game;
  expect(after.zeroCards).toEqual(['NH']);
  expect(after.sweep.origin).toBe('ME');
  await page.reload();
  expect((await saved(page)).game.hand).toEqual(after.hand);
  await page.locator('[data-chain="NH"]').click();
  expect((await saved(page)).game.route).toEqual(['ME']);
  await expect(page.locator('[data-card="NH"]')).toBeVisible();
  await page.locator('[data-card="NH"]').press('Enter');
  await expect(page.locator('[data-chain="NH"]')).toBeVisible();
  expect((await saved(page)).game.zeroCards).toEqual(['NH']);
});

test('Easy seals are local decorative backgrounds and missing images never block play', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requested = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.png')) requested.push(request.url());
  });
  await page.route('**/MA*.png', (route) => route.abort());
  await seed(page, { ...newEasyGame(), hand: ['WA', 'MA', 'NC', 'SC'] });
  await expect(page.locator('.state-card .card-seal')).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator('.state-card .card-seal')
        .evaluateAll((images) => images.every((image) => image.complete)),
    )
    .toBe(true);
  expect(new Set(requested).size).toBe(4);
  for (const url of requested) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(new URL(url).pathname).toMatch(
      /\/assets\/(?:img\/seals\/)?(WA|MA|NC|SC)(?:-[A-Z0-9]+)?\.png$/,
    );
  }
  const seal = page.locator('[data-card="WA"] .card-seal');
  await expect(seal).toHaveAttribute('alt', '');
  await expect(seal).toHaveAttribute('aria-hidden', 'true');
  await expect(seal).toHaveCSS('opacity', '0.12');
  await expect(seal).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('[data-card="WA"]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-card="WA"] .card-name')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: /^Massachusetts,/ }).click();
  await expect(page.locator('[data-chain="MA"]')).toBeVisible();
  await expect(page.locator('.state-card .card-seal')).toHaveCount(4);
  await selectDifficulty(page, 'challenging');
  await expect(page.locator('.state-card')).toHaveCount(24);
  await expect(page.locator('.state-card .card-seal')).toHaveCount(24);
});

test('Easy win omits reference solutions and switches to Challenging from the result toggle', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const game = { ...newEasyGame(), hand: ['CA', 'OR', 'ME', 'FL'] };
  await seed(page, game, { easyPersonalBests: { points: 100, playSeconds: 10000 } });
  for (let step = 0; step < 48; step++) {
    const current = (await saved(page)).game;
    if (current.status === 'won') break;
    const valid = current.hand.filter((code) => canAdd(CODES, current.route, code));
    valid.sort(
      (a, b) =>
        findContinuation(CODES, [...current.route, a]).length -
        findContinuation(CODES, [...current.route, b]).length,
    );
    await page.locator(`[data-card="${valid[0]}"]`).click();
  }
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#result-route')).toContainText('pts');
  await expect(page.locator('#record-message')).toHaveText('New record: best time!');
  await expect(page.locator('#best-points-stat')).toBeHidden();
  await expect(page.locator('#solutions')).toBeEmpty();
  const win = await saved(page);
  expect(win.easyWins).toBe(1);
  expect(win.wins).toBe(0);
  await expect(page.getByRole('switch', { name: /Finding this too easy/ })).toBeVisible();
  await page.getByRole('switch', { name: /Finding this too easy/ }).check();
  await expect(page.locator('#result-dialog')).not.toBeVisible();
  await expect(page.locator('#difficulty-challenging')).toBeChecked();
  await expect(page.locator('.state-card')).toHaveCount(24);
  expect((await saved(page)).difficulty).toBe('challenging');
  await page.reload();
  await expect(page.locator('#difficulty-challenging')).toBeChecked();
});

test('Easy cards and map stay usable without horizontal overflow at phone and tablet widths', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { ...newEasyGame(), hand: ['WA', 'MA', 'NC', 'SC'] });
  for (const [width, height] of [
    [320, 568],
    [360, 780],
    [650, 850],
    [768, 1024],
    [1024, 768],
    [915, 412],
    [568, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.state-card')).toHaveCount(4);
    await expect(page.locator('.state-card > strong')).toHaveCount(0);
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      cards: [...document.querySelectorAll('.state-card')].map((card) => ({
        width: card.getBoundingClientRect().width,
        height: card.getBoundingClientRect().height,
        contentFits: card.scrollHeight <= card.clientHeight,
        nameFits:
          card.querySelector('.card-name').scrollHeight <=
          card.querySelector('.card-name').clientHeight,
        nameFont: parseFloat(getComputedStyle(card.querySelector('.card-name')).fontSize),
      })),
      map: document.querySelector('.map-wrap').getBoundingClientRect().height,
    }));
    expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.map).toBeGreaterThanOrEqual(120);
    for (const card of geometry.cards) {
      expect(card.width).toBeGreaterThanOrEqual(44);
      expect(card.height).toBeGreaterThanOrEqual(44);
      expect(card.contentFits).toBe(true);
      expect(card.nameFits).toBe(true);
      expect(card.nameFont).toBeGreaterThanOrEqual(16);
    }
  }
});

test('Galaxy S25-sized touch layouts center full Easy names and keep play usable after rotation', async ({
  browser,
  baseURL,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'Explicit Android-sized mobile emulation');
  // Standard S25 display: 1080 × 2340 physical pixels at 3× density.
  // Also exercise the smaller viewport left by browser controls and landscape.
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 360, height: 780 },
    screen: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await seed(page, { ...newEasyGame(), hand: ['WA', 'MA', 'NC', 'SC'] });
    for (const [width, height] of [
      [360, 780],
      [360, 650],
      [780, 360],
      [780, 280],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('.state-card > strong')).toHaveCount(0);
      await expect
        .poll(() =>
          page
            .locator('.state-card .card-seal')
            .evaluateAll(
              (images) =>
                images.length === 4 &&
                images.every((image) => image.complete && image.naturalWidth === 120),
            ),
        )
        .toBe(true);
      const geometry = await page.evaluate(() => ({
        overflow:
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
        mapHeight: document.querySelector('.map-wrap').getBoundingClientRect().height,
        cards: [...document.querySelectorAll('.state-card')].map((card) => {
          const name = card.querySelector('.card-name');
          const bounds = card.getBoundingClientRect();
          const text = name.getBoundingClientRect();
          const header = card.querySelector('.card-top').getBoundingClientRect();
          return {
            width: bounds.width,
            height: bounds.height,
            xOffset: Math.abs((text.left + text.right - bounds.left - bounds.right) / 2),
            yOffset: Math.abs((text.top + text.bottom - bounds.top - bounds.bottom) / 2),
            nameFits:
              name.scrollHeight <= name.clientHeight && name.scrollWidth <= name.clientWidth,
            overlapsHeader: text.top < header.bottom,
            textAlign: getComputedStyle(name).textAlign,
          };
        }),
      }));
      expect(geometry.overflow).toBe(false);
      expect(geometry.mapHeight).toBeGreaterThanOrEqual(height < 320 ? 100 : 120);
      for (const card of geometry.cards) {
        expect(card.width).toBeGreaterThanOrEqual(44);
        expect(card.height).toBeGreaterThanOrEqual(44);
        expect(card.xOffset).toBeLessThanOrEqual(1);
        expect(card.yOffset).toBeLessThanOrEqual(1);
        expect(card.nameFits).toBe(true);
        expect(card.overlapsHeader).toBe(false);
        expect(card.textAlign).toBe('center');
      }
      for (const card of await page.locator('.state-card').all()) {
        await card.scrollIntoViewIfNeeded();
        const bounds = await card.boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      }
      if (width === 360 && height === 780)
        await page.screenshot({ path: testInfo.outputPath('galaxy-s25-easy.png') });
    }
    await page.setViewportSize({ width: 360, height: 780 });
    await page.getByRole('button', { name: /^Massachusetts,/ }).tap();
    await expect(page.locator('[data-chain="MA"]')).toBeVisible();
    await expect(page.locator('.state-card')).toHaveCount(4);
    await expect(page.locator('.state-card > strong')).toHaveCount(0);
    await page.locator('#difficulty-select').focus();
    await page.locator('#difficulty-select').press('End');
    await page.locator('#difficulty-select').press('Enter');
    await expect(page.locator('.state-card')).toHaveCount(24);
    await expect(page.locator('.state-card > strong')).toHaveCount(24);
  } finally {
    await context.close();
  }
});
import { selectDifficulty } from './controls.js';
