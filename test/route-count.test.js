import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODES, coast } from '../src/data.js';
import { canAdd, isComplete } from '../src/game.js';
import { countWinningRoutes } from '../scripts/count-routes.js';

function bruteForce(deal) {
  const routes = [];
  function walk(path) {
    if (isComplete(deal, path)) {
      routes.push(path);
      return;
    }
    for (const code of deal) if (canAdd(deal, path, code)) walk([...path, code]);
  }
  walk([]);
  return routes;
}
test('exact route counts match independent legal-route enumeration', () => {
  for (const deal of [
    [],
    ['CA', 'AZ'],
    ['CA', 'OR'],
    ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'],
    ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC', 'GA'],
    ['CA', 'AZ', 'NM', 'CO', 'KS', 'OK', 'AR', 'TN', 'NC', 'GA'],
  ]) {
    const expected = bruteForce(deal);
    const actual = countWinningRoutes(deal);
    assert.equal(actual.complete, true);
    assert.equal(actual.routes, BigInt(expected.length));
    for (const code of deal)
      assert.equal(
        actual.byCard[code],
        BigInt(expected.filter((path) => path.includes(code)).length),
      );
    for (let length = 0; length <= deal.length; length++)
      assert.equal(
        actual.byLength[length],
        BigInt(expected.filter((path) => path.length === length).length),
      );
    assert.equal(
      actual.byDirection.eastToWest,
      BigInt(expected.filter((path) => coast(path[0]) === 'east').length),
    );
    assert.equal(
      actual.byDirection.westToEast,
      BigInt(expected.filter((path) => coast(path[0]) === 'west').length),
    );
  }
});
test('interrupted counts are explicitly incomplete, never presented as exact', () => {
  const deal = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
  const limited = countWinningRoutes(deal, { visitLimit: 1 });
  assert.equal(limited.complete, false);
  assert.equal(limited.reason, 'visit limit');
  assert.equal(limited.visits, 1);
  const stopped = countWinningRoutes(deal, { shouldStop: () => true });
  assert.equal(stopped.complete, false);
  assert.equal(stopped.routes, 0n);
  assert.equal(stopped.visits, 0);
});
test('route counting rejects invalid or oversized inputs', () => {
  for (const deal of [null, ['CA', 'CA'], ['AK'], CODES.slice(0, 25)])
    assert.throws(() => countWinningRoutes(deal));
});
