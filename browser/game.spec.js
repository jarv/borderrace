import { test, expect } from '@playwright/test';
import { CODES, STATES } from '../src/data.js';
import { STORAGE_KEY, emptySave } from '../src/storage.js';
import {
  findLongestRoute,
  findMostPointsRoute,
  findContinuation,
  planCompletion,
  createDeal,
  score,
} from '../src/game.js';
import { countWinningRoutes } from '../src/route-count.js';
import { pointsFromCounts, SCORING_VERSION } from '../src/scoring.js';

const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
const fixture = (overrides = {}) => ({
  id: 'test-game',
  deal,
  route: [],
  zeroCards: [],
  hintPending: false,
  status: 'playing',
  ...overrides,
});
let hardSeed = 7;
const hardDeal = createDeal(
  () => (hardSeed = (Math.imul(hardSeed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
);
const hardPoints = pointsFromCounts(hardDeal, countWinningRoutes(hardDeal));
const modernFixture = (overrides = {}) =>
  fixture({ deal: hardDeal, scoring: SCORING_VERSION, cardPoints: hardPoints, ...overrides });

async function seed(page, game = fixture()) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!sessionStorage.getItem('test-seeded')) {
        localStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem('test-seeded', '1');
      }
    },
    { key: STORAGE_KEY, data: { ...emptySave(), game } },
  );
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(24);
}
async function press(locator, mobile) {
  if (mobile) await locator.tap();
  else await locator.click();
}
async function saved(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

test('hard cards are gold, worth three points, and retain their frozen values after reload', async ({
  page,
  isMobile,
}) => {
  await seed(page, modernFixture());
  await expect(page.locator('.state-card.hard')).toHaveCount(3);
  await expect(page.locator('[data-card="OR"]')).toHaveAccessibleName(/3 points, hard card/);
  await expect(page.locator('[data-card="OR"]')).toHaveCSS(
    'border-top-color',
    'rgb(255, 210, 121)',
  );
  await expect(page.locator('[data-card="NM"] .card-points')).toHaveText('1 PT');
  await press(page.locator('[data-card="OR"]'), isMobile);
  await expect(page.locator('#score')).toHaveText('3 pts');
  await expect(page.locator('[data-chain="OR"]')).toHaveClass(/hard/);
  await press(page.locator('[data-card="GA"]'), isMobile);
  await expect(page.locator('#message')).toContainText('−3 pts');
  await expect(page.locator('#score')).toHaveText('0 pts');
  await page.reload();
  expect((await saved(page)).game.cardPoints).toEqual(hardPoints);
  await expect(page.locator('[data-chain="OR"] small')).toHaveText('3 PTS');
  await press(page.locator('#hint-button'), isMobile);
  await press(page.locator('[data-card="CA"]'), isMobile);
  await expect(page.locator('#score')).toHaveText('0 pts');
  expect((await saved(page)).game.zeroCards).toEqual(['CA']);
});

test('preparation shows a spinner, blocks play, and ignores superseded scoring results', async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.heldScoring = [];
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).endsWith('/scoring-worker.js')) {
          this.postMessage = (data) => window.heldScoring.push({ worker: this, data });
        }
      }
    };
    window.releaseScoring = () => {
      const { worker, data } = window.heldScoring.at(-1);
      NativeWorker.prototype.postMessage.call(worker, data);
    };
  });
  await seed(page);
  await press(page.locator('#new-game'), isMobile);
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#message')).toHaveText('Preparing cards…');
  await expect(page.locator('.state-card').first()).toBeDisabled();
  await expect(page.locator('#hint-button')).toBeDisabled();
  await expect(page.locator('#end-game')).toBeDisabled();
  expect(
    await page
      .locator('#message')
      .evaluate((element) => getComputedStyle(element, '::before').content),
  ).not.toBe('none');
  await page.locator('.state-card').first().dispatchEvent('click');
  expect((await saved(page)).game.route).toEqual([]);
  const firstId = (await saved(page)).game.id;
  await press(page.locator('#new-game'), isMobile);
  expect((await saved(page)).game.id).not.toBe(firstId);
  await page.evaluate(() => {
    const { worker, data } = window.heldScoring[0];
    worker.onmessage({
      data: {
        gameId: data.gameId,
        cardPoints: Object.fromEntries(data.deal.map((code) => [code, 3])),
      },
    });
  });
  expect((await saved(page)).game.cardPoints).toBeNull();
  await page.evaluate(() => window.releaseScoring());
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  const game = (await saved(page)).game;
  expect(game.scoring).toBe(SCORING_VERSION);
  expect(Object.values(game.cardPoints)).toContain(3);
  expect(game.cardPoints).toEqual(pointsFromCounts(game.deal, countWinningRoutes(game.deal)));
  await expect(page.locator('.state-card').first()).toBeEnabled();
});

