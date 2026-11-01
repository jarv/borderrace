import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODES, STATES, EAST, WEST, coast } from '../src/data.js';
import {
  createDeal,
  findSolution,
  findContinuation,
  allCoastalStartsSolvable,
  findLongestRoute,
  findMostPointsRoute,
  planCompletion,
  getHint,
  canAdd,
  isComplete,
  isLegalRoute,
  score,
  backtrack,
  newGame,
  validGame,
  addCard,
  penalizeInvalidCard,
} from '../src/game.js';
import { emptySave, loadSave, writeSave, recordResult, STORAGE_KEY } from '../src/storage.js';
import { layoutChain } from '../src/chain.js';

const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
const fixture = (overrides = {}) => {
  const { scoring, cardPoints, ...legacy } = newGame();
  return { ...legacy, deal, ...overrides };
};
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

test('geography covers 48 states with symmetric borders and original points', () => {
  assert.equal(CODES.length, 48);
  assert.equal(EAST.length, 14);
  assert.equal(WEST.length, 3);
  assert.equal(coast('LA'), null);
  for (const code of CODES) {
    assert.ok(STATES[code].points >= 1 && STATES[code].points <= 4);
    for (const neighbor of STATES[code].neighbors)
      assert.ok(STATES[neighbor].neighbors.includes(code));
  }
  for (const [a, b] of [
    ['AZ', 'CO'],
    ['NM', 'UT'],
    ['MI', 'MN'],
    ['NY', 'RI'],
  ])
    assert.ok(STATES[a].neighbors.includes(b));
});

test('100 reproducible deals contain 24 unique states and a solution from every coast', () => {
  const random = seeded(42);
  for (let i = 0; i < 100; i++) {
    const hand = createDeal(random);
    assert.equal(new Set(hand).size, 24);
    assert.ok(isComplete(hand, findSolution(hand)));
    assert.ok(allCoastalStartsSolvable(hand));
    for (const start of hand.filter((code) => coast(code))) {
      const route = findContinuation(hand, [start]);
      assert.equal(route[0], start);
      assert.ok(isComplete(hand, route));
    }
  }
});

test('coastal-start validation rejects stranded coasts without invalidating legacy saves', () => {
  assert.ok(findSolution(deal));
  assert.equal(findContinuation(deal, ['ME']), null);
  assert.equal(allCoastalStartsSolvable(deal), false);
  assert.equal(allCoastalStartsSolvable(['CA', 'OR']), false);
  assert.equal(allCoastalStartsSolvable(['NC', 'VA']), false);
  assert.equal(allCoastalStartsSolvable(['AZ', 'NM']), false);
  const legacy = fixture({ route: ['ME'] });
  assert.ok(validGame(legacy));
  const storage = { getItem: () => JSON.stringify({ ...emptySave(), game: legacy }) };
  assert.deepEqual(loadSave(storage).game, legacy);
});

test('bounded generation falls back to a fresh hand with every coastal start solvable', () => {
  let calls = 0;
  const hand = createDeal(() => {
    calls++;
    return 0;
  });
  assert.equal(calls, 10_000 * (CODES.length - 1));
  assert.equal(new Set(hand).size, 24);
  assert.ok(allCoastalStartsSolvable(hand));
  hand.pop();
  assert.equal(createDeal(() => 0).length, 24);
  const game = newGame(() => 0);
  const fallback = {
    ...game,
    scoring: 'base-v1',
    cardPoints: Object.fromEntries(game.deal.map((code) => [code, 1])),
  };
  assert.ok(validGame(fallback));
  assert.ok(allCoastalStartsSolvable(fallback.deal));
});

test('routes require exact borders, no wildcard/repeats, and stop on the opposite coast', () => {
  assert.ok(isComplete(deal, route));
  assert.ok(isComplete(deal, [...route].reverse()));
  assert.equal(isComplete(deal, ['CA', 'NC']), false);
  assert.equal(isLegalRoute(deal, ['CA', 'AZ', 'CA']), false);
  assert.equal(canAdd(deal, [], 'AZ'), false);
  assert.equal(canAdd(deal, ['CA'], 'wild'), false);
  assert.equal(isLegalRoute(deal, ['CA', 'wild', 'NM']), false);
  assert.equal(canAdd(deal, route, 'GA'), false);
  assert.equal(isLegalRoute(deal, [...route, 'GA']), false);
  assert.deepEqual(backtrack(route, 'NM'), ['CA', 'AZ']);
});

