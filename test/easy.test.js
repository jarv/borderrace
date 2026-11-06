import test from 'node:test';
import assert from 'node:assert/strict';
import { CODES, STATES, coast } from '../src/data.js';
import { easyCandidates, easyHand, validEasyHand } from '../src/easy.js';
import {
  newEasyGame,
  addCard,
  undoCard,
  penalizeInvalidCard,
  canAdd,
  isComplete,
  validGame,
  score,
} from '../src/game.js';
import { emptySave, loadSave, recordResult } from '../src/storage.js';
import { personalBests, newRecordFlags } from '../src/personal-bests.js';

test('Easy starts with four coastal choices, both coasts, and frozen one-point values', () => {
  for (let i = 0; i < 100; i++) {
    const game = newEasyGame();
    assert.equal(validGame(game), true);
    assert.equal(validEasyHand([], game.hand), true);
    assert.ok(game.hand.every(coast));
    assert.ok(game.hand.some((code) => coast(code) === 'east'));
    assert.ok(game.hand.some((code) => coast(code) === 'west'));
    assert.deepEqual(Object.values(game.cardPoints), Array(48).fill(1));
  }
});

test('Easy choices always finish without repeating a state, including adversarial RNG', () => {
  let seed = 42;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 200; i++) {
    let game = newEasyGame(i % 2 ? random : () => 0);
    while (!isComplete(game.deal, game.route)) {
      assert.equal(validGame(game), true);
      const valid = game.hand.filter((code) => canAdd(game.deal, game.route, code));
      assert.equal(
        valid.length,
        game.route.length ? Math.min(2, easyCandidates(game.route).length) : 4,
      );
      for (const code of valid) assert.ok(easyCandidates(game.route).includes(code));
      game = addCard(game, valid[Math.floor(random() * valid.length)]);
      assert.ok(game.route.length <= 48);
    }
    assert.equal(validGame({ ...game, status: 'won' }), true);
    assert.equal(new Set(game.route).size, game.route.length);
    assert.deepEqual(game.hand, []);
    assert.equal(score(game.route, [], 0, game.cardPoints), game.route.length);
  }
});

test('Maine offers one valid choice and three non-neighbors', () => {
  assert.deepEqual(easyCandidates(['ME']), ['NH']);
  const hand = easyHand(['ME']);
  assert.equal(validEasyHand(['ME'], hand), true);
  assert.equal(hand.filter((code) => STATES.ME.neighbors.includes(code)).length, 1);
});

test('invalid picks preserve the hand, hints remain zero after undo, and sweep never rewinds', () => {
  let game = newEasyGame();
  game = { ...game, hand: ['CA', 'WA', 'ME', 'FL'] };
  game = addCard(game, 'CA');
  const invalid = game.hand.find((code) => !canAdd(CODES, game.route, code));
  const penalty = penalizeInvalidCard(game, invalid);
  assert.deepEqual(penalty.hand, game.hand);
  assert.equal(penalty.mistakePoints, 1);
  assert.ok(penalty.sweep.multiplier > game.sweep.multiplier);
  const next = game.hand.find((code) => canAdd(CODES, game.route, code));
  game = addCard({ ...penalty, hintPending: true }, next);
  assert.deepEqual(game.zeroCards, [next]);
  const undone = undoCard(game, next);
  assert.deepEqual(undone.route, ['CA']);
  assert.deepEqual(undone.sweep, game.sweep);
  assert.deepEqual(undone.zeroCards, [next]);
  assert.equal(validEasyHand(undone.route, undone.hand), true);
  assert.equal(undoCard(undone, 'CA'), undone);
  const unavailable = easyCandidates(undone.route).find((code) => !undone.hand.includes(code));
  if (unavailable) assert.equal(addCard(undone, unavailable), undone);
});

test('Easy saves round-trip hands and isolate records and personal bests', () => {
  let game = newEasyGame();
  while (!isComplete(CODES, game.route))
    game = addCard(
      game,
      game.hand.find((code) => easyCandidates(game.route).includes(code)),
    );
  game = { ...game, status: 'won', playSeconds: 20 };
  const old = {
    ...emptySave(),
    records: [{ id: 'old', points: 100 }],
    wins: 1,
    played: 2,
    personalBests: { points: 100, playSeconds: 10 },
  };
  const save = recordResult(old, game);
  assert.equal(save.wins, 1);
  assert.equal(save.easyWins, 1);
  assert.equal(save.easyPlayed, 1);
  assert.equal(personalBests(save).playSeconds, 10);
  assert.equal(personalBests(save, 'easy').playSeconds, 20);
  assert.equal(newRecordFlags(save, { ...game, playSeconds: 15 }).time, true);
  assert.equal(recordResult(save, game), save);
  const loaded = loadSave({ getItem: () => JSON.stringify(save) });
  assert.deepEqual(loaded.game, game);
  assert.deepEqual(loaded.easyRecords, save.easyRecords);
  assert.deepEqual(loaded.easyPersonalBests, save.easyPersonalBests);
  const playing = addCard(newEasyGame(), 'not-a-state');
  assert.deepEqual(
    loadSave({ getItem: () => JSON.stringify({ ...emptySave(), game: playing }) }).game,
    playing,
  );
});

test('corrupt Easy hands and bonus points cannot load as valid games', () => {
  const game = newEasyGame();
  assert.equal(validGame({ ...game, hand: ['CA', 'CA', 'ME', 'FL'] }), false);
  assert.equal(validGame({ ...game, cardPoints: { ...game.cardPoints, CA: 3 } }), false);
  assert.equal(validGame({ ...game, difficulty: 'other' }), false);
});
