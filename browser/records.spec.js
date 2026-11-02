import { test, expect } from '@playwright/test';
import { CODES } from '../src/data.js';
import { STORAGE_KEY, emptySave } from '../src/storage.js';

const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
const game = (overrides = {}) => ({
  id: 'timed-win',
  deal,
  route: [],
  zeroCards: [],
  hintPending: false,
  mistakePoints: 0,
  scoring: 'base-v1',
  cardPoints: Object.fromEntries(deal.map((code) => [code, 1])),
  status: 'playing',
  playSeconds: 0,
  ...overrides,
});

async function seed(page, save, motion = 'reduce') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-01T12:01:00Z'));
  await page.addInitScript(
    ({ key, save }) => {
      if (!sessionStorage.getItem('records-seeded')) {
        localStorage.setItem(key, JSON.stringify(save));
        sessionStorage.setItem('records-seeded', '1');
      }
    },
    { key: STORAGE_KEY, save },
  );
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(24);
}
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const play = (page, code) => page.locator(`[data-card="${code}"]`).dispatchEvent('click');

test('best time counts visible play only, persists across reload, and first wins set a baseline', async ({
  page,
}) => {
  await seed(page, { ...emptySave(), game: game() });
  await page.clock.runFor(5000);
  expect((await saved(page)).game.playSeconds).toBe(0);
  await play(page, 'CA');
  await page.clock.runFor(2000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = (await saved(page)).game.playSeconds;
  expect(paused).toBeCloseTo(2, 1);
  await page.clock.runFor(60000);
  expect((await saved(page)).game.playSeconds).toBe(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(3000);
  await page.reload();
  for (const code of route.slice(1)) await play(page, code);
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#best-time')).toHaveText('0:05.0');
  await expect(page.locator('#result-route h3')).toHaveText('Your route 7 pts · 0:05.0');
  await expect(page.locator('#best-points')).toHaveText('7 pts');
  await expect(page.locator('#record-message')).not.toBeVisible();
  const save = await saved(page);
  expect(save.records[0].playSeconds).toBe(5);
  expect(save.personalBests).toEqual({ points: 7, playSeconds: 5 });
});

for (const motion of ['no-preference', 'reduce']) {
  test(`new personal records are announced and respect motion=${motion}`, async ({ page }) => {
    await seed(
      page,
      {
        ...emptySave(),
        wins: 1,
        played: 1,
        records: [{ id: 'previous', points: 6, playSeconds: 20 }],
        personalBests: { points: 6, playSeconds: 20 },
        game: game({ route: route.slice(0, -1), playSeconds: 12.3 }),
      },
      motion,
    );
    await play(page, 'NC');
    if (motion === 'no-preference') await page.clock.runFor(2000);
    await expect(page.locator('#result-dialog')).toBeVisible();
    await expect(page.locator('#best-time')).toHaveText('0:12.3');
    await expect(page.locator('#result-route h3')).toHaveText('Your route 7 pts · 0:12.3');
    await expect(page.locator('#best-points')).toHaveText('7 pts');
    await expect(page.locator('#record-message')).toHaveText(
      'New records: best time and most points!',
    );
    await expect(page.locator('.new-personal-record')).toHaveCount(2);
    const animations = await page
      .locator('#personal-bests')
      .evaluate((el) => el.getAnimations({ subtree: true }).length);
    expect(animations > 0).toBe(motion === 'no-preference');
    await page.reload();
    await expect(page.locator('#result-dialog')).toBeVisible();
    await expect(page.locator('#result-route h3')).toHaveText('Your route 7 pts · 0:12.3');
    await expect(page.locator('#record-message')).not.toBeVisible();
    await expect(page.locator('.new-personal-record')).toHaveCount(0);
    expect((await saved(page)).wins).toBe(2);
  });
}

test('clearing scores resets personal bests without resetting the active clock', async ({
  page,
}) => {
  const active = game({ route: ['CA'], playSeconds: 3 });
  await seed(page, {
    ...emptySave(),
    wins: 1,
    played: 1,
    personalBests: { points: 20, playSeconds: 10 },
    records: [{ id: 'old', points: 20, playSeconds: 10 }],
    game: active,
  });
  await page.locator('#records-button').click();
  await page.locator('#clear-scores').click();
  const save = await saved(page);
  expect(save.personalBests).toEqual({ points: null, playSeconds: null });
  expect(save.game.playSeconds).toBe(3);
  expect(save.game.route).toEqual(['CA']);
});
