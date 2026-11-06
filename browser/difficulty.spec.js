import { test, expect } from '@playwright/test';
import { newEasyGame, newGame, createDeal, canAdd, findContinuation, score } from '../src/game.js';
import { CODES } from '../src/data.js';
import { emptySave, STORAGE_KEY } from '../src/storage.js';
import { isHardCard, pointsFromCounts } from '../src/scoring.js';
import { countWinningRoutes } from '../src/route-count.js';

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function seedMedium(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ key, save }) => {
      if (!sessionStorage.getItem('medium-seeded')) {
        localStorage.setItem(key, JSON.stringify(save));
        sessionStorage.setItem('medium-seeded', '1');
      }
    },
    {
      key: STORAGE_KEY,
      save: {
        ...emptySave(),
        difficulty: 'medium',
        game: { ...newEasyGame(Math.random, 'medium'), hand: ['WA', 'MA', 'NC', 'SC', 'CA', 'FL'] },
      },
    },
  );
  await page.goto('/');
}

test('three radio-style difficulty choices persist, support keyboard selection, and set new card values', async ({
  page,
}) => {
  await page.goto('/');
  const mobile = await page.locator('#difficulty-select').isVisible();
  await expect(page.getByRole('radio')).toHaveCount(mobile ? 0 : 3);
  await expect(page.locator('#difficulty-easy')).toBeChecked();
  await expect(page.locator('#difficulty select')).toHaveCount(0);
  await selectDifficulty(page, 'medium');
  await expect(page.locator('.state-card')).toHaveCount(6);
  expect(Object.values((await saved(page)).game.cardPoints)).toEqual(Array(48).fill(2));
  await page.reload();
  await expect(page.locator('#difficulty-medium')).toBeChecked();
  await expect(page.locator('#difficulty-select')).toHaveValue('medium');
  if (mobile) {
    await page.locator('#difficulty-select').focus();
    await page.locator('#difficulty-select').press('End');
    await page.locator('#difficulty-select').press('Enter');
  } else {
    await page.locator('#difficulty-medium').focus();
    await page.locator('#difficulty-medium').press('ArrowRight');
  }
  await expect(page.locator('#difficulty-challenging')).toBeChecked();
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  const hard = (await saved(page)).game;
  expect(Object.values(hard.cardPoints).every((value) => value === 3 || value === 4)).toBe(true);
  const code = hard.deal.find((code) => isHardCard(hard, code));
  if (code)
    await expect(page.locator(`[data-card="${code}"]`)).toHaveAccessibleName(/4 points, hard card/);
  await selectDifficulty(page, 'easy');
  await expect(page.locator('.state-card')).toHaveCount(4);
  expect(Object.values((await saved(page)).game.cardPoints)).toEqual(Array(48).fill(1));
});

test('Medium handles two-point mistakes, zero-point hints, reload and undo with six frozen choices', async ({
  page,
}) => {
  await seedMedium(page);
  await expect(page.locator('#hand-count')).toHaveText('6 STATES');
  await page.locator('[data-card="CA"]').click();
  await expect(page.locator('#score')).toHaveText('2 pts');
  let game = (await saved(page)).game;
  const invalid = game.hand.find((code) => !canAdd(CODES, game.route, code));
  await page.locator(`[data-card="${invalid}"]`).click();
  await expect(page.locator('#score')).toHaveText('0 pts');
  expect((await saved(page)).game.hand).toEqual(game.hand);
  await page.locator('#hint-button').click();
  const valid = game.hand.find((code) => canAdd(CODES, game.route, code));
  await page.locator(`[data-card="${valid}"]`).click();
  game = (await saved(page)).game;
  expect(game.zeroCards).toEqual([valid]);
  await page.reload();
  expect((await saved(page)).game.hand).toEqual(game.hand);
  await page.locator(`[data-chain="${valid}"]`).click();
  await expect(page.locator('.state-card')).toHaveCount(6);
  expect((await saved(page)).game.zeroCards).toEqual([valid]);
  await page.locator('#help-button').click();
  await expect(page.locator('#help-easy')).toContainText('Each card earns 2 points');
});

