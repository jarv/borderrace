import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EAST, WEST } from '../src/data.js';
import { coastlinePaths, statePolygons } from '../map-coasts.js';

const source = await readFile(new URL('../assets/us.svg', import.meta.url), 'utf8');
const states = Object.fromEntries(
  [...source.matchAll(/<path\b[^>]*>/g)].flatMap(([tag]) => {
    const code = tag.match(/\bid="([A-Z]{2})"/)?.[1];
    const d = tag.match(/\bd="([^"]*)"/)?.[1];
    return code && d ? [[code, d]] : [];
  }),
);

test('coastline geometry follows only the 17 playable coastal states', () => {
  const paths = [...coastlinePaths(states).matchAll(/data-coast="([A-Z]{2})" d="([^"]*)"/g)];
  assert.deepEqual(
    paths.map((match) => match[1]),
    [...WEST, ...EAST],
  );
  for (const [, code, d] of paths) {
    assert.ok(!/[zZ]/.test(d), `${code} shoreline must not close across inland borders`);
    const vertices = statePolygons(states[code]).flat();
    for (const [, x, y] of d.matchAll(/[ML]([\d.]+),([\d.]+)/g))
      assert.ok(
        vertices.some(
          ([vx, vy]) => Math.abs(vx - Number(x)) < 0.001 && Math.abs(vy - Number(y)) < 0.001,
        ),
        `${code} uses the supplied map's actual shoreline vertices`,
      );
  }
  const path = (code) => paths.find((match) => match[1] === code)[2];
  const coords = (code) =>
    [...path(code).matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
  assert.ok(
    coords('WA').every(([x]) => x < 230),
    'no Washington/Canada or Idaho border',
  );
  assert.ok(
    coords('CA').every(([x]) => x < 240),
    'no California/Mexico or Arizona border',
  );
  assert.ok(
    coords('ME').every(([, y]) => y >= 63),
    'no Maine/Canada border',
  );
  assert.ok(
    coords('FL').every(([x]) => x > 844),
    'no Florida panhandle/Gulf shoreline',
  );
});

test('coastline extraction handles relative subpaths and rejects changed source geometry', () => {
  assert.deepEqual(statePolygons('m 10,20 2,0 0,3 z m 5,5 1,1 z'), [
    [
      [10, 20],
      [12, 20],
      [12, 23],
    ],
    [
      [15, 25],
      [16, 26],
    ],
  ]);
  assert.throws(() => statePolygons('M 0,0 L 1,1'), /Unsupported/);
  assert.throws(() => coastlinePaths({ ...states, CA: 'm 1,1 2,2 z' }), /source changed for CA/);
});
