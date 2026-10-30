export const SCORING_VERSION = 'hard-v2';
export const HARD_CARD_PERCENT = 20;

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
      return [code, count > 0n && count * 100n < BigInt(HARD_CARD_PERCENT) * routes ? 3 : 1];
    }),
  );
}
