export const SCORING_VERSION = 'hard-v3';
export const BASE_POINTS = 3;
export const BONUS_POINTS = 4;
export const HARD_CARD_PERCENT = 20;

export const isHardCard = (game, code) =>
  game.cardPoints?.[code] ===
  (game.scoring === SCORING_VERSION
    ? BONUS_POINTS
    : ['hard-v1', 'hard-v2'].includes(game.scoring)
      ? 3
      : -1);

// Versioned, fixed-for-the-deal scoring. Strictly below 20%, excluding unusable
// cards. BigInt comparisons avoid rounding at the threshold.
export function pointsFromCounts(deal, { complete, routes, byCard }) {
  if (!complete || typeof routes !== 'bigint' || routes <= 0n)
    throw new Error('Hard-card points require complete winning-route counts');
  return Object.fromEntries(
    deal.map((code) => {
      const count = byCard[code];
      if (typeof count !== 'bigint' || count < 0n || count > routes)
        throw new Error('Invalid participation count');
      return [
        code,
        count > 0n && count * 100n < BigInt(HARD_CARD_PERCENT) * routes
          ? BONUS_POINTS
          : BASE_POINTS,
      ];
    }),
  );
}
