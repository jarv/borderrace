const formatCount = new Intl.NumberFormat('en-US');

export function introMessage(game) {
  const count = game.winningRoutes === undefined ? null : BigInt(game.winningRoutes);
  let routes = '';
  if (count !== null) {
    if (count < 10n)
      routes = `There ${count === 1n ? 'is' : 'are'} ${count} winning route${count === 1n ? '' : 's'}. `;
    else {
      // One significant digit, strictly below the exact count (including round numbers).
      const below = count - 1n;
      const magnitude = 10n ** BigInt(below.toString().length - 1);
      const minimum = (below / magnitude) * magnitude;
      routes = `There are more than ${formatCount.format(minimum)} winning routes. `;
    }
  }
  return `Select cards to cross the map using connecting states. ${routes}Start with a green coastal card. Gold cards are harder to use and worth 3 points.`;
}
