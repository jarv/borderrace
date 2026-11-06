import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preloadSeals } from '../src/preload-seals.js';

test('seal preloading waits for idle, deduplicates URLs, and uses bounded low-priority HTTP cache reads', async () => {
  const urls = Array.from({ length: 12 }, (_, index) => `./assets/seal-${index}.png`);
  let start;
  const calls = [];
  let active = 0;
  let maximum = 0;
  let consumed = 0;
  const done = preloadSeals(
    {
      large: Object.fromEntries(urls.map((url, index) => [index, url])),
      small: { duplicate: urls[0] },
    },
    {
      schedule: (callback) => {
        start = callback;
      },
      fetchImage: async (url, options) => {
        calls.push(url);
        assert.equal(options.cache, 'force-cache');
        assert.equal(options.priority, 'low');
        assert.ok(options.signal instanceof AbortSignal);
        maximum = Math.max(maximum, ++active);
        return {
          ok: true,
          arrayBuffer: async () => {
            await Promise.resolve();
            consumed++;
            active--;
            return new ArrayBuffer(0);
          },
        };
      },
    },
  );
  assert.deepEqual(calls, []);
  start();
  await done;
  assert.deepEqual(calls, urls);
  assert.equal(consumed, 12);
  assert.equal(maximum, 4);
});

test('failed, missing, and unreadable seals do not stop remaining preload requests', async () => {
  const calls = [];
  await preloadSeals(
    { large: { A: 'offline', B: 'missing', C: 'unreadable', D: 'ok', E: 'last' } },
    {
      schedule: (callback) => callback(),
      fetchImage: async (url) => {
        calls.push(url);
        if (url === 'offline') throw new Error('Offline');
        return {
          ok: url !== 'missing',
          arrayBuffer: async () => {
            if (url === 'unreadable') throw new Error('Interrupted');
            return new ArrayBuffer(0);
          },
        };
      },
    },
  );
  assert.deepEqual(calls, ['offline', 'missing', 'unreadable', 'ok', 'last']);
  await preloadSeals({}, { fetchImage: null });
});
