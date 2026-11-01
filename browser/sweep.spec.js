import { test, expect } from '@playwright/test';
import { CODES } from '../src/data.js';
import { STORAGE_KEY, emptySave } from '../src/storage.js';

const path = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...path, ...CODES])].slice(0, 24).sort();
async function seed(page, overrides = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.addInitScript(
    ({ key, game }) => {
      if (!sessionStorage.getItem('sweep-seeded')) {
        localStorage.setItem(key, JSON.stringify(game));
        sessionStorage.setItem('sweep-seeded', '1');
      }
    },
    {
      key: STORAGE_KEY,
      game: {
        ...emptySave(),
        game: {
          id: 'sweep-test',
          deal,
          route: [],
          zeroCards: [],
          hintPending: false,
          status: 'playing',
          scoring: 'base-v1',
          cardPoints: Object.fromEntries(deal.map((code) => [code, 1])),
          ...overrides,
        },
      },
    },
  );
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(24);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}
const click = (page, selector) => page.locator(selector).first().dispatchEvent('click');
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function bounds(page, code, direction) {
  return page.locator(`.map-state[data-code="${code}"]`).evaluate((shape, direction) => {
    const box = shape.getBoundingClientRect();
    const panel = document.querySelector('.map-wrap').getBoundingClientRect();
    const left = (box.left - panel.left) / panel.width;
    const right = (box.right - panel.left) / panel.width;
    return direction === 'east' ? { near: left, far: right } : { near: 1 - right, far: 1 - left };
  }, direction);
}

for (const [code, direction] of [
  ['CA', 'east'],
  ['NC', 'west'],
]) {
  test(`deadline starts at the panel edge and chases ${code} toward the ${direction}`, async ({
    page,
  }) => {
    await seed(page);
    await page.clock.runFor(10000);
    await expect(page.locator('.sweep-layer')).not.toBeVisible();
    await click(page, `[data-card="${code}"]`);
    await expect(page.locator('.sweep-layer')).toHaveAttribute('data-direction', direction);
    const panel = await page.locator('.map-wrap').boundingBox();
    const line = await page.locator('.sweep-line').boundingBox();
    expect(
      Math.abs(line.x + line.width / 2 - (direction === 'east' ? panel.x : panel.x + panel.width)),
    ).toBeLessThan(2);
    const threshold = await bounds(page, code, direction);
    await page.clock.runFor(Math.max(0, Math.floor(threshold.near * 90000) - 100));
    await expect(page.locator('.sweep-danger')).toHaveCount(0);
    await page.clock.runFor(200);
    await expect(page.locator(`.map-state[data-code="${code}"]`)).toHaveClass(/sweep-danger/);
    await expect(page.locator(`.map-state[data-code="${code}"] path`)).toHaveCSS(
      'fill',
      'rgb(98, 49, 59)',
    );
    const shade = await page.locator('.sweep-shade').boundingBox();
    expect(shade.width).toBeGreaterThan(0);
    const state = await saved(page);
    await page.clock.runFor(Math.max(0, (threshold.far - state.game.sweep.progress) * 90000) + 150);
    await expect(page.locator('#sweep-over')).toBeVisible();
    await expect(page.locator('#sweep-over')).toHaveText('You Lose!');
    expect((await saved(page)).played).toBe(1);
    expect((await saved(page)).wins).toBe(0);
    expect((await saved(page)).game.lossReason).toBe('timeout');
    await expect(page.locator('#result-dialog')).not.toBeVisible();
    await page.clock.runFor(1100);
    await expect(page.locator('#sweep-over')).not.toBeVisible();
    expect((await saved(page)).game.id).not.toBe('sweep-test');
    expect((await saved(page)).played).toBe(1);
  });
}

