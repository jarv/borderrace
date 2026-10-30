import { findMostPointsRoute } from './game.js';

self.onmessage = ({ data }) => {
  self.postMessage({
    gameId: data.gameId,
    mostPoints: findMostPointsRoute(data.deal, data.cardPoints, data.zeroCards),
  });
};
