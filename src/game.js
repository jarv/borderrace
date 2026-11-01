import { CODES, STATES, EAST, WEST, coast } from './data.js';
import { SCORING_VERSION } from './scoring.js';
import {
  newSweep,
  restoreSweep,
  accelerateSweep,
  CARD_ACCELERATION,
  PENALTY_ACCELERATION,
  validSweep,
} from './sweep.js';

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

// Preserve the longest possible prefix, then use its shortest continuation.
export function planCompletion(deal, route) {
  for (let keep = route.length; keep >= 0; keep--) {
    const solution = findContinuation(deal, route.slice(0, keep));
    if (solution) return { keep, route: solution };
  }
  return null;
}

export function getHint(deal, route) {
  if (isComplete(deal, route)) return { type: 'complete' };
  const plan = planCompletion(deal, route);
  if (!plan) return null;
  return plan.keep < route.length
    ? { type: 'undo', code: route[plan.keep], playCode: plan.route[plan.keep] }
    : { type: 'play', code: plan.route[plan.keep] };
}

// Exact simple-route optimization. Stop on the first opposite coast in either
// direction; ties use fewer cards. Nonnegative card weights make the reachable
// weight sum a safe upper bound. Run expensive searches in a worker.
export function findLongestRoute(deal) {
  return findBestRoute(deal, () => 1);
}

export function findMostPointsRoute(deal, cardPoints, zeroCards = []) {
  return findBestRoute(deal, (code) => pointsFor(code, zeroCards, cardPoints));
}