test('hidden pages pause without a catch-up jump and reload preserves pace/progress', async ({
  page,
}) => {
  await seed(page);
  await click(page, '[data-card="CA"]');
  await click(page, '[data-card="AZ"]');
  await click(page, '#hint-button');
  await page.clock.runFor(1000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = (await saved(page)).game.sweep;
  await page.clock.runFor(120000);
  expect((await saved(page)).game.sweep).toEqual(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const resumed = (await saved(page)).game.sweep;
  expect(resumed.progress).toBeGreaterThan(paused.progress);
  expect(resumed.progress - paused.progress).toBeLessThan(0.02);
  await page.reload();
  expect((await saved(page)).game.sweep.progress).toBeCloseTo(resumed.progress, 2);
  expect((await saved(page)).game.sweep.multiplier).toBe(resumed.multiplier);
});

test('hints and invalid cards share the stronger penalty, while undo never refunds pace', async ({
  page,
}) => {
  await seed(page);
  await click(page, '[data-card="AZ"]');
  expect((await saved(page)).game.sweep.multiplier).toBeCloseTo(1.35);
  await click(page, '[data-card="CA"]');
  await click(page, '[data-card="AZ"]');
  expect((await saved(page)).game.sweep.multiplier).toBeCloseTo(1.43);
  await click(page, '#hint-button');
  expect((await saved(page)).game.sweep.multiplier).toBeCloseTo(1.78);
  await click(page, '[data-card="NC"]');
  expect((await saved(page)).game.sweep.multiplier).toBeCloseTo(2.13);
  await page.clock.runFor(1000);
  await click(page, '[data-card="CA"]');
  const undone = (await saved(page)).game.sweep;
  expect(undone.origin).toBe('CA');
  expect(undone.progress).toBeGreaterThan(0);
  expect(undone.multiplier).toBeCloseTo(2.13);
  await click(page, '[data-card="CA"]');
  expect((await saved(page)).game.sweep.multiplier).toBeCloseTo(2.21);
});

test('wins stop the deadline; New game clears it without an assisted-route control', async ({
  page,
}) => {
  await seed(page);
  for (const code of path) await click(page, `[data-card="${code}"]`);
  const won = (await saved(page)).game.sweep;
  await expect(page.locator('.sweep-layer')).not.toBeVisible();
  await page.clock.runFor(120000);
  expect((await saved(page)).game.sweep).toEqual(won);
  expect((await saved(page)).wins).toBe(1);
  await click(page, '#play-again');
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  expect((await saved(page)).game.sweep.origin).toBe(null);
  await expect(page.locator('#show-route')).toHaveCount(0);
  await click(page, '.state-card.coastal');
  await click(page, '#new-game');
  await expect(page.locator('.sweep-layer')).not.toBeVisible();
  expect((await saved(page)).game.sweep.origin).toBe(null);
});

test('a farther state clears the warning, and rotation preserves sweep progress', async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await click(page, '[data-card="CA"]');
  const threshold = await bounds(page, 'CA', 'east');
  await page.clock.runFor(threshold.near * 90000 + 200);
  await expect(page.locator('.map-state[data-code="CA"]')).toHaveClass(/sweep-danger/);
  await click(page, '[data-card="AZ"]');
  await expect(page.locator('.sweep-danger')).toHaveCount(0);
  const before = (await saved(page)).game.sweep;
  await page.setViewportSize(isMobile ? { width: 915, height: 412 } : { width: 1024, height: 844 });
  await page.clock.runFor(50);
  await click(page, '[data-card="NC"]');
  const after = (await saved(page)).game.sweep;
  expect(after.multiplier).toBeCloseTo(before.multiplier + 0.35);
  expect(after.progress).toBeGreaterThanOrEqual(before.progress);
  expect(after.progress - before.progress).toBeLessThan(0.002);
  await expect(page.locator('.sweep-layer')).toHaveAttribute('data-direction', 'east');
});

test('reloading a timeout does not recount it and New game cancels the automatic restart', async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await click(page, '[data-card="CA"]');
  const threshold = await bounds(page, 'CA', 'east');
  await page.clock.runFor(threshold.far * 90000 + 100);
  await expect(page.locator('#sweep-over')).toBeVisible();
  expect((await saved(page)).played).toBe(1);
  await page.reload();
  await expect(page.locator('#sweep-over')).toBeVisible();
  expect((await saved(page)).played).toBe(1);
  await click(page, '#new-game');
  const id = (await saved(page)).game.id;
  await page.clock.runFor(2000);
  expect((await saved(page)).game.id).toBe(id);
  expect((await saved(page)).played).toBe(1);
  await expect(page.locator('#sweep-over')).not.toBeVisible();
});

