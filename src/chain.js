export function routeAnchors(route, centers) {
  return route.map((code) => centers[code]);
}

// Nudge crowded cards into a little fan, without detaching them from geography.
// Work in screen pixels so the same layout keeps phone cards touch-sized.
export function layoutChain(route, centers, width, height) {
  if (!width || !height) return [];
  const cardWidth = Math.max(44, Math.min(56, width * 0.078));
  const cardHeight = cardWidth * 1.3;
  const placed = [];
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  return routeAnchors(route, centers).map(([anchorX, anchorY], index) => {
    const x = (anchorX / 1000) * width;
    const y = (anchorY / 610) * height;
    const choices = [
      [0, 0],
      [0, -0.65],
      [0, 0.65],
      [-0.6, -0.55],
      [0.6, 0.55],
      [0.6, -0.55],
      [-0.6, 0.55],
      [0, -1],
      [0, 1],
    ];
    const options = choices.map(([dx, dy]) => {
      const cx = clamp(x + dx * cardWidth, cardWidth / 2 + 4, width - cardWidth / 2 - 4);
      const cy = clamp(y + dy * cardHeight, cardHeight / 2 + 4, height - cardHeight / 2 - 4);
      const overlaps = placed.reduce(
        (total, p) =>
          total +
          Math.max(0, 1 - Math.abs(p.x - cx) / (cardWidth * 0.82)) *
            Math.max(0, 1 - Math.abs(p.y - cy) / (cardHeight * 0.8)),
        0,
      );
      return { x: cx, y: cy, cost: overlaps * 100 + Math.hypot(dx, dy) * 8 };
    });
    const point = options.sort((a, b) => a.cost - b.cost)[0];
    placed.push(point);
    return {
      code: route[index],
      ...point,
      width: cardWidth,
      height: cardHeight,
      angle: [-8, 5, -4, 8, -3][index % 5],
    };
  });
}
