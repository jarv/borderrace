import { test, expect } from '@playwright/test';
import { newGame } from '../src/game.js';
import { coast } from '../src/data.js';
import { emptySave, STORAGE_KEY } from '../src/storage.js';

async function seed(page) {
  const game = newGame();
  const gold = game.deal.find(coast);
  game.scoring = 'hard-v1';
  game.cardPoints = Object.fromEntries(game.deal.map((code) => [code, code === gold ? 3 : 1]));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY,
    data: { ...emptySave(), difficulty: 'challenging', game },
  });
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(24);
  return gold;
}

test('Challenging uses small faded seals behind opaque text and difficulty markers in both themes', async ({
  page,
  isMobile,
}, testInfo) => {
  const requested = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && new URL(request.url()).pathname.endsWith('.png'))
      requested.push(request.url());
  });
  const gold = await seed(page);
  await expect(page.locator('.state-card .card-seal')).toHaveCount(24);
  await expect(page.locator('#cards')).not.toContainText('COAST');
  await expect
    .poll(() =>
      page
        .locator('.state-card .card-seal')
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth === 60),
        ),
    )
    .toBe(true);
  expect(new Set(requested).size).toBe(24);
  for (const url of requested) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(new URL(url).pathname).toMatch(/\/assets\/img\/seals\/small_60\/[A-Z]{2}\.png$/);
  }
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#theme-button').click();
    const seal = page.locator(`[data-card="${gold}"] .card-seal`);
    await expect(seal).toHaveAttribute('alt', '');
    await expect(seal).toHaveAttribute('aria-hidden', 'true');
    await expect(seal).toHaveCSS('opacity', '0.1');
    await expect(seal).toHaveCSS('pointer-events', 'none');
    const geometry = await page.locator(`[data-card="${gold}"]`).evaluate((card) => ({
      opacity: getComputedStyle(card).opacity,
      text: getComputedStyle(card.querySelector('strong')).opacity,
      textLayer: getComputedStyle(card.querySelector('strong')).zIndex,
      imageLayer: getComputedStyle(card.querySelector('.card-seal')).zIndex,
      width: card.querySelector('.card-seal').getBoundingClientRect().width,
    }));
    expect(geometry).toMatchObject({ opacity: '1', text: '1', textLayer: '1', imageLayer: '0' });
    expect(geometry.width).toBeLessThanOrEqual(60);
    const centers = await page.locator('.state-card').evaluateAll((cards) =>
      cards.map((card) => {
        const abbreviation = card.querySelector('strong');
        const range = document.createRange();
        range.selectNodeContents(abbreviation);
        const text = range.getBoundingClientRect();
        const seal = card.querySelector('.card-seal').getBoundingClientRect();
        return {
          text: abbreviation.textContent,
          code: card.dataset.card,
          offset: Math.abs((text.left + text.right - seal.left - seal.right) / 2),
        };
      }),
    );
    for (const center of centers) {
      expect(center.text).toBe(center.code);
      expect(center.offset).toBeLessThanOrEqual(1);
    }
    await expect(page.locator(`[data-card="${gold}"] .bonus-star`)).toBeVisible();
    await expect(page.locator(`[data-card="${gold}"] .card-top .bonus-star`)).toBeVisible();
    if (isMobile)
      await page.screenshot({
        path: testInfo.outputPath(`challenging-seals-${theme}.png`),
        scale: 'css',
      });
  }
  await page.locator(`[data-card="${gold}"]`).click();
  await expect(page.locator('#score')).toHaveText('3 pts');
  await expect(page.locator(`[data-chain="${gold}"]`)).toBeVisible();
  await expect(page.locator('#map .card-seal, #map-chain .card-seal')).toHaveCount(0);
});

test('missing small seals do not block keyboard play in Challenging', async ({ page }) => {
  await page.route('**/small_60/*.png', (route) => route.abort());
  const gold = await seed(page);
  await expect
    .poll(() =>
      page
        .locator('.state-card .card-seal')
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth === 0),
        ),
    )
    .toBe(true);
  await page.locator(`[data-card="${gold}"]`).focus();
  await page.locator(`[data-card="${gold}"]`).press('Enter');
  await expect(page.locator(`[data-chain="${gold}"]`)).toBeVisible();
  await expect(page.locator('#score')).toHaveText('3 pts');
});

test('background preloading requests all 96 local seal sizes once without delaying play', async ({
  page,
}) => {
  const warmed = new Set();
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' && new URL(request.url()).pathname.endsWith('.png'))
      warmed.add(request.url());
  });
  const gold = await seed(page);
  await page.locator(`[data-card="${gold}"]`).click();
  await expect(page.locator(`[data-chain="${gold}"]`)).toBeVisible();
  await expect.poll(() => warmed.size).toBe(96);
  expect([...warmed].filter((url) => url.includes('/small_60/'))).toHaveLength(48);
  for (const url of warmed) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  await page.locator('#new-game').click();
  await expect(page.locator('.state-card')).toHaveCount(24);
  expect(warmed.size).toBe(96);
});

test('four pending preload downloads cannot delay keyboard play or New game', async ({ page }) => {
  const held = [];
  await page.route('**/*.png', (route) => {
    if (route.request().resourceType() === 'fetch') held.push(route);
    else return route.continue();
  });
  const gold = await seed(page);
  await expect.poll(() => held.length).toBe(4);
  await page.locator(`[data-card="${gold}"]`).focus();
  await page.locator(`[data-card="${gold}"]`).press('Enter');
  await expect(page.locator(`[data-chain="${gold}"]`)).toBeVisible();
  await page.locator('#new-game').click();
  await expect(page.locator('.map-card')).toHaveCount(0);
  expect(held).toHaveLength(4);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
