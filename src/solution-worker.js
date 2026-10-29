import { findLongestRoute } from './game.js';

self.onmessage = ({ data }) => {
  self.postMessage({ gameId: data.gameId, longest: findLongestRoute(data.deal) });
};
