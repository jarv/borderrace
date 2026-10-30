import { countWinningRoutes } from './route-count.js';
import { pointsFromCounts } from './scoring.js';

self.onmessage = ({ data }) => {
  try {
    const deadline = performance.now() + 2000;
    const counts = countWinningRoutes(data.deal, {
      shouldStop: () => performance.now() >= deadline,
    });
    self.postMessage({ gameId: data.gameId, cardPoints: pointsFromCounts(data.deal, counts) });
  } catch {
    // Never award a rarity bonus using partial counts.
    self.postMessage({ gameId: data.gameId, cardPoints: null });
  }
};