function findBestRoute(deal, valueFor) {
  let best = findSolution(deal);
  if (!best) return null;
  const codes = [...new Set(deal)];
  const indices = new Map(codes.map((code, index) => [code, index]));
  const graph = codes.map((code) =>
    STATES[code].neighbors.filter((next) => indices.has(next)).map((next) => indices.get(next)),
  );
  const weights = codes.map(valueFor);
  let bestValue = best.reduce((total, code) => total + valueFor(code), 0);
  const totalValue = weights.reduce((total, value) => total + value, 0);
  const minimumBestLength = Math.max(best.length, weights.filter((value) => value > 0).length);
  const perfect = () => bestValue === totalValue && best.length === minimumBestLength;
  let targets;
  const path = [];
  const seen = new Set();
  function search(node, used, value) {
    path.push(node);
    used |= 1 << node;
    value += weights[node];
    if (targets.has(node)) {
      if (value > bestValue || (value === bestValue && path.length < best.length)) {
        best = path.map((index) => codes[index]);
        bestValue = value;
      }
      path.pop();
      return;
    }
    if (perfect()) {
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
    let potential = value;
    for (let i = 0; i < reachable.length; i++) {
      for (const next of graph[reachable[i]]) {
        if (!(mask & (1 << next)) && !(used & (1 << next))) {
          mask |= 1 << next;
          reachable.push(next);
          potential += weights[next];
          if (targets.has(next)) reachesTarget = true;
        }
      }
    }
    if (
      reachesTarget &&
      (potential > bestValue || (potential === bestValue && path.length < best.length))
    ) {
      const nextNodes = graph[node]
        .filter((next) => !(used & (1 << next)))
        .sort((a, b) => weights[b] - weights[a] || graph[a].length - graph[b].length);
      for (const next of nextNodes) {
        search(next, used, value);
        if (perfect()) break;
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
      if (indices.has(code)) search(indices.get(code), 0, 0);
      if (perfect()) break;
    }
    if (perfect()) break;
  }
  return best;
}

export function allCoastalStartsSolvable(deal) {
  const starts = deal.filter((code) => coast(code));
  return (
    starts.some((code) => coast(code) === 'east') &&
    starts.some((code) => coast(code) === 'west') &&
    starts.every((code) => findContinuation(deal, [code]) !== null)
  );
}

// A verified coast-to-coast hand keeps generation bounded even with a poor RNG.
const fallbackDeal = [
  'AR',
  'AZ',
  'CA',
  'CT',
  'GA',
  'ID',
  'KS',
  'KY',
  'LA',
  'MA',
  'MN',
  'MT',
  'NJ',
  'NM',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'TN',
  'VA',
  'WY',
];

export function createDeal(random = Math.random) {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const shuffled = [...CODES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const deal = shuffled.slice(0, 24).sort();
    if (allCoastalStartsSolvable(deal)) return deal;
  }
  return [...fallbackDeal];
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

export const pointsFor = (code, zeroCards = [], cardPoints) =>
  zeroCards.includes(code) ? 0 : (cardPoints?.[code] ?? STATES[code]?.points ?? 0);
export const score = (route, zeroCards = [], mistakePoints = 0, cardPoints) =>
  route.reduce((total, code) => total + pointsFor(code, zeroCards, cardPoints), 0) - mistakePoints;
export const backtrack = (route, code) =>
  route.includes(code) ? route.slice(0, route.indexOf(code)) : route;

export function addCard(game, code) {
  if (game.status !== 'playing' || game.cardPoints === null || !canAdd(game.deal, game.route, code))
    return game;
  const sweep = restoreSweep(game);
  return {
    ...game,
    sweep: sweep.origin ? accelerateSweep(sweep, CARD_ACCELERATION) : { ...sweep, origin: code },
    route: [...game.route, code],
    hintPending: false,
    zeroCards:
      game.hintPending && !game.zeroCards.includes(code)
        ? [...game.zeroCards, code]
        : game.zeroCards,
  };
}

export function penalizeInvalidCard(game, code) {
  if (
    game.status !== 'playing' ||
    game.cardPoints === null ||
    !game.deal.includes(code) ||
    game.route.includes(code) ||
    canAdd(game.deal, game.route, code)
  )
    return game;
  return {
    ...game,
    mistakePoints: (game.mistakePoints ?? 0) + pointsFor(code, [], game.cardPoints),
    sweep: accelerateSweep(restoreSweep(game), PENALTY_ACCELERATION),
  };
}

export function newGame(random = Math.random) {
  return {
    id: crypto.randomUUID(),
    deal: createDeal(random),
    scoring: SCORING_VERSION,
    cardPoints: null,
    route: [],
    zeroCards: [],
    hintPending: false,
    mistakePoints: 0,
    status: 'playing',
    sweep: newSweep(),
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
    (game.mistakePoints !== undefined &&
      (!Number.isSafeInteger(game.mistakePoints) || game.mistakePoints < 0)) ||
    !['playing', 'won', 'lost'].includes(game.status)
  )
    return false;
  if (game.sweep !== undefined && !validSweep(game.sweep, game.deal)) return false;
  if (
    game.winningRoutes !== undefined &&
    (typeof game.winningRoutes !== 'string' || !/^[1-9][0-9]{0,24}$/.test(game.winningRoutes))
  )
    return false;
  if (
    game.lossReason !== undefined &&
    (game.lossReason !== 'timeout' || game.status !== 'lost' || !game.sweep?.origin)
  )
    return false;
  if (game.scoring === undefined) {
    if (game.cardPoints !== undefined) return false;
  } else if (!['hard-v1', SCORING_VERSION, 'base-v1'].includes(game.scoring)) return false;
  else if (game.cardPoints === null) {
    if (
      !['hard-v1', SCORING_VERSION].includes(game.scoring) ||
      game.route.length ||
      game.zeroCards.length ||
      game.hintPending ||
      game.mistakePoints ||
      game.sweep?.origin ||
      game.status !== 'playing'
    )
      return false;
  } else if (!validCardPoints(game.deal, game.cardPoints, game.scoring === 'base-v1')) return false;
  else if (game.scoring === SCORING_VERSION && !Object.values(game.cardPoints).includes(3))
    return false;
  return game.status !== 'won' || isComplete(game.deal, game.route);
}

export function validCardPoints(deal, cardPoints, baseOnly = false) {
  return Boolean(
    cardPoints &&
    typeof cardPoints === 'object' &&
    !Array.isArray(cardPoints) &&
    Object.keys(cardPoints).length === deal.length &&
    deal.every(
      (code) =>
        Object.hasOwn(cardPoints, code) &&
        (cardPoints[code] === 1 || (!baseOnly && cardPoints[code] === 3)),
    ),
  );
}
