import { CODES, STATES, EAST, WEST, coast } from './data.js';

export function findSolution(deal) {
  const allowed = new Set(deal);
  const queue = EAST.filter((code) => allowed.has(code)).map((code) => [code]);
  const visited = new Set(queue.flat());
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path.at(-1);
    if (WEST.includes(last)) return path;
    for (const next of STATES[last].neighbors) {
      if (allowed.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

// Shortest continuation of the actual route, without reusing cards.
export function findContinuation(deal, route) {
  if (!isLegalRoute(deal, route)) return null;
  if (!route.length) return findSolution(deal);
  if (isComplete(deal, route)) return [...route];
  const target = coast(route[0]) === 'east' ? WEST : EAST;
  const visited = new Set(route);
  const queue = deal.filter((code) => canAdd(deal, route, code)).map((code) => [...route, code]);
  queue.forEach((path) => visited.add(path.at(-1)));
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const last = path.at(-1);
    if (target.includes(last)) return path;
    for (const next of STATES[last].neighbors) {
      if (!visited.has(next) && canAdd(deal, path, next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

export function getHint(deal, route) {
  if (isComplete(deal, route)) return { type: 'complete' };
  for (let keep = route.length; keep >= 0; keep--) {
    const prefix = route.slice(0, keep);
    const solution = findContinuation(deal, prefix);
    if (solution)
      return keep < route.length
        ? { type: 'undo', code: route[keep] }
        : { type: 'play', code: solution[keep] };
  }
  return null;
}

// Exact longest simple route. Reaching the opposite coast ends the route.
// Run in a worker: longest-path search can be expensive on highly connected deals.
export function findLongestRoute(deal) {
  let best = findSolution(deal);
  if (!best) return null;
  const codes = [...new Set(deal)];
  const indices = new Map(codes.map((code, index) => [code, index]));
  const graph = codes.map((code) =>
    STATES[code].neighbors.filter((next) => indices.has(next)).map((next) => indices.get(next)),
  );
  let targets;
  const path = [];
  const seen = new Set();
  function search(node, used) {
    path.push(node);
    used |= 1 << node;
    if (targets.has(node)) {
      if (path.length > best.length) best = path.map((index) => codes[index]);
      path.pop();
      return;
    }
    if (best.length === codes.length) {
      path.pop();
      return;
    }
    const key = used * 32 + node;
    if (seen.has(key)) {
      path.pop();
      return;
    }
    // Bound memory without abandoning the exact search.
    if (seen.size < 500_000) seen.add(key);
    const reachable = [node];
    let mask = 1 << node;
    let reachesTarget = targets.has(node);
    for (let i = 0; i < reachable.length; i++) {
      for (const next of graph[reachable[i]]) {
        if (!(mask & (1 << next)) && !(used & (1 << next))) {
          mask |= 1 << next;
          reachable.push(next);
          if (targets.has(next)) reachesTarget = true;
        }
      }
    }
    if (reachesTarget && path.length + reachable.length - 1 > best.length) {
      const nextNodes = graph[node]
        .filter((next) => !(used & (1 << next)))
        .sort((a, b) => graph[a].length - graph[b].length);
      for (const next of nextNodes) {
        search(next, used);
        if (best.length === codes.length) break;
      }
    }
    path.pop();
  }
  for (const [starts, ends] of [
    [EAST, WEST],
    [WEST, EAST],
  ]) {
    targets = new Set(ends.filter((code) => indices.has(code)).map((code) => indices.get(code)));
    seen.clear();
    for (const code of starts) {
      if (indices.has(code)) search(indices.get(code), 0);
      if (best.length === codes.length) break;
    }
    if (best.length === codes.length) break;
  }
  return best;
}

export function createDeal(random = Math.random) {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const shuffled = [...CODES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const deal = shuffled.slice(0, 24).sort();
    if (findSolution(deal)) return deal;
  }
  throw new Error('Unable to deal a solvable board. Please try again.');
}

export function canAdd(deal, route, code) {
  if (!STATES[code] || !deal.includes(code) || route.includes(code)) return false;
  if (!route.length) return Boolean(coast(code));
  const last = route.at(-1);
  if (coast(last) && coast(last) !== coast(route[0])) return false;
  return STATES[last]?.neighbors.includes(code) ?? false;
}

export function isLegalRoute(deal, route) {
  if (!Array.isArray(route) || route.length > 24) return false;
  return route.every((code, index) => canAdd(deal, route.slice(0, index), code));
}

export function isComplete(deal, route) {
  return (
    route.length > 1 &&
    isLegalRoute(deal, route) &&
    Boolean(coast(route[0])) &&
    Boolean(coast(route.at(-1))) &&
    coast(route[0]) !== coast(route.at(-1))
  );
}

export const pointsFor = (code, zeroCards = []) =>
  zeroCards.includes(code) ? 0 : (STATES[code]?.points ?? 0);
export const score = (route, zeroCards = []) =>
  route.reduce((total, code) => total + pointsFor(code, zeroCards), 0);
export const backtrack = (route, code) =>
  route.includes(code) ? route.slice(0, route.indexOf(code)) : route;

export function addCard(game, code) {
  if (game.status !== 'playing' || !canAdd(game.deal, game.route, code)) return game;
  return {
    ...game,
    route: [...game.route, code],
    hintPending: false,
    zeroCards:
      game.hintPending && !game.zeroCards.includes(code)
        ? [...game.zeroCards, code]
        : game.zeroCards,
  };
}

export function newGame(random = Math.random) {
  return {
    id: crypto.randomUUID(),
    deal: createDeal(random),
    route: [],
    zeroCards: [],
    hintPending: false,
    status: 'playing',
  };
}

export function validGame(game) {
  if (
    !game ||
    typeof game.id !== 'string' ||
    !Array.isArray(game.deal) ||
    game.deal.length !== 24 ||
    new Set(game.deal).size !== 24 ||
    !game.deal.every((code) => STATES[code]) ||
    !findSolution(game.deal) ||
    !isLegalRoute(game.deal, game.route) ||
    !Array.isArray(game.zeroCards) ||
    new Set(game.zeroCards).size !== game.zeroCards.length ||
    !game.zeroCards.every((code) => game.deal.includes(code)) ||
    typeof game.hintPending !== 'boolean' ||
    !['playing', 'won', 'lost'].includes(game.status)
  )
    return false;
  return game.status !== 'won' || isComplete(game.deal, game.route);
}
