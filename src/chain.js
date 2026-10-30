// Fit a gently zig-zagging route into the map area without horizontal scrolling.
export function layoutChain(route, width, height) {
  if (!width || !height || !route.length) return [];
  const gap = 4;
  const cardWidth = Math.max(44, Math.min(56, width * 0.078));
  const columns = Math.max(1, Math.floor((width - 8 + gap) / (cardWidth + gap)));
  const rows = Math.ceil(route.length / columns);
  const cellHeight = (height - 8 - gap * (rows - 1)) / rows;
  const offset = Math.min(6, Math.max(0, (cellHeight - 44) / 2));
  const cardHeight = Math.max(44, Math.min(cardWidth * 1.3, cellHeight - offset * 2));
  const rowHeight = cardHeight + offset * 2;
  const blockHeight = rows * rowHeight + (rows - 1) * gap;
  const top = Math.max(4, Math.min(height * 0.72 - rowHeight / 2, height - blockHeight - 4));
  return route.map((code, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      code,
      row,
      x: 4 + cardWidth / 2 + column * (cardWidth + gap),
      y: top + row * (rowHeight + gap) + cardHeight / 2 + (column % 2 ? offset * 2 : 0),
      width: cardWidth,
      height: cardHeight,
      angle: 0,
    };
  });
}