test('compact controls share one touch-sized row and preserve play across rotation and theme changes', async ({
  page,
}, testInfo) => {
  await seedMedium(page);
  await page.locator('[data-card="CA"]').click();
  const before = (await saved(page)).game;
  for (const [width, height] of [
    [320, 568],
    [360, 780],
    [393, 852],
    [650, 850],
    [780, 360],
  ]) {
    await page.setViewportSize({ width, height });
    if (!(await page.locator('#difficulty-select').isVisible())) continue;
    await expect(page.getByRole('combobox', { name: 'Difficulty' })).toHaveValue('medium');
    const geometry = await page.evaluate(() => {
      const rect = (element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        row: rect(document.querySelector('.game-controls')),
        controls: [
          '#difficulty-select',
          '#hint-button',
          '#sound-button',
          '#help-button',
          '#theme-button',
          '#new-game',
        ].map((selector) => rect(document.querySelector(selector))),
        overflow: document.documentElement.scrollWidth > innerWidth,
        map: rect(document.querySelector('.map-wrap')),
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.row.height).toBeLessThanOrEqual(54);
    let end = geometry.row.x;
    for (const control of geometry.controls) {
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.y, JSON.stringify({ width, height, geometry })).toBe(geometry.controls[0].y);
      expect(control.x).toBeGreaterThanOrEqual(end);
      end = control.x + control.width;
    }
    expect(end).toBeLessThanOrEqual(geometry.row.x + geometry.row.width);
    expect(geometry.map.y).toBeGreaterThanOrEqual(geometry.row.y + geometry.row.height);
    await expect(page.locator('.map-card')).toHaveCSS('border-top-width', '1px');
    if (width === 360)
      await page.screenshot({ path: testInfo.outputPath('galaxy-s25-controls.png'), scale: 'css' });
    await page.locator('#theme-button').click();
    expect((await saved(page)).game.id).toBe(before.id);
    expect((await saved(page)).game.route).toEqual(before.route);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('#difficulty-medium')).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.locator('.map-card')).toHaveCSS('border-top-width', '2px');
  expect((await saved(page)).game.id).toBe(before.id);
  await page.setViewportSize({ width: 360, height: 780 });
  await selectDifficulty(page, 'easy');
  await expect(page.locator('.state-card')).toHaveCount(4);
  expect((await saved(page)).game.id).not.toBe(before.id);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Difficulty' })).toHaveValue('easy');
});

test('Medium wins keep their own records and omit Challenging reference solutions', async ({
  page,
}) => {
  await seedMedium(page);
  for (let step = 0; step < 48; step++) {
    const game = (await saved(page)).game;
    if (game.status === 'won') break;
    const valid = game.hand.filter((code) => canAdd(CODES, game.route, code));
    valid.sort(
      (a, b) =>
        findContinuation(CODES, [...game.route, a]).length -
        findContinuation(CODES, [...game.route, b]).length,
    );
    await page.locator(`[data-card="${valid[0]}"]`).click();
  }
  await expect(page.locator('#result-dialog')).toBeVisible();
  const win = await saved(page);
  expect(win.mediumWins).toBe(1);
  expect(win.easyWins).toBe(0);
  expect(win.wins).toBe(0);
  expect(win.mediumRecords[0].points).toBe(win.game.route.length * 2);
  await expect(page.locator('#solutions')).toBeEmpty();
  await expect(page.locator('#best-points-stat')).toBeHidden();
  await page.locator('#result-dialog [data-close]').click();
  await page.locator('#records-button').click();
  await expect(page.locator('#records-title')).toHaveText('Your scores · Medium');
  await page.locator('#clear-scores').click();
  expect((await saved(page)).mediumRecords).toEqual([]);
  expect((await saved(page)).mediumWins).toBe(0);
});

