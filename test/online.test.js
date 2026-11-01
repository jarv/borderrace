import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onlineConfig } from '../build-config.js';
import { createAuth, safeStorage } from '../src/auth.js';
import { createOutbox, OUTBOX_KEY } from '../src/leaderboard.js';

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const win = (id = 'game-1') => ({
  id,
  status: 'won',
  route: ['CA', 'AZ'],
  zeroCards: ['CA'],
  mistakePoints: 5,
  cardPoints: { CA: 1, AZ: 3 },
});
const session = (id) => ({ user: { id }, access_token: `token-${id}` });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('only explicit public Supabase configuration reaches the browser', () => {
  assert.equal(onlineConfig({}), null);
  assert.deepEqual(
    onlineConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      GOOGLE_SECRET: 'never-bundle',
    }),
    { url: 'https://example.supabase.co', key: 'sb_publishable_test' },
  );
  for (const values of [
    { SUPABASE_URL: 'https://example.supabase.co' },
    { SUPABASE_URL: 'http://evil.example', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never' },
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: `eyJ.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.sig`,
    },
  ])
    assert.throws(() => onlineConfig(values));
});

test('auth storage survives blocked storage without resurrecting a removed session', () => {
  const raw = storage();
  const adapter = safeStorage(raw);
  adapter.setItem('session', 'token');
  raw.removeItem('session');
  assert.equal(adapter.getItem('session'), null);
  const blocked = safeStorage({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
    removeItem() {
      throw Error();
    },
  });
  blocked.setItem('session', 'token');
  assert.equal(blocked.getItem('session'), 'token');
  blocked.removeItem('session');
  assert.equal(blocked.getItem('session'), null);
  const full = safeStorage({
    getItem() {
      return null;
    },
    setItem() {
      throw Error('full');
    },
  });
  full.setItem('verifier', 'pkce');
  assert.equal(full.getItem('verifier'), 'pkce');
});

test('PKCE exchanges once, cleans callback parameters, and preserves subpaths', async () => {
  const calls = [];
  const history = { replaceState: (...args) => calls.push(['replace', ...args]) };
  const current = session('A');
  const client = {
    auth: {
      onAuthStateChange() {},
      exchangeCodeForSession: async (code) => {
        calls.push(['exchange', code]);
        return { data: { session: current } };
      },
      signInWithOAuth: async (options) => {
        calls.push(['signin', options]);
        return {};
      },
    },
  };
  const auth = createAuth({
    client,
    history,
    location: { href: 'https://example.com/game/?code=one-use&other=keep' },
  });
  await auth.initialize();
  assert.equal(auth.session.user.id, 'A');
  assert.equal(calls.filter(([name]) => name === 'exchange').length, 1);
  assert.equal(calls.find(([name]) => name === 'replace').at(-1), '/game/?other=keep');
  await auth.signIn();
  assert.equal(calls.at(-1)[1].options.redirectTo, 'https://example.com/game/');
});

test('auth callback errors are generic, cleaned, and do not prevent local play', async () => {
  let state;
  let replaced;
  const auth = createAuth({
    client: { auth: { onAuthStateChange() {} } },
    location: { href: 'https://example.com/?error=access_denied&error_description=private' },
    history: {
      replaceState: (...args) => {
        replaced = args.at(-1);
      },
    },
    onChange: (next) => {
      state = next;
    },
  });
  await auth.initialize();
  assert.equal(state.ready, true);
  assert.match(state.error, /Sign-in unavailable/);
  assert.equal(replaced, '/');
});

test('outbox submits only authenticated wins with the exact penalized score', async () => {
  const raw = storage();
  const calls = [];
  const outbox = createOutbox({ storage: raw, submit: async (...args) => calls.push(args) });
  outbox.recordWin(win(), null);
  outbox.recordWin({ ...win(), status: 'lost' }, 'A');
  assert.equal(raw.getItem(OUTBOX_KEY), null);
  outbox.setSession(session('A'));
  outbox.recordWin(win(), 'A');
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].points, -2);
  assert.equal(calls[0][1].user.id, 'A');
  assert.deepEqual(JSON.parse(raw.getItem(OUTBOX_KEY)), []);
  outbox.dispose();
});

