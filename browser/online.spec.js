import { test, expect } from '@playwright/test';
import { CODES } from '../src/data.js';
import { STORAGE_KEY, emptySave } from '../src/storage.js';
import { OUTBOX_KEY } from '../src/leaderboard.js';

const userId = '00000000-0000-0000-0000-000000000001';
const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
const session = {
  access_token: 'test-user-token',
  refresh_token: 'test-refresh-token',
  expires_at: 4102444800,
  token_type: 'bearer',
  user: {
    id: userId,
    aud: 'authenticated',
    email: 'private@example.com',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Private Google Name' },
  },
};

async function setup(page, { loggedIn = false, gameRoute = [], rpc, profileName = null } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ key, save, session }) => {
      if (!sessionStorage.getItem('online-seeded')) {
        localStorage.setItem(key, JSON.stringify(save));
        if (session) localStorage.setItem('border-race:auth:v1', JSON.stringify(session));
        sessionStorage.setItem('online-seeded', '1');
      }
    },
    {
      key: STORAGE_KEY,
      save: {
        ...emptySave(),
        game: {
          id: 'online-win',
          deal,
          route: gameRoute,
          zeroCards: [],
          hintPending: false,
          status: 'playing',
        },
      },
      session: loggedIn ? session : null,
    },
  );
  let storedName = profileName;
  await page.route('http://127.0.0.1:55431/**', async (request) => {
    const url = new URL(request.request().url());
    const name = url.pathname.split('/').at(-1);
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const response = await rpc?.(name, request.request());
      if (response) return request.fulfill(response);
      if (name === 'ensure_display_name') {
        storedName ??= request.request().postDataJSON().p_display_name;
        return request.fulfill({ json: storedName });
      }
      if (name === 'set_display_name') {
        storedName = request.request().postDataJSON().p_display_name;
        return request.fulfill({ status: 204 });
      }
      if (name === 'get_daily_leaderboard')
        return request.fulfill({
          json: {
            day: new Date().toISOString().slice(0, 10),
            resets_at: new Date(Date.now() + 86400000).toISOString(),
            entries: [{ rank: 1, name: '<script>alert(1)</script>', points: 30, own: loggedIn }],
          },
        });
      return request.fulfill({ status: 204 });
    }
    if (url.pathname === '/rest/v1/profiles') return request.fulfill({ json: null });
    if (url.pathname.endsWith('/user')) return request.fulfill({ json: session.user });
    if (url.pathname.endsWith('/logout')) return request.fulfill({ status: 204 });
    return request.fulfill({
      status: 200,
      contentType: 'text/html',
      body: 'OAuth test destination',
    });
  });
  await page.goto('/');
  await expect(page.locator('.state-card')).toHaveCount(24);
}

async function openBoard(page) {
  await page.locator('#daily-button').click();
  await expect(page.locator('#daily-dialog')).toBeVisible();
}