test('connectors disappear on undo and New game, including normal and reduced motion', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion });
    // Restore a fixed, already-scored legacy deal between motion variants.
    await page.evaluate(
      ({ key, game }) => {
        const data = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...data, game }));
      },
      { key: STORAGE_KEY, game: fixture() },
    );
    await page.reload();
    for (const code of ['CA', 'AZ']) await press(page.locator(`[data-card="${code}"]`), isMobile);
    await expect(page.locator('.row-line')).toBeVisible();
    await expect(page.locator('.row-line polyline')).toHaveCount(1);
    await press(page.locator('[data-card="AZ"]'), isMobile);
    await expect(page.locator('.row-line')).toBeHidden();
    await expect(page.locator('.row-line polyline')).toHaveCount(0);
    await press(page.locator('[data-card="AZ"]'), isMobile);
    await expect(page.locator('.row-line')).toBeVisible();
    await press(page.locator('#new-game'), isMobile);
    await expect(page.locator('.row-line')).toBeHidden();
    await expect(page.locator('.row-line polyline')).toHaveCount(0);
    await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('[data-chain]')).toHaveCount(0);
    expect(await page.locator('.state-card.hard').count()).toBeGreaterThanOrEqual(1);
  }
});

test('older hard-card games keep their saved points without a forced reroll', async ({ page }) => {
  const original = modernFixture({
    scoring: 'hard-v1',
    cardPoints: Object.fromEntries(hardDeal.map((code) => [code, 1])),
    route: ['OR'],
  });
  await seed(page, original);
  await expect(page.locator('[data-chain="OR"] small')).toHaveText('1 PT');
  await expect(page.locator('.state-card.hard')).toHaveCount(0);
  await page.reload();
  expect((await saved(page)).game).toEqual(original);
});

test('unavailable analysis falls back explicitly to fixed one-point cards', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        if (String(url).endsWith('/scoring-worker.js')) throw new Error('Blocked worker');
        super(url, options);
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('#message')).toHaveText('Bonus unavailable. All cards: 1 pt.');
  await expect(page.locator('.state-card.hard')).toHaveCount(0);
  await expect(page.locator('.state-card').first()).toBeEnabled();
  const game = (await saved(page)).game;
  expect(game.scoring).toBe('base-v1');
  expect(Object.values(game.cardPoints)).toEqual(Array(24).fill(1));
});

test('hard-card values apply to results, reference solutions, and saved scores', async ({
  page,
  isMobile,
}) => {
  const path = findContinuation(hardDeal, ['OR']);
  await seed(
    page,
    modernFixture({ route: path.slice(0, -1), zeroCards: ['OR'], mistakePoints: 3 }),
  );
  await press(page.locator(`[data-card="${path.at(-1)}"]`), isMobile);
  const total = score(path, ['OR'], 3, hardPoints);
  await expect(page.locator('#result-route h3')).toHaveText(`Your route ${total} pts`);
  await expect(page.locator('#result-route .solution-card.hard')).toHaveCount(
    path.filter((code) => hardPoints[code] === 3).length,
  );
  for (const [label, solution] of [
    ['Most points', findMostPointsRoute(hardDeal, hardPoints, ['OR'])],
  ]) {
    await expect(
      page
        .locator('#solutions .solution-section')
        .filter({ has: page.locator(`ol[aria-label="${label}"]`) })
        .locator('h3'),
    ).toHaveText(`${label} ${score(solution, ['OR'], 0, hardPoints)} pts`);
  }
  expect((await saved(page)).records[0].points).toBe(total);
  await page.reload();
  await expect(page.locator('#result-route h3')).toHaveText(`Your route ${total} pts`);
  expect((await saved(page)).records).toHaveLength(1);
});

test('games are playable immediately with no wildcard, timer, start, or finish controls', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await expect(page.locator('#wild, #clock, #time-fill, #finish, #start')).toHaveCount(0);
  await expect(page.locator('#message')).toHaveText(
    'Select cards to cross the map. Start with a green coastal card. Gold cards are harder to use and worth 3 points.',
  );
  await expect(page.locator('body')).not.toContainText(/wildcard|five minutes/i);
  await press(page.locator('[data-card="CA"]'), isMobile);
  await expect(page.locator('#message')).toBeEmpty();
  expect((await saved(page)).game.status).toBe('playing');
  await page.reload();
  await expect(page.locator('[data-chain]')).toHaveCount(1);
  const game = (await saved(page)).game;
  expect(game).not.toHaveProperty('startedAt');
  expect(game).not.toHaveProperty('finishedAt');
});

