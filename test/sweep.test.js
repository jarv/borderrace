import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newSweep,
  advanceSweep,
  accelerateSweep,
  restoreSweep,
  sweepFrontier,
  validSweep,
  CARD_ACCELERATION,
  PENALTY_ACCELERATION,
} from '../src/sweep.js';
import { addCard, penalizeInvalidCard, newGame, validGame } from '../src/game.js';
import { CODES } from '../src/data.js';
import { loadSave, emptySave } from '../src/storage.js';

const path = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
const deal = [...new Set([...path, ...CODES])].slice(0, 24).sort();
const fixture = () => ({
  ...newGame(),
  deal,
  scoring: 'base-v1',
  cardPoints: Object.fromEntries(deal.map((code) => [code, 1])),
});

test('sweep starts only with the first valid coastal card and crosses in 90 base seconds', () => {
  let game = fixture();
  assert.deepEqual(game.sweep, newSweep());
  assert.equal(addCard(game, 'AZ'), game);
  assert.deepEqual(advanceSweep(game.sweep, 100), newSweep());
  game = addCard(game, 'CA');
  assert.equal(game.sweep.origin, 'CA');
  assert.equal(game.sweep.multiplier, 1);
  assert.equal(advanceSweep(game.sweep, 45).progress, 0.5);
  assert.equal(advanceSweep(game.sweep, 90).progress, 1);
  assert.equal(advanceSweep(game.sweep, 1000).progress, 1);
});

test('valid plays and hints accelerate permanently, with a 3x cap and no point changes', () => {
  let game = addCard(fixture(), 'CA');
  game = { ...game, sweep: advanceSweep(game.sweep, 1) };
  const progress = game.sweep.progress;
  game = addCard(game, 'AZ');
  assert.equal(game.sweep.multiplier, 1 + CARD_ACCELERATION);
  assert.equal(game.sweep.progress, progress);
  game = { ...game, route: [] };
  game = addCard(game, 'CA');
  assert.equal(game.sweep.origin, 'CA');
  assert.equal(game.sweep.progress, progress);
  assert.ok(Math.abs(game.sweep.multiplier - 1.16) < 1e-8);
  const hinted = accelerateSweep(game.sweep, PENALTY_ACCELERATION);
  assert.ok(hinted.multiplier > game.sweep.multiplier + CARD_ACCELERATION);
  assert.equal(accelerateSweep(hinted, 100).multiplier, 3);
  assert.equal(advanceSweep({ ...hinted, multiplier: 3 }, 30).progress, 1);
});

test('invalid cards apply the same 35% speed penalty as hints while retaining point and hint rules', () => {
  let game = { ...fixture(), hintPending: true };
  game = penalizeInvalidCard(game, 'AZ');
  assert.equal(game.sweep.origin, null);
  assert.equal(game.sweep.progress, 0);
  assert.equal(game.sweep.multiplier, 1.35);
  assert.equal(game.mistakePoints, 1);
  assert.equal(game.hintPending, true);
  assert.deepEqual(game.sweep, accelerateSweep(newSweep(), PENALTY_ACCELERATION));
  game = addCard(game, 'CA');
  assert.deepEqual(game.zeroCards, ['CA']);
  assert.equal(game.sweep.multiplier, 1.35);
  assert.equal(penalizeInvalidCard(game, 'AZ'), game);
  assert.equal(penalizeInvalidCard(game, 'CA'), game);
  assert.equal(penalizeInvalidCard(game, 'unknown'), game);
  game = penalizeInvalidCard(game, 'NC');
  assert.ok(Math.abs(game.sweep.multiplier - 1.7) < 1e-8);
  for (let i = 0; i < 10; i++) game = penalizeInvalidCard(game, 'NC');
  assert.equal(game.sweep.multiplier, 3);
  assert.equal(game.mistakePoints, 12);
});

test('frontier follows actual furthest extent in either direction, not the last card', () => {
  const bounds = new Map([
    ['CA', { left: 0.1, right: 0.2 }],
    ['AZ', { left: 0.2, right: 0.3 }],
    ['NM', { left: 0.3, right: 0.4 }],
    ['NC', { left: 0.8, right: 0.9 }],
  ]);
  assert.deepEqual(sweepFrontier({ ...newSweep(), origin: 'CA' }, ['CA', 'NM', 'AZ'], bounds), {
    code: 'NM',
    near: 0.3,
    far: 0.4,
  });
  const west = sweepFrontier({ ...newSweep(), origin: 'NC' }, ['NC', 'NM', 'AZ'], bounds);
  assert.equal(west.code, 'AZ');
  assert.equal(west.near, 0.7);
  assert.equal(west.far, 0.8);
  assert.equal(sweepFrontier({ ...newSweep(), origin: 'CA' }, [], bounds).code, 'CA');
});

test('sweep snapshots validate defensively and legacy point records stay compatible', () => {
  const game = addCard(fixture(), 'CA');
  for (const value of [
    null,
    [],
    {},
    { ...game.sweep, origin: 'AZ' },
    { ...game.sweep, progress: -1 },
    { ...game.sweep, progress: 2 },
    { ...game.sweep, progress: NaN },
    { ...game.sweep, multiplier: Infinity },
    { ...game.sweep, multiplier: 0 },
    { ...game.sweep, multiplier: 4 },
    { ...game.sweep, origin: null, progress: 0.1 },
  ]) {
    assert.equal(validSweep(value, deal), false);
    assert.equal(validGame({ ...game, sweep: value }), false);
  }
  assert.equal(validGame({ ...game, lossReason: 'timeout' }), false);
  assert.ok(validGame({ ...game, status: 'lost', lossReason: 'timeout' }));
  const { sweep, ...legacy } = game;
  assert.ok(validGame(legacy));
  assert.deepEqual(restoreSweep(legacy), { origin: 'CA', progress: 0, multiplier: 1 });
  const timed = { ...game, sweep: { ...game.sweep, progress: 0.123, multiplier: 1.5 } };
  const save = { ...emptySave(), game: timed, records: [{ id: 'old', points: 8 }] };
  const loaded = loadSave({ getItem: () => JSON.stringify(save) });
  assert.deepEqual(loaded.game, timed);
  assert.deepEqual(loaded.records, save.records);
});
