// A left-to-right route row, independent of state geography. Long rows scroll.
export function layoutChain(route, width, height) {
  if (!width || !height) return [];
  const cardWidth = Math.max(44, Math.min(56, width * 0.078));
  const cardHeight = cardWidth * 1.3;
  const y = Math.max(cardHeight / 2 + 6, Math.min(height * 0.72, height - cardHeight / 2 - 6));
  return route.map((code, index) => ({
    code,
    x: 6 + cardWidth / 2 + index * (cardWidth + 8),
    y,
    width: cardWidth,
    height: cardHeight,
    angle: 0,
  }));
}
