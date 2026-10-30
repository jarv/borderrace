import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeal,
  newGame,
  addCard,
  penalizeInvalidCard,
  backtrack,
  pointsFor,
  score,
  validGame,
  findContinuation,
} from '../src/game.js';
import { countWinningRoutes } from '../src/route-count.js';
import { pointsFromCounts } from '../src/scoring.js';
import { emptySave, writeSave, loadSave, recordResult } from '../src/storage.js';

let seed = 7;
const deal = createDeal(() => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const counts = countWinningRoutes(deal);
const cardPoints = pointsFromCounts(deal, counts);
const fixture = (overrides = {}) => ({ ...newGame(), deal, cardPoints, ...overrides });

test('hard bonuses use exact participation below 10%, excluding zero and the boundary', () => {
  assert.deepEqual(
    pointsFromCounts(['CA', 'OR', 'WA', 'AZ', 'NM'], {
      complete: true,
      routes: 100n,
      byCard: { CA: 0n, OR: 1n, WA: 9n, AZ: 10n, NM: 100n },
    }),
    { CA: 1, OR: 3, WA: 3, AZ: 1, NM: 1 },
  );
  const huge = 10n ** 30n;
  assert.equal(
    pointsFromCounts(['CA'], { complete: true, routes: huge, byCard: { CA: huge / 10n - 1n } }).CA,
    3,
  );
  assert.throws(() => pointsFromCounts(deal, { ...counts, complete: false }));
  assert.throws(() => pointsFromCounts([], { complete: true, routes: 0n }));
  assert.deepEqual(
    Object.keys(cardPoints).filter((code) => cardPoints[code] === 3),
    ['GA', 'OR', 'SC'],
  );
  let otherSeed = 1;
  const otherDeal = createDeal(
    () => (otherSeed = (Math.imul(otherSeed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
  );
  assert.equal(pointsFromCounts(otherDeal, countWinningRoutes(otherDeal)).OR, 1);
  assert.equal(cardPoints.OR, 3);
});

test('deal points stay fixed through hints, invalid selections, undo, and replay', () => {
  let game = fixture({ hintPending: true });
  game = addCard(game, 'OR');
  assert.equal(pointsFor('OR', game.zeroCards, game.cardPoints), 0);
  assert.equal(game.cardPoints.OR, 3);
  game = penalizeInvalidCard(game, 'GA');
  assert.equal(game.mistakePoints, 3);
  game = addCard(game, 'CA');
  assert.equal(score(game.route, game.zeroCards, game.mistakePoints, game.cardPoints), -2);
  game = { ...game, route: backtrack(game.route, 'OR') };
  game = addCard(game, 'OR');
  assert.equal(pointsFor('OR', game.zeroCards, game.cardPoints), 0);
  assert.deepEqual(game.cardPoints, cardPoints);
  assert.equal(pointsFor('NM'), 3); // Existing unversioned games retain legacy values.
  assert.equal(pointsFor('NM', [], cardPoints), 1);
});

test('pending, completed, and fallback scoring saves validate defensively', () => {
  const pending = newGame();
  assert.ok(validGame(pending));
  assert.equal(addCard(pending, pending.deal[0]), pending);
  assert.equal(penalizeInvalidCard(pending, pending.deal[0]), pending);
  assert.equal(validGame({ ...pending, hintPending: true }), false);
  assert.ok(validGame(fixture()));
  for (const bad of [undefined, {}, [], { ...cardPoints, OR: 2 }, { ...cardPoints, AK: 1 }])
    assert.equal(validGame(fixture({ cardPoints: bad })), false);
  assert.equal(validGame(fixture({ scoring: 'unknown' })), false);
  assert.equal(validGame(fixture({ scoring: 'base-v1' })), false);
  assert.ok(
    validGame(
      fixture({
        scoring: 'base-v1',
        cardPoints: Object.fromEntries(deal.map((code) => [code, 1])),
      }),
    ),
  );
});

test('frozen deal points persist and winning records use the same penalized score', () => {
  const route = findContinuation(deal, ['OR']);
  const game = fixture({ route, status: 'won', zeroCards: ['OR'], mistakePoints: 3 });
  let value;
  const storage = {
    getItem: () => value,
    setItem: (_, data) => {
      value = data;
    },
  };
  const save = recordResult(emptySave(), game);
  assert.equal(save.records[0].points, score(route, ['OR'], 3, cardPoints));
  assert.ok(writeSave(storage, save));
  assert.deepEqual(loadSave(storage), save);
});