test('public daily board uses text-only names and fits small phones', async ({
  page,
  isMobile,
}) => {
  await setup(page);
  await openBoard(page);
  await expect(page.locator('#daily-list')).toContainText('<script>alert(1)</script>');
  await expect(page.locator('#daily-list script')).toHaveCount(0);
  await expect(page.locator('#daily-dialog .fine-print')).toHaveText(
    'Winning points add up each UTC day.',
  );
  await expect(page.locator('#daily-date')).toHaveCount(0);
  await expect(page.locator('#daily-refresh')).toHaveAccessibleName('Refresh leaderboard');
  await expect(page.locator('#daily-refresh')).toHaveText('');
  if (isMobile) {
    for (const width of [320, 360, 650]) {
      await page.setViewportSize({ width, height: 780 });
      expect(
        await page.locator('#daily-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const title = await page.locator('#daily-title').boundingBox();
      const refresh = await page.locator('#daily-refresh').boundingBox();
      expect(refresh.width).toBeGreaterThanOrEqual(44);
      expect(refresh.height).toBeGreaterThanOrEqual(44);
      expect(title.x + title.width).toBeLessThanOrEqual(refresh.x);
    }
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#daily-dialog')).not.toBeVisible();
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log in with Google');
  await expect(page.locator('#account-name')).not.toBeVisible();
  await page.locator('#records-button').click();
  await expect(page.locator('#records-dialog #daily-button')).toHaveCount(0);
});

test('Google sign-in uses PKCE and the current application redirect', async ({ page }) => {
  await setup(page);
  await page.locator('#account-button').click();
  await expect(page).toHaveURL(/\/auth\/v1\/authorize/);
  const url = new URL(page.url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4174/');
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
});

test('existing names stay account-bound and the top bar fits small screens', async ({ page }) => {
  await setup(page, { loggedIn: true, profileName: 'A very long player name!!' });
  await expect(page.locator('#account-name')).toHaveText('A very long player name!!');
  for (const width of [320, 360, 650, 820, 1440]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('#daily-button')).toBeInViewport();
    await expect(page.locator('#account-button')).toBeInViewport();
    const name = await page.locator('#account-name').boundingBox();
    const login = await page.locator('#account-button').boundingBox();
    expect(name.x + name.width).toBeLessThanOrEqual(login.x);
  }
  await page.locator('#account-name').click();
  await expect(page.locator('#display-name')).toHaveValue('A very long player name!!');
  await page.keyboard.press('Escape');
  await expect(page.locator('#account-name')).toBeFocused();
  await page.reload();
  await expect(page.locator('#account-name')).toHaveText('A very long player name!!');
});

test('profile failures allow name recovery without blocking gameplay', async ({ page }) => {
  let fail = true;
  await setup(page, {
    loggedIn: true,
    rpc(name) {
      if (name === 'ensure_display_name' || (name === 'set_display_name' && fail))
        return { status: 503, json: { message: 'unavailable' } };
    },
  });
  await expect(page.locator('#account-name')).toHaveText('Set name');
  await page.locator('#account-name').click();
  await expect(page.locator('#profile-status')).toContainText('Name unavailable');
  await page.locator('#display-name').fill('Sunny Otter');
  await page.locator('#save-display-name').click();
  await expect(page.locator('#profile-status')).toContainText('Name not saved');
  fail = false;
  await page.locator('#save-display-name').click();
  await expect(page.locator('#profile-dialog')).not.toBeVisible();
  await expect(page.locator('#account-name')).toHaveText('Sunny Otter');
  await page.locator('[data-card="CA"]').click();
  await expect(page.locator('[data-chain="CA"]')).toHaveCount(1);
});

test('signed-in wins submit once without waiting for results and never publish Google identity', async ({
  page,
}) => {
  const submissions = [];
  await setup(page, {
    loggedIn: true,
    gameRoute: route.slice(0, -1),
    rpc(name, request) {
      if (name === 'submit_score')
        submissions.push({ body: request.postDataJSON(), token: request.headers().authorization });
    },
  });
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log out');
  await expect(page.locator('.site-header')).not.toContainText(
    /private@example.com|Private Google Name/,
  );
  await expect(page.locator('#account-name')).toHaveText(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{4}$/);
  await page.locator('#account-name').click();
  await expect(page.locator('#display-name')).toHaveValue(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{4}$/);
  await page.locator('#display-name').fill('Map player');
  await page.locator('#profile-form').evaluate((form) => form.requestSubmit());
  await expect(page.locator('#profile-dialog')).not.toBeVisible();
  await expect(page.locator('#account-name')).toHaveText('Map player');
  await page.locator('[data-card="NC"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].body).toEqual({
    p_game_id: 'online-win',
    p_points: 11,
    p_rules_version: 'wins-v1',
  });
  expect(submissions[0].token).toBe('Bearer test-user-token');
  await page.reload();
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#account-name')).toHaveText('Map player');
  expect(submissions.length).toBe(1);
});

test('anonymous wins and abandoned games do not submit scores', async ({ page }) => {
  const submissions = [];
  await setup(page, {
    gameRoute: route.slice(0, -1),
    rpc(name) {
      if (name === 'submit_score') submissions.push(name);
    },
  });
  await page.locator('[data-card="NC"]').click();
  await expect(page.locator('#result-dialog')).toBeVisible();
  expect(submissions).toEqual([]);
  await page.locator('#play-again').click();
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  await page.locator('[data-card]').first().click();
  await page.locator('#new-game').click();
  await expect(page.locator('.board-layout')).toHaveAttribute('aria-busy', 'false');
  expect(submissions).toEqual([]);
});

test('signed-in timeout losses do not submit scores', async ({ page }) => {
  const submissions = [];
  await page.clock.install();
  await setup(page, {
    loggedIn: true,
    rpc(name) {
      if (name === 'submit_score') submissions.push(name);
    },
  });
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log out');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.locator('[data-card="CA"]').dispatchEvent('click');
  await page.clock.runFor(90000);
  const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(save.played).toBe(1);
  expect(save.wins).toBe(0);
  expect(submissions).toEqual([]);
});

test('network failure queues signed-in wins and refresh retries without losing local records', async ({
  page,
}) => {
  let offline = true;
  let submissions = 0;
  await setup(page, {
    loggedIn: true,
    gameRoute: route.slice(0, -1),
    rpc(name) {
      if (name === 'submit_score') {
        submissions++;
        return offline ? { status: 503, json: { message: 'offline' } } : { status: 204 };
      }
    },
  });
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log out');
  await page.locator('[data-card="NC"]').click();
  await expect.poll(() => submissions).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).records[0].points,
      STORAGE_KEY,
    ),
  ).toBe(11);
  await page.locator('#play-again').click();
  await openBoard(page);
  await expect(page.locator('#daily-status')).toContainText('queued');
  offline = false;
  await page.locator('#daily-refresh').click();
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).length, OUTBOX_KEY))
    .toBe(0);
});

