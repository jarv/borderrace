import { coast } from './data.js';

export const CROSSING_SECONDS = 90;
export const CARD_ACCELERATION = 0.08;
export const PENALTY_ACCELERATION = 0.35;
export const MAX_MULTIPLIER = 3;

export const newSweep = () => ({ origin: null, progress: 0, multiplier: 1 });

export function restoreSweep(game) {
  const sweep = game.sweep ?? newSweep();
  return !sweep.origin && game.route.length ? { ...sweep, origin: game.route[0] } : sweep;
}

export function accelerateSweep(sweep, amount) {
  return { ...sweep, multiplier: Math.min(MAX_MULTIPLIER, sweep.multiplier + amount) };
}

export function advanceSweep(sweep, seconds) {
  if (!sweep.origin || seconds <= 0 || !Number.isFinite(seconds)) return sweep;
  return {
    ...sweep,
    progress: Math.min(1, sweep.progress + (seconds * sweep.multiplier) / CROSSING_SECONDS),
  };
}

export function validSweep(sweep, deal) {
  return Boolean(
    sweep &&
    typeof sweep === 'object' &&
    !Array.isArray(sweep) &&
    (sweep.origin === null || (deal.includes(sweep.origin) && coast(sweep.origin))) &&
    Number.isFinite(sweep.progress) &&
    sweep.progress >= 0 &&
    sweep.progress <= 1 &&
    Number.isFinite(sweep.multiplier) &&
    sweep.multiplier >= 1 &&
    sweep.multiplier <= MAX_MULTIPLIER &&
    (sweep.origin !== null || sweep.progress === 0),
  );
}

// Bounds are normalized to the whole map panel, not the outline of the US.
// Keep chasing the original coastal state if the player removes the entire route.
export function sweepFrontier(sweep, route, bounds) {
  const eastward = coast(sweep.origin) === 'west';
  let furthest = null;
  for (const code of route.length ? route : [sweep.origin]) {
    const rect = bounds.get(code);
    if (!rect) continue;
    const near = eastward ? rect.left : 1 - rect.right;
    const far = eastward ? rect.right : 1 - rect.left;
    if (!furthest || far > furthest.far) furthest = { code, near, far };
  }
  return furthest;
}
