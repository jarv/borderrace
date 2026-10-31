import { EAST, WEST } from './src/data.js';

// Open shoreline runs from the supplied Simplemaps polygons. Indices refer to
// vertices in the largest subpath; counts guard against silently using a changed
// source map. Exclude inland/international borders and Florida's Gulf shoreline.
const SHORELINES = {
  CA: [69, 3, 46],
  OR: [48, 34, 47],
  WA: [68, 22, 67],
  ME: [42, 3, 20],
  NH: [26, 17, 21],
  MA: [46, 19, 41],
  RI: [13, 4, 9],
  CT: [21, 10, 15],
  NJ: [26, 14, 24],
  NY: [50, 11, 16],
  DE: [18, 3, 13],
  MD: [66, 24, 57],
  VA: [86, 17, 61],
  NC: [68, 25, 63],
  SC: [32, 10, 25],
  GA: [44, 26, 34],
  FL: [71, 42, 63],
};

export function statePolygons(d) {
  // This asset uses relative moveto/implicit lineto and closepath only. Refuse
  // other commands rather than approximate a new asset's curves incorrectly.
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g);
  const polygons = [];
  let x = 0;
  let y = 0;
  let start;
  let polygon;
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i++];
    if (token === 'm') {
      x += Number(tokens[i++]);
      y += Number(tokens[i++]);
      start = [x, y];
      polygon = [[x, y]];
      polygons.push(polygon);
    } else if (token === 'z') {
      [x, y] = start;
    } else if (/^[a-z]$/i.test(token)) {
      throw new Error(`Unsupported coastline command: ${token}`);
    } else {
      x += Number(token);
      y += Number(tokens[i++]);
      polygon.push([x, y]);
    }
  }
  return polygons;
}

function openPath(points) {
  return points
    .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`)
    .join(' ');
}

export function coastlinePaths(states) {
  return [...WEST, ...EAST]
    .map((code) => {
      const polygons = statePolygons(states[code]);
      const mainland = polygons.reduce((a, b) => (a.length > b.length ? a : b));
      const [count, from, to] = SHORELINES[code];
      if (mainland.length !== count) throw new Error(`Coastline source changed for ${code}`);
      const paths = [openPath(mainland.slice(from, to + 1))];
      // Long Island and Virginia's Eastern Shore are separate from their mainland.
      if (code === 'NY') paths.push(openPath(polygons[5]));
      if (code === 'VA') paths.push(openPath(polygons[8].slice(3, 10)));
      return `<path data-coast="${code}" d="${paths.join(' ')}"/>`;
    })
    .join('');
}