test('connecting the coasts wins automatically and saves the result exactly once', async ({
  page,
  isMobile,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  for (const code of route) await press(page.locator(`[data-card="${code}"]`), isMobile);
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#result-title')).toHaveText('You win');
  await expect(page.locator('#result-route .solution-card')).toHaveCount(route.length);
  expect(await page.locator('#result-route .solution-card').allTextContents()).toEqual(route);
  await expect(page.locator('#result-route h3')).toHaveText('Your route 11 pts');
  expect((await saved(page)).records).toEqual([{ id: 'test-game', points: 11, route }]);
  expect((await saved(page)).wins).toBe(1);
  await page.reload();
  await expect(page.locator('#result-dialog')).toBeVisible();
  expect((await saved(page)).wins).toBe(1);
  expect(errors).toEqual([]);
});

test('invalid cards are rejected and undo removes a suffix', async ({ page, isMobile }) => {
  await seed(page);
  await press(page.locator('[data-card="AZ"]'), isMobile);
  await expect(page.locator('#message')).toHaveText('Choose a coastal card. −2 pts');
  await expect(page.locator('[data-chain]')).toHaveCount(0);
  for (const code of route.slice(0, 3))
    await press(page.locator(`[data-card="${code}"]`), isMobile);
  await press(page.locator('[data-card="NC"]'), isMobile);
  await expect(page.locator('#message')).toContainText('doesn’t border');
  await expect(page.locator('[data-chain]')).toHaveCount(3);
  await press(page.locator('[data-card="AZ"]'), isMobile);
  await expect(page.locator('[data-chain]')).toHaveCount(1);
  await expect(page.locator('#score')).toHaveText('-2 pts');
});

test('map messages never move the board and new games restore the starting prompt', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(60_000);
  await seed(page);
  const sizes = isMobile
    ? [
        [320, 568],
        [360, 640],
        [360, 780],
        [412, 915],
        [915, 412],
        [568, 320],
      ]
    : [
        [1440, 1000],
        [768, 844],
      ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    // Restore the seeded deal so assertions are independent of random new games.
    await page.evaluate(
      ({ key, game }) => {
        const data = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...data, game }));
      },
      { key: STORAGE_KEY, game: fixture() },
    );
    await page.reload();
    await expect(page.locator('#message')).toContainText('Start with a green coastal card.');
    const bounds = async () =>
      page.locator('.game-shell, .board-layout, .map-panel, .hand').evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
    const before = await bounds();
    await press(page.locator('[data-card="AZ"]'), isMobile);
    await expect(page.locator('.map-panel #message')).toContainText('−2 pts');
    expect(await bounds()).toEqual(before);
    await press(page.locator('#hint-button'), isMobile);
    await expect(page.locator('#hint-cost')).toBeVisible();
    expect(await bounds()).toEqual(before);
    const text = await page.locator('.map-messages').boundingBox();
    const map = await page.locator('.map-wrap').boundingBox();
    const texas = await page.locator('.map-state[data-code="TX"]').boundingBox();
    expect(text.y).toBeGreaterThanOrEqual(texas.y + texas.height);
    expect(text.y + text.height).toBeLessThanOrEqual(map.y + map.height);
    await press(page.locator('[data-card="CA"]'), isMobile);
    await expect(page.locator('#message')).toBeEmpty();
    expect(await bounds()).toEqual(before);
    await press(page.locator('[data-card="NC"]'), isMobile);
    await expect(page.locator('#message')).toContainText('doesn’t border');
    expect(await bounds()).toEqual(before);
    await press(page.locator('#new-game'), isMobile);
    await expect(page.locator('#confirm-dialog')).not.toBeVisible();
    await expect(page.locator('#message')).toContainText('Start with a green coastal card.');
  }
});