test('a single narrow sweep line has no internal animation; threatened states pulse', async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await click(page, '[data-card="CA"]');
  const line = page.locator('.sweep-line');
  await expect(line).toHaveCSS('background-color', 'rgb(255, 73, 64)');
  await expect(line).toHaveCSS('width', '2px');
  await expect(line).toHaveCSS('animation-name', 'none');
  for (const pseudo of ['::before', '::after']) {
    expect(
      await line.evaluate((element, pseudo) => getComputedStyle(element, pseudo).content, pseudo),
    ).toBe('none');
    expect(
      await line.evaluate(
        (element, pseudo) => getComputedStyle(element, pseudo).animationName,
        pseudo,
      ),
    ).toBe('none');
  }
  const threshold = await bounds(page, 'CA', 'east');
  await page.clock.runFor(threshold.near * 90000 + 100);
  const danger = page.locator('.map-state.sweep-danger path');
  await expect(danger).toHaveCSS('animation-name', 'sweep-danger-pulse');
  const pulse = await danger.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((animation) => animation.animationName === 'sweep-danger-pulse');
    return {
      duration: animation.effect.getTiming().duration,
      fills: [...new Set(animation.effect.getKeyframes().map((keyframe) => keyframe.fill))],
    };
  });
  expect(pulse.duration).toBe(1200);
  expect(pulse.fills.length).toBeGreaterThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(danger).toHaveCSS('animation-name', 'none');
  await expect(danger).toHaveCSS('fill', 'rgb(98, 49, 59)');
  expect(
    await line.evaluate((element) => getComputedStyle(element, '::before').animationName),
  ).toBe('none');
  expect(await line.evaluate((element) => getComputedStyle(element, '::after').animationName)).toBe(
    'none',
  );
  await expect(page.locator('.sweep-layer')).toBeVisible();
});

test('first play slams the line down, impacts, and sheds bounded sparks with cleanup', async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const entering = await page.evaluate(() => {
    window.sweepObserved = { sparks: 0, impacts: 0, peak: 0 };
    const effects = document.querySelector('.sweep-effects');
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (node.classList?.contains('sweep-spark')) window.sweepObserved.sparks++;
          if (node.classList?.contains('sweep-impact')) window.sweepObserved.impacts++;
        }
      window.sweepObserved.peak = Math.max(window.sweepObserved.peak, effects.childElementCount);
    }).observe(effects, { childList: true });
    document.querySelector('[data-card="CA"]').click();
    return document.querySelector('.sweep-line').classList.contains('sweep-entering');
  });
  expect(entering).toBe(true);
  await page.clock.runFor(450);
  await expect.poll(() => page.evaluate(() => window.sweepObserved.impacts)).toBe(1);
  await expect(page.locator('.sweep-entering')).toHaveCount(0);
  await page.clock.runFor(3000);
  await expect.poll(() => page.evaluate(() => window.sweepObserved.sparks)).toBeGreaterThan(14);
  expect(await page.evaluate(() => window.sweepObserved.peak)).toBeLessThanOrEqual(32);
  const impacts = await page.evaluate(() => window.sweepObserved.impacts);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.sweep-effects > *')).toHaveCount(0);
  await page.clock.runFor(1000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(300);
  expect(await page.evaluate(() => window.sweepObserved.impacts)).toBe(impacts);
  await page.reload();
  await expect(page.locator('.sweep-entering')).toHaveCount(0);
  await expect(page.locator('.sweep-line')).toHaveCSS('transform', 'none');
  for (const code of path.slice(1)) await click(page, `[data-card="${code}"]`);
  await expect(page.locator('.sweep-effects > *')).toHaveCount(0);
  await page.clock.runFor(2100);
  await expect(page.locator('#result-dialog')).toBeVisible();
  await click(page, '#play-again');
  await expect(page.locator('.sweep-effects > *, .sweep-entering')).toHaveCount(0);
});

test('reduced motion skips sweep effects, and interrupted entrances never burst later', async ({
  page,
}) => {
  await seed(page);
  await click(page, '[data-card="CA"]');
  await page.clock.runFor(2000);
  await expect(page.locator('.sweep-effects > *, .sweep-entering')).toHaveCount(0);
  await expect(page.locator('.sweep-layer')).toBeVisible();
  await click(page, '#new-game');
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    document.querySelector('.state-card.coastal').click();
    document.querySelector('#new-game').click();
  });
  await expect(page.locator('.sweep-effects > *, .sweep-entering')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.locator('.sweep-effects > *, .sweep-entering')).toHaveCount(0);
  await expect(page.locator('.sweep-line')).toHaveCSS('transform', 'none');
});
