import { STATES, EAST, WEST } from './data.js';

// Exhaustively enumerate ordered, simple winning routes. Run off the main thread
// in gameplay. Counts from interrupted runs are lower bounds, never exact.
export function countWinningRoutes(deal, { visitLimit = Infinity, shouldStop = () => false } = {}) {
  if (
    !Array.isArray(deal) ||
    deal.length > 24 ||
    new Set(deal).size !== deal.length ||
    !deal.every((code) => Object.hasOwn(STATES, code))
  )
    throw new Error('Expected at most 24 unique contiguous states');
  if (!(visitLimit >= 0)) throw new Error('Invalid visit limit');

  const indices = new Map(deal.map((code, index) => [code, index]));
  const graph = deal.map((code) =>
    STATES[code].neighbors.reduce(
      (mask, next) => (indices.has(next) ? mask | (1 << indices.get(next)) : mask),
      0,
    ),
  );
  const maskFor = (codes) =>
    codes.reduce((mask, code) => (indices.has(code) ? mask | (1 << indices.get(code)) : mask), 0);
  const east = maskFor(EAST);
  const west = maskFor(WEST);
  const byCard = Object.fromEntries(deal.map((code) => [code, 0n]));
  const byLength = Array(deal.length + 1).fill(0n);
  const byDirection = { eastToWest: 0n, westToEast: 0n };
  let routes = 0n;
  let visits = 0;
  let reason = null;

  function search(node, used, length, targets, direction) {
    if (reason) return;
    if (visits >= visitLimit) {
      reason = 'visit limit';
      return;
    }
    if ((visits & 4095) === 0 && shouldStop()) {
      reason = 'time budget';
      return;
    }
    visits++;
    const bit = 1 << node;
    used |= bit;
    if (targets & bit) {
      routes++;
      byDirection[direction]++;
      byLength[length]++;
      for (let remaining = used; remaining; remaining &= remaining - 1) {
        byCard[deal[31 - Math.clz32(remaining & -remaining)]]++;
      }
      return; // The first opposite coast ends the route, even during counting.
    }
    let next = graph[node] & ~used;
    while (next && !reason) {
      const bit = next & -next;
      next ^= bit;
      search(31 - Math.clz32(bit), used, length + 1, targets, direction);
    }
  }
  for (const [starts, targets, direction] of [
    [east, west, 'eastToWest'],
    [west, east, 'westToEast'],
  ]) {
    if (!targets) continue;
    let remaining = starts;
    while (remaining && !reason) {
      const bit = remaining & -remaining;
      remaining ^= bit;
      search(31 - Math.clz32(bit), 0, 1, targets, direction);
    }
  }
  return { complete: reason === null, reason, routes, visits, byCard, byLength, byDirection };
}