test('map states highlight and translucent cards retain solid borders and text', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const initialFill = await page
    .locator('.map-state[data-code="CA"] path')
    .evaluate((p) => getComputedStyle(p).fill);
  for (const code of ['CA', 'AZ']) await press(page.locator(`[data-card="${code}"]`), isMobile);
  await expect(page.locator('[data-chain="AZ"]')).toHaveCSS('opacity', '1');
  await expect(page.locator('.map-state.on-route')).toHaveCount(2);
  expect(
    await page.locator('.map-state[data-code="CA"] path').evaluate((p) => getComputedStyle(p).fill),
  ).not.toBe(initialFill);
  const style = await page.locator('[data-chain="AZ"]').evaluate((card) => {
    const css = getComputedStyle(card);
    return {
      background: css.backgroundImage,
      border: css.borderTopStyle,
      borderColor: css.borderTopColor,
      text: css.color,
      opacity: css.opacity,
    };
  });
  expect(style.background).toMatch(/rgba\([^)]*, 0\./);
  expect(style.border).toBe('solid');
  expect(style.borderColor).toMatch(/^rgb\(/);
  expect(style.text).toMatch(/^rgb\(/);
  expect(style.opacity).toBe('1');
  await press(page.locator('[data-card="AZ"]'), isMobile);
  await expect(page.locator('.map-state.on-route')).toHaveCount(1);
  await expect(page.locator('.map-state[data-code="AZ"]')).not.toHaveClass(/on-route/);
});

test('the map fills and centers its artwork while cards form a horizontal route row', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  for (const [width, height] of isMobile
    ? [
        [360, 780],
        [915, 412],
        [320, 568],
      ]
    : [
        [1440, 1000],
        [1024, 844],
      ]) {
    await page.setViewportSize({ width, height });
    const svg = await page.locator('#map > svg').boundingBox();
    const artwork = await page.locator('#state-shapes').boundingBox();
    const panel = await page.locator('.map-wrap').boundingBox();
    expect(artwork.width / svg.width).toBeGreaterThan(0.95);
    expect(Math.abs(artwork.x + artwork.width / 2 - panel.x - panel.width / 2)).toBeLessThan(3);
    expect(Math.abs(artwork.y + artwork.height / 2 - svg.y - svg.height / 2)).toBeLessThan(3);
    expect(
      await page
        .locator('#message')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(13);
  }
  for (const code of ['CA', 'AZ']) await press(page.locator(`[data-card="${code}"]`), isMobile);
  const alignment = await page.evaluate(() => {
    const line = document.querySelector('.row-line polyline');
    return ['CA', 'AZ'].map((code, index) => {
      const point = line.points.getItem(index);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(line.getScreenCTM());
      const card = document.querySelector(`[data-chain="${code}"]`).getBoundingClientRect();
      return Math.hypot(screen.x - card.x - card.width / 2, screen.y - card.y - card.height / 2);
    });
  });
  for (const distance of alignment) expect(distance).toBeLessThan(1);
});

test('mistakes persist, stack, preserve hints, and count in final scores', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await press(page.locator('#hint-button'), isMobile);
  for (let i = 0; i < 2; i++) await press(page.locator('[data-card="AZ"]'), isMobile);
  await expect(page.locator('#score')).toHaveText('-4 pts');
  expect((await saved(page)).game.hintPending).toBe(true);
  await page.reload();
  await expect(page.locator('#score')).toHaveText('-4 pts');
  for (const code of route) await press(page.locator(`[data-card="${code}"]`), isMobile);
  await expect(page.locator('#result-route h3')).toHaveText('Your route 6 pts');
  expect((await saved(page)).records[0].points).toBe(6);
  await page.reload();
  await expect(page.locator('#result-route h3')).toHaveText('Your route 6 pts');
  await press(page.locator('#play-again'), isMobile);
  await expect(page.locator('#score')).toHaveText('0 pts');
  expect((await saved(page)).game.mistakePoints).toBe(0);
});

test('a hint zeros any next chosen card and the penalty survives undo and reload', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await press(page.locator('#hint-button'), isMobile);
  await expect(page.locator('#message')).toHaveText('Play NC');
  await expect(page.locator('#message')).not.toContainText('points');
  expect((await page.locator('.map-messages').innerText()).match(/Next card/g)).toHaveLength(1);
  await expect(page.locator('.state-card.hinted')).toHaveCount(1);
  await expect(page.locator('#hint-cost')).toBeVisible();
  expect((await saved(page)).game.hintPending).toBe(true);
  await page.reload();
  await expect(page.locator('#hint-cost')).toBeVisible();
  await press(page.locator('[data-card="CA"]'), isMobile);
  await expect(page.locator('#score')).toContainText('0');
  expect((await saved(page)).game.zeroCards).toEqual(['CA']);
  await press(page.locator('[data-card="AZ"]'), isMobile);
  await expect(page.locator('#score')).toContainText('2');
  await press(page.locator('[data-card="CA"]'), isMobile);
  await press(page.locator('[data-card="CA"]'), isMobile);
  await expect(page.locator('#score')).toContainText('0');
  await expect(page.locator('[data-chain="CA"] small')).toHaveText('0 PTS');
});

test('a backtracking hint charges the next added card, not the removal', async ({
  page,
  isMobile,
}) => {
  await seed(page, fixture({ route: ['ME'] }));
  await press(page.locator('#hint-button'), isMobile);
  await expect(page.locator('#message')).toHaveText('Remove ME, play NC');
  await expect(page.locator('[data-card="ME"]')).toHaveClass(/hinted/);
  await press(page.locator('[data-card="ME"]'), isMobile);
  await expect(page.locator('#message')).toBeEmpty();
  await expect(page.locator('#hint-cost')).toBeVisible();
  expect((await saved(page)).game.hintPending).toBe(true);
  await press(page.locator('[data-card="CA"]'), isMobile);
  expect((await saved(page)).game.zeroCards).toEqual(['CA']);
});