test('Medium retains the visible map, six usable name cards, and single-row radio controls on small screens', async ({
  page,
}, testInfo) => {
  await seedMedium(page);
  for (const [width, height] of [
    [320, 568],
    [360, 780],
    [650, 850],
    [768, 844],
    [1024, 844],
    [780, 360],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      desktop: innerWidth >= 761 && matchMedia('(pointer: fine)').matches,
      map: document.querySelector('.map-wrap').getBoundingClientRect().height,
      radios: [...document.querySelectorAll('.difficulty-control label, #difficulty-select')]
        .filter((element) => element.getBoundingClientRect().width > 0)
        .map((label) => ({
          x: label.getBoundingClientRect().x,
          y: label.getBoundingClientRect().y,
          width: label.getBoundingClientRect().width,
          height: label.getBoundingClientRect().height,
        })),
      cards: [...document.querySelectorAll('.state-card')].map((card) => ({
        row: card.offsetTop,
        column: card.offsetLeft,
        width: card.getBoundingClientRect().width,
        height: card.getBoundingClientRect().height,
        clipped:
          card.querySelector('.card-name').scrollHeight >
          card.querySelector('.card-name').clientHeight,
      })),
    }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.map).toBeGreaterThanOrEqual(120);
    expect(geometry.cards.length).toBe(6);
    expect(new Set(geometry.cards.map((card) => card.column)).size).toBe(geometry.desktop ? 2 : 3);
    expect(new Set(geometry.cards.map((card) => card.row)).size).toBe(geometry.desktop ? 3 : 2);
    for (const card of geometry.cards) {
      expect(card.width).toBeGreaterThanOrEqual(44);
      expect(card.height).toBeGreaterThanOrEqual(44);
      expect(card.clipped).toBe(false);
    }
    for (const radio of geometry.radios) {
      expect(radio.width).toBeGreaterThanOrEqual(44);
      expect(radio.height).toBeGreaterThanOrEqual(44);
      expect(radio.x + radio.width).toBeLessThanOrEqual(width);
      expect(radio.y).toBe(geometry.radios[0].y);
    }
    if (width === 360)
      await page.screenshot({ path: testInfo.outputPath('medium-phone.png'), scale: 'css' });
  }
});

test('new Challenging scoring renders 3/4-point cards, applies their penalties, and scores the win consistently', async ({
  page,
}) => {
  let seed = 7;
  const deal = createDeal(() => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const cardPoints = pointsFromCounts(deal, countWinningRoutes(deal));
  const game = { ...newGame(), deal, cardPoints };
  const path = findContinuation(deal, ['OR']);
  const next = path[1];
  expect(cardPoints.OR).toBe(4);
  expect(cardPoints[next]).toBe(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), {
    key: STORAGE_KEY,
    save: { ...emptySave(), difficulty: 'challenging', game },
  });
  await page.goto('/');
  await expect(page.locator('[data-card="OR"]')).toHaveAccessibleName(/4 points, hard card/);
  await expect(page.locator(`[data-card="${next}"]`)).not.toHaveClass(/hard/);
  await page.locator('[data-card="OR"]').click();
  await expect(page.locator('[data-chain="OR"]')).toHaveClass(/hard/);
  await expect(page.locator('#score')).toHaveText('4 pts');
  await page.locator('[data-card="GA"]').click();
  await expect(page.locator('#score')).toHaveText('0 pts');
  await page.locator(`[data-card="${next}"]`).click();
  await expect(page.locator('#score')).toHaveText('3 pts');
  await page.locator(`[data-card="${next}"]`).click();
  await page.locator('#hint-button').click();
  await page.locator(`[data-card="${next}"]`).click();
  await expect(page.locator('#score')).toHaveText('0 pts');
  for (const code of path.slice(2)) await page.locator(`[data-card="${code}"]`).click();
  await expect(page.locator('#result-dialog')).toBeVisible();
  expect((await saved(page)).records[0].points).toBe(score(path, [next], 4, cardPoints));
  await expect(page.locator('#solutions .solution-chain')).toBeVisible();
  await expect(page.locator('#result-route')).toContainText(
    `${score(path, [next], 4, cardPoints)} pts`,
  );
});
import { selectDifficulty } from './controls.js';
