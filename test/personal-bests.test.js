import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalBests, newRecordFlags, formatPlayTime } from '../src/personal-bests.js';
import { emptySave, recordResult, loadSave } from '../src/storage.js';
import { CODES } from '../src/data.js';
import { validGame, newEasyGame } from '../src/game.js';

const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
const win = (overrides = {}) => ({
  id: 'first',
  deal,
  route,
  zeroCards: [],
  hintPending: false,
  cardPoints: Object.fromEntries(deal.map((code) => [code, 1])),
  scoring: 'base-v1',
  mistakePoints: 0,
  status: 'won',
  playSeconds: 20,
  ...overrides,
});

test('first wins establish baselines; only strict improvements count as new records', () => {
  const first = win({ mistakePoints: 1 });
  assert.deepEqual(newRecordFlags(emptySave(), first), { time: false, points: false });
  let save = recordResult(emptySave(), first);
  assert.deepEqual(save.personalBests, { points: 6, playSeconds: 20 });
  assert.equal(recordResult(save, first), save);
  const better = win({ id: 'second', playSeconds: 18.5 });
  assert.deepEqual(newRecordFlags(save, better), { time: true, points: true });
  save = recordResult(save, better);
  assert.deepEqual(save.personalBests, { points: 7, playSeconds: 18.5 });
  assert.deepEqual(newRecordFlags(save, { ...better, id: 'tie' }), { time: false, points: false });
  assert.deepEqual(newRecordFlags(save, { ...better, status: 'lost' }), {
    time: false,
    points: false,
  });
});

test('Easy most-points records use penalized totals, persist, and only announce strict improvements', () => {
  const first = { ...newEasyGame(), route, status: 'won', mistakePoints: 1, playSeconds: 20 };
  assert.deepEqual(newRecordFlags(emptySave(), first), { time: false, points: false });
  const save = recordResult(emptySave(), first);
  assert.deepEqual(personalBests(save, 'easy'), { points: 6, playSeconds: 20 });
  const next = { ...first, id: 'easy-improvement', mistakePoints: 0 };
  assert.deepEqual(newRecordFlags(save, next), { time: false, points: true });
  assert.equal(newRecordFlags(save, { ...next, zeroCards: ['AZ'] }).points, false);
  assert.equal(newRecordFlags(save, { ...next, mistakePoints: 2 }).points, false);
  const restored = loadSave({ getItem: () => JSON.stringify(recordResult(save, next)) });
  assert.deepEqual(personalBests(restored, 'easy'), { points: 7, playSeconds: 20 });
  assert.deepEqual(newRecordFlags(restored, next), { time: false, points: false });
  assert.equal(personalBests(restored, 'challenging').points, null);
  assert.equal(personalBests(restored, 'medium').points, null);
});

test('best time survives top-ten trimming and reload without importing old duration fields', () => {
  let save = recordResult(emptySave(), win({ playSeconds: 5 }));
  for (let n = 0; n < 12; n++)
    save = recordResult(
      save,
      win({
        id: `high-${n}`,
        playSeconds: 25,
        cardPoints: Object.fromEntries(deal.map((code) => [code, 3])),
        scoring: 'hard-v1',
      }),
    );
  assert.equal(save.records.length, 10);
  assert.equal(
    save.records.some((record) => record.playSeconds === 5),
    false,
  );
  assert.deepEqual(save.personalBests, { points: 21, playSeconds: 5 });
  const loaded = loadSave({ getItem: () => JSON.stringify(save) });
  assert.deepEqual(loaded.personalBests, save.personalBests);
  assert.deepEqual(loaded.records, save.records);
  const old = loadSave({
    getItem: () =>
      JSON.stringify({
        ...emptySave(),
        records: [{ id: 'old', points: 30, elapsed: 2, duration: 2 }],
      }),
  });
  assert.deepEqual(old.personalBests, { points: 30, playSeconds: null });
});

test('time validation, formatting, negative point records, and corrupt bests are defensive', () => {
  assert.equal(formatPlayTime(0), '0:00.0');
  assert.equal(formatPlayTime(65.3), '1:05.3');
  assert.equal(formatPlayTime(59.99), '1:00.0');
  assert.equal(formatPlayTime(undefined), '—');
  for (const playSeconds of [-1, NaN, Infinity, '12'])
    assert.equal(validGame(win({ playSeconds })), false);
  const negative = recordResult(emptySave(), win({ mistakePoints: 20 }));
  assert.equal(negative.personalBests.points, -13);
  assert.equal(newRecordFlags(negative, win({ id: 'next', mistakePoints: 19 })).points, true);
  assert.deepEqual(
    personalBests({ personalBests: { points: '99', playSeconds: -1 }, records: [] }),
    { points: null, playSeconds: null },
  );
});
