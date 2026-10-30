import * as esbuild from 'esbuild';
import { readFile, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { STATES } from './src/data.js';
import { fingerprintAssets } from './build-assets.js';

const serve = process.argv.includes('--serve');
// Extract only known state paths, never scripts, inline styles, or event handlers.
async function makeMap() {
  const sourceMap = await readFile('assets/us.svg', 'utf8');
  const shapes = [...sourceMap.matchAll(/<path\b[^>]*>/g)].flatMap(([tag]) => {
    const code = tag.match(/\bid="([A-Z]{2})"/)?.[1];
    const d = tag.match(/\bd="([^"]*)"/)?.[1];
    if (!STATES[code] || !d) return [];
    return [`<g class="map-state" data-code="${code}"><path d="${d}"/></g>`];
  });
  if (shapes.length !== 48) throw new Error('Expected all 48 contiguous states');
  return `<svg viewBox="130 0 870 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of the contiguous United States"><!-- Map copyright 2017 Pareto Software, LLC DBA Simplemaps.com. https://simplemaps.com/resources/svg-license --><g id="state-shapes">${shapes.join('')}</g></svg>`;
}

// dist is generated only. A production build must not retain dev source maps.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const context = await esbuild.context({
  entryPoints: {
    app: 'src/main.js',
    'solution-worker': 'src/solution-worker.js',
    'scoring-worker': 'src/scoring-worker.js',
  },
  bundle: true,
  outdir: 'dist',
  entryNames: '[name]',
  format: 'esm',
  target: ['es2022'],
  minify: !serve,
  sourcemap: serve,
  metafile: true,
  plugins: [
    {
      name: 'border-map',
      setup(build) {
        build.onResolve({ filter: /^border-map$/ }, () => ({ path: 'map', namespace: 'map' }));
        build.onLoad({ filter: /.*/, namespace: 'map' }, async () => ({
          contents: await makeMap(),
          loader: 'text',
          watchFiles: ['assets/us.svg', 'src/index.html', 'src/favicon.svg', 'THIRD_PARTY.md'],
        }));
      },
    },
    {
      name: 'site-files',
      setup(build) {
        build.onStart(async () => {
          await copyFile('src/index.html', 'dist/index.html');
          await copyFile('src/favicon.svg', 'dist/favicon.svg');
          await copyFile('THIRD_PARTY.md', 'dist/THIRD_PARTY.md');
          const licenses = await Promise.all(
            [
              'motion/LICENSE.md',
              'framer-motion/LICENSE.md',
              'motion-dom/LICENSE.md',
              'motion-utils/LICENSE.md',
              'tslib/CopyrightNotice.txt',
              'tslib/LICENSE.txt',
            ].map(async (file) => `${file}\n\n${await readFile(`node_modules/${file}`, 'utf8')}`),
          );
          await writeFile('dist/LICENSES.txt', licenses.join('\n\n--------------------\n\n'));
        });
        build.onEnd(async (result) => {
          if (!result.errors.length) {
            if (!serve) await fingerprintAssets('dist');
            console.log(`Built ${Object.keys(result.metafile.outputs).length} assets → dist/`);
          }
        });
      },
    },
  ],
});
if (serve) {
  await context.watch();
  const server = await context.serve({
    servedir: 'dist',
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 4173),
  });
  console.log(`Border Race → http://${server.hosts[0]}:${server.port}`);
} else {
  try {
    await context.rebuild();
  } finally {
    await context.dispose();
  }
}