test('backtracking hints name the suffix to remove and the exact next abbreviation', async ({
  page,
  isMobile,
}) => {
  const blocked = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'KY', 'IN', 'MI'];
  await seed(page, fixture({ route: blocked }));
  await press(page.locator('#hint-button'), isMobile);
  await expect(page.locator('#message')).toHaveText('Remove KY, play GA');
  await expect(page.locator('[data-card="KY"]')).toHaveClass(/hinted/);
  expect((await page.locator('.map-messages').innerText()).match(/Next card/g)).toHaveLength(1);
  await press(page.locator('[data-card="KY"]'), isMobile);
  expect((await saved(page)).game.route).toEqual(blocked.slice(0, 6));
  expect((await saved(page)).game.hintPending).toBe(true);
  await press(page.locator('[data-card="GA"]'), isMobile);
  await expect(page.locator('#result-dialog')).toBeVisible();
  expect((await saved(page)).game.zeroCards).toEqual(['GA']);
});

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`win results wait for the celebration with motion=${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.clock.install();
    await seed(page, fixture({ route: route.slice(0, -1) }));
    await page.clock.fastForward(2000);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.locator('[data-card="NC"]').dispatchEvent('click');
    expect((await saved(page)).game.status).toBe('won');
    expect((await saved(page)).wins).toBe(1);
    if (reducedMotion === 'no-preference') {
      await expect(page.locator('#result-dialog')).not.toBeVisible();
      await page.clock.runFor(1999);
      await expect(page.locator('#result-dialog')).not.toBeVisible();
      await page.clock.runFor(1);
    }
    await expect(page.locator('#result-dialog')).toBeVisible();
    expect((await saved(page)).wins).toBe(1);
  });
}

test('mobile modal close controls are visually compact without losing touch targets', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Compact mobile dialogs');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  for (const [width, height] of [
    [320, 568],
    [360, 780],
    [915, 412],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [trigger, id] of [
      ['#help-button', '#help-dialog'],
      ['#records-button', '#records-dialog'],
    ]) {
      await press(page.locator(trigger), true);
      const dialog = page.locator(id);
      const button = dialog.locator('.close-button');
      await expect(dialog.locator('.dialog-top')).toHaveCSS('position', 'absolute');
      const sizes = await button.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const visual = getComputedStyle(element, '::before');
        return {
          width: box.width,
          height: box.height,
          visualWidth: parseFloat(visual.width),
          visualHeight: parseFloat(visual.height),
        };
      });
      expect(sizes.width).toBeGreaterThanOrEqual(44);
      expect(sizes.height).toBeGreaterThanOrEqual(44);
      expect(sizes.visualWidth).toBeLessThanOrEqual(32);
      expect(sizes.visualHeight).toBeLessThanOrEqual(32);
      const heading = await dialog.locator('h2').boundingBox();
      const close = await button.boundingBox();
      expect(heading.y).toBeLessThan(close.y + close.height);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await press(button, true);
      await expect(dialog).not.toBeVisible();
    }
  }
});

test('automatic results and records include the final hinted card penalty', async ({
  page,
  isMobile,
}) => {
  await seed(page, fixture({ route: route.slice(0, -1) }));
  await press(page.locator('#hint-button'), isMobile);
  await press(page.locator('[data-card="NC"]'), isMobile);
  await expect(page.locator('#result-title')).toHaveText('You win');
  await expect(page.locator('#result-dialog')).toBeVisible();
  expect((await saved(page)).records[0].points).toBe(10);
  expect((await saved(page)).game.zeroCards).toEqual(['NC']);
  await expect(page.locator('#result-route h3')).toHaveText('Your route 10 pts');
  await expect(page.locator('.solution-chain[aria-label="Most points"]')).toHaveCount(1);
  for (const [label, path] of [['Most points', findMostPointsRoute(deal, undefined, ['NC'])]]) {
    const total = path.reduce(
      (points, code) => points + (code === 'NC' ? 0 : STATES[code].points),
      0,
    );
    await expect(
      page
        .locator('#solutions .solution-section')
        .filter({ has: page.locator(`ol[aria-label="${label}"]`) })
        .locator('h3'),
    ).toHaveText(`${label} ${total} pts`);
  }
});

test('solutions are linked, compact state abbreviations only', async ({ page }) => {
  await seed(page, fixture({ status: 'won', route }));
  await expect(page.locator('.solution-chain[aria-label="Most points"]')).toHaveCount(1);
  for (const [label, expected] of [['Most points', findMostPointsRoute(deal)]]) {
    const cards = page.locator(`.solution-chain[aria-label="${label}"] .solution-card`);
    expect(await cards.allTextContents()).toEqual(expected);
    expect(
      await cards.evaluateAll((elements) =>
        elements.every((e) => e.childElementCount === 0 && e.getBoundingClientRect().width <= 40),
      ),
    ).toBe(true);
  }
  expect(
    await page
      .locator('#result-dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
});

test('wins show only the most-points reference', async ({ page }) => {
  await seed(
    page,
    fixture({ status: 'won', route, zeroCards: deal.filter((code) => code !== 'GA') }),
  );
  await expect(page.locator('.solution-chain[aria-label="Most points"]')).toHaveCount(1);
  await expect(page.locator('#solutions h3')).toHaveText(['Most points 1 pts']);
  await expect(page.locator('#solutions')).not.toContainText('Shortest');
});

test('all-zero wins show most points and mobile reference cards stay smaller than your route', async ({
  page,
  isMobile,
}) => {
  await seed(page, fixture({ status: 'won', route, zeroCards: deal }));
  await expect(page.locator('#solutions h3')).toHaveText('Most points 0 pts');
  if (isMobile) {
    for (const width of [320, 360, 650]) {
      await page.setViewportSize({ width, height: 780 });
      const reference = page.locator('#solutions .solution-card').first();
      await expect(reference).toHaveCSS('width', '26px');
      await expect(reference).toHaveCSS('height', '30px');
      const player = page.locator('#result-route .solution-card').first();
      expect(
        parseFloat(await player.evaluate((element) => getComputedStyle(element).height)),
      ).toBeGreaterThan(30);
      expect(
        await page
          .locator('#result-dialog')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
    }
  }
});

for (const motion of ['reduce', 'no-preference']) {
  test(`End game completes the map without a win or modal, motion=${motion}`, async ({
    page,
    isMobile,
  }) => {
    const blocked = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'KY', 'IN', 'MI'];
    await page.emulateMedia({ reducedMotion: motion });
    await page.clock.install();
    await seed(
      page,
      fixture({ route: blocked, hintPending: true, zeroCards: ['CA'], mistakePoints: 2 }),
    );
    await page.clock.runFor(1000);
    await press(page.locator('#end-game'), isMobile);
    if (motion === 'no-preference') {
      await expect(page.locator('#message')).toHaveText('Completing route…');
      await page.clock.runFor(401);
      await expect(page.locator('[data-chain="MI"]')).toHaveCount(0);
    }
    await page.clock.runFor(15000);
    await expect(page.locator('#message')).toHaveText('Route completed. Select New game.');
    const expected = planCompletion(deal, blocked).route;
    expect(
      await page
        .locator('[data-chain]')
        .evaluateAll((cards) => cards.map((card) => card.dataset.chain)),
    ).toEqual(expected);
    await expect(page.locator('#result-dialog')).not.toBeVisible();
    await expect(page.locator('.game-toolbar button:enabled')).toHaveCount(1);
    await expect(page.locator('#new-game')).toBeEnabled();
    const data = await saved(page);
    expect(data.game.route).toEqual(blocked);
    expect(data.game.zeroCards).toEqual(['CA']);
    expect(data.game.hintPending).toBe(true);
    expect(data.game.mistakePoints).toBe(2);
    expect(data.played).toBe(1);
    expect(data.wins).toBe(0);
    expect(data.records).toEqual([]);
    await page.reload();
    await expect(page.locator('#message')).toHaveText('Route completed. Select New game.');
    expect((await saved(page)).played).toBe(1);
    await press(page.locator('#new-game'), isMobile);
    await page.clock.runFor(15000);
    expect((await saved(page)).game.route).toEqual([]);
    await expect(page.locator('[data-chain]')).toHaveCount(0);
  });
}

test('New game cancels an assisted completion in progress', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await seed(page, fixture({ route: ['ME'] }));
  await page.clock.runFor(1000);
  await press(page.locator('#end-game'), isMobile);
  await press(page.locator('#new-game'), isMobile);
  await page.clock.runFor(15000);
  expect((await saved(page)).game.route).toEqual([]);
  await expect(page.locator('[data-chain]')).toHaveCount(0);
  await expect(page.locator('#result-dialog')).not.toBeVisible();
});

test('help, scores, ending a game, and clearing scores work', async ({ page, isMobile }) => {
  await seed(page);
  await press(page.locator('#help-button'), isMobile);
  await expect(page.locator('#help-dialog')).toContainText('next card you add scores 0');
  await expect(page.locator('#help-dialog')).not.toContainText(/wildcard|Explorer|five minutes/);
  await press(page.locator('#help-dialog [data-close]').first(), isMobile);
  await press(page.locator('#end-game'), isMobile);
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  await expect(page.locator('#result-dialog')).not.toBeVisible();
  await expect(page.locator('#message')).toHaveText('Route completed. Select New game.', {
    timeout: 15000,
  });
  await press(page.locator('#new-game'), isMobile);
  await press(page.locator('#records-button'), isMobile);
  await expect(page.locator('#record-summary')).toHaveText('0 wins · 1 game');
  await expect(page.locator('#records-dialog h2')).toHaveText('Your scores');
  await press(page.locator('#clear-scores'), isMobile);
  await expect(page.locator('#confirm-dialog')).toHaveCount(0);
  await expect(page.locator('#record-summary')).toHaveText('No games yet.');
  await expect(page.locator('#record-list')).toContainText('No scores yet.');
});

test('new game replaces an active route immediately without confirmation', async ({
  page,
  isMobile,
}) => {
  await seed(page, fixture({ route: ['CA'], mistakePoints: 4 }));
  await press(page.locator('#new-game'), isMobile);
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  const data = await saved(page);
  expect(data.game.id).not.toBe('test-game');
  expect(data.game.route).toEqual([]);
  expect(data.game.mistakePoints).toBe(0);
  expect(data.played).toBe(0);
});

test('all win dialog dismissal controls start a new game and scores show the winning path', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  for (const method of ['close', 'escape', 'play-again']) {
    await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(
      ({ key, game }) => {
        const data = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...data, game }));
      },
      { key: STORAGE_KEY, game: fixture({ id: `win-${method}`, route: route.slice(0, -1) }) },
    );
    await page.reload();
    await press(page.locator('[data-card="NC"]'), isMobile);
    await expect(page.locator('#result-dialog')).toBeVisible();
    if (method === 'escape') await page.keyboard.press('Escape');
    else
      await press(
        page.locator(method === 'close' ? '#result-dialog [data-close]' : '#play-again'),
        isMobile,
      );
    await expect.poll(async () => (await saved(page)).game.status).toBe('playing');
    expect((await saved(page)).game.route).toEqual([]);
    expect(
      (await saved(page)).records.find((record) => record.id === `win-${method}`).route,
    ).toEqual(route);
  }
  await page.reload();
  await press(page.locator('#records-button'), isMobile);
  await expect(page.locator('#record-list th').first()).toHaveText('PATH');
  await expect(page.locator('.record-path').first()).toHaveText(route.join(' → '));
  await expect(page.locator('#record-list tbody tr').first()).toContainText('11 pts');
  expect(
    await page
      .locator('#records-dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
});

test('long routes fit inside the map without scrolling and remain keyboard accessible', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Small-screen route wrapping');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  const path = findLongestRoute(deal).slice(0, -1);
  await seed(page, fixture({ route: path }));
  const cards = await page
    .locator('[data-chain]')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
  expect(new Set(cards).size).toBeGreaterThan(2);
  expect(Math.abs(cards[1] - cards[0])).toBeLessThanOrEqual(12);
  expect(cards[0]).toBe(cards[2]);
  const map = await page.locator('.map-wrap').boundingBox();
  const card = await page.locator('[data-chain]').first().boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(map.y);
  expect(card.y + card.height).toBeLessThanOrEqual(map.y + map.height);
  const messages = await page.locator('.map-messages').boundingBox();
  const us = await page.locator('#state-shapes').boundingBox();
  expect(messages.y).toBeGreaterThanOrEqual(us.y + us.height);
  expect(messages.y + messages.height).toBeLessThanOrEqual(568 / 2);
  for (const element of await page.locator('[data-chain]').all()) {
    const bounds = await element.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(map.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(map.x + map.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(map.y + map.height);
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator(`[data-chain="${path.at(-1)}"]`).focus();
  expect(await page.locator('#map-chain').evaluate((layer) => layer.scrollLeft)).toBe(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-chain]')).toHaveCount(path.length - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('clearing scores preserves the current route, hint penalties, and sound setting', async ({
  page,
  isMobile,
}) => {
  await seed(page, fixture({ route: ['CA'], zeroCards: ['CA'], hintPending: true }));
  await press(page.locator('#sound-button'), isMobile);
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key));
    data.records = [{ id: 'previous', points: 8 }];
    data.wins = 1;
    data.played = 3;
    localStorage.setItem(key, JSON.stringify(data));
  }, STORAGE_KEY);
  await page.reload();
  const before = await saved(page);
  await expect(page.locator('#new-game')).toContainText('New game');
  await expect(page.locator('#privacy-button, #privacy-dialog')).toHaveCount(0);
  await press(page.getByRole('button', { name: 'Your scores' }), isMobile);
  await press(page.locator('#clear-scores'), isMobile);
  await expect(page.locator('#confirm-dialog')).toHaveCount(0);
  const after = await saved(page);
  expect(after.records).toEqual([]);
  expect(after.wins).toBe(0);
  expect(after.played).toBe(0);
  expect(after.game).toEqual(before.game);
  expect(after.soundEnabled).toBe(false);
  await page.reload();
  expect((await saved(page)).game).toEqual(before.game);
  await expect(page.locator('#sound-button')).toHaveText('Sound off');
});

test('Your scores scrolls vertically on short screens and Clear is reachable without confirmation', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? { width: 320, height: 568 } : { width: 1024, height: 400 });
  await seed(page);
  await page.evaluate(
    ({ key, route }) => {
      const data = JSON.parse(localStorage.getItem(key));
      data.records = Array.from({ length: 10 }, (_, index) => ({
        id: `score-${index}`,
        points: 11,
        route,
      }));
      data.wins = data.played = 10;
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: STORAGE_KEY, route },
  );
  await page.reload();
  await press(page.locator('#records-button'), isMobile);
  const dialog = page.locator('#records-dialog');
  await expect(dialog.locator('tbody tr')).toHaveCount(10);
  await expect(dialog).toHaveCSS('overflow-y', 'auto');
  expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.locator('#clear-scores').scrollIntoViewIfNeeded();
  expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await press(page.locator('#clear-scores'), isMobile);
  await expect(dialog).toBeVisible();
  await expect(page.locator('#record-summary')).toHaveText('No games yet.');
  await expect(page.locator('#confirm-dialog')).toHaveCount(0);
});

test('sound preference persists and blocked audio does not prevent keyboard play', async ({
  page,
  isMobile,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        constructor() {
          throw new Error('Blocked');
        }
      },
    }),
  );
  await seed(page);
  await press(page.locator('#sound-button'), isMobile);
  await page.reload();
  await expect(page.locator('#sound-button')).toHaveText('Sound off');
  await press(page.locator('#sound-button'), isMobile);
  await page.locator('[data-card="CA"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-chain]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('blocked storage and reduced motion still permit play', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Blocked');
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('#storage-warning')).toBeVisible();
  await press(page.locator('.state-card.coastal').first(), isMobile);
  await expect(page.locator('[data-chain]')).toHaveCount(1);
  await expect(page.locator('.flying-card')).toHaveCount(0);
  await expect(page.locator('#message')).toBeEmpty();
});

test('phone and desktop layouts fit, with usable touch targets', async ({ page, isMobile }) => {
  await seed(page);
  const sizes = isMobile
    ? [
        [915, 412],
        [915, 320],
        [844, 390],
        [780, 360],
        [650, 320],
        [568, 320],
      ]
    : [
        [768, 844],
        [1024, 844],
        [1440, 1000],
      ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const box = await page.locator('.state-card').first().boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (isMobile) {
      const hand = await page.locator('.hand').boundingBox();
      const map = await page.locator('.map-panel').boundingBox();
      if (width > height) {
        expect(hand.x + hand.width).toBeLessThanOrEqual(map.x + 1);
        expect(Math.abs(hand.y - map.y)).toBeLessThan(1);
      } else {
        expect(map.y + map.height).toBeLessThanOrEqual(hand.y + 1);
        expect(hand.y + hand.height).toBeLessThanOrEqual(height);
      }
      expect(map.y + map.height).toBeLessThanOrEqual(height);
      const controls = await page
        .locator('#hint-button, #sound-button, #records-button, #help-button, #new-game, #end-game')
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const { x, y, width, height } = button.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
      expect(
        Math.max(...controls.map((b) => b.y)) - Math.min(...controls.map((b) => b.y)),
      ).toBeLessThan(1);
      for (const control of controls) {
        expect(control.width).toBeGreaterThanOrEqual(44);
        expect(control.height).toBeGreaterThanOrEqual(44);
        expect(control.x + control.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
    }
  }
  if (isMobile) {
    await page.setViewportSize({ width: 915, height: 412 });
    await expect
      .poll(() => page.locator('.hand').evaluate((hand) => hand.scrollHeight <= hand.clientHeight))
      .toBe(true);
    await press(page.locator('[data-card="CA"]'), true);
    await expect(page.locator('[data-chain="CA"]')).toBeVisible();
    await press(page.locator('[data-chain="CA"]'), true);
    await expect(page.locator('[data-chain]')).toHaveCount(0);
  }
});

test('portrait phones fit the map above the cards and keep play usable after rotation', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Compact phone layout');
  await seed(page, fixture({ route: ['CA'] }));
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [360, 780],
    [375, 812],
    [412, 915],
    [430, 844],
    [650, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('#cards')).toBeVisible();
    const hand = await page.locator('.hand').boundingBox();
    const map = await page.locator('.map-panel').boundingBox();
    expect(map.y + map.height).toBeLessThanOrEqual(hand.y + 1);
    expect(hand.y + hand.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect
      .poll(() => page.locator('.hand').evaluate((hand) => hand.scrollHeight <= hand.clientHeight))
      .toBe(true);
    const controls = await page.locator('.game-toolbar button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    expect(new Set(controls.map((button) => button.y)).size).toBe(1);
    for (const button of controls) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width).toBeLessThanOrEqual(width);
    }
    const card = await page.locator('.state-card').first().boundingBox();
    expect(card.width).toBeGreaterThanOrEqual(44);
    expect(card.height).toBeGreaterThanOrEqual(44);
  }
  await press(page.locator('[data-chain="CA"]'), true);
  await press(page.locator('[data-card="CA"]'), true);
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('[data-chain="CA"]')).toBeVisible();
  expect((await saved(page)).game.route).toEqual(['CA']);
  await press(page.locator('#help-button'), true);
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator('#help-dialog')).toBeVisible();
});
