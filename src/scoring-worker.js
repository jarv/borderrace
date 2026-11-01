import { prepareGoldDeal } from './prepare-deal.js';

self.onmessage = ({ data }) => {
  try {
    const deadline = performance.now() + 2000;
    const result = prepareGoldDeal(data.deal, {
      shouldStop: () => performance.now() >= deadline,
    });
    self.postMessage({
      gameId: data.gameId,
      deal: result.deal,
      cardPoints: result.complete ? result.cardPoints : null,
      winningRoutes: result.complete ? result.winningRoutes : undefined,
    });
  } catch {
    // Never award a rarity bonus using partial counts.
    self.postMessage({ gameId: data.gameId, cardPoints: null });
  }
};