test('hints lead to a solution and identify backtracking without mutating the route', () => {
  let path = [];
  for (let i = 0; i < 24 && !isComplete(deal, path); i++) {
    const before = [...path];
    const hint = getHint(deal, path);
    assert.deepEqual(path, before);
    assert.equal(hint.type, 'play');
    assert.ok(canAdd(deal, path, hint.code));
    path.push(hint.code);
  }
  assert.ok(isComplete(deal, path));
  assert.deepEqual(getHint(deal, path), { type: 'complete' });
  assert.deepEqual(getHint(deal, ['ME']), { type: 'undo', code: 'ME', playCode: 'NC' });
  const blocked = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'KY', 'IN', 'MI'];
  assert.ok(isLegalRoute(deal, blocked));
  const undo = getHint(deal, blocked);
  assert.deepEqual(undo, { type: 'undo', code: 'KY', playCode: 'GA' });
  const prefix = backtrack(blocked, undo.code);
  assert.ok(canAdd(deal, prefix, undo.playCode));
  assert.ok(isComplete(deal, [...prefix, undo.playCode]));
});

test('a hint zeros the next added card, including a different choice and undo/replay', () => {
  let game = fixture({ hintPending: true });
  const invalid = addCard(game, 'AZ');
  assert.equal(invalid, game);
  assert.equal(invalid.hintPending, true);
  game = addCard(game, 'CA');
  assert.deepEqual(game.zeroCards, ['CA']);
  assert.equal(game.hintPending, false);
  assert.equal(score(game.route, game.zeroCards), 0);
  game = addCard(game, 'AZ');
  assert.equal(score(game.route, game.zeroCards), 2);
  game = { ...game, route: backtrack(game.route, 'CA') };
  game = addCard(game, 'CA');
  assert.equal(score(game.route, game.zeroCards), 0);
  assert.deepEqual(game.zeroCards, ['CA']);
  assert.equal(score(route, ['NC']), 10);
});

test('new games begin playing with pending points and an unstarted sweep, without timestamps', () => {
  const game = newGame(seeded(23));
  assert.equal(game.status, 'playing');
  assert.deepEqual(game.route, []);
  assert.equal('startedAt' in game, false);
  assert.equal('finishedAt' in game, false);
  assert.deepEqual(game.sweep, { origin: null, progress: 0, multiplier: 1 });
  assert.ok(validGame(game));
  assert.equal(validGame({ ...game, deal: Array(24).fill('CA') }), false);
  assert.equal(validGame({ ...game, zeroCards: ['AK'] }), false);
  assert.equal(validGame({ ...game, hintPending: 'yes' }), false);
  assert.ok(validGame(fixture({ status: 'won', route })));
  assert.equal(validGame(fixture({ status: 'won', route: ['CA', 'NC'] })), false);
});

