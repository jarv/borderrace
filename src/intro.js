const formatCount = new Intl.NumberFormat('en-US');

export function introMessage(game) {
  const count = game.winningRoutes === undefined ? null : BigInt(game.winningRoutes);
  const routes = count === null ? '' : `There are ${formatCount.format(count)} winning routes. `;
  return `Select cards to cross the map using connecting states. ${routes}Start with a green coastal card. Gold cards are harder to use and worth 3 points.`;
}