test('leaderboard errors do not block local play; callback errors are cleaned', async ({
  page,
}) => {
  await setup(page, {
    rpc(name) {
      if (name === 'get_daily_leaderboard')
        return { status: 503, json: { message: 'unavailable' } };
    },
  });
  await page.goto('/?error=access_denied&error_description=private');
  await expect(page).toHaveURL('http://127.0.0.1:4174/');
  await openBoard(page);
  await expect(page.locator('#daily-status')).toContainText('Sign-in unavailable');
  await expect(page.locator('#daily-status')).toContainText('Leaderboard unavailable');
  await page.keyboard.press('Escape');
  await page.locator('[data-card="CA"]').click();
  await expect(page.locator('[data-chain="CA"]')).toHaveCount(1);
});

test('sign-out keeps the active game and personal records', async ({ page }) => {
  const submissions = [];
  await setup(page, {
    loggedIn: true,
    gameRoute: ['CA'],
    rpc(name) {
      if (name === 'submit_score') submissions.push(name);
    },
  });
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log out');
  await page.locator('#account-button').click();
  await expect(page.locator('#account-button')).toHaveAttribute('aria-label', 'Log in with Google');
  await expect(page.locator('#account-name')).not.toBeVisible();
  await expect(page.locator('[data-chain="CA"]')).toHaveCount(1);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).game.route, STORAGE_KEY),
  ).toEqual(['CA']);
  expect(submissions).toEqual([]);
});

test('a visible board switches days using the server reset time', async ({ page }) => {
  let reads = 0;
  await page.clock.install();
  await setup(page, {
    rpc(name) {
      if (name === 'get_daily_leaderboard') {
        reads++;
        return {
          json: {
            day: reads === 1 ? '2026-10-30' : '2026-10-31',
            server_time: '2026-10-30T23:59:59Z',
            resets_at: '2026-10-31T00:00:00Z',
            entries: reads === 1 ? [{ rank: 1, name: 'Yesterday', points: 10, own: false }] : [],
          },
        };
      }
    },
  });
  await openBoard(page);
  await expect(page.locator('#daily-list')).toContainText('Yesterday');
  await page.clock.runFor(2000);
  await expect(page.locator('#daily-list')).toHaveText('No scores today.');
});