test('retries retain game identity and are bound to the original account', async () => {
  const raw = storage();
  const scheduled = [];
  const calls = [];
  let fail = true;
  const outbox = createOutbox({
    storage: raw,
    submit: async (entry, bound) => {
      calls.push([entry, bound]);
      if (fail) throw Error('offline');
    },
    schedule: (callback) => {
      scheduled.push(callback);
    },
    cancel() {},
  });
  outbox.setSession(session('A'));
  outbox.recordWin(win(), 'A');
  outbox.recordWin(win(), 'A');
  await tick();
  assert.equal(JSON.parse(raw.getItem(OUTBOX_KEY)).length, 1);
  outbox.setSession(session('B'));
  await tick();
  assert.equal(calls.length, 1);
  fail = false;
  outbox.setSession(session('A'));
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0].gameId, calls[1][0].gameId);
  assert.deepEqual(JSON.parse(raw.getItem(OUTBOX_KEY)), []);
  outbox.dispose();
});

test('pending requests abort when accounts change and never acquire the new token', async () => {
  let finish;
  let signal;
  let bound;
  const outbox = createOutbox({
    storage: storage(),
    submit: (_entry, current, abort) => {
      bound = current;
      signal = abort;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  outbox.setSession(session('A'));
  outbox.recordWin(win(), 'A');
  outbox.setSession(session('B'));
  assert.equal(signal.aborted, true);
  assert.equal(bound.access_token, 'token-A');
  finish();
  await tick();
  outbox.dispose();
});

test('reload recovers queued scores; corrupt, expired, full storage degrades safely', async () => {
  const raw = storage();
  raw.setItem(
    OUTBOX_KEY,
    JSON.stringify([{ userId: 'A', gameId: 'yesterday', points: 3, queuedAt: 1000 }]),
  );
  let submitted = 0;
  const outbox = createOutbox({
    storage: raw,
    now: () => 2000,
    submit: async () => {
      submitted++;
    },
  });
  outbox.setSession(session('A'));
  await tick();
  assert.equal(submitted, 1);
  outbox.dispose();
  let state;
  const broken = createOutbox({
    storage: {
      getItem: () => '{bad',
      setItem() {
        throw Error('full');
      },
    },
    submit: async () => {},
    onChange: (next) => {
      state = next;
    },
  });
  broken.setSession(session('A'));
  broken.recordWin(win(), 'A');
  await tick();
  assert.match(state.warning, /survive reload/);
  broken.dispose();
  raw.setItem(
    OUTBOX_KEY,
    JSON.stringify([{ userId: 'A', gameId: 'expired', points: 3, queuedAt: 1 }]),
  );
  const expired = createOutbox({
    storage: raw,
    now: () => 8 * 86400000,
    submit: async () => {
      throw Error('must not submit expired result');
    },
    onChange: (next) => {
      state = next;
    },
  });
  expired.setSession(session('A'));
  await tick();
  assert.equal(state.pending, 0);
  assert.match(state.warning, /expired/);
  expired.dispose();
});

test('automatic retry work and queue size are bounded', async () => {
  const callbacks = [];
  let calls = 0;
  const outbox = createOutbox({
    storage: storage(),
    submit: async () => {
      calls++;
      throw Error('offline');
    },
    schedule: (callback) => {
      callbacks.push(callback);
    },
    cancel() {},
  });
  outbox.setSession(session('A'));
  outbox.recordWin(win(), 'A');
  await tick();
  for (let i = 0; i < 10 && callbacks.length; i++) {
    callbacks.shift()();
    await tick();
  }
  assert.equal(calls, 6);
  assert.equal(callbacks.length, 0);
  outbox.dispose();
  const raw = storage();
  let state;
  const bounded = createOutbox({
    storage: raw,
    submit: async () => {},
    onChange: (next) => {
      state = next;
    },
  });
  for (let i = 0; i < 205; i++) bounded.recordWin(win(`game-${i}`), 'A');
  assert.equal(JSON.parse(raw.getItem(OUTBOX_KEY)).length, 200);
  assert.match(state.warning, /queue limit/);
  bounded.dispose();
});
