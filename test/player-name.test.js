import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomPlayerName } from '../src/player-name.js';

test('pet names are bounded, public-safe, and use only the supplied randomness', () => {
  assert.equal(
    randomPlayerName(() => 0),
    'Brave Badger 0000',
  );
  assert.equal(
    randomPlayerName(() => 4294967295),
    'Witty Panda 7295',
  );
  for (let n = 0; n < 100; n++) {
    const name = randomPlayerName(() => n);
    assert.match(name, /^[A-Z][a-z]+ [A-Z][a-z]+ \d{4}$/);
    assert.ok(name.length <= 24);
  }
});