test('invalid selections deduct original points repeatedly without consuming hints', () => {
  let game = fixture({ hintPending: true, zeroCards: ['AZ'] });
  game = penalizeInvalidCard(game, 'AZ');
  assert.equal(game.mistakePoints, 2);
  game = penalizeInvalidCard(game, 'AZ');
  assert.equal(score(game.route, game.zeroCards, game.mistakePoints), -4);
  assert.equal(game.hintPending, true);
  assert.equal(penalizeInvalidCard(game, 'CA'), game);
  assert.equal(penalizeInvalidCard(game, 'wild'), game);
  game = addCard(game, 'CA');
  assert.equal(game.mistakePoints, 4);
  assert.equal(penalizeInvalidCard(game, 'CA'), game);
  game = { ...game, route: backtrack(game.route, 'CA') };
  assert.equal(score(game.route, game.zeroCards, game.mistakePoints), -4);
  for (const status of ['won', 'lost']) {
    const ended = { ...game, status };
    assert.equal(penalizeInvalidCard(ended, 'AZ'), ended);
  }
  assert.equal(newGame().mistakePoints, 0);
  const { mistakePoints, ...oldGame } = game;
  assert.ok(validGame(oldGame));
  for (const value of [-1, 1.5, '2', null, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(validGame({ ...game, mistakePoints: value }), false);
});

test('mistake deductions and negative winning records survive storage', () => {
  const game = fixture({ route, status: 'won', mistakePoints: 20 });
  const save = recordResult(emptySave(), game);
  assert.equal(save.records[0].points, -9);
  const loaded = loadSave({ getItem: () => JSON.stringify(save) });
  assert.deepEqual(loaded.game, game);
  assert.deepEqual(loaded.records, save.records);
});

test('longest routes are exact in either direction and end at the first opposite coast', () => {
  function brute(codes) {
    let longest = 0;
    function visit(path) {
      const last = path.at(-1);
      if (coast(last) && coast(last) !== coast(path[0])) {
        longest = Math.max(longest, path.length);
        return;
      }
      for (const next of STATES[last].neighbors)
        if (codes.includes(next) && !path.includes(next)) visit([...path, next]);
    }
    codes.filter(coast).forEach((code) => visit([code]));
    return longest;
  }
  for (const codes of [
    route,
    [...route, 'CO', 'KS'],
    [...route, 'OR', 'ID', 'UT'],
    [...route, 'GA', 'FL', 'AL'],
  ]) {
    const longest = findLongestRoute(codes);
    assert.equal(longest.length, brute(codes));
    assert.ok(isComplete(codes, longest));
  }
  assert.equal(findLongestRoute(['CA', 'ME']), null);
});

test('most-points routes match exhaustive search with zero cards and shorter score ties', () => {
  for (const codes of [
    route,
    [...route, 'CO', 'KS'],
    [...route, 'OR', 'ID', 'UT'],
    [...route, 'GA', 'FL', 'AL'],
  ]) {
    const points = Object.fromEntries(codes.map((code, index) => [code, index % 3 === 0 ? 3 : 1]));
    for (const zeroCards of [[], ['CA', 'TN'], codes]) {
      let best = null;
      function visit(path) {
        if (isComplete(codes, path)) {
          if (
            !best ||
            score(path, zeroCards, 0, points) > score(best, zeroCards, 0, points) ||
            (score(path, zeroCards, 0, points) === score(best, zeroCards, 0, points) &&
              path.length < best.length)
          )
            best = path;
          return;
        }
        for (const code of codes) if (canAdd(codes, path, code)) visit([...path, code]);
      }
      visit([]);
      const actual = findMostPointsRoute(codes, points, zeroCards);
      assert.ok(isComplete(codes, actual));
      assert.equal(score(actual, zeroCards, 0, points), score(best, zeroCards, 0, points));
      assert.equal(actual.length, best.length);
    }
  }
  assert.equal(findMostPointsRoute(['CA', 'ME']), null);
});

test('completion preserves the longest solvable prefix without mutating the player route', () => {
  for (const path of [
    [],
    ['CA'],
    ['ME'],
    ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'KY', 'IN', 'MI'],
    route,
  ]) {
    const before = [...path];
    const plan = planCompletion(deal, path);
    assert.ok(isComplete(deal, plan.route));
    assert.deepEqual(plan.route.slice(0, plan.keep), path.slice(0, plan.keep));
    for (let keep = plan.keep + 1; keep <= path.length; keep++)
      assert.equal(planCompletion(deal, path.slice(0, keep)).keep < keep, true);
    assert.deepEqual(path, before);
  }
});

test('a shorter gold route can score more than the longest route', () => {
  // Keep the scoring example independent of the current deal-generation policy.
  const codes = [
    'AL',
    'AR',
    'DE',
    'GA',
    'IL',
    'IN',
    'KY',
    'MI',
    'MN',
    'MO',
    'NC',
    'ND',
    'NJ',
    'NV',
    'OK',
    'OR',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'WA',
    'WV',
    'WY',
  ];
  const points = Object.fromEntries(codes.map((code) => [code, code === 'WA' ? 3 : 1]));
  const longest = findLongestRoute(codes);
  const best = findMostPointsRoute(codes, points);
  assert.equal(longest.length, 20);
  assert.equal(best.length, 19);
  assert.equal(score(longest, [], 0, points), 20);
  assert.equal(score(best, [], 0, points), 21);
  assert.ok(isComplete(codes, best));
});

test('storage tolerates corruption, persists pending penalties, and migrates old saves', () => {
  assert.deepEqual(loadSave(undefined), emptySave());
  assert.deepEqual(loadSave({ getItem: () => '{broken' }), emptySave());
  assert.equal(writeSave(undefined, emptySave()), false);
  let value;
  const storage = {
    getItem: () => value,
    setItem: (key, data) => {
      assert.equal(key, STORAGE_KEY);
      value = data;
    },
  };
  const game = fixture({ route: ['CA'], zeroCards: ['CA'], hintPending: true });
  writeSave(storage, { ...emptySave(), game });
  assert.deepEqual(loadSave(storage).game, game);
  const legacy = {
    version: 1,
    game: {
      id: 'old',
      mode: 'advanced',
      deal,
      route: [],
      status: 'ready',
      startedAt: null,
      finishedAt: null,
    },
    records: [{ id: 'old-score', mode: 'advanced', points: 12, seconds: 20 }],
  };
  const migrated = loadSave({ getItem: () => JSON.stringify(legacy) });
  assert.equal(migrated.game.status, 'playing');
  assert.equal('startedAt' in migrated.game, false);
  assert.deepEqual(migrated.records, [{ id: 'old-score', points: 12 }]);
  assert.deepEqual(migrated.archive, legacy);
  legacy.game.route = ['CA', 'wild'];
  assert.equal(loadSave({ getItem: () => JSON.stringify(legacy) }).game, null);
});

test('records use penalized points only, and results are recorded once', () => {
  let save = emptySave();
  const won = fixture({ status: 'won', route, zeroCards: ['NC'] });
  save = recordResult(save, won);
  assert.deepEqual(save.records, [{ id: won.id, points: 10, route }]);
  assert.deepEqual(recordResult(save, won), save);
  assert.equal(save.played, 1);
  for (let i = 0; i < 14; i++)
    save = recordResult(save, fixture({ id: `game-${i}`, status: 'won', route }));
  assert.equal(save.records.length, 10);
  assert.equal(save.records[0].points, 11);
  assert.ok(save.records.every((r) => !('seconds' in r)));
  save = recordResult(save, fixture({ status: 'lost' }));
  assert.equal(save.wins, 15);
  assert.equal(save.played, 16);
});

test('zig-zag routes wrap to fit the map while staying touch-sized', () => {
  for (const width of [294, 328, 600, 900]) {
    const height = Math.max(220, width * 0.61);
    const chain = layoutChain(route, width, height);
    assert.deepEqual(
      chain.map((p) => p.code),
      route,
    );
    for (const card of chain) {
      assert.ok(card.width >= 44 && card.height >= 44);
      assert.ok(card.x >= card.width / 2 && card.x <= width - card.width / 2);
      assert.ok(card.y >= card.height / 2 && card.y <= height - card.height / 2);
    }
    assert.equal(chain[0].y, chain[2].y);
    assert.equal(chain[1].y, chain[3].y);
    assert.ok(chain[1].y > chain[0].y);
    assert.ok(chain[1].y - chain[0].y <= 12);
    assert.ok(chain[0].x < chain[1].x);
    const long = layoutChain(CODES.slice(0, 24), width, height);
    for (const card of long) {
      assert.ok(card.width >= 44 && card.height >= 44);
      assert.ok(card.x >= card.width / 2 && card.x <= width - card.width / 2);
      assert.ok(card.y >= card.height / 2 && card.y <= height - card.height / 2);
    }
    assert.ok(long.at(-1).row > 0);
  }
});

test('score paths survive loading while legacy records and malformed paths remain safe', () => {
  const save = {
    ...emptySave(),
    records: [
      { id: 'path', points: 11, route },
      { id: 'legacy', points: 8 },
      { id: 'bad', points: 4, route: ['<script>'] },
    ],
  };
  assert.deepEqual(loadSave({ getItem: () => JSON.stringify(save) }).records, [
    { id: 'path', points: 11, route },
    { id: 'legacy', points: 8 },
    { id: 'bad', points: 4 },
  ]);
});
