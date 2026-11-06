import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutChain } from '../src/chain.js';
import { CODES } from '../src/data.js';

test('compact route cards use less area and fit more cards per row without shrinking touch targets', () => {
  const route = CODES.slice(0, 24);
  const normal = layoutChain(route, 334, 400);
  const compact = layoutChain(route, 334, 400, { compact: true });
  assert.equal(normal.filter((card) => card.row === 0).length, 6);
  assert.equal(compact.filter((card) => card.row === 0).length, 7);
  assert.ok(compact[0].width * compact[0].height < normal[0].width * normal[0].height);
  for (const [width, height] of [
    [294, 300],
    [334, 400],
    [624, 400],
    [456, 240],
  ]) {
    const cards = layoutChain(route, width, height, { compact: true });
    for (const card of cards) {
      assert.equal(card.width, 44);
      assert.ok(card.height >= 44 && card.height <= 48);
      assert.ok(card.x - card.width / 2 >= 0);
      assert.ok(card.x + card.width / 2 <= width);
      assert.ok(card.y - card.height / 2 >= 0);
      assert.ok(card.y + card.height / 2 <= height);
    }
    for (let index = 1; index < cards.length; index++) {
      const previous = cards[index - 1];
      const current = cards[index];
      if (previous.row === current.row) assert.equal(current.x - previous.x, 46);
    }
  }
});
