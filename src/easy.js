import { CODES, STATES, EAST, WEST, coast } from './data.js';

export const isEasy = (game) => game.difficulty === 'easy';
export const difficultyOf = (game) => (isEasy(game) ? 'easy' : 'challenging');

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Reachability, not a longest-path search: each offered neighbor must still win.
export function easyCandidates(route) {
  if (!route.length) return [...EAST, ...WEST];
  const target = coast(route[0]) === 'east' ? WEST : EAST;
  if (target.includes(route.at(-1))) return [];
  return STATES[route.at(-1)].neighbors.filter((code) => {
    if (route.includes(code)) return false;
    const seen = new Set([...route, code]);
    const queue = [code];
    for (let i = 0; i < queue.length; i++) {
      if (target.includes(queue[i])) return true;
      for (const next of STATES[queue[i]].neighbors) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  });
}

export function easyHand(route, random = Math.random) {
  if (!route.length) {
    const west = shuffle(WEST, random);
    const east = shuffle(EAST, random);
    return shuffle(
      [west[0], east[0], ...shuffle([...west.slice(1), ...east.slice(1)], random).slice(0, 2)],
      random,
    );
  }
  const valid = shuffle(easyCandidates(route), random).slice(0, 2);
  if (!valid.length) return [];
  const neighbors = STATES[route.at(-1)].neighbors;
  const invalid = CODES.filter((code) => !route.includes(code) && !neighbors.includes(code));
  // Extremely long routes may exhaust unused distractors. Played non-neighbors
  // remain invalid choices; only map-chain buttons perform undo in Easy.
  const fallback = route.filter((code) => !neighbors.includes(code));
  return shuffle(
    [
      ...valid,
      ...shuffle(invalid, random)
        .concat(shuffle(fallback, random))
        .slice(0, 4 - valid.length),
    ],
    random,
  );
}

export function validEasyHand(route, hand) {
  if (!Array.isArray(hand)) return false;
  const candidates = easyCandidates(route);
  if (!candidates.length)
    return (
      hand.length === 0 && Boolean(coast(route.at(-1))) && coast(route.at(-1)) !== coast(route[0])
    );
  if (hand.length !== 4 || new Set(hand).size !== 4 || !hand.every((code) => STATES[code]))
    return false;
  if (!route.length)
    return (
      hand.every(coast) &&
      hand.some((code) => WEST.includes(code)) &&
      hand.some((code) => EAST.includes(code))
    );
  return (
    hand.filter((code) => candidates.includes(code)).length === Math.min(2, candidates.length) &&
    hand.every(
      (code) => candidates.includes(code) || !STATES[route.at(-1)].neighbors.includes(code),
    )
  );
}
