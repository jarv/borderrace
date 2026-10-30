import { createDeal } from './game.js';
import { countWinningRoutes } from './route-count.js';
import { pointsFromCounts } from './scoring.js';

// Only accept complete, solvable analyses containing a genuinely usable gold
// card. Bound retries as well as worker time; never relax the rarity definition.
export function prepareGoldDeal(
  initialDeal,
  { nextDeal = () => createDeal(), shouldStop = () => false, maxAttempts = 128 } = {},
) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1)
    throw new Error('Invalid attempt limit');
  let deal = initialDeal;
  let visits = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!Array.isArray(deal) || deal.length !== 24) throw new Error('Expected a 24-card deal');
    if (shouldStop())
      return { complete: false, reason: 'time budget', attempts: attempt - 1, visits };
    const counts = countWinningRoutes(deal, { shouldStop });
    visits += counts.visits;
    if (!counts.complete)
      return { complete: false, reason: counts.reason, attempts: attempt, visits };
    const cardPoints = pointsFromCounts(deal, counts);
    if (Object.values(cardPoints).includes(3))
      return { complete: true, deal, cardPoints, attempts: attempt, visits };
    if (attempt < maxAttempts) deal = nextDeal();
  }
  return { complete: false, reason: 'attempt limit', attempts: maxAttempts, visits };
}
